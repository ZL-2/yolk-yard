import test from 'node:test';
import assert from 'node:assert/strict';
import {pieceBoxes,validEdit,WALL_PATTERNS,STAIR_PATHS,editRay,editPlanePoint} from '../src/building-shapes.js';
import {MATERIALS,harvestDefinition,snappedFacing,canEdit} from '../src/building-rules.js';
import {placement,buildingTick,rebuildMap,editBuilding,damageObject,constructionTick,applyBuildState,toggleDoor} from '../src/building.js';
import {direction,canStand,wallDistance,movePlayer} from '../src/physics.js';
const piece=(type='wall',extra={})=>({id:'build-1',type,material:'wood',owner:'a',x:0,y:0,z:-4,rotation:0,mask:0,health:90,maxHealth:150,created:0,revision:0,...extra});
function fixture(){const p={id:'a',x:0,y:0,z:0,yaw:0,pitch:0,health:100,flight:'ground',materials:{wood:200,brick:200,metal:200}};const s={map:{size:256,boxes:[]},worldBoxes:[],worldDamage:{},builds:[],buildVersion:0,buildId:0,time:0,players:new Map([['a',p]]),options:{mode:'royale'},loot:[],chests:[],events:[],emit(type,event){this.events.push({type,...event});}};return {s,p};}
const command=(b,extra={})=>'build-change:'+JSON.stringify({id:b.id,revision:b.revision||0,mask:b.mask,path:b.path||[],...extra});
test('all registered wall patterns and every rotated/mirrored stair gesture produce nonempty real solids',()=>{
 for(const mask of WALL_PATTERNS)for(let rotation=0;rotation<4;rotation++){const b=piece('wall',{mask,rotation});assert.ok(validEdit(b));assert.ok(pieceBoxes(b).length);}
 for(const path of STAIR_PATHS)for(let rotation=0;rotation<4;rotation++){const b=piece('stairs',{path,rotation});assert.ok(validEdit(b));assert.ok(pieceBoxes(b).length);}
 for(const type of ['floor','roof'])for(let mask=0;mask<15;mask++){assert.ok(validEdit(piece(type,{mask})));assert.ok(pieceBoxes(piece(type,{mask})).length);}
 for(const type of ['wall','floor','roof','stairs']){assert.equal(validEdit(piece(type,{mask:511})),false);assert.equal(validEdit(piece(type,{mask:-1})),false);}
 assert.equal(validEdit(piece('wall',{mask:1})),false);assert.equal(validEdit(piece('stairs',{path:[0,4,8]})),false);
});
test('crosshair grid projection stays in build space for every piece and all four rotations',()=>{
 for(const type of ['wall','floor','stairs','roof'])for(let rotation=0;rotation<4;rotation++){
  const b=piece(type,{rotation}),target=editPlanePoint(b,.2,.2),o=type==='wall'?editPlanePoint(b,.2,.2):{...target,y:target.y+3};
  if(type==='wall'){const d=direction(rotation*Math.PI/2);o.x-=d.x*3;o.z-=d.z*3;}
  const len=Math.hypot(target.x-o.x,target.y-o.y,target.z-o.z),d={x:(target.x-o.x)/len,y:(target.y-o.y)/len,z:(target.z-o.z)/len};
  const hit=editRay(b,o,d);assert.ok(hit,`${type}/${rotation}`);assert.equal(hit.cell,0);
 }
});
test('ramps ascend away from camera and deliberate offsets survive material changes',()=>{
 for(let facing=0;facing<4;facing++)for(const pitch of [-1.4,0,1.4]){
  const p={x:0,y:0,z:0,yaw:facing*Math.PI/2,pitch};const a=placement(p,'stairs',0),d=direction(p.yaw,0),boxes=pieceBoxes(a),low=boxes[0],high=boxes.at(-1);
  assert.ok((high.x-low.x)*d.x+(high.z-low.z)*d.z>3.5);assert.ok(high.y>low.y);
  assert.equal(placement(p,'stairs',1).rotation,(facing+1)%4);assert.equal(placement(p,'stairs',1,'metal').rotation,(facing+1)%4);
 }
 assert.equal(snappedFacing(Math.PI/4+.02,0),0);assert.equal(snappedFacing(Math.PI/4+.09,0),1);
});
test('edits enforce permission, legality, revision, sight; doors are solid until opened; reset cannot heal',()=>{
 const {s,p}=fixture(),b=piece();s.builds=[b];rebuildMap(s);const old=JSON.stringify(b);
 assert.equal(editBuilding(s,{...p,id:'enemy'},command(b,{mask:18})),false);assert.equal(editBuilding(s,p,command(b,{mask:1})),false);assert.equal(JSON.stringify(b),old);
 assert.equal(editBuilding(s,p,command(b,{mask:18})),true);assert.equal(b.health,90);
 assert.ok(wallDistance(s.map,{x:0,y:1,z:0},{x:0,y:0,z:-1},8)<8);
 p.z=-2;assert.equal(toggleDoor(s,p),true);assert.equal(wallDistance(s.map,{x:0,y:1,z:0},{x:0,y:0,z:-1},8),8);assert.ok(canStand(s.map,{...p,z:-4}));
 assert.equal(editBuilding(s,p,command(b,{mask:0,revision:0})),false);
 assert.equal(editBuilding(s,p,command(b,{mask:0})),true);assert.equal(b.health,90);assert.equal(b.material,'wood');assert.equal(b.owner,'a');
 s.worldBoxes=[{objectId:'block',x:0,y:0,z:-3,w:4,h:4,d:.3,material:'brick'}];rebuildMap(s);assert.equal(editBuilding(s,p,command(b,{mask:16})),false);
 assert.equal(canEdit({...b,team:0,teamMode:true},{id:'friend',team:0}),true);assert.equal(canEdit({...b,team:0,teamMode:false},{id:'foe',team:0}),false);
});
test('host and snapshot collision agree for windows, floors, stairs, cone edits and open doors',()=>{
 const {s}=fixture(),map={size:256,boxes:[]};
 for(const b of [piece('wall',{mask:16}),piece('wall',{mask:18,doorOpen:true}),piece('floor',{mask:3}),piece('stairs',{path:[6,3,0,1,2]}),piece('roof',{mask:3})]){
  s.builds=[b];rebuildMap(s);applyBuildState(map,{matchId:'m',round:1,builds:[b],worldDamage:{}});assert.deepEqual(map.boxes,s.map.boxes);
 }
 const window=piece('wall',{mask:16});s.builds=[window];rebuildMap(s);assert.equal(wallDistance(s.map,{x:0,y:2,z:0},{x:0,y:0,z:-1},8),8);assert.ok(wallDistance(s.map,{x:1.6,y:2,z:0},{x:0,y:0,z:-1},8)<8);
});
test('construction ticks finish, preserve damage debt and cannot gain health from repeated edits',()=>{
 for(const material of Object.keys(MATERIALS)){
  const {s,p}=fixture();buildingTick(s,p,{buildMode:true,buildType:'wall',buildMaterial:material,fire:true});const b=s.builds[0];assert.equal(b.health,MATERIALS[material].start);
  for(s.time=.5;s.time<=30;s.time+=.5)constructionTick(s);assert.equal(b.health,b.maxHealth);assert.equal(b.constructionRemaining,0);
  b.health-=30;const hp=b.health;for(let i=0;i<10;i++){assert.ok(editBuilding(s,p,command(b,{mask:i%2?0:16})));assert.equal(b.health,hp);}
  constructionTick(s);assert.equal(b.health,hp);
 }
 const {s,p}=fixture();buildingTick(s,p,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});damageObject(s,s.map.boxes[0],20);s.time=10;constructionTick(s);assert.equal(s.builds[0].health,130);
});
test('object budgets vary, cap total payouts, exclude destroyed objects and player builds',()=>{
 const yields=[];
 for(const [kind,material]of [['woodWall','wood'],['stoneWall','brick'],['metalWall','metal']]){
  const {s,p}=fixture(),box={objectId:'obj',x:0,y:0,z:-3,w:5,h:6,d:1,material,harvestType:kind};s.worldBoxes=[box];rebuildMap(s);const def=harvestDefinition(box,s.map);yields.push(def.resources/def.health);p.materials[material]=0;
  for(let i=0;i<30;i++)damageObject(s,box,50,p);assert.equal(p.materials[material],def.resources);damageObject(s,box,100,p);assert.equal(p.materials[material],def.resources);
  s.builds=[piece('wall',{material})];rebuildMap(s);const bank=p.materials[material],stale=s.map.boxes.find(b=>b.buildId);damageObject(s,stale,1000,p);damageObject(s,stale,1000,p);assert.equal(p.materials[material],bank);
 }
 assert.ok(yields[0]>yields[1]&&yields[1]>yields[2]);
});

test('repair spends material progressively rather than healing instantly',()=>{
 const {s,p}=fixture(),b=piece('wall',{health:50,constructionRemaining:0,constructionTick:.5});s.builds=[b];rebuildMap(s);
 const bank=p.materials.wood;assert.ok(editBuilding(s,p,'build-repair'));assert.equal(b.health,50);assert.ok(p.materials.wood<bank);assert.equal(editBuilding(s,p,'build-repair'),false);
 for(s.time=.5;s.time<10;s.time+=.5)constructionTick(s);assert.equal(b.health,150);
});

test('drag selection visits each tile once, cancel leaves source untouched, release confirms only when enabled',async()=>{
 const {BuildingUI}=await import('../src/building-ui.js');
 const source=piece(),ui=Object.create(BuildingUI.prototype);ui.edit={...source};ui.controls={};ui.renderEdit=()=>{};let confirms=0;ui.action=action=>{if(action==='confirm')confirms++;};
 const pose=y=>({x:0,y:0,z:0,yaw:0,pitch:Math.atan2(y-1.43,4)});
 for(let i=0;i<20;i++)ui.sample(pose(2),true,false);assert.equal(ui.edit.mask,16);assert.equal(source.mask,0);
 ui.sample(pose(.65),true,false);assert.equal(ui.edit.mask,18);ui.sample(pose(.65),false,false);assert.equal(confirms,0);
 ui.sample(pose(2),true,true);ui.sample(pose(2),false,true);assert.equal(confirms,1);
 ui.edit=piece('stairs');ui.down=false;
 // Center-lane bottom-to-top gesture is a full forward ramp, not removed squares.
 for(const [y,z]of [[2/3,-8/3],[2,-4],[10/3,-16/3]])ui.sample({x:0,y:0,z:0,yaw:0,pitch:Math.atan2(y-1.43,-z)},true,false);
 assert.deepEqual(ui.edit.path,[7,4,1]);assert.equal(ui.edit.mask,0);
});
