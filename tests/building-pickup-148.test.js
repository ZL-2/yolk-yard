import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {inventory,buildingTick,rebuildMap,editBuilding,validPlacement,solvePlacement} from '../src/building.js';
import {canStand,movePlayer,wallDistance} from '../src/physics.js';
import {predictionCopy,predictMovement} from '../src/guest-movement.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
import {SHADOWSTEP,startShadowstep,shadowRechargeState} from '../src/shadowstep.js';

function room(){
 const s=new RoyaleSimulation({bots:0,capacity:2,fill:false}),p=s.addPlayer('builder',{name:'Builder'}),other=s.addPlayer('other',{name:'Other'});
 s.phase='playing';s.stage='active';s.time=10;s.map={id:'flat',theme:'royale',size:256,boxes:[],floorLoot:[],landmarks:[],districts:[]};s.worldBoxes=[];s.worldDamage={};s.builds=[];s.loot=[];s.chests=[];s.relays=[];s.smokes=[];s.storm={active:false};
 for(const q of [p,other])Object.assign(q,{x:0,y:0,z:0,yaw:0,pitch:0,health:100,shield:0,grounded:true,flight:'ground',vy:0,spectating:false,contestant:true,slot:1,inventory:inventory(),bank:{light:0,medium:100,shells:0,heavy:0,rockets:0},materials:{wood:100,brick:100,metal:100},lastDamage:-100,phasedBuilds:[]});
 p.inventory[1]={id:'sprinter',weapon:true,count:1,rarity:1,ammo:30};other.x=40;s.syncInventory(p);s.syncInventory(other);return{s,p,other};
}
const wall=(p,extra={})=>({id:'build-1',owner:p.id,team:p.team,type:'wall',rotation:0,material:'wood',x:0,y:0,z:-4,mask:18,doorOpen:true,health:70,maxHealth:150,created:0,revision:0,...extra});
const edit=(b,mask)=>'build-change:'+JSON.stringify({id:b.id,revision:b.revision,mask,path:[],yaw:0,pitch:0});

test('resetting a doorway around a player succeeds, permits exit, then blocks re-entry without changing bullet cover',()=>{
 const{s,p,other}=room(),b=wall(p);s.builds=[b];rebuildMap(s);p.z=-4;
 assert.equal(canStand(s.map,p),true);assert.equal(editBuilding(s,p,edit(b,0)),true);assert.equal(b.health,70);assert.deepEqual(p.phasedBuilds,[b.id]);assert.equal(canStand(s.map,p),true);
 Object.assign(other,{x:0,z:-4});assert.equal(canStand(s.map,other),false);assert.ok(wallDistance(s.map,{x:0,y:1,z:0},{x:0,y:0,z:-1},8)<8);
 for(let i=0;i<30;i++)movePlayer(p,{forward:1,yaw:0},s.map,1/60);assert.ok(p.z<-5);assert.deepEqual(p.phasedBuilds,[]);
 for(let i=0;i<60;i++)movePlayer(p,{forward:-1,yaw:0},s.map,1/60);assert.ok(p.z<-4.35);assert.equal(canStand(s.map,p),true);
});
test('placing a supported wall over an occupant spends materials once and grants only that occupant an exit',()=>{
 const{s,p,other}=room(),choice=solvePlacement(p,'wall',0,'wood',s.map,[],[]).piece;Object.assign(other,{x:choice.x,y:choice.y,z:choice.z});
 assert.equal(validPlacement(choice,s.map,[],[other]),'');buildingTick(s,p,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});
 assert.equal(s.builds.length,1);assert.equal(p.materials.wood,90);assert.deepEqual(other.phasedBuilds,[s.builds[0].id]);assert.deepEqual(p.phasedBuilds,[]);s.time+=1;buildingTick(s,p,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});assert.equal(p.materials.wood,90);
 assert.equal(validPlacement({...choice,y:40},s.map,[],[]),'Needs support');
});
test('a floor placed at the feet raises the grounded player safely rather than trapping them inside the slab',()=>{
 const{s,p}=room();p.pitch=-1.48;buildingTick(s,p,{buildMode:true,buildType:'floor',buildMaterial:'wood',fire:true});assert.equal(s.builds.length,1);assert.ok(p.y>0&&p.y<=.43);assert.equal(canStand(s.map,p),true);assert.deepEqual(p.phasedBuilds,[]);
});
test('build-through trees does not remove the tree or permit placement inside structural cover',()=>{
 const{s}=room(),piece={type:'wall',x:0,y:0,z:0,rotation:0,mask:0,material:'wood'},tree={kind:'tree',x:0,y:0,z:0,w:1,h:5,d:1};s.map.boxes=[tree];assert.equal(validPlacement(piece,s.map,[]),'');assert.equal(s.map.boxes[0],tree);
 s.map.boxes=[{...tree,kind:'building',w:8,d:8,h:8}];assert.equal(validPlacement(piece,s.map,[]),'Blocked');
});
test('Royale teammates can edit new shared builds while Solo opponents cannot',()=>{
 for(const size of [1,2,4]){const{s,p,other}=room();s.options.teamSize=size;p.team=other.team=0;buildingTick(s,p,{buildMode:true,buildType:'wall',buildMaterial:'wood',fire:true});const b=s.builds[0];Object.assign(other,{x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch});assert.equal(editBuilding(s,other,edit(b,16)),size>1);}
});
test('temporary build collision survives wire snapshots and recovery, with detached guest prediction and no lasting ghost permission',()=>{
 const{s,p}=room(),b=wall(p);s.builds=[b];rebuildMap(s);p.z=-4;assert.equal(editBuilding(s,p,edit(b,0)),true);
 const enc=new SnapshotEncoder(),dec=new SnapshotDecoder(),state=dec.decode(JSON.parse(JSON.stringify(enc.encode({state:s.snapshot(),checkpoint:s.checkpoint()}).frame))).state,row=state.players.find(q=>q.id===p.id),predicted=predictionCopy(row);
 assert.notEqual(predicted.phasedBuilds,row.phasedBuilds);for(let i=0;i<30;i++){movePlayer(p,{forward:1,yaw:0},s.map,1/60);predictMovement(predicted,{forward:1,yaw:0},s.map,1/60,state.royale,s.time);}
 assert.ok(Math.abs(p.z-predicted.z)<1e-8);assert.deepEqual(p.phasedBuilds,predicted.phasedBuilds);assert.deepEqual(row.phasedBuilds,[b.id]);
 const checkpoint=s.checkpoint();checkpoint.players.find(q=>q.id===p.id).phasedBuilds=[b.id];const recovered=new RoyaleSimulation().restore(checkpoint);assert.deepEqual(recovered.players.get(p.id).phasedBuilds,[b.id]);
});
test('walking over matching healing/mobility fills existing stacks only, preserves active healing/reload and leaves overflow',()=>{
 for(const [id,count,max]of [['mini',5,6],['medkit',1,2],['impulse',2,3],['launchpad',1,2]]){
  const{s,p}=room();p.inventory[2]={id,count};p.use={id:'medkit',slot:2,started:s.time,end:s.time+6};p.reloadEnd=15;const use=p.use,gun=p.inventory[1],drop=s.dropLoot(p,{id,count:4,rarity:1});s.interact(p,{editing:true},1/60);
  assert.equal(p.inventory[2].count,max);assert.equal(drop.count,3);assert.equal(p.inventory[3],null);assert.equal(p.inventory[1],gun);assert.equal(p.slot,1);assert.equal(p.use,use);assert.equal(p.reloadEnd,15);
 }
});
test('automatic stacking respects full stacks, missing items, cover, locked vaults and deliberate-drop cooldowns',()=>{
 const{s,p}=room();p.inventory[2]={id:'mini',count:6};const full=s.dropLoot(p,{id:'mini',count:2});s.interact(p,{},1/60);assert.equal(full.count,2);assert.equal(p.inventory[3],null);
 const fresh=s.dropLoot(p,{id:'impulse',count:2});s.interact(p,{},1/60);assert.equal(p.inventory.some(i=>i?.id==='impulse'),false);assert.ok(s.loot.includes(fresh));
 p.inventory[2].count=4;full.droppedBy=p.id;full.pickupAfter=s.time+2;s.interact(p,{},1/60);assert.equal(full.count,2);full.pickupAfter=0;full.vaultId='sealed';s.vaults=[{id:'sealed',open:false}];s.interact(p,{},1/60);assert.equal(full.count,2);delete full.vaultId;
 Object.assign(full,{x:0,y:0,z:-1});s.map.boxes=[{x:0,y:0,z:-.5,w:3,h:3,d:.03}];s.interact(p,{},1/60);assert.equal(p.inventory[2].count,4);
});
test('Shadowstep remains unlimited and permits the next dash at exactly one second, including HUD cooldown progress',()=>{
 const{s,p}=room(),item={id:'shadowstep',count:1};assert.equal(SHADOWSTEP.cooldown,1);assert.equal(startShadowstep(p,item,10),true);assert.equal(startShadowstep(p,item,10.999),false);assert.equal(shadowRechargeState(item,10.5).progress,.5);assert.equal(startShadowstep(p,item,11),true);assert.equal(item.count,1);assert.equal(item.charges,undefined);
});

test('real private host/guest commands replicate occupied edits, movement clearance and partial automatic pickup',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{default:WebSocket}=await import('ws'),{Network}=await import('../src/network.js'),{startRealtimeServer}=await import('../server/realtime/index.js'),{safeProfile}=await import('../src/data.js');
 const dir=await mkdtemp(tmpdir()+'/build-pickup-network-'),oldWindow=globalThis.window,oldSocket=globalThis.WebSocket,previous={};
 for(const key of ['RAVEL_SOCIAL_DATA_PATH','RAVEL_REWARD_DATA_PATH','YOLK_OWNER_DATA_PATH']){previous[key]=process.env[key];process.env[key]=dir+'/'+key+'.json';}
 let app,host,guest,clock,state;
 const wait=async fn=>{const end=Date.now()+12000;while(!fn()){assert.ok(Date.now()<end,'Host/guest state did not converge');await new Promise(r=>setTimeout(r,20));}};
 try{
  app=await startRealtimeServer({host:'127.0.0.1',port:0,mapPath:dir+'/maps.json'});globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
  const{s,p,other}=room();s.players.delete(p.id);p.id='host';s.players.set(p.id,p);s.players.delete(other.id);s.phase='lobby';s.stage='waiting';s.map.id='sunnybreak';
  host=new Network({getState:()=>s.snapshot(),getCheckpoint:()=>s.checkpoint(),onJoin:(id,profile,admission)=>!!s.admitPlayer(id,profile,admission),onInput:(id,input)=>s.setInput(id,input,true),onPlayerAction:(id,action)=>s.playerAction(id,action)});guest=new Network({onState:value=>state=value});
  const code=await host.host();host.setVisibility('private');clock=setInterval(()=>host.broadcast(s.snapshot()),25);await guest.join(code,safeProfile({name:'Network Builder'}));await wait(()=>state?.players.some(q=>q.id===guest.id));
  const q=s.players.get(guest.id),id=q.id,name=q.name;Object.assign(q,structuredClone(p),{id,name,z:-4,phasedBuilds:[]});s.phase='playing';s.stage='active';const b=wall(q);s.builds=[b];rebuildMap(s);
  guest.send({type:'player-action',action:edit(b,0)});await wait(()=>state.players.find(v=>v.id===id)?.phasedBuilds?.includes(b.id));assert.equal(b.mask,0);
  const predicted=predictionCopy(state.players.find(v=>v.id===id));guest.input({seq:1,forward:1,yaw:0,pitch:0});await wait(()=>s.inputs.get(id)?.forward===1);
  for(let i=0;i<30;i++){movePlayer(q,s.inputs.get(id),s.map,1/60);predictMovement(predicted,{forward:1,yaw:0,pitch:0},s.map,1/60,state.royale,s.time);}assert.ok(Math.abs(q.z-predicted.z)<1e-8);await wait(()=>state.players.find(v=>v.id===id)?.phasedBuilds?.length===0);
  q.inventory[2]={id:'mini',count:5};const drop=s.dropLoot(q,{id:'mini',count:3});s.interact(q,{},1/60);await wait(()=>state.players.find(v=>v.id===id)?.inventory[2]?.count===6);assert.equal(drop.count,2);assert.equal(q.inventory[1].id,'sprinter');
 }finally{
  clearInterval(clock);guest?.destroy();host?.destroy();if(app)await app.close();globalThis.window=oldWindow;globalThis.WebSocket=oldSocket;for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;await rm(dir,{recursive:true,force:true});
 }
});
