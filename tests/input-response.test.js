import test from 'node:test';
import assert from 'node:assert/strict';
import {GuestActions} from '../src/guest-actions.js';
import {GuestFire} from '../src/guest-fire.js';
import {RemoteInputBuffer} from '../src/remote-input.js';
import {responseFrameDue} from '../src/action-network.js';
import {makeBlaster,disposeBlaster} from '../src/weapons.js';
import {FrameStats} from '../src/frame-stats.js';
import {View} from '../src/view.js';
import * as THREE from 'three';
const state=()=>({options:{map:'sunnybreak'},round:1,royale:{matchId:'test'}});
const player=()=>({id:'g',health:100,flight:'ground',slot:0,ack:0,ammo:[0,30,8],inventory:[{id:'pickaxe',pickaxe:true},{id:'sprinter',weapon:true},{id:'scatter',weapon:true}],equipStarted:0,equipUntil:0});
test('weapon feedback starts before acknowledgement without mutating inventory or enabling early fire',()=>{
 const a=new GuestActions(),s=state(),p=player(),original=structuredClone(p),i={seq:1,slot:1,fire:true};
 assert.ok(a.input(s,p,i,10,1000));const visual=a.present(p,10,1000);
 assert.equal(visual.slot,1);assert.equal(visual.equipStarted,10);assert.equal(visual.inventory,p.inventory);assert.deepEqual(p,original);
 assert.equal(new GuestFire().step(p,i,10,1,1),null);
 a.receive(s,p,1100);assert.equal(a.present(p,10.1,1100).slot,1);
 const accepted={...p,slot:1,ack:1,equipStarted:10.1,equipUntil:10.6};a.receive(s,accepted,1150);
 assert.equal(a.present(accepted,10.15,1150).equipStarted,10,'Host acceptance must not restart the animation');
 a.receive(s,accepted,1200);assert.equal(a.present(accepted,10.2,1200).equipStarted,10);
 assert.equal(a.present(accepted,11,2000),accepted);
});
test('rapid switches, denial, changed inventory, death and new rounds reconcile cleanly',()=>{
 const a=new GuestActions(),s=state(),p=player();a.input(s,p,{seq:1,slot:1},10,1000);a.input(s,p,{seq:2,slot:2},10.05,1050);
 a.receive(s,{...p,slot:1,ack:1},1100);assert.equal(a.present(p,10.1,1100).slot,2);
 a.receive(s,{...p,ack:2},1150);assert.equal(a.present(p,10.15,1150),p);
 a.input(s,p,{seq:3,slot:1},11,2000);a.receive(s,{...p,slot:1,ack:3,inventory:[p.inventory[0],{id:'needle',weapon:true}]},2050);assert.equal(a.equip,null);
 a.input(s,p,{seq:4,slot:2},12,3000);a.receive({...s,round:2},p,3010);assert.equal(a.equip,null);
 a.input(s,p,{seq:5,slot:1},12,3000);a.receive(s,{...p,health:0},3010);assert.equal(a.equip,null);
 a.input(s,{...p,downed:true},{seq:6,slot:1},12,3000);assert.equal(a.equip,null);
});
test('interaction feedback is immediate, bounded, and clears on rejected or accepted acknowledgement',()=>{
 const a=new GuestActions(),s=state(),p=player();a.input(s,p,{seq:1,slot:0,interact:true},1,1000);
 assert.ok(a.interacting(1000));a.receive(s,p,1100);assert.ok(a.interacting(1100));
 a.receive(s,{...p,ack:1},1150);assert.equal(a.interacting(1150),false);assert.deepEqual(p.inventory,player().inventory);
 a.input(s,p,{seq:2,slot:0,interact:false},1.2,1200);a.input(s,p,{seq:3,slot:0,interact:true},1.3,1300);assert.equal(a.interacting(2400),false);
});
test('100 ms persistent backlog recovers within 150 ms and never creates movement credit',()=>{
 const b=new RemoteInputBuffer();let seq=0,total=0;
 for(let n=0;n<6;n++)b.push({seq:++seq,forward:1,slot:1});
 for(let n=0;n<600;n++){b.push({seq:++seq,forward:n<30?1:0,slot:1});const steps=b.take(1/60);total+=steps.length;assert.ok(total<=n+1);if(n>=8)assert.equal(b.last.seq,seq);}
 assert.equal(b.dropped,6);assert.equal(b.last.forward,0);
});
test('ordinary burst delivery drains using earned time without retiring movement',()=>{
 const b=new RemoteInputBuffer();let seq=0,count=0;
 for(let n=0;n<180;n++){if(n%4===3)for(let j=0;j<4;j++)b.push({seq:++seq});count+=b.take(1/60).length;}
 assert.equal(count,180);assert.equal(b.dropped,0);
});
test('retiring movement preserves same-slot taps, but never fires or drops a newly selected weapon',()=>{
 for(const sameSlot of [true,false]){
  const b=new RemoteInputBuffer();for(let seq=1;seq<=10;seq++)b.push({seq,slot:seq===10&&!sameSlot?2:1,forward:seq<10?1:0,interact:seq===2,fire:seq===3,drop:seq===4,jump:seq===5});
  const [next]=b.take(1/60);assert.equal(next.seq,10);assert.equal(next.forward,0);assert.ok(next.jump);assert.equal(!!next.fire,sameSlot);assert.equal(!!next.interact,sameSlot);assert.equal(!!next.drop,sameSlot);
 }
});
test('action snapshots are capped at 30 Hz; unchanged states retain the normal cadence',()=>{
 assert.equal(responseFrameDue({responseVersion:2},1/60,0,1),false);
 assert.equal(responseFrameDue({responseVersion:2},2/60,0,1),true);
 assert.equal(responseFrameDue({responseVersion:2},2/60,0,2),false);
 assert.equal(responseFrameDue({responseVersion:2},3/60,0,2),true);
});
test('cached gun models have independent articulated sockets and optic materials with shared immutable geometry',()=>{
 for(const id of ['sprinter','scatter','needle','comet','stormspike']){
  const a=makeBlaster(id),b=makeBlaster(id);const aa=[],bb=[];a.traverse(n=>aa.push(n));b.traverse(n=>bb.push(n));assert.equal(aa.length,bb.length);
  for(let i=0;i<aa.length;i++){assert.notEqual(aa[i],bb[i]);if(aa[i].geometry)assert.equal(aa[i].geometry,bb[i].geometry);}
  for(const key of ['muzzle','reloadPart','reloadToken','pump','bolt','lens'])if(a.userData[key]){assert.notEqual(a.userData[key],b.userData[key]);assert.ok(bb.includes(b.userData[key]));}
  if(a.userData.lens){assert.notEqual(a.userData.lens.material,b.userData.lens.material);a.userData.lens.material.opacity=.123;assert.notEqual(b.userData.lens.material.opacity,.123);}
  a.userData.muzzle.position.x=99;assert.notEqual(b.userData.muzzle.position.x,99);disposeBlaster(a);const c=makeBlaster(id);assert.notEqual(c.userData.muzzle.position.x,99);
 }
});
test('performance reports retain actual slow frames at a 30 FPS cap',()=>{
 const f=new FrameStats();for(let i=0;i<30;i++)f.frame(1000/30,'guest','royale');f.frame(180,'guest','royale');assert.match(f.text(),/worst frame 180.0 ms/);assert.match(f.text(),/frames over 50 ms 1\/31/);
});
test('first-person switches reuse private arm buffers and bound inactive model residency',()=>{
 const view=Object.assign(Object.create(View.prototype),{gunGroup:new THREE.Group(),viewmodelCamera:new THREE.Group(),scopeTarget:{texture:new THREE.Texture()},reticleTexture:new THREE.Texture()});
 const profile={health:100,weapon:'sprinter',slot:0,outfit:'outfit-wren'};view.setWeapon(profile,{holster:0});const first=view.localModel,arms=view.localArms;
 for(let n=0;n<10;n++){view.setWeapon({...profile,weapon:'needle'},{holster:0});view.setWeapon(profile,{holster:0});assert.equal(view.localModel,first);assert.equal(view.localArms,arms);}
 for(const weapon of ['sprinter','zipper','anchor','duet','pip','needle','scatter','thumper','peeper','doubleyolk','comet','stormspike'])view.setWeapon({...profile,weapon},{holster:0});
 view.clearOutgoing(view);assert.ok(view.weaponCache.size<=6);assert.equal(view.gunGroup.children.length,2);
});
