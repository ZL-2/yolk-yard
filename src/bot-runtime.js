// Tactical work is staggered; physics, cooldowns and damage stay on every tick.
// Weak caches are deliberately excluded from snapshots/checkpoints.
import {botWorld,nearbyPlayers} from './bot-work.js';
import {executeRoyaleIntent} from './royale-bot-execution.js';
const rooms=new WeakMap(),intents=new WeakMap();
export const BOT_THINK_LIMITS=Object.freeze({jobs:4,milliseconds:2.5});
export function suspendBotInput(sim,p){
 const room=rooms.get(sim);room?.pending.delete(p);room?.ready?.delete(p);intents.delete(p);
}
function roomBudget(sim){
 let room=rooms.get(sim);if(!room){room={time:-1,pending:new Map()};rooms.set(sim,room);}
 if(room.time!==sim.time){
  room.time=sim.time;room.remaining=BOT_THINK_LIMITS.jobs;room.spent=0;room.humans=botWorld(sim).focus;
  for(const [p,job]of room.pending)if(p.health<=0||p.spectating||p.id!==undefined&&!sim.players.has(p.id)||sim.time-job.requested>.8)room.pending.delete(p);
  // Age eventually outranks interrupts, preventing late-iteration bots starving.
  const ordered=[...room.pending].sort((a,b)=>(a[1].at-(a[1].urgent?.15:0))-(b[1].at-(b[1].urgent?.15:0)));
  room.capacity=Math.max(1,Math.min(BOT_THINK_LIMITS.jobs,Math.floor(BOT_THINK_LIMITS.milliseconds/(room.jobCost||.1))));
  room.ready=new Set(ordered.slice(0,room.capacity).map(([p])=>p));
 }
 return room;
}
export function scheduledBotInput(sim,p,think,{combat=.06,roam=.1}={}){
 const key=sim.round+':'+sim.map.id+':'+p.flight;
 let cached=intents.get(p);const budget=roomBudget(sim);
 const changed=!cached||cached.key!==key||cached.brain!==p.brain||cached.warmupBrain!==p.warmupBrain;
 const hurt=cached&&cached.damage!==p.lastDamage&&sim.time-cached.thought>=.08;
 if(changed||hurt||sim.time>=cached.at){
  const job=budget.pending.get(p);if(job){job.requested=sim.time;job.urgent=!!hurt;}else{budget.pending.set(p,{at:sim.time,requested:sim.time,urgent:!!hurt});if(budget.ready.size<budget.capacity)budget.ready.add(p);}
 }
 if(budget.pending.has(p)&&budget.ready.has(p)&&budget.remaining>0&&budget.spent<BOT_THINK_LIMITS.milliseconds){
  budget.remaining--;
  budget.pending.delete(p);const start=performance.now();
  const input=think();budget.spent+=performance.now()-start;budget.jobCost=budget.spent/(BOT_THINK_LIMITS.jobs-budget.remaining);let engaged=p.use||p.brain?.task?.kind==='heal'||p.reviving;
  if(!engaged)engaged=!!nearbyPlayers(sim,p,55).length;
  // Distant AI-only fights need fewer tactical searches. Human-facing combat,
  // physics, fire cadence and damage retain their normal rates.
  const distant=p.inventory&&sim.map.id==='sunnybreak'&&!budget.humans.some(h=>h.id===p.brain?.target||h.id===p.id||(h.x-p.x)**2+(h.z-p.z)**2<180**2);
  const period=(engaged?combat:roam)*(distant?2:1),offset=((p.botSeed||p.joinedOrder*.618||0)%1+1)%1*period;
  let at=(Math.floor((sim.time-offset)/period)+1)*period+offset;if(at<=sim.time+1e-8)at+=period;
  cached={key,input:{...input},damage:p.lastDamage,brain:p.brain,warmupBrain:p.warmupBrain,at,thought:sim.time};intents.set(p,cached);
  return executeRoyaleIntent(sim,p,input);
 }
 // Cold initialization/host recovery is also budgeted. Never replay an action
 // from a different round, flight state or restored brain while waiting.
 if(changed)return {yaw:p.yaw||0,pitch:p.pitch||0,slot:p.slot||0,forward:0,strafe:0,fire:false,swapSlot:-1};
 const input={...cached.input},brain=p.brain;
 // A tactical build/grenade is a pulse. Never replay it on every physics tick.
 if(input.buildMode)input.fire=false;
 if(!p.inventory)input.fire=false;
 input.popper=false;
 if(input.fire&&brain?.target){const target=sim.players.get(brain.target);
  if(!target||target.health<=0||target.spectating)input.fire=false;
 }
 return executeRoyaleIntent(sim,p,input);
}
