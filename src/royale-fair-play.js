import {TeamingMonitor} from './teaming-monitor.js';
import {getMap} from './maps.js';
import {applyBuildState} from './building.js';
import {wallDistance} from './physics.js';

// Every connected client independently measures the snapshots it receives.
// These are corroborating observations, not server-authoritative world state.
export class RoyaleFairPlay {
 constructor(send){this.send=send;this.pending=[];}
 observe(state,hostId){
  const r=state.royale;if(state.options?.mode!=='royale'||!r)return;
  const key=r.matchId+':'+hostId;
  if(this.key!==key){this.key=key;this.last=-Infinity;this.cursor=0;this.pending=[];this.world={};this.map=null;this.lastHeartbeat=-Infinity;
   this.monitor=new TeamingMonitor({identity:id=>id,onFlag:flag=>{if(flag.evidence.enforce)this.send({matchId:r.matchId,hostId,flag});}});
  }
  this.world={...this.world,...r};
  for(const e of state.events||[])if(e.id>this.cursor){this.pending.push(e);this.cursor=e.id;}
  if(this.pending.length>2000)this.pending.splice(0,this.pending.length-2000);
  if(state.time-this.last<(this.focus?.size ? .5 : 1)){if(this.lastSim&&this.monitor.work)this.monitor.sample({...this.lastSim,phase:state.phase});return;}this.last=state.time;
  if(state.time-this.lastHeartbeat>=5){this.lastHeartbeat=state.time;this.send({matchId:r.matchId,hostId});}
  if(!this.world.builds||!this.world.worldDamage)return;
  if(!this.map||this.mapId!==state.options.map){this.mapId=state.options.map;const base=getMap(this.mapId);this.map={...base,boxes:[...base.boxes]};}
  applyBuildState(this.map,this.world);
  const sim={...r,time:state.time,phase:state.phase,options:state.options,players:new Map(state.players.map(p=>[p.id,p])),accessible:(a,b)=>{
   const from={x:a.x,y:a.y+.9,z:a.z},d={x:b.x-from.x,y:b.y+.6-from.y,z:b.z-from.z},len=Math.hypot(d.x,d.y,d.z)||1;
   return wallDistance(this.map,from,{x:d.x/len,y:d.y/len,z:d.z/len},len)>=len-.15;
  }};
  for(const e of this.pending)this.monitor.combat(e,sim);this.pending=[];
  this.lastSim=sim;this.monitor.focus=this.focus;this.monitor.sample(sim);
 }
}
