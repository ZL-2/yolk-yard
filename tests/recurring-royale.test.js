import test from 'node:test';
import assert from 'node:assert/strict';
import {RoyaleSimulation} from '../src/royale.js';
import {publicRoyaleOptions,PUBLIC_ROYALE} from '../src/public-royale.js';
import {RealtimeRelay} from '../server/realtime/relay.js';
import {lobbyMarkup,publicRoyaleMarkup} from '../src/lobby-ui.js';
import {markerAction} from '../src/team-markers.js';
import {movePlayer,canStand} from '../src/physics.js';
import {startShadowstep} from '../src/shadowstep.js';
import {fallDamage} from '../src/airborne.js';
import {initializeFrontier,setDoor} from '../src/frontier-world.js';
import {resetBuilding} from '../src/building.js';
import {SoundVisuals} from '../src/sound-visuals.js';
const publicSim=()=>new RoyaleSimulation({...publicRoyaleOptions(),seed:137});
test('public simulation is absent from the relay and an empty public card waits for its first host',async()=>{
 const relay=new RealtimeRelay();try{relay.authority.ensurePublicRoyale();assert.equal(relay.authority.rooms.size,0);assert.equal(relay.authority.publicSummary().hosting,'player');assert.equal(relay.authority.publicSummary().humanPlayers,0);assert.equal(relay.authority.publicSummary().joinable,true);assert.equal(PUBLIC_ROYALE.warmupSeconds,30);}finally{relay.close();}
});
test('48 humans replace bots and retain the full 30-second public join window',()=>{
 const sim=publicSim();sim.startRound();assert.equal(sim.queueEnds,0);
 for(let i=0;i<48;i++)assert.ok(sim.admitPlayer('human-'+i,{name:'Human '+i}));
 assert.equal(sim.queueEnds-sim.time,30);assert.equal([...sim.players.values()].filter(p=>p.bot&&p.contestant).length,0);
 sim.time=sim.queueEnds-.1;sim.advanceWarmupClock();assert.equal(sim.stage,'starting');assert.equal(sim.admitPlayer('extra',{name:'Extra'}),null);
 sim.time=sim.queueEnds;sim.advanceWarmupClock();assert.equal(sim.stage,'battle-bus');
 const viewer=sim.admitPlayer('viewer',{name:'Late Viewer'},{spectator:true,publicSpectator:true});assert.ok(viewer.lateSpectator);assert.equal(viewer.contestant,false);
});
test('public results restart after ten seconds and a checkpoint retains the remaining result timer',()=>{
 const sim=publicSim();sim.addPlayer('host',{name:'Host'});sim.startRound();const old=sim.matchId;sim.phase='results';sim.stage='finished';sim.tick(1/60);const deadline=sim.publicRestartAt;
 const copy=new RoyaleSimulation(sim.options).restore(sim.checkpoint());assert.equal(copy.publicRestartAt,deadline);copy.time=deadline-.02;copy.tick(1/60);assert.equal(copy.matchId,old);copy.tick(1/60);assert.notEqual(copy.matchId,old);assert.equal(copy.stage,'spawn-island');assert.equal(copy.queueEnds-copy.time,30);
});
test('landing markers use the battle map during Spawn Island and survive departure',()=>{
 const sim=publicSim(),p=sim.addPlayer('host',{name:'Planner'});sim.startRound();assert.ok(markerAction(sim,p,'ping-'+JSON.stringify({kind:'map',x:180,z:-150})));assert.equal(sim.markers.length,1);assert.equal(sim.markers[0].planning,true);assert.equal(sim.markers[0].x,180);
 sim.time=sim.queueEnds;sim.advanceWarmupClock();assert.equal(sim.stage,'battle-bus');assert.equal(sim.snapshot().royale.markers[0].x,180);
});
test('an airborne Shadowstep prevents landing damage; a later ordinary fall still hurts',()=>{
 const sim=publicSim(),p=sim.addPlayer('host',{name:'Dasher'}),map={id:'flat',theme:'royale',size:256,boxes:[]};Object.assign(p,{x:0,y:40,z:0,yaw:0,health:100,flight:'ground',grounded:false,vy:-5,spectating:false,fall:{apex:40,immune:false,source:'normal'}});
 assert.equal(startShadowstep(p,{id:'shadowstep'},0),true);for(let i=0;i<180&&!p.grounded;i++)movePlayer(p,{},map,1/60);assert.equal(p.grounded,true);assert.equal(fallDamage(p.landing),0);
 Object.assign(p,{y:40,grounded:false,vy:-5,fall:null,landing:null});for(let i=0;i<180&&!p.grounded;i++)movePlayer(p,{},map,1/60);assert.ok(fallDamage(p.landing)>=100);
});
test('an open door cannot trap an overlapping player and cannot close onto that player',()=>{
 const sim=publicSim(),p=sim.addPlayer('host',{name:'Door Test'}),door={id:'door-test',x:0,y:0,z:0,w:1.6,h:2.4,d:.2};sim.map={id:'flat',theme:'royale',size:256,doors:[door],boxes:[{...door,doorId:door.id,objectId:'world-door-'+door.id}]};resetBuilding(sim);initializeFrontier(sim);Object.assign(p,{x:0,y:0,z:0,grounded:true,flight:'ground',health:100,vy:0,yaw:0});assert.equal(canStand(sim.map,p),false);assert.equal(setDoor(sim,door,true,p),true);assert.equal(canStand(sim.map,p),true);sim.time+=1;assert.equal(setDoor(sim,door,false,p),false);
 for(let i=0;i<60;i++)movePlayer(p,{yaw:0,forward:1},sim.map,1/60);assert.ok(p.z<-3);assert.equal(canStand(sim.map,p),true);
});
test('visual footsteps omit teammates while preserving enemy footsteps',()=>{
 const fake={hidden:false,append(){},setAttribute(){},className:'',innerHTML:'',dataset:{},style:{setProperty(){}},querySelector:()=>({toggleAttribute(){},setAttribute(){}})},old=globalThis.document;globalThis.document={createElement:()=>({...fake})};
 try{const sounds=new SoundVisuals(fake),p={id:'me',team:1,x:0,y:0,z:0,health:100,yaw:0,flight:'ground'},mate={...p,id:'mate',x:3,moving:true,grounded:true,vx:2},enemy={...mate,id:'enemy',team:2,x:-3};sounds.update({phase:'playing',round:1,time:1,options:{mode:'royale',teamSize:2},royale:{stage:'active',matchId:'test',chests:[]},players:[p,mate,enemy],events:[]},p,{},1000);assert.equal(sounds.signals.has('footsteps:mate'),false);assert.equal(sounds.signals.has('footsteps:enemy'),true);}finally{globalThis.document=old;}
});
test('the public card shows the 30-second clock and blocks joins during host recovery',()=>{
 const model={profile:{name:'Test'},id:'a',online:true,balance:0,party:{leader:'a',state:'idle',members:[{id:'a',profile:{name:'Test'},ready:true}]},publicMatch:{phase:'playing',stage:'spawn-island',humanPlayers:7,capacity:48,joinable:true,countdownSeconds:30,estimatedSeconds:590,availableSeats:41,availableSpectators:16}};
 assert.match(lobbyMarkup(model),/30s to departure/);assert.match(publicRoyaleMarkup({...model,publicMatch:{...model.publicMatch,recovering:true}}),/CONNECTING PUBLIC HOST/);assert.match(publicRoyaleMarkup({...model,publicMatch:{...model.publicMatch,recovering:true}}),/disabled/);
});
