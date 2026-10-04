// Change only damaged ranges and only when their visible damage stage changes.
// Retains chunk batching; no per-hit meshes, particles or timers are allocated.
const caches=new WeakMap();
export function updateWorldDamage(world,damage,key){
 if(!world)return;let cache=caches.get(world);
 if(!cache||cache.children!==world.children.length||cache.revision!==world.userData.geometryRevision){cache={children:world.children.length,revision:world.userData.geometryRevision,ranges:new Map(),models:new Map(),last:null};world.traverse(m=>{if(m.userData.damageObjectId)cache.models.set(m.userData.damageObjectId,m);for(const range of m.userData.objectRanges||[]){if(!cache.ranges.has(range.id))cache.ranges.set(range.id,[]);cache.ranges.get(range.id).push({mesh:m,range,stage:m.userData.damageStages?.[range.id]||0});}});caches.set(world,cache);}
 if(cache.last===key)return;cache.last=key;
 const ids=new Set([...Object.keys(damage||{}),...(cache.damaged||[])]);cache.damaged=new Set(Object.keys(damage||{}));
 for(const id of ids){const data=damage?.[id],stage=data?.destroyed?4:data?Math.min(3,Math.max(1,Math.ceil((1-data.health/data.maxHealth)*3))):0;
  const model=cache.models.get(id);if(model)model.visible=!data?.destroyed;
  for(const entry of cache.ranges.get(id)||[]){if(entry.stage===stage)continue;entry.stage=stage;const {mesh,range}=entry;mesh.userData.damageStages??={};mesh.userData.damageStages[range.id]=stage;const position=mesh.geometry.attributes.position,color=mesh.geometry.attributes.color,start=range.start*3,end=(range.start+range.count)*3;
   mesh.userData.originalPositions??=position.array.slice();if(color)mesh.userData.originalColors??=color.array.slice();const original=mesh.userData.originalPositions,baseColors=mesh.userData.originalColors;
   position.array.set(original.subarray(start,end),start);
   if(stage===4)position.array.fill(0,start,end);
   if(color)for(let i=start;i<end;i+=3){const x=original[i],y=original[i+1],z=original[i+2],crack=Math.abs(Math.sin(y*3.7+x*1.2+Math.sin(z*6.1)*.5))<.15+.025*stage,shade=stage?crack?.24:1-stage*.105:1;for(let k=0;k<3;k++)color.array[i+k]=baseColors[i+k]*shade;
    if(stage>1&&stage<4){const chip=Math.sin(x*11+y*13+z*17)*.022*(stage-1);position.array[i]+=chip;position.array[i+2]-=chip;}}
   position.needsUpdate=true;if(color)color.needsUpdate=true;
  }
 }
}
