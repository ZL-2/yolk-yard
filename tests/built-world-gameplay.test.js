import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import WebSocket from 'ws';
import {SLIDER_DEFAULTS,perspectiveFov,resetSliders} from '../src/settings.js';
import {validatePlayerName} from '../src/player-name.js';
import {canSpectate,spectatorTargets,watcherAction} from '../src/spectator-status.js';
import {startRealtimeServer} from '../server/realtime/index.js';
import {VERSION} from '../src/data.js';

test('first and third person keep independent saved FOVs with a 65-degree third-person default',()=>{
 const settings={...SLIDER_DEFAULTS,fov:103};
 assert.equal(perspectiveFov(settings),103);assert.equal(perspectiveFov(settings,true),65);
 settings.thirdPersonFov=78;assert.equal(perspectiveFov(settings),103);assert.equal(perspectiveFov(settings,true),78);
 resetSliders(settings,'thirdPersonFov');assert.equal(settings.fov,103);assert.equal(settings.thirdPersonFov,65);
 assert.equal(perspectiveFov({fov:96},true),65);assert.equal(perspectiveFov({thirdPersonFov:Infinity},true),65);
});
test('name rejection returns specific useful reasons without silently accepting a replacement',()=>{
 for(const [name,reason]of [['','empty'],['Longer Than Eighteen Characters','length'],['Player','reserved'],['Scout/','format'],['Scout12345','privacy'],['idiot','language']]){
  const result=validatePlayerName(name);assert.equal(result.ok,false,name);assert.equal(result.reason,reason);assert.ok(result.message.length>12);
 }
 assert.deepEqual(validatePlayerName('  Élan Scout  '),{ok:true,name:'Élan Scout',message:'',reason:null});
});
test('bosses and henchmen cannot become camera or authoritative watcher targets',()=>{
 const players=[{id:'viewer',health:0,spectating:true,killerId:'guard'},{id:'boss',health:100,boss:'voss',bot:true},{id:'guard',health:100,henchman:true,bot:true},{id:'contestant',health:100,bot:true},{id:'human',health:100}];
 const state={players,options:{mode:'royale',teamSize:1}},sim={players:new Map(players.map(p=>[p.id,p]))},viewer=players[0];
 for(const id of ['boss','guard']){assert.equal(canSpectate(sim.players.get(id),'viewer'),false);watcherAction(sim,viewer,'watch:'+id);assert.equal(viewer.watchingId,null);}
 assert.deepEqual(spectatorTargets(state,'viewer').map(p=>p.id),['human']);
 watcherAction(sim,viewer,'watch:contestant');assert.equal(viewer.watchingId,'contestant');
 state.players=players.filter(p=>p.id!=='human');assert.deepEqual(spectatorTargets(state,'viewer').map(p=>p.id),['contestant']);
});

function social(url,name,token){
 const ws=new WebSocket(url,{origin:'https://zl-2.github.io'}),pending=new Map();let serial=0,helloResolve,helloReject;
 const ready=new Promise((resolve,reject)=>{helloResolve=resolve;helloReject=reject;});
 ws.on('error',helloReject);ws.on('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION,profile:{name},token})));
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='hello')helloResolve(m);if(m.type==='reply'){const p=pending.get(m.request);if(p){clearTimeout(p.timer);pending.delete(m.request);m.error?p.reject(Error(m.error)):p.resolve(m.result);}}});
 return {ws,ready,ask(type,data={}){return new Promise((resolve,reject)=>{const request=++serial,timer=setTimeout(()=>reject(Error('Social reply timed out')),5000);pending.set(request,{resolve,reject,timer});ws.send(JSON.stringify({type,request,...data}));});}};
}
test('private friend nicknames survive a relay restart, never leak to the friend, and can be removed',async()=>{
 const dir=await mkdtemp('/tmp/ravel-nicknames-'),previous=process.env.RAVEL_SOCIAL_DATA_PATH;process.env.RAVEL_SOCIAL_DATA_PATH=dir+'/social.json';
 let app;const clients=[];
 try{
  const start=async()=>{app=await startRealtimeServer({port:0,host:'127.0.0.1',mapPath:dir+'/maps.json'});return `ws://127.0.0.1:${app.server.address().port}/social`;};
  let url=await start();const a=social(url,'Copper Scout'),b=social(url,'Harbor Scout');clients.push(a,b);const ah=await a.ready,bh=await b.ready;
  await assert.rejects(a.ask('friend-nickname',{id:bh.id,nickname:'Captain'}),/friend first/);
  await a.ask('friend-send',{id:bh.id});await b.ask('friend-accept',{id:ah.id});
  await a.ask('friend-nickname',{id:bh.id,nickname:'Captain'});
  assert.equal((await a.ask('social')).friends[0].nickname,'Captain');assert.equal((await b.ask('social')).friends[0].nickname,'');
  await assert.rejects(a.ask('profile',{profile:{name:'Scout/'}}),/letters, numbers/);
  await assert.rejects(a.ask('friend-nickname',{id:bh.id,nickname:'Far Too Many Characters Here'}),/18 characters/);
  a.ws.close();b.ws.close();await app.close();url=await start();
  const restored=social(url,'Copper Scout',ah.token);clients.push(restored);await restored.ready;
  const friend=(await restored.ask('social')).friends[0];assert.equal(friend.nickname,'Captain');assert.equal(friend.name,'Harbor Scout');
  await restored.ask('friend-nickname',{id:bh.id,nickname:''});assert.equal((await restored.ask('social')).friends[0].nickname,'');
  await restored.ask('friend-nickname',{id:bh.id,nickname:'Captain'});await restored.ask('friend-remove',{id:bh.id});assert.equal(app.relay.parties.store.nickname(ah.id,bh.id),'');
 }finally{for(const c of clients)c.ws.close();await app?.close();if(previous===undefined)delete process.env.RAVEL_SOCIAL_DATA_PATH;else process.env.RAVEL_SOCIAL_DATA_PATH=previous;await rm(dir,{recursive:true,force:true});}
});
