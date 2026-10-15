import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';

function fixture(){
 const s=new RoyaleSimulation({capacity:2,bots:0,seed:161});
 const p=s.addPlayer('pilot',{name:'Pilot'}),enemy=s.addPlayer('rival',{name:'Rival'});
 s.startRound();assert.equal(s.beginBattle(),true);
 Object.assign(s,{stage:'active',time:10,map:{id:'flat',theme:'royale',size:200,boxes:[],districts:[]},vehicles:[],loot:[],chests:[]});
 for(const [id] of s.players)if(id!==p.id&&id!==enemy.id)s.players.delete(id);
 const chest={id:'supply-test',x:0,y:0,z:0,supply:true,opened:false,landed:false,landAt:s.time+18,canopyHealth:100,contents:[{id:'mini',count:3,rarity:1}]};
 s.chests.push(chest);s.lootVersion++;
 // The parafoil is 5.1 metres above the crate's visual base. An elevated
 // firing platform gives a level, deterministic shot through its centre.
 const canopyY=(chest.landAt-s.time)*4+5.1;
 Object.assign(p,{x:0,y:canopyY-1.7,z:30,yaw:0,pitch:0,aim:true,health:100,shield:0,shieldUntil:0,grounded:true,flight:'ground',spectating:false,equipUntil:0,nextShot:0,slot:1,inventory:[null,{id:'anchor',weapon:true,count:1,rarity:0,ammo:10}],ammo:[0,10],accuracyState:[{}, {spread:0}],reloadEnd:0,sprinting:false,sprintRecovery:0});
 Object.assign(enemy,{x:50,y:0,z:0,health:100,shield:0,shieldUntil:0,flight:'ground',spectating:false});
 return {s,p,enemy,chest,canopyY};
}

test('an exposed supply parafoil accepts authoritative hitscan damage without opening its crate',()=>{
 const {s,p,chest}=fixture(),version=s.lootVersion;
 assert.equal(s.fire(p),true);
 assert.ok(chest.canopyHealth<100,'the visible airborne canopy must be a weapon hit target');
 assert.equal(chest.opened,false);assert.equal(chest.contents.length,1);
 assert.ok(s.lootVersion>version,'canopy damage must reach chest-version snapshots');
});

test('solid world cover blocks supply-canopy hitscan damage',()=>{
 const {s,p,chest,canopyY}=fixture();
 s.map.boxes.push({x:0,y:canopyY-3,z:15,w:8,h:6,d:1,material:'concrete'});
 assert.equal(s.fire(p),true);
 assert.equal(chest.canopyHealth,100);assert.equal(chest.opened,false);
 const end=s.events.findLast(e=>e.type==='shot').shots[0].end;
 assert.ok(end.z>14,'the tracer must stop at the wall');
});

test('a nearer player absorbs the shot before the supply canopy behind them',()=>{
 const {s,p,enemy,chest}=fixture();
 Object.assign(enemy,{x:0,y:p.y,z:15});
 assert.equal(s.fire(p),true);
 assert.ok(enemy.health<100);assert.equal(chest.canopyHealth,100);
});

test('swept sniper projectiles collide with the supply canopy instead of crossing it',()=>{
 const {s,p,chest,canopyY}=fixture();
 s.projectiles=[{id:1,owner:p.id,shotId:1,weapon:'needle',kind:'bolt',x:0,y:canopyY,z:10,vx:0,vy:0,vz:-330,gravity:0,hitRadius:.008,buildFalloff:false,damage:95,critical:2.15,buildDamage:75,range:500,born:s.time,fuse:2,travelled:0,popper:false}];
 for(let i=0;i<4&&s.projectiles.length;i++)s.updateProjectiles(1/60);
 assert.ok(chest.canopyHealth<100,'the projectile sweep must include the airborne canopy');
 assert.equal(s.projectiles.length,0);assert.equal(chest.opened,false);
});

test('thrown poppers bounce safely off a canopy before their fuse expires',()=>{
 const {s,p,chest,canopyY}=fixture();
 s.projectiles=[{id:2,owner:p.id,popper:true,x:0,y:canopyY,z:2,vx:0,vy:0,vz:-30,gravity:0,born:s.time,fuse:2,bounces:0}];
 for(let i=0;i<8&&!s.projectiles[0]?.bounces;i++)s.updateProjectiles(1/60);
 const b=s.projectiles[0];assert.equal(b.bounces,1);assert.ok(b.vz>0);assert.ok([b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite));assert.equal(chest.canopyHealth,100);
});
