import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {monitorEventLoopDelay} from 'node:perf_hooks';
import {Session} from 'node:inspector';
import {writeFileSync} from 'node:fs';
const profiler=process.env.RAVEL_CAPACITY_PROFILE?new Session():null;if(profiler){profiler.connect();profiler.post('Profiler.enable');}
const root=process.env.RAVEL_TEST_ROOT;
const source=path=>import(pathToFileURL(resolve(root,path)));
const [{startRealtimeServer},{Simulation},{RoyaleSimulation},{groundAt},{weapon,rng}]=await Promise.all([
 source('server/realtime/index.js'),source('src/simulation.js'),source('src/royale.js'),source('src/terrain.js'),source('src/data.js')]);
const app=await startRealtimeServer({port:0,host:'127.0.0.1'}),authority=app.relay.authority;
let costs={},cpu,start;
const loop=monitorEventLoopDelay({resolution:10});loop.enable();
function wrap(object,name,key){const original=object[name];object[name]=function(...args){const at=performance.now();try{return original.apply(this,args);}finally{costs[key]=(costs[key]||0)+performance.now()-at;}};}
wrap(Simulation.prototype,'botInput','arenaAI');wrap(RoyaleSimulation.prototype,'botInput','royaleAI');wrap(authority,'broadcast','broadcast');
for(const Type of [Simulation,RoyaleSimulation]){const original=Type.prototype.tick;Type.prototype.tick=function(...args){if(Type===Simulation&&this instanceof RoyaleSimulation)return original.apply(this,args);const at=performance.now();try{return original.apply(this,args);}finally{costs.simulation=(costs.simulation||0)+performance.now()-at;costs.ticks=(costs.ticks||0)+1;}};}
process.on('message',async message=>{
 if(message.type==='phase'){
  for(const room of authority.rooms.values()){
   const sim=room.sim;sim.random=rng(42);
   if(sim.options.mode==='royale'){
    sim.beginBattle();sim.elapsed=sim.route.duration+2;sim.startedAt=sim.time-sim.elapsed;sim.stage='active';
    let i=0;for(const p of sim.players.values()){const angle=i++*2.399;Object.assign(p,{flight:'ground',grounded:true,x:Math.cos(angle)*70,z:Math.sin(angle)*70,botSeed:i*.618,shieldUntil:0,health:100,shield:100,brain:null});p.y=groundAt(sim.map,p.x,p.z)+2;p.inventory[1]={id:'sprinter',weapon:true,count:1,rarity:0,ammo:weapon('sprinter').magazine};p.slot=1;p.bank.medium=400;sim.syncInventory(p);}
   }
   // Sustain the advertised population while retaining actual shots, cover,
   // collision and damage-event work. This is a synthetic capacity fixture.
   const damage=sim.damage;sim.damage=function(p,attacker,amount,...args){p.health=100;p.shield=sim.options.mode==='royale'?100:0;return damage.call(this,p,attacker,Math.min(amount,sim.options.mode==='royale'?150:60),...args);};
  }
  process.send({type:'phased'});
 }
 if(message.type==='begin'){costs={};loop.reset();if(profiler)profiler.post('Profiler.start');cpu=process.cpuUsage();start=performance.now();process.send({type:'begun'});}
 if(message.type==='end'){
  const used=process.cpuUsage(cpu),seconds=(performance.now()-start)/1000;
  if(profiler)await new Promise(resolve=>profiler.post('Profiler.stop',(error,result)=>{if(!error)writeFileSync(process.env.RAVEL_CAPACITY_PROFILE,JSON.stringify(result.profile));resolve();}));
  process.send({type:'result',seconds,cpuMsPerSecond:(used.user+used.system)/1000/seconds,costs,loopP99Ms:loop.percentile(99)/1e6,loopMaxMs:loop.max/1e6,rooms:[...authority.rooms.values()].map(({sim})=>({humans:[...sim.players.values()].filter(p=>!p.bot).length,bots:[...sim.players.values()].filter(p=>p.bot).length,alive:[...sim.players.values()].filter(p=>p.health>0&&!p.spectating).length,phase:sim.stage||sim.phase})),capacity:authority.capacity?.snapshot()});
 }
 if(message.type==='close'){await app.close();process.exit();}
});
process.send({type:'ready',port:app.server.address().port});
