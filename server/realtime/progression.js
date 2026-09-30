import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {activityEvent,newActivity,observeInput,observeMotion,meaningfulActivity,activityRemaining} from '../../src/activity.js';
import {calculateReward,participation} from '../../src/rewards.js';
const warmup=new Set(['waiting','spawn-island','starting']);
const bounded=(v,max=1e7)=>Number.isFinite(v)?Math.min(max,Math.max(-max,v)):0;
export class ProgressionService{
 constructor(relay,{clock=()=>Date.now()/1000,path=process.env.RAVEL_REWARD_DATA_PATH||(process.env.YOLK_OWNER_DATA_PATH?dirname(process.env.YOLK_OWNER_DATA_PATH)+'/ravelfront-progress.json':'/tmp/ravelfront-progress.json')}={}){this.relay=relay;this.clock=clock;this.path=path;this.matches=new Map();this.accounts=new Map();this.ready=this.load();this.dirty=false;this.saveChain=Promise.resolve();}
 async load(){if(!this.path)return;try{for(const [id,a]of JSON.parse(await readFile(this.path,'utf8')))this.accounts.set(id,a);}catch{}}
 identity(token){return typeof token==='string'&&/^[a-f0-9]{32,64}$/.test(token)?createHash('sha256').update(token).digest('hex'):null;}
 async register(peer,token){peer.progressId=this.identity(token)||randomUUID();await this.ready;for(const receipt of this.account(peer.progressId).receipts.slice(-30))this.relay.send(peer,{type:'reward',receipt});}
 account(id){if(!this.accounts.has(id))this.accounts.set(id,{receipts:[],pairs:[],earned:[],encounters:[]});return this.accounts.get(id);}
 input(peer,input){const now=this.clock();for(const match of this.matches.values()){const p=[...match.players.values()].find(p=>p.identity===peer.progressId);if(p&&!match.finished&&!p.afkRemoved){observeInput(p.activity,input||{},now);p.inputAt=now;}}}
 frame(peer,s){
  if(!peer.listing||!Array.isArray(s?.players)||s.players.length>36||!Number.isInteger(s.round)||!['playing','results'].includes(s.phase))return;
  // A room's public/custom provenance is assigned by matchmaking, not the host.
  const room=peer.id,now=this.clock(),key=room+':'+String(s.matchId).slice(0,64)+':'+s.round;
  if(warmup.has(s.stage))return;
  let m=this.matches.get(key);
  if(!m){if(s.phase!=='playing')return;m={id:randomUUID(),key,room,started:now,last:now,event:-1,players:new Map(),eliminations:[],hits:new Map(),custom:peer.rewardPublic!==true,mode:s.mode==='royale'?'royale':['ffa','teams'].includes(s.mode)?s.mode:'arena',difficulty:Math.max(1,Math.min(4,s.difficulty||1)),hostIdentity:peer.progressId};this.matches.set(key,m);}
  if(m.finished||now-m.last<.35)return;
  const recovered=now-m.last>5,dt=Math.min(1.5,Math.max(0,now-m.last));m.last=now;m.state=s;
  if(recovered)for(const p of m.players.values())p.activity.last=now;
  const seen=new Set(),connected=new Map([...this.relay.peers.values()].filter(p=>p.ws).map(p=>[p.id,p]));
  for(const raw of s.players){if(typeof raw.id!=='string'||seen.has(raw.id)||raw.lateSpectator)continue;seen.add(raw.id);
   const isHost=raw.id===s.hostId,remote=isHost?peer:connected.get(raw.id),bot=raw.bot===true&&/^bot-\d+$/.test(raw.id);
   if(!bot&&!remote)continue;
   if(!bot&&!isHost&&![...remote.links.values()].some(p=>p.id===room||p.progressId===peer.progressId))continue;
   let p=m.players.get(raw.id);if(!p){if(now-m.started>15)continue;const identity=bot?raw.id:remote.progressId;if(!bot&&[...m.players.values()].some(p=>!p.bot&&p.identity===identity))continue;p={id:raw.id,identity,bot,activity:newActivity(now),joined:now,difficulty:m.difficulty,kills:0,assists:0};m.players.set(p.id,p);}
   p.peer=remote;p.raw={...raw,x:bounded(raw.x),y:bounded(raw.y),z:bounded(raw.z)};p.afkRemoved||=!!raw.afkRemoved;
   p.controlled=!bot&&!p.afkRemoved&&!raw.awaitingEntry&&!raw.spectating&&raw.health>0&&raw.flight!=='transport'&&remote?.ws&&(isHost||p.inputAt!=null);
   if(!p.controlled){p.activity.last=now;p.activity.x=raw.x;p.activity.z=raw.z;continue;}
   p.activity.elapsed=(p.activity.elapsed||0)+dt;
   if(isHost)observeInput(p.activity,s.input||{},now);
   // Movement must agree with recent authenticated input. Host telemetry cannot
   // turn a silent guest into an active opponent and increase population value.
   if(isHost||now-(p.inputAt||0)<2)observeMotion(p.activity,p.raw,dt,now);
  }
  for(const e of s.events||[]){if(!Number.isInteger(e.id)||e.id<=m.event)continue;m.event=Math.max(m.event,e.id);const p=m.players.get(e.player),target=m.players.get(e.target);if(e.type==='afk-removed'&&p){p.afkRemoved=true;p.controlled=false;continue;}if(!p||p.afkRemoved)continue;
   if(e.type==='hit'&&target&&target!==p){p.activity.damage+=Math.max(0,Math.min(100,e.amount||0));if(p.controlled)meaningfulActivity(p.activity,'damage',target.id,now);const hits=m.hits.get(target.id)||new Map();hits.set(p.id,now);m.hits.set(target.id,hits);}
   if(e.type==='elimination'&&target&&target!==p&&now-(target.lastEliminated||-999)>2){target.lastEliminated=now;p.kills++;m.eliminations.push({attacker:p.id,target:target.id,time:now});for(const [id,t]of m.hits.get(target.id)||[])if(id!==p.id&&now-t<12){const helper=m.players.get(id);if(helper)helper.assists++;}m.hits.delete(target.id);}
   const activity=activityEvent(e);if(p.controlled&&activity&&meaningfulActivity(p.activity,'action',activity.signature+':'+Math.round(p.raw.x/3)+','+Math.round(p.raw.z/3),now)&&activity.contribution)p.activity.contributions++;
  }
  if(s.phase==='results')this.settle(m);
 }
 settle(m){
  if(m.finished)return;m.finished=true;const now=this.clock(),elapsed=now-m.started,all=[...m.players.values()];
  for(const p of all){if(p.bot)continue;const account=this.account(p.identity);account.earned=account.earned.filter(e=>now-e.time<3600);account.pairs=account.pairs.filter(e=>now-e.time<3600);account.encounters=(account.encounters||[]).filter(e=>now-e.time<3600);
   // Team membership is evaluated independently of skin/team colors.
   const enemy=all.filter(o=>o!==p&&!((m.state.teamSize>1||m.mode==='teams')&&o.raw?.team===p.raw?.team));
   const kills=m.eliminations.filter(e=>e.attacker===p.id).map(e=>{const victim=m.players.get(e.target),repeat=account.pairs.filter(x=>x.target===victim.identity).length;account.pairs.push({target:victim.identity,time:now});return {bot:victim.bot,difficulty:victim.difficulty,repeat,...(!victim.bot&&!participation({...victim.activity,elapsed:victim.activity.elapsed??elapsed,afkRemoved:victim.afkRemoved})?{repeat:9}:{})};});
   const ranked=all.filter(o=>!o.raw?.lateSpectator).sort((a,b)=>b.kills-a.kills||(a.raw?.deaths||0)-(b.raw?.deaths||0));
   const place=m.mode==='royale'?p.raw?.place:ranked.indexOf(p)+1;
   const won=m.mode==='royale'?place===1:m.mode==='teams'?(m.state.scores?.[p.raw?.team]||0)>(m.state.scores?.[1-p.raw?.team]||0):place===1&&p.kills>0;
   const result=calculateReward({player:{...p.activity,afkRemoved:p.afkRemoved},opponents:enemy.map(o=>({...o.activity,bot:o.bot,difficulty:o.difficulty,familiarity:account.encounters.filter(e=>e.target===o.identity).length,afkRemoved:o.afkRemoved})),elapsed,custom:m.custom,mode:m.mode,place,won,eliminations:kills,assists:p.assists,hourEarned:account.earned.reduce((n,e)=>n+e.amount,0)});
   const receipt={id:m.id+':'+p.identity.slice(0,12),amount:result.amount,label:won?'Frontier secured':'Match complete',mode:m.mode,place,won,kills:result.eligible?p.kills:0,assists:result.eligible?p.assists:0,eligible:result.eligible,reason:result.reason,time:now,challenge:result.challenge,population:result.population,custom:m.custom};
   for(const o of enemy)if(!o.bot&&result.eligible)account.encounters.push({target:o.identity,time:now});
   account.receipts.push(receipt);account.receipts=account.receipts.slice(-60);if(result.amount)account.earned.push({time:now,amount:result.amount});this.dirty=true;if(p.peer?.ws)this.relay.send(p.peer,{type:'reward',receipt});
  }
 }
 sweep(){const now=this.clock();for(const [key,m]of this.matches){if(now-m.last>3600){this.matches.delete(key);continue;}if(m.finished||now-m.last>5)continue;
  if(this.relay.authority?.rooms.has(m.room))continue; // The authoritative simulation owns AFK removal.
  for(const p of m.players.values()){if(!p.controlled||p.bot||p.afkRemoved||!p.peer?.ws)continue;const remaining=Math.ceil(activityRemaining(p.activity,now));if(remaining<=12)this.relay.send(p.peer,{type:'afk',remaining});if(remaining<=0){p.afkRemoved=true;p.controlled=false;const host=this.relay.peers.get(m.room);if(host)this.relay.send(host,{type:'afk-enforce',player:p.id});}}
 }if(this.dirty){this.dirty=false;void this.save();}}
 save(){if(!this.path)return Promise.resolve();const json=JSON.stringify([...this.accounts].slice(-5000));this.saveChain=this.saveChain.then(async()=>{await mkdir(dirname(this.path),{recursive:true});await writeFile(this.path+'.tmp',json);await rename(this.path+'.tmp',this.path);}).catch(()=>{this.dirty=true;});return this.saveChain;}
 async close(){await this.ready;await this.save();}
}
