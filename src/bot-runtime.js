// Tactical work is staggered; physics, cooldowns and damage stay on every tick.
// Weak caches are deliberately excluded from snapshots/checkpoints.
const rooms=new WeakMap(),intents=new WeakMap();
export function scheduledBotInput(sim,p,think,{combat=.06,roam=.1}={}){
 const key=sim.round+':'+sim.map.id+':'+p.flight;
 let cached=intents.get(p),budget=rooms.get(sim);
 if(!budget||budget.time!==sim.time){budget={time:sim.time,remaining:4};rooms.set(sim,budget);}
 const changed=!cached||cached.key!==key||cached.brain!==p.brain||cached.warmupBrain!==p.warmupBrain;
 const hurt=cached&&cached.damage!==p.lastDamage&&sim.time-cached.thought>=.08;
 if(changed||hurt||sim.time>=cached.at&&budget.remaining>0){
  budget.remaining--;
  const input=think();let engaged=p.use||p.brain?.task?.kind==='heal'||p.reviving;
  if(!engaged)for(const other of sim.players.values())if(other!==p&&other.health>0&&!other.spectating&&(p.x-other.x)**2+(p.z-other.z)**2<55**2){engaged=true;break;}
  const period=engaged?combat:roam,offset=((p.botSeed||p.joinedOrder*.618)%1+1)%1*period;
  let at=(Math.floor((sim.time-offset)/period)+1)*period+offset;if(at<=sim.time+1e-8)at+=period;
  cached={key,input:{...input},damage:p.lastDamage,brain:p.brain,warmupBrain:p.warmupBrain,at,thought:sim.time};intents.set(p,cached);
  return input;
 }
 const input={...cached.input},brain=p.brain;
 // A tactical build/grenade is a pulse. Never replay it on every physics tick.
 if(input.buildMode)input.fire=false;
 input.popper=false;
 if(input.fire&&brain?.target){const target=sim.players.get(brain.target);
  if(!target||target.health<=0||target.spectating||sim.time>=brain.burstUntil)input.fire=false;
 }
 return input;
}
