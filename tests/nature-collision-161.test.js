import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {ROYALE_MAP} from '../src/royale-map.js';
import {detailEnvironmentProp} from '../src/environment-props.js';
import {authoredBoxes,applyBuildState,resetBuilding,damageObject} from '../src/building.js';
import {worldHit,wallDistance,canStand,movePlayer,RADIUS} from '../src/physics.js';
import {baseObjects,sourceRecord,compileLayout,emptyLayout} from '../src/map-layout.js';
import {resetStance} from '../src/stance.js';
import {environmentCollision,rayShape,shapeNormal,shapeOverlap,shapeAxisInterval,shapeVerticalInterval,collisionBounds,transformCollisionShape} from '../src/environment-collision.js';

// Use authored props and the real visual factory: these tests catch invisible
// cover rather than agreeing with a second copy of the collider formula.
function isolated(kind,predicate=()=>true){
 const index=ROYALE_MAP.props.findIndex(p=>p.kind===kind&&predicate(p));
 assert.ok(index>=0,'authored '+kind+' fixture');
 const prop=ROYALE_MAP.props[index],box=ROYALE_MAP.boxes.find(b=>b.prop===index);
 assert.ok(box,'authored collider owner');
 const map={id:'nature-fixture',theme:'royale',size:600,boxes:[{...box,prop:0}],props:[prop],trees:[],buildings:[],doors:[],spawns:[[-8,0],[8,0]],chests:[],floorLoot:[]};
 map.boxes=authoredBoxes(map);
 return {prop,box:map.boxes[0],map,index};
}
function visualDistance(prop,origin,direction,max=20){
 const group=new T.Group();assert.equal(detailEnvironmentProp(group,prop,{},true),true);group.updateMatrixWorld(true);
 return new T.Raycaster(new T.Vector3(origin.x,origin.y,origin.z),new T.Vector3(direction.x,direction.y,direction.z),0,max).intersectObject(group,true)[0]?.distance??Infinity;
}
function person(at){
 const p={health:100,inventory:[{id:'pickaxe',pickaxe:true}],slot:0,flight:'ground',grounded:true,x:0,y:0,z:0,yaw:0,pitch:0,vy:0,vx:0,vz:0,...at};resetStance(p);return p;
}

test('rounded boulder empty upper corners do not stop shots or sight lines',()=>{
 const {prop:p,map}=isolated('rock',p=>p.w>=3&&p.d>=2.8),origin={x:p.x+p.w*.44,y:p.y+p.h*.87,z:p.z-p.d-2},direction={x:0,y:0,z:1},range=p.d*2+4;
 assert.equal(visualDistance(p,origin,direction,range),Infinity,'fixture visibly clears the boulder');
 assert.equal(worldHit(map,origin,direction,range),null,'bullets pass the empty corner');
 assert.equal(wallDistance(map,origin,direction,range),range,'bots see through the same empty corner');
});

test('boulder contacts follow the rounded surface and retain their destruction owner',()=>{
 const {prop:p,map,box}=isolated('rock',p=>p.w>=3&&p.d>=2.8),origin={x:p.x,y:p.y+p.h*.87,z:p.z-p.d-2},direction={x:0,y:0,z:1},visible=visualDistance(p,origin,direction),hit=worldHit(map,origin,direction,20);
 assert.ok(Number.isFinite(visible));assert.ok(hit?.box);
 assert.equal(hit.box.objectId,box.objectId);
 assert.ok(Math.abs(hit.distance-visible)<.23,'contact must not float far ahead of the visible upper slope');
 assert.ok(hit.normal.y>.25,'sloped rock contacts provide a sloped normal');
 assert.ok(Math.abs(Math.hypot(hit.normal.x,hit.normal.y,hit.normal.z)-1)<1e-6);
});

test('walking and guest prediction can pass a boulder bounding-box corner',()=>{
 const {prop:p,map}=isolated('rock',p=>p.w>=3&&p.d>=2.8),at={x:p.x+p.w*.5+RADIUS*.55,y:p.y,z:p.z+p.d*.5+RADIUS*.55};
 assert.equal(canStand(map,at),true,'empty rectangular corner is walkable');
 const a=person(at),b=structuredClone(a),input={yaw:-Math.PI/2,forward:1};
 for(let i=0;i<12;i++){movePlayer(a,input,map,1/60,i/60);movePlayer(b,input,map,1/60,i/60);}
 assert.ok(a.x>at.x+.35,'a nearby empty corner does not clamp horizontal motion');
 assert.deepEqual(a,b,'shared guest and authority solver remains deterministic');
});

test('sparse bush foliage is traversable and does not act as invisible bulletproof cover',()=>{
 const {prop:p,map}=isolated('bush'),at={x:p.x,y:p.y,z:p.z};
 assert.equal(canStand(map,at),true);
 const origin={x:p.x,y:p.y+p.h*.55,z:p.z-p.d-2},direction={x:0,y:0,z:1},range=p.d*2+4;
 assert.equal(worldHit(map,origin,direction,range),null);
});

test('lamp collision follows its thin lower stem rather than its whole light envelope',()=>{
 const {prop:p,map}=isolated('lamp',p=>p.w>1),at={x:p.x+p.w*.4,y:p.y,z:p.z},origin={x:at.x,y:p.y+p.h*.48,z:p.z-p.d-2},direction={x:0,y:0,z:1},range=p.d*2+4;
 assert.equal(visualDistance(p,origin,direction,range),Infinity,'fixture clears stem and lantern');
 assert.equal(worldHit(map,origin,direction,range),null);
 assert.equal(canStand(map,at),true,'player can walk beside the pole');
 const center=worldHit(map,{...origin,x:p.x},direction,range);assert.ok(center?.box,'pole itself still stops a bullet');
});

test('tree trunks stay solid while their distant crown envelope stays navigable',()=>{
 for(const kind of ['oak','pine','palm','autumn','orchard']){
  const index=ROYALE_MAP.trees.findIndex(t=>t.kind===kind),tree=ROYALE_MAP.trees[index],source=ROYALE_MAP.boxes.find(b=>b.tree===index);
  assert.ok(tree&&source,kind);
  const map={id:'tree-fixture',theme:'royale',size:600,props:[],trees:[tree],boxes:[{...source,tree:0}]};map.boxes=authoredBoxes(map);
  const hit=worldHit(map,{x:tree.x,y:tree.y+.55,z:tree.z-3},{x:0,y:0,z:1},6);
  assert.equal(hit?.box.objectId,source.objectId,kind+' trunk');
  assert.equal(canStand(map,{x:tree.x,y:tree.y,z:tree.z}),false,kind+' solid trunk');
  assert.equal(canStand(map,{x:tree.x+1.3,y:tree.y,z:tree.z+1.3}),true,kind+' walkable beneath crown');
 }
});

test('nature shape ownership survives destruction snapshots and editor transforms without extra world records',()=>{
 const {map,box,index}=isolated('rock',p=>p.w>=3&&p.d>=2.8),sim={map,players:new Map(),time:0,emit(){}};
 resetBuilding(sim);assert.equal(sim.worldBoxes.length,1,'one broadphase/harvest record per object');
 damageObject(sim,sim.worldBoxes[0],1e6);
 assert.equal(sim.worldDamage[box.objectId].destroyed,true);assert.equal(sim.map.boxes.length,0);
 const guest={...map,authored:sim.worldBoxes,boxes:[...sim.worldBoxes]};
 applyBuildState(guest,{matchId:'nature',round:1,buildVersion:1,builds:[],worldDamage:sim.worldDamage,doors:{}});
 assert.equal(guest.boxes.length,0,'guest removes the same owner on destruction');
 const source=baseObjects(ROYALE_MAP).find(s=>s.id==='prop-'+index),record={...sourceRecord(source),position:[12,20,-8],rotation:90,scale:[1.5,1.2,.8]},compiled=compileLayout(ROYALE_MAP,{...emptyLayout('sunnybreak'),objects:[record]}),edited=compiled.boxes.filter(b=>b.editorObject===record.id);
 assert.equal(edited.length,1,'editor preserves one stable object record');assert.equal(edited[0].objectId,source.boxes[0].objectId);
 const only={...compiled,terrain:undefined,boxes:edited},b=edited[0];
 assert.equal(worldHit(only,{x:b.x+b.w*.44,y:b.y+b.h*.87,z:b.z-b.d-2},{x:0,y:0,z:1},b.d*2+4),null,'rotated and scaled rounded shape keeps empty corners');
});

test('analytic rays distinguish empty corners, genuine surfaces and swept projectile radii',()=>{
 const ball={kind:'ellipsoid',x:0,y:0,z:0,w:2,h:2,d:2};
 assert.equal(rayShape({x:.9,y:1.8,z:-3},{x:0,y:0,z:1},ball,6),Infinity);
 const t=rayShape({x:0,y:1.8,z:-3},{x:0,y:0,z:1},ball,6);assert.ok(Math.abs(t-2.4)<1e-9);
 const normal=shapeNormal(ball,{x:0,y:1.8,z:-.6});assert.ok(Math.abs(normal.y-.8)<1e-9&&Math.abs(normal.z+.6)<1e-9);
 const near={x:1.1,y:1,z:-3},direction={x:0,y:0,z:1};assert.equal(rayShape(near,direction,ball,6),Infinity);assert.ok(Number.isFinite(rayShape(near,direction,ball,6,.2)));
 const elongated={...ball,w:6,d:1.4},q=Math.SQRT1_2,nx=q/3,nz=q/.7,nlen=Math.hypot(nx,nz),shoulder={x:3*q+nx/nlen*.199,y:1,z:.7*q+nz/nlen*.199};
 assert.equal(rayShape(shoulder,{x:0,y:1,z:0},elongated,2,.2),0,'swept sphere cannot miss an elongated shoulder');
 assert.equal(rayShape({x:0,y:1,z:0},direction,ball,6),0,'starting inside does not tunnel');
 const cylinder={kind:'cylinder',x:0,y:0,z:0,w:2,h:2,d:1};
 assert.equal(rayShape({x:.1,y:4,z:.1},{x:0,y:-1,z:0},cylinder,6),2);
 assert.deepEqual(shapeNormal(cylinder,{x:.1,y:2,z:.1}),{x:0,y:1,z:0});
});

test('rounded support follows real curvature and cannot create a flat invisible rock roof',()=>{
 const ball={kind:'ellipsoid',x:0,y:0,z:0,w:2,h:2,d:2},support=shapeVerticalInterval(ball,.75,0);
 assert.ok(Math.abs(support.max-(1+Math.sqrt(1-.75**2)))<1e-9);
 assert.equal(shapeVerticalInterval(ball,.9,.9),null);
 assert.equal(shapeOverlap(ball,{x:.9,y:1.7,z:0},.5,0),false);
 assert.equal(shapeOverlap(ball,{x:0,y:1.7,z:0},.5,0),true);
 assert.ok(shapeVerticalInterval(ball,.75,0,.32).max>support.max,'player footprint can be supported by the nearer higher surface');
});

test('OBB leaf rays, movement and support agree while its enclosing box stays broadphase only',()=>{
 const leaf={kind:'obb',x:0,y:0,z:0,w:4,h:3,d:.35,yaw:Math.PI/4},b=collisionBounds(leaf);
 assert.ok(b.w>2.8&&b.d>2.8);
 const clear={x:1.3,y:0,z:1.1};assert.equal(shapeOverlap(leaf,clear,1.85,.32),false);assert.equal(shapeVerticalInterval(leaf,clear.x,clear.z,.32),null);
 assert.equal(shapeOverlap(leaf,{x:1,y:0,z:-1},1.85,.32),true);
 const t=rayShape({x:0,y:1,z:-3},{x:0,y:0,z:1},leaf,6),point={x:0,y:1,z:-3+t},n=shapeNormal(leaf,point);
 assert.ok(Math.abs(t-(3-.35/(2*Math.cos(Math.PI/4))))<1e-9);assert.ok(n.z<-.7&&n.x<-.7);
 assert.deepEqual(shapeVerticalInterval(leaf,1,-1,.32),{min:0,max:3});
});

test('movement axis limits agree with body overlap for all analytic shape kinds',()=>{
 const shapes=[{kind:'box',x:1,y:0,z:-1,w:3,h:2,d:1.2},{kind:'ellipsoid',x:1,y:0,z:-1,w:3,h:2,d:1.2},{kind:'cylinder',x:1,y:0,z:-1,w:3,h:2,d:1.2},{kind:'obb',x:1,y:0,z:-1,w:3,h:2,d:.35,yaw:.71}];
 for(const s of shapes)for(const axis of ['x','z'])for(let i=0;i<120;i++){
  const p={x:-1+(i%12)*.37,y:.1+(i%4)*.31,z:-3+Math.floor(i/12)*.41},hit=shapeAxisInterval(s,axis,p,.55,.32),inside=!!hit&&p[axis]>hit.min&&p[axis]<hit.max;
  assert.equal(inside,shapeOverlap(s,p,.55,.32),s.kind+' '+axis+' '+JSON.stringify(p));
 }
 const parts={kind:'parts',parts:[{kind:'cylinder',x:-2,y:0,z:0,w:1,h:2,d:1},{kind:'cylinder',x:2,y:0,z:0,w:1,h:2,d:1}]};
 assert.equal(shapeAxisInterval(parts,'x',{x:0,y:0,z:0},1.85,.32),null,'separated solids retain their walking gap');
});

test('descriptor authoring and quarter-turn transforms preserve original object ownership',()=>{
 for(const kind of ['rock','bush','crop','lamp','bollard','barrels','shield-barrel','tank','silo']){
  const prop={kind,x:4,y:2,z:-3,w:3,h:4,d:2},box={...prop,kind:'prop',prop:0,objectId:'owner'},before=JSON.stringify(box),s=environmentCollision(box,{props:[prop]});
  assert.equal(JSON.stringify(box),before);assert.ok(s,kind);
  for(const rotation of [0,90,180,270]){
   const edit={position:[8,5,-7],rotation,scale:[1.5,1.2,.8]},moved=transformCollisionShape(s,[4,2,-3],edit);
   if(s.kind==='none'){assert.deepEqual(moved,{kind:'none'});continue;}
   const bounds=collisionBounds(moved);assert.ok(Object.values(bounds).every(Number.isFinite),kind);
   if(s.kind==='ellipsoid'){assert.equal(moved.x,8);assert.equal(moved.y,5);assert.equal(moved.z,-7);assert.ok(Math.abs(moved.w-(rotation%180?s.d*.8:s.w*1.5))<1e-9);}
  }
 }
});
