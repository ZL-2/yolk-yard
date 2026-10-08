// One spatial index per room/100 ms, shared by perception and crowd avoidance.
// Buckets hold live players; the small query margin covers movement between rebuilds.
const caches=new WeakMap(),CELL=32;
export function botWorld(sim){
 let cache=caches.get(sim);
 if(!cache||cache.round!==sim.round||sim.time-cache.time>=.1||cache.size!==sim.players.size){
  cache={time:sim.time,round:sim.round,size:sim.players.size,grid:new Map(),teams:new Map(),humans:[],bots:[],focus:[]};
  const watching=new Set();for(const p of sim.players.values())if(!p.bot&&p.connected!==false){const focus=p.health>0&&!p.spectating?p:sim.players.get(p.watchingId);if(focus&&focus.health>0&&!focus.spectating&&!watching.has(focus.id)){watching.add(focus.id);cache.focus.push(focus);}}
  for(const p of sim.players.values()){if(p.health<=0||p.spectating)continue;(p.bot?cache.bots:cache.humans).push(p);if(p.team>=0){let team=cache.teams.get(p.team);if(!team)cache.teams.set(p.team,team=[]);team.push(p);}if(!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;const key=Math.floor(p.x/CELL)+','+Math.floor(p.z/CELL);let bucket=cache.grid.get(key);if(!bucket){bucket=[];cache.grid.set(key,bucket);}bucket.push(p);}
  caches.set(sim,cache);
 }
 return cache;
}
const work=new WeakMap();
export function takeBotWork(sim,kind){
 let budget=work.get(sim);if(!budget||budget.time!==sim.time){budget={time:sim.time,sight:32,cover:2};work.set(sim,budget);}
 if(budget[kind]<=0)return false;budget[kind]--;return true;
}
export function nearbyPlayers(sim,p,radius){const grid=botWorld(sim).grid,r=radius+2,found=[];
 for(let x=Math.floor((p.x-r)/CELL);x<=Math.floor((p.x+r)/CELL);x++)for(let z=Math.floor((p.z-r)/CELL);z<=Math.floor((p.z+r)/CELL);z++)for(const other of grid.get(x+','+z)||[])if(other!==p&&(other.x-p.x)**2+(other.z-p.z)**2<radius*radius)found.push(other);
 return found;
}
