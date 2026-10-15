import test from 'node:test';import assert from 'node:assert/strict';import {MAPS,navigation,surfaceAt} from '../src/maps.js';import {arenaSpawnPoints} from '../src/arena-spawns.js';import {canStand,RADIUS} from '../src/physics.js';import {lobbyScene} from '../src/lobby-scene.js';
import * as THREE from 'three';import {FrontierArt} from '../src/frontier-art.js';
test('every Ravelfront arena has safe bases and bot-reachable pickups on the new geometry',()=>{
 assert.deepEqual(MAPS.map(m=>m.name),['Aster Relay','Breakwater Docks','Ironwake Foundry']);
 for(const m of MAPS){assert.equal(m.theme,'frontier');assert.ok(m.boxes.length<100);assert.ok(arenaSpawnPoints(m).length>=30);
  for(const [x,z]of m.bases)assert.ok(canStand(m,{x,z,y:surfaceAt(m,x,z)},RADIUS),m.name+' base');
  for(const base of m.bases){const from={x:base[0],z:base[1],y:0};for(const [x,z]of [...m.bases,...m.pickups]){const y=surfaceAt(m,x,z);assert.ok(canStand(m,{x,z,y},RADIUS),m.name+' pickup');if(Math.hypot(x-from.x,z-from.z)<2)continue;const route=navigation(m).path(from,{x,y,z}),last=route.at(-1);assert.ok(last&&Math.hypot(last.x-x,last.z-z,last.y-y)<2,m.name+' route '+[x,z]);}}
 }
});
test('detailed lobby is bounded, statically batched and keeps the patrol conveyor continuous',()=>{
 const scene=lobbyScene(),segments=scene.userData.moving;assert.equal(segments.length,4);assert.ok(segments.every(s=>s.model.children.length<=3&&s.model.userData.details>150));
 let triangles=0,meshes=0;scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const attr of Object.values(o.geometry.attributes))assert.ok(attr.array.every(Number.isFinite));}});assert.ok(meshes<=17);assert.ok(triangles<100000);const before=scene.userData.distance;scene.userData.update(1/60);assert.ok(scene.userData.distance>before);for(let i=0;i<3000;i++)scene.userData.update(1/60);assert.ok(segments.every(s=>s.model.position.z>=-90&&s.model.position.z<30));
 scene.traverse(o=>{if(o.isMesh){if(!o.geometry.userData.shared)o.geometry.dispose();if(!o.material.userData.shared)o.material.dispose();}});
});
test('Frontier environment preserves PBR, world-scale ground UVs, shared resources and cover records',()=>{
 const a=new FrontierArt(),world=new THREE.Group(),cover=Object.freeze({x:5,y:0,z:7,w:4,h:1.5,d:2,kind:'cover',color:'concrete'}),unchanged={...cover};
 a.box(0,1,0,2,2,2,'slate');a.groundBox(0,-.13,0,80,.26,80,0x687b6b,'soil');a.groundBox(0,.02,0,70,.03,8,0x4c6067,'stone');a.wallDetail(cover);a.wallDetail({x:9,y:0,z:10,w:7,h:3,d:3,kind:'container',color:'teal'});a.pine(20,20,8);a.rock(-15,1,20,3,2,3);a.lamp(12,-8);a.truck(-10,-10);
 let disposedShared=0;const shared=[];a.scenery.traverse(m=>{if(m.isMesh)for(const asset of [m.geometry,m.material])if(asset.userData.shared&&!shared.includes(asset)){shared.push(asset);asset.addEventListener('dispose',onDispose);}});function onDispose(){disposedShared++;}
 a.bake(world);assert.deepEqual(cover,unchanged);assert.equal(world.children.length,5);assert.equal(world.children.filter(m=>m.userData.frontierArchitecture&&m.material.userData.architectureAtlas).length,1);assert.equal(world.children.filter(m=>m.userData.frontierEnvironment).length,2);
 const ground=world.children.filter(m=>m.userData.environmentGround);assert.equal(ground.length,2);assert.ok(ground.every(m=>m.geometry.attributes.uv.array.some(v=>Math.abs(v)>10)));
 for(const mesh of world.children){for(const attribute of Object.values(mesh.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));if(mesh.material.isMeshStandardMaterial){assert.ok(mesh.material.map&&mesh.material.normalMap&&mesh.material.roughnessMap);assert.equal(mesh.material.userData.shared,true);assert.notEqual(mesh.userData.ownedMaterial,true);}mesh.geometry.dispose();if(mesh.userData.ownedMaterial)mesh.material.dispose();}
 assert.equal(disposedShared,0);for(const asset of shared)asset.removeEventListener('dispose',onDispose);
});
test('private FFA guests receive each current arena and host-authoritative movement',async()=>{
 const {startRealtimeServer}=await import('../server/realtime/index.js'),{Network}=await import('../src/network.js'),{Simulation}=await import('../src/simulation.js'),{safeProfile}=await import('../src/data.js'),{default:WebSocket}=await import('ws');
 const app=await startRealtimeServer({host:'127.0.0.1',port:0}),nets=[];globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 const wait=async fn=>{const end=Date.now()+5000;while(!fn()){assert.ok(Date.now()<end,'hosted arena timeout');await new Promise(r=>setTimeout(r,15));}};
 try{for(const map of MAPS){let state;const sim=new Simulation({mode:'ffa',map:map.id,bots:0});sim.addPlayer('host',{name:'Coastal Captain'});
  const host=new Network({getCheckpoint:()=>sim.checkpoint(),onJoin:(id,p,a)=>!!sim.admitPlayer(id,p,a),onInput:(id,i)=>sim.setInput(id,i,true)}),guest=new Network({onState:s=>state=s});nets.push(host,guest);
  const code=await host.host();host.setVisibility('private');host.broadcast(sim.snapshot());await guest.join(code,safeProfile({name:'Coastal Guest'}));sim.startRound();for(const p of sim.players.values())sim.spawn(p);host.broadcast(sim.snapshot());await wait(()=>state?.phase==='playing');
  assert.equal(state.options.map,map.id);assert.notEqual(guest.serverAuthority,true);assert.equal(app.relay.authority.rooms.size,0);for(const p of sim.players.values())assert.ok(canStand(map,p,RADIUS));
  guest.input({seq:1,crouch:true,dt:1/60});await wait(()=>sim.inputs.get(guest.id)?.crouch);sim.tick(1/60);assert.ok(sim.players.get(guest.id).crouching);host.destroy();guest.destroy();
 }}finally{for(const n of nets)n.destroy();await app.close();}
});
