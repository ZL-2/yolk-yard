import test from 'node:test';import assert from 'node:assert/strict';import {MAPS,navigation,surfaceAt} from '../src/maps.js';import {arenaSpawnPoints} from '../src/arena-spawns.js';import {canStand,RADIUS} from '../src/physics.js';import {lobbyScene} from '../src/lobby-scene.js';
test('every Ravelfront arena has safe bases and bot-reachable pickups on the new geometry',()=>{
 assert.deepEqual(MAPS.map(m=>m.name),['Aster Relay','Breakwater Docks','Ironwake Foundry']);
 for(const m of MAPS){assert.equal(m.theme,'frontier');assert.ok(m.boxes.length<100);assert.ok(arenaSpawnPoints(m).length>=30);
  for(const [x,z]of m.bases)assert.ok(canStand(m,{x,z,y:surfaceAt(m,x,z)},RADIUS),m.name+' base');
  for(const base of m.bases){const from={x:base[0],z:base[1],y:0};for(const [x,z]of [...m.bases,...m.pickups]){const y=surfaceAt(m,x,z);assert.ok(canStand(m,{x,z,y},RADIUS),m.name+' pickup');if(Math.hypot(x-from.x,z-from.z)<2)continue;const route=navigation(m).path(from,{x,y,z}),last=route.at(-1);assert.ok(last&&Math.hypot(last.x-x,last.z-z,last.y-y)<2,m.name+' route '+[x,z]);}}
 }
});
test('detailed lobby is bounded, statically batched and keeps the patrol conveyor continuous',()=>{
 const scene=lobbyScene(),segments=scene.userData.moving;assert.equal(segments.length,4);assert.ok(segments.every(s=>s.model.children.length===1&&s.model.userData.details>150));
 let triangles=0,meshes=0;scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});assert.ok(meshes<=7);assert.ok(triangles<100000);const before=scene.userData.distance;scene.userData.update(1/60);assert.ok(scene.userData.distance>before);for(let i=0;i<3000;i++)scene.userData.update(1/60);assert.ok(segments.every(s=>s.model.position.z>=-90&&s.model.position.z<30));
 scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
});
test('FFA and Team Scramble clients receive every new arena from the authoritative server',async()=>{
 const {startRealtimeServer}=await import('../server/realtime/index.js'),{Network}=await import('../src/network.js'),{safeProfile}=await import('../src/data.js'),{default:WebSocket}=await import('ws');
 const app=await startRealtimeServer({host:'127.0.0.1',port:0}),nets=[];globalThis.window={YOLK_NETWORK:{relay:`ws://127.0.0.1:${app.server.address().port}/game`}};globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin:'https://zl-2.github.io'});}};
 try{for(const map of MAPS)for(const mode of ['ffa','teams']){let state;const host=new Network(),guest=new Network({onState:s=>state=s});nets.push(host,guest);const code=await host.host();await host.createAuthority({mode,map:map.id,bots:0},safeProfile({name:'Coastal Captain'}),'public');await guest.join(code,safeProfile({name:'Coastal Guest'}));const end=Date.now()+5000;while(!state){assert.ok(Date.now()<end);await new Promise(r=>setTimeout(r,20));}assert.equal(state.options.map,map.id);assert.equal(state.network.authority,'server');const room=app.relay.authority.rooms.get(host.peer.id);assert.equal(room.sim.map.name,map.name);host.authorityCommand({type:'start'});while(room.sim.phase!=='playing'){assert.ok(Date.now()<end);await new Promise(r=>setTimeout(r,20));}for(const p of room.sim.players.values())assert.ok(canStand(map,p,RADIUS));host.destroy();guest.destroy();}}
 finally{for(const n of nets)n.destroy();await app.close();}
});
