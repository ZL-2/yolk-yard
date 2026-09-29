import test from 'node:test';import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {movePlayer,humanHit,canStand,invalidateCollision} from '../src/physics.js';
import {bodyHeight,eyeHeight} from '../src/stance.js';
import {REVIVE_RULES,reviveAccessible} from '../src/team-survival.js';
import {visibleMarkers} from '../src/team-markers.js';
const flat={id:'yard',size:256,theme:'royale',boxes:[],terrain:null};
function room(){const s=new RoyaleSimulation({capacity:4,bots:0,fill:false,teamSize:2,seed:9});for(let i=0;i<4;i++)s.addPlayer('p'+i,{name:'Operator '+i});s.startRound();s.beginBattle();s.map={...flat,boxes:[]};s.chests=[];s.loot=[];for(const [i,p]of [...s.players.values()].entries())Object.assign(p,{x:i<2?i*1.5:30+i*3,y:0,z:0,flight:'ground',grounded:true,shieldUntil:0,team:Math.floor(i/2),shield:0});return s;}
function walk(p,input,map=flat,n=60){for(let i=0;i<n;i++){const x=p.x,z=p.z;movePlayer(p,input,map,1/60);p.vx=(p.x-x)*60;p.vz=(p.z-z)*60;}}
function advance(s,seconds,inputs={}){for(let i=0;i<Math.ceil(seconds*60);i++){for(const [id,input]of Object.entries(inputs))s.setInput(id,{seq:(s.inputs.get(id)?.seq||0)+1,...input});s.tick(1/60);}}
test('crouch changes movement, camera, body hit regions and low-ceiling clearance',()=>{
 const s=room(),p=s.players.get('p0');walk(p,{crouch:true,forward:1,yaw:0});assert.equal(p.crouching,true);assert.equal(bodyHeight(p),1.25);assert.equal(eyeHeight(p),1.12);assert.ok(Math.abs(p.z+2.4)<.03);
 const ray=y=>humanHit({x:p.x,y,z:p.z+5},{x:0,y:0,z:-1},p);assert.equal(ray(1.68).distance,Infinity);assert.equal(ray(1.1).region,'head');
 const ceiling={...flat,boxes:[{x:p.x,y:1.35,z:p.z,w:4,h:.4,d:4}]};walk(p,{},ceiling,1);assert.equal(canStand(ceiling,p),false);assert.equal(p.crouching,true);walk(p,{forward:1,yaw:0},ceiling,150);assert.equal(p.crouching,false);
});
test('slide requires real momentum; slows, has cooldown and cannot expand into a tunnel',()=>{
 const p=room().players.get('p0');walk(p,{crouch:true},flat,1);assert.equal(p.sliding,false);walk(p,{forward:1,sprint:true,yaw:0},flat,30);assert.ok(p.vz<-7);walk(p,{forward:1,crouch:true,yaw:0},flat,1);assert.equal(p.sliding,true);const v=Math.hypot(p.slideVX,p.slideVZ);walk(p,{forward:1,crouch:true,yaw:0},flat,30);assert.ok(Math.hypot(p.slideVX,p.slideVZ)<v);walk(p,{crouch:true},flat,200);assert.equal(p.sliding,false);assert.equal(p.crouching,true);
 p.sliding=true;p.slideVX=0;p.slideVZ=-3;p.slideAge=3.3;const tunnel={...flat,boxes:[{x:p.x,y:1.03,z:p.z,w:10,h:.4,d:10}]};walk(p,{},tunnel,1);assert.equal(p.sliding,false);assert.equal(p.lowCrouch,true);assert.equal(bodyHeight(p),.96);
});
test('Duo knock restricts combat and loot; hold revive is authoritative and completes once',()=>{
 const s=room(),p=s.players.get('p0'),mate=s.players.get('p1'),enemy=s.players.get('p2');s.damage(p,enemy,200,'Sprinter');assert.equal(p.lifeState,'DOWNED');assert.equal(p.kills,0);assert.equal(enemy.kills,0);assert.equal(p.spectating,false);
 p.inventory[1]={id:'sprinter',weapon:true,ammo:30,rarity:0};p.slot=1;s.syncInventory(p);const n=s.projectiles.length;s.fire(p);assert.equal(s.projectiles.length,n);const item=s.dropWeapon(p,'pip');assert.equal(s.takeLoot(p,item),false);
 advance(s,11,{p1:{interact:true}});assert.equal(p.downed,false);assert.equal(p.health,30);assert.equal(mate.revives,1);assert.equal(s.events.filter(e=>e.type==='revived').length,1);
});
test('remote slide edges retain validated momentum across short packet gaps',()=>{
 const s=room(),p=s.players.get('p0');
 for(let seq=1;seq<=30;seq++){s.setInput(p.id,{seq,forward:1,sprint:true,yaw:0,dt:1/60},true);s.tick(1/60);}
 for(let i=0;i<6;i++)s.tick(1/60);
 s.setInput(p.id,{seq:31,forward:1,sprint:true,crouch:true,yaw:0,dt:1/60},true);s.tick(1/60);assert.equal(p.sliding,true);
});
test('revive stops on movement, damage, release or a wall, and decays rather than duplicating',()=>{
 const s=room(),p=s.players.get('p0'),mate=s.players.get('p1'),enemy=s.players.get('p2');s.damage(p,enemy,200,'Sprinter');advance(s,4,{p1:{interact:true}});const progress=p.reviveProgress;assert.ok(progress>2);
 advance(s,.3,{p1:{interact:false}});assert.ok(p.reviveProgress<progress);s.damage(mate,enemy,1,'Pip');advance(s,.3,{p1:{interact:true}});assert.equal(p.reviverId,null);
 s.map.boxes=[{x:.75,y:0,z:0,w:.2,h:3,d:6}];invalidateCollision(s.map);assert.equal(reviveAccessible(s.map,mate,p),false);advance(s,11,{p1:{interact:true}});assert.equal(p.downed,true);assert.equal(p.reviveProgress,0);
});
test('final active Duo member falling resolves the whole team and credits the original knock',()=>{
 const s=room(),p=s.players.get('p0'),mate=s.players.get('p1'),enemy=s.players.get('p2');s.damage(p,enemy,200,'Sprinter');s.damage(mate,enemy,200,'Sprinter');s.tick(1/60);assert.equal(p.health,0);assert.equal(mate.health,0);assert.equal(p.lifeState,'ELIMINATED');assert.equal(enemy.kills,2);assert.equal(s.winnerTeam,1);assert.equal(p.place,2);
});
test('finishing, bleed-out, storm and disconnected teammate cannot leave immortal downed players',()=>{
 for(const cause of ['finish','bleed','storm','disconnect']){const s=room(),p=s.players.get('p0'),enemy=s.players.get('p2');s.damage(p,enemy,200,'Sprinter');if(cause==='finish')s.damage(p,s.players.get('p3'),200,'Pip');if(cause==='bleed')advance(s,52);if(cause==='storm')s.damage(p,null,200,'Storm');if(cause==='disconnect'){s.removePlayer('p1');s.tick(1/60);}assert.equal(p.health,0,cause);assert.equal(p.spectating,true);assert.equal(enemy.kills,1);}
});
test('marker intent is bounded, rate-limited, expiring and visible only to its Duo',()=>{
 const s=room(),p=s.players.get('p0');s.playerAction(p.id,'ping-'+JSON.stringify({kind:'map',x:10,z:20,team:1}));assert.equal(s.markers.length,1);assert.equal(s.markers[0].team,0);assert.equal(visibleMarkers(s.snapshot(),s.players.get('p1')).length,1);assert.equal(visibleMarkers(s.snapshot(),s.players.get('p2')).length,0);
 const event=s.events.at(-1);assert.equal(event.id,s.eventId);assert.equal(event.markerId,s.markers[0].id);
 s.playerAction(p.id,'ping-'+JSON.stringify({kind:'danger'}));assert.equal(s.markers[0].kind,'normal');s.time+=1;s.playerAction(p.id,'ping-'+JSON.stringify({kind:'danger'}));assert.equal(s.events.at(-1).id,event.id+1);assert.equal(s.markers[0].kind,'danger');assert.equal(s.markers.length,1);s.time+=13;assert.equal(visibleMarkers(s.snapshot(),p).length,0);
});
