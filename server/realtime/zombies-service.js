import {randomUUID,randomInt} from 'node:crypto';
import {VERSION} from '../../src/data.js';
import {matchOptions} from '../../src/match-options.js';
import {ZombiesSimulation} from '../../src/zombies.js';
import {ZOMBIES} from '../../src/zombies-config.js';
import {ChatRoom} from '../../src/chat.js';
const address=code=>`yolk-yard-v${VERSION}-${code}`;
const code=()=>Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
export function queueZombies(service,u,m){
 const p=service.parties.get(u.party),a=service.relay.authority,privateMatch=p.selection.access==='private'||!!m.code,options=matchOptions({...p.selection,mode:'zombies',session:'online'});
 if(!m.code&&p.members.length>options.capacity)throw Error('Choose enough cooperative seats for your party.');
 let room=m.code?a.rooms.get(address(m.code)):null;
 if(m.code&&room?.sim.options.mode!=='zombies')throw Error('That Zombies room is unavailable.');
 const candidates=[...a.rooms.values()].filter(r=>r.zombies&&r.visibility==='public'&&r.sim.options.capacity===options.capacity&&r.sim.phase!=='results'&&r.sim.zWave<=ZOMBIES.lateJoinRound&&r.sim.zStage!=='exfil');
 if(!room&&!privateMatch)room=candidates.sort((a,b)=>b.members.size-a.members.size).find(r=>a.capacity.humans(r)+a.capacity.pending(r.key)+p.members.length<=r.sim.options.capacity);
 if(room&&(room.sim.phase==='results'||room.sim.zWave>ZOMBIES.lateJoinRound||room.sim.zStage==='exfil'))throw Error('This run is closed to new operators. Start a fresh run.');
 if(room&&a.capacity.humans(room)+a.capacity.pending(room.key)+p.members.length>room.sim.options.capacity)throw Error('This Zombies run cannot fit your entire party.');
 const plan=a.capacity.plan(room?.sim.options||options,{key:room?.key,humans:(room?a.capacity.humans(room)+a.capacity.pending(room.key):0)+p.members.length,botLimit:0});if(!plan.ok)throw Error('Zombies servers are busy. Existing runs continue; try matchmaking again shortly.');
 if(!room){let roomCode=code();while(service.relay.peers.has(address(roomCode)))roomCode=code();const key=address(roomCode),hostPeer={id:key,token:randomUUID(),virtualRoom:true,ws:null,links:new Map(),pending:[],pendingBytes:0,seq:0,acked:0,clientSeq:0,history:[],historyBytes:0,lastSeen:Date.now()};
  const sim=new ZombiesSimulation(options);room={key,code:roomCode,zombies:true,sim,hostPeer,owner:null,leaderSocial:u.id,visibility:privateMatch?'private':'public',recurring:false,members:new Map(),encoders:new Map(),eventCursors:new Map(),kicked:new Set(),chat:new ChatRoom(),age:0,frameAt:0,progressAt:0,created:Date.now(),autoStart:!privateMatch};a.rooms.set(key,room);service.relay.peers.set(key,hostPeer);a.publish(room);
 }
 a.capacity.reserve(p.id,room.key,room.sim.options,p.members.length,0);
 const launch={id:randomUUID(),code:room.code,options:room.sim.options,creating:false,host:false,hostRun:false,serverAuthority:true,visibility:room.visibility,created:Date.now()};p.launch=launch;p.state='queueing';u.ready=true;
 for(const id of p.members){const token=randomUUID();service.tickets.set(token,{party:p.id,member:id,code:room.code,teamSize:room.sim.options.teamSize,partySize:p.members.length,hostRun:false,expires:Date.now()+90000,token});service.users.get(id).ticket=token;}
 service.sync(p);service.dispatch(p);return launch.id;
}
export function settleZombiesPlayer(relay,room,p,peer){
 if(!peer?.progressId||!p||room.sim.phase==='lobby'||p.friendSpectator||!p.zStats)return;const now=relay.progression.clock(),account=relay.progression.account(peer.progressId),id=`z:${room.sim.matchId}:${peer.progressId.slice(0,12)}`;if(account.receipts.some(r=>r.id===id))return;
 const s=p.zStats,elapsed=room.sim.time-(room.sim.zRunStarted||0),eligible=elapsed>=60&&s.active>=30&&s.rounds>=2&&(s.kills>=8||s.revives>=2&&s.damage>=400)&&!p.afkRemoved;
 account.earned=(account.earned||[]).filter(r=>now-r.time<3600);const earned=account.earned.reduce((n,r)=>n+r.amount,0),extracted=room.sim.zOutcome==='extracted',quest=!!room.sim.zQuest.complete;
 const amount=eligible?Math.max(0,Math.min(200,400-earned,Math.floor(Math.min(s.rounds,40)*4+Math.min(s.kills,300)*.12+s.revives*3+(extracted?30:0)+(quest?40:0)))):0;
 const record={highestRound:s.rounds,kills:s.kills,critical:s.critical,revives:s.revives,extractions:Number(extracted),quests:Number(quest),bosses:s.bosses,games:1,cooperative:Number(room.sim.options.capacity>1)};
 const receipt={id,amount,label:extracted?'Blacktide extracted':'Blacktide run complete',mode:'zombies',won:extracted,eligible,reason:eligible?'Verified Zombies contribution':'Survive two rounds and actively contribute to earn progression.',kills:eligible?s.kills:0,assists:eligible?p.assists:0,zombies:eligible?record:null,time:now,custom:room.visibility==='private'};
 if(eligible){account.zombies??={};for(const [k,v]of Object.entries(record))account.zombies[k]=k==='highestRound'?Math.max(account.zombies[k]||0,v):(account.zombies[k]||0)+v;}
 account.receipts.push(receipt);account.receipts=account.receipts.slice(-60);if(amount)account.earned.push({time:now,amount});relay.progression.dirty=true;if(peer.ws)relay.send(peer,{type:'reward',receipt});void relay.progression.save();
}
