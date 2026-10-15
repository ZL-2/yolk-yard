import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPose,thirdPersonActive,sightRay,reachablePoint,toolDirection,perspectiveMode} from '../src/perspective.js';
import {direction,worldHit,sanitizeInput,movePlayer,rayBox} from '../src/physics.js';
import {eyeHeight} from '../src/stance.js';
import {Simulation} from '../src/simulation.js';
import {RoyaleSimulation} from '../src/royale.js';
import {weapon} from '../src/data.js';
import {targetBuild,aimedObject,solvePlacement,editBuilding} from '../src/building.js';
import {pieceBoxes,editRay} from '../src/building-shapes.js';
import {normalizeBindings,migratePerspectiveBindings} from '../src/keybinds.js';
import {routeHotDrop} from '../src/field-operations.js';
import {throwPath,thrownProjectile,stepThrowable} from '../src/throwables.js';
import {grappleAim} from '../src/grappler.js';
import {wallDistance} from '../src/physics.js';
const flat=()=>({size:500,boxes:[]});
const player=(extra={})=>({id:'a',health:100,x:0,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,pitch:0,perspective:'third',viewBlend:0,viewBoom:1,weapon:'sprinter',slot:0,grounded:true,...extra});
function arena(){const s=new Simulation({mode:'ffa',bots:0}),a=s.addPlayer('a',{name:'Alpha',weapon:'anchor'}),b=s.addPlayer('b',{name:'Bravo'});s.startRound();s.map=flat();s.time=10;Object.assign(a,player({weapon:'anchor',ammo:[100,10],accuracyState:[{spread:0},{}],shieldUntil:0,equipUntil:0}));Object.assign(b,{x:.62,y:0,z:-10,health:100,shieldUntil:0,spectating:false});return {s,a,b};}
test('default perspective and scoped/special camera transitions',()=>{
 assert.equal(perspectiveMode(undefined),'first');assert.equal(perspectiveMode('broken'),'first');
 const p=player(),map=flat(),first=cameraPose(map,{...p,perspective:'first'}),third=cameraPose(map,p),ads=cameraPose(map,{...p,aim:true,viewBlend:1});
 assert.deepEqual(first.origin,{x:0,y:1.7,z:0});assert.ok(third.origin.x>.5&&third.origin.z>3);assert.ok(ads.origin.z<third.origin.z);
 for(const pose of [{weapon:'needle',aim:true},{emote:{}},{vehicleId:1},{downed:true},{health:0},{flight:'glide'}])assert.equal(thirdPersonActive({...p,...pose}),false);
 for(const pose of [{crouching:true},{sliding:true},{mantle:{}},{reviving:'b'},{building:true,aim:true,weapon:'needle'}])assert.equal(thirdPersonActive({...p,...pose}),true);
});
test('shoulder boom collides with walls, corners, terrain and ceilings at all pitch angles',()=>{
 const box={x:0,y:0,z:2,w:8,h:8,d:.2},map={...flat(),boxes:[box]};
 for(const pitch of [-1.4,-.5,0,.5,1.4]){const p=player({pitch}),pose=cameraPose(map,p),dx=pose.origin.x-p.x,dy=pose.origin.y-eyeHeight(p),dz=pose.origin.z-p.z,len=Math.hypot(dx,dy,dz),d={x:dx/len,y:dy/len,z:dz/len};assert.ok(rayBox(pose.eye,d,box,Infinity,.18)>=len-.001);assert.ok(pose.origin.y>=.15);}
 const ceiling={...flat(),boxes:[{x:0,y:2.4,z:0,w:8,h:.3,d:8}]},pose=cameraPose(ceiling,player({pitch:-.8}));assert.ok(pose.origin.y<2.23);
 const bounded=sanitizeInput({perspective:'third',viewBoom:999,viewBlend:-50});assert.equal(bounded.viewBoom,1);assert.equal(bounded.viewBlend,0);assert.equal(sanitizeInput({perspective:'evil',viewBoom:NaN}).perspective,'first');
});
test('third-person reticle hits at close and far range from the player muzzle',()=>{
 for(const distance of [2,10,60]){const {s,a,b}=arena();b.z=-distance;const pose=cameraPose(s.map,a);a.pitch=Math.atan2(1.4-pose.origin.y,distance+pose.origin.z);const path=s.shotPath(a,weapon('anchor'));assert.equal(path.blocked,null);assert.ok(Math.hypot(path.origin.x-a.x,path.origin.y-(a.y+eyeHeight(a)),path.origin.z-a.z)<1);s.fire(a);assert.ok(b.health<100,`miss at ${distance}m`);}
});
test('camera peeking cannot fire, edit or harvest through body cover',()=>{
 const {s,a,b}=arena();a.pitch=-.045;s.map.boxes=[{x:0,y:0,z:-.8,w:.65,h:3,d:.2,objectId:'cover'}];
 const ray=sightRay(s.map,a,30);assert.equal(worldHit(s.map,ray.origin,ray.d,ray.range),null,'shoulder can see beyond cover');
 assert.ok(s.shotPath(a,weapon('anchor')).blocked);s.fire(a);assert.equal(b.health,100);
 assert.equal(reachablePoint(s.map,a,{x:.62,y:1.4,z:-4},8),false);
});
test('third-person build preview, selection and edits use reticle with body range',()=>{
 const map=flat(),p=player({pitch:-.05,flight:'ground',building:true}),b={id:'build-1',x:0,y:0,z:-4,type:'wall',rotation:0,material:'wood',owner:'a',health:100,maxHealth:150,mask:0};map.boxes=pieceBoxes(b);
 assert.equal(targetBuild(map,[b],p)?.id,b.id);assert.equal(aimedObject(map,p,5)?.box.buildId,b.id);
 const sight=sightRay(map,p,8),hit=editRay(b,sight.origin,sight.d,sight.range);assert.ok(hit);assert.equal(targetBuild(map,[b],{...p,z:10}),null,'camera distance must not extend editing reach');
 const preview=solvePlacement(p,'floor',0,'wood',flat(),[]);assert.ok(Math.hypot(preview.piece.x-p.x,preview.piece.z-p.z)<=9);
 const sim={map,builds:[b],worldBoxes:[],worldDamage:{},players:new Map([['a',p]]),time:1,buildVersion:0,emit(){}};
 assert.equal(editBuilding(sim,p,'build-change:'+JSON.stringify({id:b.id,mask:16,path:[],revision:0,yaw:p.yaw,pitch:p.pitch})),true);
});
test('grenade preview shares launch and bounce physics in third person; grappler obeys body cover',()=>{
 const map={...flat(),boxes:[{x:0,y:0,z:-15,w:15,h:10,d:1}]},p=player({pitch:.1}),path=throwPath(p,map),b=thrownProjectile(p,'popper',map);
 assert.ok(Math.abs(toolDirection(map,p).x)>0);for(let i=0;i<Math.ceil(b.fuse*60);i++){stepThrowable(b,map,1/60);if(b.resting)break;}
 assert.ok(Math.hypot(path.at(-1).x-b.x,path.at(-1).y-b.y,path.at(-1).z-b.z)<1e-6);
 const aim=grappleAim(map,p,wallDistance);assert.equal(aim.valid,true);assert.equal(aim.origin.x,p.x);assert.ok(aim.anchor.x>.4);
});
test('camera preference travels through remote commands and snapshots without changing movement',()=>{
 const {s,a}=arena();s.setInput('a',{perspective:'third',viewBlend:.4,viewBoom:.8,yaw:.2,pitch:.1,forward:1,slot:0,seq:1});s.tick(1/60);assert.equal(s.snapshot().players.find(p=>p.id==='a').perspective,'third');
 const first=player({perspective:'first'}),third=player(),input={yaw:.3,pitch:0,forward:1,sprint:true};movePlayer(first,{...input,perspective:'first'},flat(),1/60);movePlayer(third,{...input,perspective:'third'},flat(),1/60);assert.equal(first.x,third.x);assert.equal(first.z,third.z);
 const restored=new Simulation().restore(s.checkpoint());assert.equal(restored.players.get('a').perspective,'third');
});
test('stance camera eases deterministically without lifting the physical weapon eye',()=>{
 const p=player({cameraEye:1.7}),map=flat();movePlayer(p,{perspective:'third',crouch:true},map,1/60);
 assert.ok(p.cameraEye>eyeHeight(p)&&p.cameraEye<1.7);const first=p.cameraEye;
 movePlayer(p,{perspective:'third',crouch:true},map,1/60);assert.ok(p.cameraEye<first);
 assert.equal(cameraPose(map,p).eye.y,eyeHeight(p));
 for(let i=0;i<60;i++)movePlayer(p,{perspective:'third',crouch:true},map,1/60);
 assert.ok(Math.abs(p.cameraEye-eyeHeight(p))<1e-6);
});
test('new controls migrate only defaults; custom controls and independent start key survive',()=>{
 const settings={keybinds:{aim:['Mouse2',null],sprint:['ShiftLeft',null],crouch:['ControlLeft',null]}};migratePerspectiveBindings(settings);const b=normalizeBindings(settings.keybinds);assert.deepEqual(b.aim,['ShiftLeft','Mouse2']);assert.deepEqual(b.sprint,['ControlLeft',null]);assert.deepEqual(b.crouch,['AltLeft',null]);assert.deepEqual(b.startNow,['KeyU',null]);
 const custom={keybinds:{aim:['KeyL',null],sprint:['ShiftLeft',null],crouch:['ControlLeft',null]}};migratePerspectiveBindings(custom);assert.equal(custom.keybinds.aim[0],'KeyL');assert.equal(custom.keybinds.crouch[0],'ControlLeft');
});
test('hot drop is nearest bus-start POI and remains the same after departure',()=>{
 const s=new RoyaleSimulation({seed:157,capacity:4,bots:0,fill:false});s.addPlayer('a',{name:'Alpha'});s.addPlayer('b',{name:'Bravo'});s.startRound();const hot=routeHotDrop(s.battleMap().districts,s.route);assert.equal(s.operations.hotspot.id,hot.id);s.beginBattle('host-start');assert.equal(s.operations.hotspot.id,hot.id);
 for(const p of s.map.districts)assert.ok(Math.hypot(hot.x-s.route.fromX,hot.z-s.route.fromZ)<=Math.hypot(p.x-s.route.fromX,p.z-s.route.fromZ)+1e-9);
});
