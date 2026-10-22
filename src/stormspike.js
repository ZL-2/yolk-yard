// Authority-owned delayed build damage. Spikes never perform a player blast.
export const STORMSPIKE=Object.freeze({fuse:1.15,burstDamage:150,neighborScale:.55,maxConnected:4,maxActive:48});
export function lodgeStormspike(sim,projectile,box,normal){
 if(!box?.buildId)return;
 const build=sim.builds.find(b=>b.id===box.buildId);if(!build)return;
 sim.stormSpikes??=[];
 if(sim.stormSpikes.length>=STORMSPIKE.maxActive)sim.stormSpikes.shift();
 const spike={id:++sim.projectileId,owner:projectile.owner,buildId:box.buildId,x:projectile.x,y:projectile.y,z:projectile.z,nx:normal.x,ny:normal.y,nz:normal.z,born:sim.time,until:sim.time+STORMSPIKE.fuse,damage:STORMSPIKE.burstDamage*(projectile.damage/58)};
 sim.stormSpikes.push(spike);sim.emit('royale-cue',{cue:'spike-stick',x:spike.x,y:spike.y,z:spike.z});
}
const gap=(a,b,key,size)=>Math.max(0,Math.abs(a[key]-b[key])-(a[size]+b[size])/2);
function touching(a,b){return gap(a,b,'x','w')<.35&&gap(a,b,'z','d')<.35&&Math.max(a.y,b.y)<=Math.min(a.y+a.h,b.y+b.h)+.35;}
export function tickStormspikes(sim){
 const active=sim.stormSpikes;if(!active?.length)return;
 const existing=new Set(sim.builds.map(b=>b.id));let buildBoxes;
 for(let i=active.length-1;i>=0;i--){
  const s=active[i];if(!existing.has(s.buildId)){active.splice(i,1);continue;}
  if(sim.time<s.until)continue;
  active.splice(i,1);
  buildBoxes??=sim.map.boxes.filter(b=>b.buildId);
  const root=buildBoxes.filter(b=>b.buildId===s.buildId);if(!root.length)continue;
  // Select only the attached piece and pieces physically touching it. Never
  // search through terrain/architecture or propagate across an empty gap.
  const targets=new Map([[s.buildId,root[0]]]);
  for(const b of buildBoxes){if(targets.size>STORMSPIKE.maxConnected)break;if(!b.buildId||targets.has(b.buildId))continue;if(root.some(a=>touching(a,b)))targets.set(b.buildId,b);}
  for(const [id,b]of targets)sim.damageWorld(b,s.damage*(id===s.buildId?1:STORMSPIKE.neighborScale));
  sim.emit('royale-fx',{kind:'stormspike-burst',x:s.x,y:s.y,z:s.z});sim.emit('royale-cue',{cue:'spike-burst',x:s.x,y:s.y,z:s.z});
 }
}
