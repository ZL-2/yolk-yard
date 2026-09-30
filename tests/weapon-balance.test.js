import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {weapon,gun,WEAPONS,ROYALE_WEAPONS} from '../src/data.js';
import {COMBAT_PROFILES,AMMO_RULES,RARITY_SCALE,UTILITY_WEAPONS} from '../src/weapon-balance.js';
import {falloffAt,structureDamage,updateCombatAccuracy,firedAccuracy,crosshairRadius,weaponReadyAt} from '../src/combat.js';
import {humanHit,direction} from '../src/physics.js';
import {eyeHeight} from '../src/stance.js';
import {beginEquip} from '../src/equip.js';
import {reloadProgress} from '../src/arms.js';
import {selectWeapon} from '../src/bot-objectives.js';
import {rollChest} from '../src/royale-loot.js';
import {ammoType} from '../src/royale-data.js';
import {MATERIALS} from '../src/building-rules.js';
const guns=[...WEAPONS,...ROYALE_WEAPONS];
function arena(id){const s=new Simulation({bots:0,seed:11}),p=s.addPlayer('a',{name:'Alpha',weapon:id}),t=s.addPlayer('b',{name:'Bravo'});s.phase='playing';s.time=10;s.map={...s.map,size:1200,boxes:[],pickups:[]};Object.assign(p,{weapon:id,x:0,y:0,z:0,health:100,grounded:true,aim:true,pitch:0,yaw:0,slot:0,ammo:[100,14],reserve:[100,84],reloadEnd:0,equipUntil:0,nextShot:0,shieldUntil:0,weaponCooldowns:{},accuracyState:[{spread:0,adsBlend:1},{}]});Object.assign(t,{x:0,y:0,z:-12,health:10000,shieldUntil:0,spectating:false});return {s,p,t};}
test('every firearm has a complete central role and controlled rarity progression',()=>{
 assert.equal(guns.length,11);assert.equal(Object.keys(COMBAT_PROFILES).length,11);
 for(const base of guns)for(let rarity=0;rarity<5;rarity++){const w=gun({slot:1,inventory:[null,{id:base.id,weapon:true,rarity}]});assert.ok(w.purpose&&w.weakness&&w.damage>0&&w.reload>0&&w.adsTime>0&&w.equipTime>0&&w.bloomRecovery>0&&w.recoilRecovery>0);assert.equal(w.damage,base.damage*RARITY_SCALE[rarity].damage);assert.equal(w.critical,base.critical);assert.equal(w.magazine,base.magazine);assert.equal(w.interval,base.interval);assert.ok(w.hitRadius<=.08);assert.ok(Math.abs(w.interval*60-Math.round(w.interval*60))<1e-9);assert.equal(w.roundsPerSecond,(w.burst||1)/w.interval);}
});
test('actual body/head damage follows central falloff at five representative ranges',()=>{
 for(const base of guns.filter(w=>!w.projectile))for(const rarity of [0,4])for(const distance of [2,12,40,100,Math.min(base.range-1,350)])for(const head of [false,true]){
  const {s,p,t}=arena(base.id),w=gun({slot:1,inventory:[null,{id:base.id,weapon:true,rarity}]});
  p.inventory=[null,{id:base.id,weapon:true,rarity}];p.slot=1;p.ammo=[0,100];p.reserve=[0,100];p.accuracyState=[{},{spread:0,adsBlend:1}];t.z=-distance;
  const height=head?1.68:1.19;let pitch=Math.atan2(height-eyeHeight(p),distance);
  if(!w.hitscan){for(let i=0;i<8;i++){p.pitch=pitch;const path=s.shotPath(p,w,direction(0,pitch)),time=distance/(w.boltSpeed*-path.d.z),at=path.origin.y+path.d.y*w.boltSpeed*time-.5*w.gravity*time*time;pitch+=Math.atan2(height-at,distance);}}
  p.pitch=pitch;assert.equal(s.fire(p),true);const projectile=s.projectiles[0];
  for(let i=0;s.projectiles.length&&i<120;i++){s.time+=1/60;s.updateProjectiles(1/60);}
  const amount=s.events.filter(e=>e.type==='hit').reduce((sum,e)=>sum+e.amount,0);
  if(distance>=w.range){assert.equal(amount,0);continue;}
  const shot=s.events.findLast(e=>e.type==='shot');
  const expected=w.hitscan?shot.shots.reduce((sum,trace)=>{const o=shot.origin,end=trace.end,len=Math.hypot(end.x-o.x,end.y-o.y,end.z-o.z),d={x:(end.x-o.x)/len,y:(end.y-o.y)/len,z:(end.z-o.z)/len},hit=humanHit(o,d,t);return sum+(hit.distance<=len+1e-7?w.damage*falloffAt(w,hit.distance)*(hit.region==='head'?w.critical:1):0);},0):w.damage*falloffAt(w,projectile.travelled)*(head?w.critical:1);
  assert.ok(Math.abs(amount-expected)<.001,`${w.id} rarity${rarity} ${distance} ${head?'head':'body'}: ${amount}/${expected}`);
  if(amount)assert.equal(s.events.some(e=>e.type==='hit'&&e.precision),head);
 }
});
test('standard humanoid regions reject cosmetics and precision near misses',()=>{const p={x:0,y:0,z:-12,yaw:0,hat:99,backbling:99};assert.equal(humanHit({x:0,y:2.2,z:0},direction(0),p).distance,Infinity);assert.equal(humanHit({x:0,y:1.68,z:0},direction(0),p).region,'head');assert.equal(humanHit({x:.25,y:1.68,z:0},direction(0),p,weapon('needle').hitRadius).distance,Infinity);});
test('authoritative cadence cannot be exceeded by direct calls or duplicate packets',()=>{
 for(const w of guns){const {s,p}=arena(w.id);let last=-100,accepted=0;for(let n=0;n<=60;n++){s.time=10+n/60;if(s.fire(p)){assert.ok(s.time-last+1e-8>=w.interval);last=s.time;accepted++;assert.equal(s.fire(p),false);}if(w.burst&&p.burstLeft&&s.time+1e-9>=p.burstTime){if(s.fire(p,true)){p.burstLeft--;p.burstTime=s.time+w.burstInterval;assert.equal(s.fire(p,true),false);}}}assert.ok(accepted<=Math.floor(1/w.interval)+1);}
 const {s,p}=arena('pip');s.setInput(p.id,{seq:1,fire:true});s.setInput(p.id,{seq:1,fire:true});assert.equal(s.inputs.get(p.id).firePress,1);s.setInput(p.id,{seq:2,fire:false});s.setInput(p.id,{seq:3,fire:true});assert.equal(s.inputs.get(p.id).firePress,3);
});
test('semi-auto trigger buffering accepts a timely tap without adding hold fire',()=>{const {s,p}=arena('pip');s.combatInput(p,{fire:true,firePress:1});p.fireLatch=true;s.time+=.12;s.combatInput(p,{fire:false,firePress:1});s.combatInput(p,{fire:true,firePress:2});s.time+=.09;s.combatInput(p,{fire:false,firePress:2});assert.equal(p.ammo[0],98);s.time+=.25;s.combatInput(p,{fire:true,firePress:2});assert.equal(p.ammo[0],98);});
test('swapping preserves weapon and shotgun-family delays and interrupts reload safely',()=>{const {s,p}=arena('scatter');s.fire(p);const ready=weaponReadyAt(p,weapon('scatter'));p.inventory=[{id:'doubleyolk',weapon:true,rarity:0}];beginEquip(p,s.time,true);s.time+=.6;assert.equal(s.fire(p),false);s.time=ready+.001;assert.equal(s.fire(p),true);p.ammo[0]=0;s.time+=2;s.reload(p);const reserve=p.reserve[0];p.reloadEnd=0;p.inventory=[{id:'pip',weapon:true,rarity:0}];beginEquip(p,s.time,true);assert.equal(p.reserve[0],reserve);assert.equal(s.fire(p),false);});
test('all six stances, ADS, bloom, recoil and the projected reticle share accuracy',()=>{
 for(const w of guns){const p={grounded:true,aim:false,slot:0},a={};updateCombatAccuracy(p,w,a,1,10,0);const idle=a.spread;updateCombatAccuracy({...p,crouching:true},w,a,1,11,0);assert.ok(a.spread<idle,w.id+' crouch');updateCombatAccuracy(p,w,a,1,12,5);assert.ok(a.spread>idle,w.id+' walking');updateCombatAccuracy({...p,sliding:true},w,a,1,13,7.4);assert.ok(a.spread>idle,w.id+' sliding');updateCombatAccuracy({...p,grounded:false},w,a,1,14,5);assert.ok(a.spread>idle,w.id+' airborne');updateCombatAccuracy({...p,sprinting:true},w,a,1,15,7.4);assert.ok(a.spread>idle,w.id+' sprint');p.aim=true;for(let i=0;i<90;i++)updateCombatAccuracy(p,w,a,1/60,16+i/60,0);assert.ok(a.spread<idle);if(w.stableScope){assert.equal(a.spread,0);updateCombatAccuracy({...p,grounded:false},w,a,.1,18,0);assert.ok(a.spread>0);}firedAccuracy(p,w,a,20);assert.ok(a.recoilPitch>0);for(let i=0;i<180;i++)updateCombatAccuracy(p,w,a,1/60,20+i/60,0);assert.ok(a.recoilPitch<.00001);assert.equal(a.bloom,0);}
 assert.ok(Math.abs(crosshairRadius(.1,800,1.2)-Math.tan(.05)*480)<1e-9);
});
test('every magazine and tactical/empty reload agrees with animation time',()=>{for(const w of guns)for(const empty of [false,true]){const {s,p}=arena(w.id);p.ammo[0]=empty?0:w.magazine-1;p.reserve[0]=w.magazine;assert.equal(s.reload(p),true);assert.equal(s.reload(p),false);assert.equal(p.reloadDuration,empty?w.reloadEmpty:w.reload);assert.ok(Math.abs(reloadProgress(p,s.time+p.reloadDuration/2)-.5)<1e-9);s.time=p.reloadEnd;s.tick(1/60);assert.equal(p.ammo[0],w.magazine);assert.equal(p.reserve[0],empty?0:w.magazine-1);}});
test('strongest/weakest close and distant matchups retain category counterplay',()=>{const smg=weapon('zipper'),ar=weapon('sprinter');const dps=(w,d)=>w.damage*w.pellets*w.roundsPerSecond*falloffAt(w,d);assert.ok(dps(smg,12)>dps(ar,12));assert.ok(dps(smg,40)<dps(ar,40));assert.ok(dps(weapon('anchor'),100)<dps(weapon('peeper'),100));for(const id of ['scatter','doubleyolk']){const w=gun({slot:0,inventory:[{id,weapon:true,rarity:4}]});assert.ok(w.damage*w.pellets*w.critical<200);assert.ok(falloffAt(w,35)<.1);assert.ok(w.patternFixed&&w.shotgunLock);}assert.ok(weapon('pip').equipTime<ar.equipTime);});
test('build pressure and explosions use independent central values and physical projectiles',()=>{assert.deepEqual(Object.values(MATERIALS).map(m=>m.health),[150,300,500]);for(const w of guns)assert.equal(structureDamage(w,40),w.buildDamage*(w.buildFalloff?falloffAt(w,40):1));const {s,p}=arena('thumper');s.fire(p);let b=s.projectiles[0];assert.ok(Math.abs(Math.hypot(b.vx,b.vy,b.vz)-weapon('thumper').boltSpeed)<1e-8);assert.equal(b.hitRadius,.08);s.launch(p,true);b=s.projectiles.at(-1);assert.equal(b.damage,85);assert.equal(b.gravity,UTILITY_WEAPONS.popper.gravity);});
test('bots switch by effective range/ammo and chest ammunition matches every weapon',()=>{const p={x:0,y:0,z:0,slot:1,inventory:[null,{id:'scatter',weapon:true,ammo:5},{id:'sprinter',weapon:true,ammo:30},{id:'needle',weapon:true,ammo:1}],bank:{shells:0,medium:0,heavy:0}};assert.equal(selectWeapon(p,{x:0,y:0,z:-4}),1);assert.equal(selectWeapon(p,{x:0,y:0,z:-50}),2);assert.equal(selectWeapon(p,{x:0,y:0,z:-200}),3);p.inventory[3].ammo=0;assert.equal(selectWeapon(p,{x:0,y:0,z:-200}),2);let seed=4;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(let i=0;i<300;i++){const [w,a]=rollChest(random);assert.equal(a.ammoType,ammoType(w.id));assert.ok(a.count>=AMMO_RULES[a.ammoType].min&&a.count<=AMMO_RULES[a.ammoType].max);}});
