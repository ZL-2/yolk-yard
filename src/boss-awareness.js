import {dist,wallDistance} from './physics.js';
import {GRAPPLER} from './grappler.js';
import {initializeBossVoice,requestBossVoice,bossVoiceTick} from './boss-voice.js';
// Official Epic guard states supply the model, not these BR-specific numbers.
export const BOSS_AWARENESS=Object.freeze({scan:.2,fieldOfView:120,nearSense:2.5,hearing:42,searchSeconds:7,forgetSeconds:1.2});
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const valid=p=>!!p?.contestant&&p.health>0&&!p.spectating&&p.flight==='ground';
export function initializeBossAwareness(sim,p){
 p.bossAlert='unaware';p.bossSuspicion=0;p.bossAlertAt=sim.time;
 p.bossPerception={lastScan:sim.time-.2,seenAt:-100,lastKnown:null,searchUntil:0,noiseSeq:sim.eventId||0};
 initializeBossVoice(sim,p);
}
function transition(sim,p,state){
 if(p.bossAlert===state)return;p.bossAlert=state;p.bossAlertAt=sim.time;
 if(state==='alerted')requestBossVoice(sim,p,'alerted',{chance:false});
 else if(state==='suspicious')requestBossVoice(sim,p,'suspicious',{chance:false});
 else if(state==='searching')requestBossVoice(sim,p,'search');
}
export function alertBossToDamage(sim,p,attacker){
 if(!valid(attacker)||p.health<=0)return;if(!p.bossPerception)initializeBossAwareness(sim,p);
 p.targetId=attacker.id;p.bossSuspicion=1;p.bossPerception.lastKnown={x:attacker.x,y:attacker.y,z:attacker.z};
 p.bossPerception.seenAt=sim.time;p.bossPerception.searchUntil=sim.time+BOSS_AWARENESS.searchSeconds;p.aggroAt=sim.time+.25;transition(sim,p,'alerted');
}
export function bossHasSight(sim,p,target,smokeBlocks){
 if(!valid(target))return false;
 const from={x:p.x,y:p.y+1.55,z:p.z},dy=target.y+.9-from.y,len=Math.hypot(target.x-p.x,dy,target.z-p.z)||1;
 const ray={x:(target.x-p.x)/len,y:dy/len,z:(target.z-p.z)/len};
 return wallDistance(sim.map,from,ray,len)>=len-.4&&!smokeBlocks(sim,from,{...target,y:target.y+.9});
}
export function scanBossAwareness(sim,p,def,smokeBlocks){
 if(!p.bossPerception)initializeBossAwareness(sim,p);const memory=p.bossPerception;
 const dt=Math.min(.4,Math.max(0,sim.time-memory.lastScan));memory.lastScan=sim.time;
 if(dist(p,p.home)>def.leash&&!(p.pursuitUntil>sim.time)){p.targetId=null;p.bossSuspicion=0;transition(sim,p,'unaware');bossVoiceTick(sim,p);return;}
 let seen=null,bestD=def.notice;
 const attacker=sim.players.get(p.attackerId);
 if(def.ability==='winch'&&sim.time-(p.attackerAt??-100)<10&&valid(attacker)&&dist(p,attacker)<GRAPPLER.range&&bossHasSight(sim,p,attacker,smokeBlocks)){seen=attacker;bestD=dist(p,attacker);}
 for(const target of sim.players.values()){
  if(target===p||!valid(target))continue;const d=dist(p,target);if(d>bestD)continue;
  const yaw=Math.atan2(p.x-target.x,p.z-target.z),wide=p.bossAlert==='alerted'||p.bossAlert==='searching';
  if(!wide&&d>BOSS_AWARENESS.nearSense&&Math.abs(wrap(yaw-p.yaw))>BOSS_AWARENESS.fieldOfView*Math.PI/360)continue;
  if(!bossHasSight(sim,p,target,smokeBlocks))continue;seen=target;bestD=d;
 }
 // Reuse bounded replicated shot events: no new player/world polling loop.
 let heard=null,heardD=BOSS_AWARENESS.hearing;
 for(let i=sim.events.length-1;i>=0;i--){const e=sim.events[i];if(e.id<=memory.noiseSeq||sim.time-e.time>.6)break;
  if(e.type!=='shot'||e.player===p.id||!e.origin)continue;const actor=sim.players.get(e.player);if(!valid(actor))continue;
  const d=Math.hypot(e.origin.x-p.x,e.origin.y-(p.y+1.55),e.origin.z-p.z);if(d<heardD){heardD=d;heard={x:e.origin.x,y:e.origin.y-1.55,z:e.origin.z};}
 }memory.noiseSeq=sim.eventId;
 if(seen){
  if(p.targetId!==seen.id&&p.bossAlert!=='alerted')p.bossSuspicion=0;
  p.targetId=seen.id;memory.seenAt=sim.time;memory.lastKnown={x:seen.x,y:seen.y,z:seen.z};memory.searchUntil=sim.time+BOSS_AWARENESS.searchSeconds;
  if(p.bossAlert==='alerted'||p.bossAlert==='searching'&&p.bossSuspicion>=.8){p.bossSuspicion=1;transition(sim,p,'alerted');}
  else{p.bossSuspicion=Math.min(1,(p.bossSuspicion||0)+dt/def.reaction);if(p.bossSuspicion>=1){p.aggroAt=sim.time+.2;transition(sim,p,'alerted');}else transition(sim,p,'suspicious');}
 }else if(p.bossAlert==='alerted'||p.bossAlert==='searching'){
  p.targetId=null;
  if(sim.time-memory.seenAt>BOSS_AWARENESS.forgetSeconds)transition(sim,p,'searching');
  if(sim.time>=memory.searchUntil){p.bossSuspicion=0;memory.lastKnown=null;transition(sim,p,'unaware');}
 }else{
  p.targetId=null;p.bossSuspicion=Math.max(0,(p.bossSuspicion||0)-dt/.8);
  if(!p.bossSuspicion&&!heard&&sim.time>=memory.searchUntil){memory.lastKnown=null;transition(sim,p,'unaware');}
 }
 if(heard&&!seen){memory.lastKnown=heard;memory.searchUntil=sim.time+BOSS_AWARENESS.searchSeconds;
  if(p.bossAlert==='unaware'||p.bossAlert==='suspicious'){p.bossSuspicion=Math.max(.2,p.bossSuspicion);transition(sim,p,'suspicious');}
 }
 p.bossSuspicion=Math.round(p.bossSuspicion*100)/100;bossVoiceTick(sim,p);
}
export function bossAlertVisual(p,time=0){
 if(!p.boss||p.health<=0||p.spectating||p.flight!=='ground'||!['suspicious','alerted','searching'].includes(p.bossAlert))return null;
 const alerted=p.bossAlert==='alerted',age=Math.max(0,time-(p.bossAlertAt||0));
 return {symbol:alerted?'!':'?',color:alerted?'#ff303c':'#ffd447',fill:alerted||p.bossAlert==='searching'?1:Math.round((p.bossSuspicion||0)*10)/10,scale:1+Math.max(0,1-age/.35)*.35};
}
