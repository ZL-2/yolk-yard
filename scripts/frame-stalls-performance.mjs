import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';
const root=resolve(process.argv[2]||'.'),tag=process.argv[3]||'current',load=p=>import(pathToFileURL(resolve(root,p))),stats=a=>{a.sort((a,b)=>a-b);return{p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
const [{RoyaleSimulation},{rebuildMap,applyBuildState},{candidates},{TeamingMonitor},{MatchReplays},{OwnerStore}]=await Promise.all(['src/royale.js','src/building.js','src/physics.js','src/teaming-monitor.js','server/realtime/match-replays.js','server/realtime/owner-store.js'].map(load));
const sim=new RoyaleSimulation({bots:0,fill:false,capacity:48,seed:226});for(let i=0;i<48;i++)sim.addPlayer('p'+i,{name:'Local '+i});sim.startRound();sim.beginBattle();
sim.builds=Array.from({length:600},(_,i)=>({id:'build-'+i,type:i%3?'wall':'stairs',x:-120+i%30*8,y:2,z:-96+Math.floor(i/30)*8,rotation:0,mask:0,material:'wood',health:100}));rebuildMap(sim);
const client={...sim.map,boxes:sim.map.boxes.slice(),authored:sim.worldBoxes};let version=0;
const packet=()=>({matchId:sim.matchId,round:1,buildVersion:++version,builds:sim.builds,worldDamage:sim.worldDamage,doors:sim.doors});applyBuildState(client,packet());candidates(sim.map,{x:0,y:0,z:0});candidates(client,{x:0,y:0,z:0});
const host=[],guest=[];
for(let i=0;i<100;i++){sim.builds[1].mask=i%2?16:0;let at=performance.now();rebuildMap(sim);candidates(sim.map,{x:0,y:0,z:0});host.push(performance.now()-at);at=performance.now();applyBuildState(client,packet());candidates(client,{x:0,y:0,z:0});guest.push(performance.now()-at);}
const monitor=new TeamingMonitor({identity:id=>id,onFlag:()=>{}}),players=new Map(Array.from({length:48},(_,i)=>['p'+i,{id:'p'+i,x:i%6*2,y:0,z:Math.floor(i/6)*2,health:100,team:i,contestant:true,connected:true,flight:'ground'}]));
const observed={players,time:20,elapsed:20,phase:'playing',stage:'active',options:{mode:'royale',teamSize:1},storm:{radius:1000},accessible:()=>true},slices=[];
for(let i=0;i<100;i++){observed.time=observed.elapsed=20+i*2;do{const at=performance.now();monitor.sample(observed);slices.push(performance.now()-at);}while(monitor.work);}
const directory=await mkdtemp(tmpdir()+'/stalls-replay-'),db=new OwnerStore({path:directory+'/replay.sqlite',legacyPath:null});db.db.exec('CREATE TABLE IF NOT EXISTS teaming_cases(id TEXT,data TEXT);CREATE TABLE IF NOT EXISTS fair_play_reports(id TEXT,room TEXT,match_id TEXT);');
const relay={owner:{db},progression:{accounts:new Map()}},replays=new MatchReplays(relay),capture=[],room={sim,code:'LOCAL',members:new Map([['p0',{}]])};
try{for(let i=0;i<40;i++){sim.time+=.5;const at=performance.now();replays.server(room);capture.push(performance.now()-at);await new Promise(r=>setTimeout(r,5));}await replays.close();}finally{await db.close();await rm(directory,{recursive:true,force:true});}
const result={tag,buildCap:600,humans:48,collisionHostMs:stats(host),collisionGuestMs:stats(guest),fairPlaySliceMs:stats(slices),captureMainThreadMs:stats(capture),replayWorker:!!replays.writer};await mkdir('test-results/frame-stalls',{recursive:true});await writeFile('test-results/frame-stalls/cpu-'+tag+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
