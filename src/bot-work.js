// One spatial index per room/100 ms, shared by perception and crowd avoidance.
// Buckets hold live players; the small query margin covers movement between rebuilds.
const caches=new WeakMap(),CELL=32;
export function botWorld(sim){
 let cache=caches.get(sim);
 if(!cache||cache.round!==sim.round||sim.time-cache.time>=.1||cache.size!==sim.players.size){
  cache={time:sim.time,round:sim.round,size:sim.players.size,grid:new Map(),humans:[]};
  for(const p of sim.players.values()){if(p.health<=0||p.spectating)continue;if(!p.bot)cache.humans.push(p);if(!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;const key=Math.floor(p.x/CELL)+','+Math.floor(p.z/CELL);let bucket=cache.grid.get(key);if(!bucket){bucket=[];cache.grid.set(key,bucket);}bucket.push(p);}
  caches.set(sim,cache);
 }
 return cache;
}
export function nearbyPlayers(sim,p,radius){const grid=botWorld(sim).grid,r=radius+2,found=[];
 for(let x=Math.floor((p.x-r)/CELL);x<=Math.floor((p.x+r)/CELL);x++)for(let z=Math.floor((p.z-r)/CELL);z<=Math.floor((p.z+r)/CELL);z++)for(const other of grid.get(x+','+z)||[])if(other!==p&&(other.x-p.x)**2+(other.z-p.z)**2<radius*radius)found.push(other);
 return found;
}
