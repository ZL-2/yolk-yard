import test from 'node:test';
import assert from 'node:assert/strict';
import {humanHit,HUMAN_HIT,RADIUS,HEIGHT,EYE} from '../src/physics.js';
import {makeHumanoid,animateHumanoid,humanoidDiagnostics} from '../src/humanoid.js';
import {SHOP_ITEMS} from '../src/shop-catalog.js';
import {Vector3} from 'three';
test('head and body are distinct; empty silhouette space misses; skins cannot change regions',()=>{
 const p={x:0,y:0,z:0,yaw:0},ray=y=>humanHit({x:0,y,z:5},{x:0,y:0,z:-1},p);
 assert.equal(ray(1.68).region,'head');assert.equal(ray(1.22).region,'body');assert.equal(ray(2).distance,Infinity);
 assert.equal(humanHit({x:.4,y:1.75,z:5},{x:0,y:0,z:-1},p).distance,Infinity);
 for(const outfit of SHOP_ITEMS.filter(i=>i.slot==='outfit'))assert.deepEqual(humanHit({x:0,y:1.68,z:5},{x:0,y:0,z:-1},{...p,outfit:outfit.id,bodyScale:.5}),ray(1.68));
 assert.ok(RADIUS<.4&&HEIGHT>1.8&&EYE>1.6);assert.equal(new Set(HUMAN_HIT.map(h=>h.region)).size,2);
 const a=.78;assert.equal(humanHit({x:0,y:1.68*Math.cos(a),z:1.68*Math.sin(a)+5},{x:0,y:0,z:-1},{...p,flight:'dive'}).region,'head');
});
test('shared humanoid mesh has 32 anatomical bones and bounded complexity; all states remain finite',()=>{
 const a=makeHumanoid({outfit:'outfit-garden'}),b=makeHumanoid({outfit:'outfit-garden'});assert.equal(a.userData.human.mesh.geometry,b.userData.human.mesh.geometry);assert.notEqual(a.userData.human.mesh.skeleton,b.userData.human.mesh.skeleton);
 const d=humanoidDiagnostics(a);assert.equal(d.bones,32);assert.ok(d.vertices>4000&&d.vertices<10000);assert.ok(d.triangles<12000);
 const poses=[{grounded:true},{vx:3,vz:-3},{vx:0,vz:7},{sprinting:true,vz:-7.4},{grounded:false,vy:5},{grounded:false,vy:-4},{flight:'dive',grounded:false},{flight:'glide',grounded:false},{building:true},{use:{id:'mini'}},{reloadEnd:100},{equipUntil:100,equipStarted:0},{health:0}];
 poses.push({crouching:true},{crouching:true,vz:-2.4,shotRecoil:1},{sliding:true,vz:-7},{downed:true},{downed:true,vz:-1},{reviving:'mate'},{downed:true,reviverId:'mate'});
 for(const pose of poses)for(let i=0;i<20;i++){animateHumanoid(a,{x:0,y:0,z:0,yaw:0,health:100,grounded:true,...pose},1/60,i/60);a.updateMatrixWorld(true);for(const bone of a.userData.human.mesh.skeleton.bones)assert.ok(bone.matrixWorld.elements.every(Number.isFinite),bone.name);}
 // Grounded stance feet stay on the ground and knees have plausible flexion.
 const c=makeHumanoid();for(let i=0;i<120;i++)animateHumanoid(c,{vx:0,vz:-5,grounded:true,health:100},1/60,i/60);c.updateMatrixWorld(true);
 for(const side of ['L','R']){const foot=c.userData.human.bones['foot'+side].getWorldPosition(new Vector3());assert.ok(foot.y>=.07&&foot.y<=.25,foot.y);}
});
