import {randomUUID,randomInt} from 'node:crypto';
import {VERSION} from '../../src/data.js';
import {matchOptions} from '../../src/match-options.js';
import {ZombiesSimulation} from '../../src/zombies-expedition.js';
import {ZOMBIES} from '../../src/zombies-config.js';
import {ChatRoom} from '../../src/chat.js';
const address=code=>`yolk-yard-v${VERSION}-${code}`;
const code=()=>Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
export function queueZombies(service,u,m){
 const p=service.parties.get(u.party),a=service.relay.authority,privateMatch=p.selection.access==='private'||!!m.code,options=matchOptions({...p.selection,mode:'zombies',session:'online',sharedWorld:!privateMatch});
 if(!m.code&&p.members.length>options.capacity)throw Error('Choose enough cooperative seats for your party.');
 let room=m.code?a.rooms.get(address(m.code)):null;
 if(m.code&&room?.sim.options.mode!=='zombies')throw Error('That Zombies room is unavailable.');
 const candidates=[...a.rooms.values()].filter(r=>r.zombies&&r.visibility==='public'&&r.sim.acceptsJoining());
 if(!room&&!privateMatch)room=candidates.sort((a,b)=>b.members.size-a.members.size).find(r=>a.capacity.humans(r)+a.capacity.pending(r.key)+p.members.length<=r.sim.options.capacity);
 if(room&&!room.sim.acceptsJoining())throw Error('This deployment is closed to new operators. Start a fresh run.');
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
 if(!peer?.progressId||!p||room.sim.phase==='lobby'||p.friendSpectator||!p.zStats)return;
 const now=relay.progression.clock(),account=relay.progression.account(peer.progressId),id=`z:${room.sim.matchId}:${peer.progressId.slice(0,12)}`;if(account.receipts.some(r=>r.id===id))return;
 const s=p.zStats,elapsed=room.sim.elapsed(),eligible=elapsed>=60&&s.active>=30&&((s.contracts||0)>=1&&s.kills>=3||s.kills>=12||s.revives>=2&&s.damage>=400)&&!p.afkRemoved,extracted=!!p.zExtracted;
 account.earned=(account.earned||[]).filter(r=>now-r.time<3600);const earned=account.earned.reduce((n,r)=>n+r.amount,0);
 const amount=eligible?Math.max(0,Math.min(200,400-earned,Math.floor((s.contracts||0)*12+Math.min(s.kills,300)*.12+s.revives*3+(extracted?35:0)+(s.rift?40:0)))):0;
 const record={kills:s.kills,critical:s.critical,revives:s.revives,extractions:Number(extracted),quests:Number(!!s.rift),bosses:s.bosses,games:1,cooperative:Number(s.cooperative),contracts:s.contracts||0,minutes:Math.floor(elapsed/60)};
 const gear=account.expedition??={stash:[],schematics:[],cooldowns:{},contraband:[],insuredUntil:0,containment:0,story:0};
 if(extracted&&eligible){gear.stash=[...gear.stash,...(p.zBag||[])].slice(-30);gear.contraband=[...gear.contraband,...p.zombieKit.map(k=>k.id)].slice(-8);gear.insuredUntil=Math.max(now,(gear.insuredUntil||0)-Math.floor(p.points/10));if(eligible){gear.containment=Math.min(100,(gear.containment||0)+(s.contracts||0));gear.schematics=[...new Set([...gear.schematics,...(p.zSchematics||[])])];const stage=gear.story||0;const done=[s.contracts>=3,(p.zPersonalLogs?.length||0)>=3,(s.sabotage||0)>=1&&(s.cipher||0)>=1,(s.rift||0)>=1,(s.finale||0)>=1][stage];if(done)gear.story=Math.min(5,stage+1);}}
 else if(extracted){const owned=(p.zLoadout?.items||[]).slice(),carried=(p.zBag||[]).slice();for(const item of owned){const at=carried.indexOf(item);if(at>=0){carried.splice(at,1);gear.stash.push(item);}}gear.stash=gear.stash.slice(-30);if(p.zLoadout?.contraband)gear.contraband=[...gear.contraband,p.zLoadout.weapon].slice(-8);}
 else{gear.insuredUntil=now+1800;gear.containment=Math.max(0,(gear.containment||0)-3);if(eligible&&p.zInsuranceKeep)gear.stash=[...gear.stash,...(p.zBag||[])].slice(-30);}
 const receipt={id,amount,label:extracted?'Blacktide extraction complete':'Blacktide deployment ended',mode:'zombies',won:extracted,eligible,reason:eligible?'Server-verified expedition contribution':'Complete a contract and contribute to combat to earn progression.',kills:eligible?s.kills:0,assists:eligible?p.assists:0,zombies:eligible?record:null,time:now,custom:room.visibility==='private'};
 if(eligible){account.zombies??={};for(const [k,v]of Object.entries(record))account.zombies[k]=(account.zombies[k]||0)+v;}
 account.receipts.push(receipt);account.receipts=account.receipts.slice(-60);if(amount)account.earned.push({time:now,amount});relay.progression.dirty=true;if(peer.ws)relay.send(peer,{type:'reward',receipt});void relay.progression.save();
}
