import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlayer,sanitizeInput,humanHit,muzzleOrigin} from '../src/physics.js';
import {eyePosition,leanAmount,resetStance} from '../src/stance.js';
import {fallDamage} from '../src/airborne.js';
import {naturalHeight,groundAt,riverX} from '../src/terrain.js';
import {ROYALE_MAP} from '../src/royale-map.js';
import {SPAWN_ISLAND} from '../src/spawn-island.js';
import {normalizeBindings,bindingAllowed,CONTROL_GROUPS} from '../src/keybinds.js';
import {predictMovement,predictionCopy} from '../src/guest-movement.js';
import {cameraPose} from '../src/perspective.js';
import {thrownProjectile} from '../src/throwables.js';
import {weapon} from '../src/data.js';
import {Simulation} from '../src/simulation.js';
import {SnapshotEncoder,SnapshotDecoder} from '../src/snapshot-codec.js';
const player=extra=>({id:'a',x:0,y:0,z:0,yaw:0,pitch:0,health:100,weapon:'anchor',slot:0,grounded:true,vy:0,vx:0,vz:0,flight:'ground',perspective:'first',...extra});
const flat=()=>({size:100,boxes:[]});
const water=()=>({...flat(),waterLevel:.5,terrain:{size:100,cell:200,n:2,max:-3,heights:new Float32Array(4).fill(-3)}});
const move=(p,i,m,n=60)=>{for(let k=0;k<n;k++)movePlayer(p,i,m,1/60,k/60);return p;};
test('wet beds deepen while dry ground and authored helipad stay dry',()=>{
 assert.ok(naturalHeight(riverX(-60),-60)<-2);
 assert.ok(naturalHeight(165,-27)<-2);
 for(const map of [ROYALE_MAP,SPAWN_ISLAND]){assert.equal(map.waterLevel,.5);assert.ok(Math.min(...map.terrain.heights)<-2.5);}
 const h=ROYALE_MAP.helipad;assert.ok(h.y-groundAt(ROYALE_MAP,h.x,h.z)>.2);
});
test('lethal water falls are cushioned, surface movement and jumping work',()=>{
 const p=player({y:45,grounded:false}),map=water();let damage=0;
 for(let i=0;i<240;i++){movePlayer(p,{},map,1/60);damage+=fallDamage(p.landing);p.landing=null;}
 assert.equal(damage,0);assert.equal(p.swimming,true);assert.ok(Math.abs(p.y+.55)<.001);
 move(p,{forward:1},map);assert.ok(p.z<-2);movePlayer(p,{jump:true},map,1/60);assert.ok(p.vy>0&&p.y>-.55);
 const dry=flat(),q=player({y:45,grounded:false});let dryDamage=0;
 for(let i=0;i<180;i++){movePlayer(q,{},dry,1/60);dryDamage+=fallDamage(q.landing);q.landing=null;}
 assert.ok(dryDamage>=100);assert.equal(q.swimming,false);
});
test('a bridge over water remains a solid damaging landing',()=>{
 const map=water();map.boxes.push({x:0,y:2,z:0,w:8,d:8,h:.4});const p=player({y:45,grounded:false});let damage=0;
 for(let i=0;i<180;i++){movePlayer(p,{},map,1/60);damage+=fallDamage(p.landing);p.landing=null;}
 assert.ok(damage>=100);assert.equal(p.y,2.4);assert.equal(p.swimming,false);
});
test('lean moves camera, exposed head, muzzle and throwable together',()=>{
 const map=flat(),p=move(player(),{leanRight:true},map),eye=eyePosition(p);
 assert.ok(eye.x>.37&&eye.y<1.7);assert.deepEqual(cameraPose(map,p).origin,eye);
 const ray={x:eye.x,y:eye.y-.06,z:-5},d={x:0,y:0,z:1};
 assert.equal(humanHit(ray,d,p).region,'head');assert.equal(humanHit(ray,d,{...p,lean:0}).distance,Infinity);
 assert.ok(muzzleOrigin({...p,aim:true},weapon('anchor')).x>.30);assert.equal(thrownProjectile(p).x,eye.x);
 move(p,{leanLeft:true,crouch:true},map);assert.ok(eyePosition(p).x<-.37);assert.ok(eyePosition(p).y<1.12);
 move(p,{leanLeft:true,leanRight:true},map);assert.equal(p.lean,0);
});
test('head and shoulder sweeps prevent leaning through a wall',()=>{
 const map=flat();map.boxes.push({x:.55,y:0,z:0,w:.2,h:3,d:5});const p=move(player(),{leanRight:true},map);
 assert.ok(eyePosition(p).x<.27);assert.ok(p.lean<.7);
 for(const pose of [{vehicleId:'v'},{downed:true},{swimming:true},{sprinting:true},{grounded:false},{building:true},{emote:{}}])assert.equal(leanAmount({...p,...pose}),0);
 resetStance(p);assert.equal(p.lean,0);
});
test('authority and guest predict identical lean and water trajectories',()=>{
 for(const map of [flat(),water()]){const a=player({y:map.waterLevel?30:0,grounded:!map.waterLevel}),b=predictionCopy(a);
 for(let k=0;k<200;k++){const i=sanitizeInput({leanRight:k%80<40,leanLeft:k%80>=40,forward:.2,yaw:.2});movePlayer(a,i,map,1/60);predictMovement(b,i,map,1/60,null);}
 for(const key of ['x','y','z','lean','swimming','grounded'])assert.equal(a[key],b[key],key);}
});
test('lean survives snapshots, checkpoints and lag-compensated target poses',()=>{
 const s=new Simulation({mode:'ffa',bots:0});s.addPlayer('a');s.startRound();const a=s.players.get('a');Object.assign(a,player({lean:.8}));s.recordPoses();
 const enc=new SnapshotEncoder(),dec=new SnapshotDecoder(),state=dec.decode(enc.encode({state:s.snapshot()}).frame).state;
 assert.equal(state.players.find(p=>p.id==='a').lean,.8);assert.equal(new Simulation().restore(s.checkpoint()).players.get('a').lean,.8);
 const history=s.poseHistory.get('a');assert.equal(history.at(-1).lean,.8);s.remoteInputs.set('shooter',{});const rewound=s.shotPose({...a,lean:0},{id:'shooter',executedShotTime:s.time},{hitscan:true});assert.equal(rewound.lean,.8);
});
test('Q/E defaults migrate once and intentional custom bindings remain exclusive',()=>{
 const defaults=normalizeBindings();assert.deepEqual(defaults.leanLeft,['KeyQ',null]);assert.deepEqual(defaults.leanRight,['KeyE',null]);
 const legacy=normalizeBindings({swap:['KeyQ',null],popper:['KeyE','KeyG']});assert.equal(legacy.swap[0],'Backquote');assert.equal(legacy.popper[0],'KeyG');assert.deepEqual(normalizeBindings(legacy),legacy);
 const custom=normalizeBindings({buildEdit:['KeyE',null],swap:['KeyQ','KeyU']});assert.equal(custom.buildEdit[0],'KeyE');assert.equal(custom.swap[0],'KeyQ');assert.equal(custom.leanLeft[0],null);assert.equal(custom.leanRight[0],null);
 const occupied=normalizeBindings({swap:['KeyQ',null],buildEdit:['Backquote',null]});assert.equal(occupied.buildEdit[0],'Backquote');assert.equal(occupied.swap[0],null);
 assert.equal(bindingAllowed('leanLeft','WheelUp'),false);assert.ok(CONTROL_GROUPS.find(g=>g[0]==='Movement')[1].includes('leanRight'));
});
