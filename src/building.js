import {worldDoorBox} from './world-rules.js';
import {direction,rayBox,rayEgg,EYE,HEIGHT,RADIUS,wallDistance,worldHit,invalidateCollision,candidates} from './physics.js';
import {bodyHeight,eyeHeight,canFight} from './stance.js';
import {groundAt} from './terrain.js';
import {MATERIALS,GRID,COST,CAP,EDIT_RANGE,PICKAXE,propAt,harvestDefinition,buildStats,snappedFacing,canEdit,selectMaterial} from './building-rules.js';
import {PIECES,pieceBoxes,validEdit,editRay,wallPattern} from './building-shapes.js';
export {MATERIALS,GRID,COST,CAP,PIECES,pieceBoxes};
export const pickaxe=()=>({id:'pickaxe',pickaxe:true,count:1,rarity:0});
export const inventory=()=>[pickaxe(),null,null,null,null,null];
export function materialFor(b,map){
 const prop=propAt(map,b.x,b.z);
 if(b.kind==='tree'||['crate','bench'].includes(prop?.kind)||b.kind==='shelter')return 'wood';
 if(['lamp','barrels'].includes(prop?.kind)||['steel','gold'].includes(b.color)||map?.buildings?.[b.building]?.kind==='factory')return 'metal';
 if(['farm','camp','park'].includes(map?.buildings?.[b.building]?.kind))return 'wood';
 return b.color==='crate'?'wood':'brick';
}
export function authoredBoxes(map){return (map.authored||map.boxes).filter(b=>!b.buildId).map((b,i)=>{const box={...b,objectId:b.objectId||'world-'+i,material:b.material||materialFor(b,map)};box.harvestType=b.harvestType||harvestDefinition(box,map).type;return box;});}
export function placement(p,type,rotation=0,material='wood'){
 const d=direction(p.yaw,0),reach=4.3;
 let x=Math.round((p.x+d.x*reach)/4)*4,z=Math.round((p.z+d.z*reach)/4)*4,y=Math.max(0,Math.round((p.y+(p.pitch>.45?2:p.pitch<-.5?-1:0))/4)*4);
 let r=((snappedFacing(p.yaw,p.buildFacing)+rotation)%4+4)%4;
 if(type==='wall'){if(r%2)x=Math.round((p.x+d.x*reach-2)/4)*4+2;else z=Math.round((p.z+d.z*reach-2)/4)*4+2;}
 return {x,y,z,type,rotation:r,material,mask:0};
}
const bounds=p=>{const bs=pieceBoxes(p);return {minX:Math.min(...bs.map(b=>b.x-b.w/2)),maxX:Math.max(...bs.map(b=>b.x+b.w/2)),minY:p.y,maxY:Math.max(...bs.map(b=>b.y+b.h)),minZ:Math.min(...bs.map(b=>b.z-b.d/2)),maxZ:Math.max(...bs.map(b=>b.z+b.d/2))};};
const touching=(a,b)=>a.minX<=b.maxX+.2&&a.maxX>=b.minX-.2&&a.minY<=b.maxY+.2&&a.maxY>=b.minY-.2&&a.minZ<=b.maxZ+.2&&a.maxZ>=b.minZ-.2;
// Props declare whether they block a build. Small dressing and pickups do not.
export const blocksBuilding=b=>b.buildBlocking!==false&&!b.decorative&&!(b.kind==='prop'&&b.w*b.d*b.h<3);
function supportSamples(b){return [[b.x,b.z],[b.x-b.w/2+.04,b.z-b.d/2+.04],[b.x+b.w/2-.04,b.z-b.d/2+.04],[b.x-b.w/2+.04,b.z+b.d/2-.04],[b.x+b.w/2-.04,b.z+b.d/2-.04]];}
function anchored(p,map){
 const bs=pieceBoxes(p),near=[...candidates(map,p,null,0,5)];
 return bs.some(b=>supportSamples(b).some(([x,z])=>Math.abs(b.y-groundAt(map,x,z))<.32))||near.some(b=>!b.buildId&&blocksBuilding(b)&&bs.some(a=>Math.abs(a.y-(b.y+b.h))<.24&&Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2));
}
export function validPlacement(p,map,builds,players=[]){
 if(![p.x,p.y,p.z,p.rotation].every(Number.isFinite)||p.y<0)return 'Invalid coordinates';
 if(!PIECES.includes(p.type)||!MATERIALS[p.material]||Math.abs(p.x)>map.size-3||Math.abs(p.z)>map.size-3||p.y>100)return 'Outside build area';
 if(builds.length>=600)return 'Build limit reached';
 if(builds.some(b=>b.type===p.type&&b.x===p.x&&Math.abs(b.y-p.y)<.2&&b.z===p.z&&(p.type!=='wall'||b.rotation%2===p.rotation%2)))return 'Already built';
 const bs=pieceBoxes(p),near=[...candidates(map,p,null,0,4)].filter(o=>!o.buildId&&blocksBuilding(o));
 for(const b of bs){
  if(players.some(o=>o.health>0&&!o.spectating&&!(['floor','stairs'].includes(p.type)&&o.grounded&&b.y>=o.y&&b.y-o.y<=.43)&&o.y<b.y+b.h-.05&&o.y+bodyHeight(o)>b.y+.05&&Math.abs(o.x-b.x)<b.w/2+RADIUS+.02&&Math.abs(o.z-b.z)<b.d/2+RADIUS+.02))return 'Player in the way';
  if(near.some(o=>Math.abs(o.x-b.x)<(o.w+b.w)/2-.06&&Math.abs(o.z-b.z)<(o.d+b.d)/2-.06&&b.y<o.y+o.h-.06&&b.y+b.h>o.y+.06))return 'Blocked';
 }
 // Buried floor/roof surfaces are not usable. Walls and ramps can root in a slope.
 const terrain=bs.map(b=>groundAt(map,b.x,b.z)-b.y);
 if(p.type==='floor'&&Math.max(...terrain)>.13||p.type==='roof'&&Math.min(...terrain)>.15||['wall','stairs'].includes(p.type)&&Math.min(...terrain)>1)return 'Inside terrain';
 if(!anchored(p,map)&&!builds.some(b=>touching(bounds(p),bounds(b))))return 'Needs support';
 return '';
}
const cellKey=p=>[p.x,p.y,p.z,p.rotation].join(',');
// One deterministic solver for host and preview. Enumerate local grid attachments,
// rank intent before validation, and never search behind a major solid wall.
export function solvePlacement(p,type,rotation,material,map,builds=[],players=[],preferred=null){
 const base=placement(p,type,rotation,material),forward=direction(p.yaw,0),ray=direction(p.yaw,p.pitch),eye={x:p.x,y:p.y+eyeHeight(p),z:p.z};
 const hit=worldHit(map,eye,ray,9),aim=hit?.point||{x:p.x+ray.x*5,y:eye.y+ray.y*5,z:p.z+ray.z*5};
 const aimed=builds.find(b=>b.id===hit?.box?.buildId&&b.type===type);
 if(aimed&&!(type==='stairs'&&Math.abs(p.x-aimed.x)<2.6&&Math.abs(p.z-aimed.z)<2.6&&p.y>aimed.y+.7&&p.pitch>-.45)){
  const point=hit.point,inside=type==='wall'?(Math.abs((aimed.rotation%2?point.z-aimed.z:point.x-aimed.x))<1.65&&point.y>aimed.y+.25&&point.y<aimed.y+3.7):(Math.abs(point.x-aimed.x)<1.65&&Math.abs(point.z-aimed.z)<1.65);
  if(inside)return {piece:{...aimed,material},reason:'Already built'};
 }
 const nearBuilds=builds.filter(b=>Math.hypot(b.x-p.x,b.z-p.z)<12&&Math.abs(b.y-p.y)<9);
 const nearWorld=[...candidates(map,p,null,0,10)].filter(b=>!b.buildId&&blocksBuilding(b));
 const options=new Map(),offsetX=type==='wall'&&base.rotation%2?2:0,offsetZ=type==='wall'&&!(base.rotation%2)?2:0;
 const add=(x,y,z,connected=false)=>{
  x=Math.round((x-offsetX)/GRID)*GRID+offsetX;z=Math.round((z-offsetZ)/GRID)*GRID+offsetZ;y=Math.round(Math.max(0,y)*1000)/1000;
  const dx=x-p.x,dz=z-p.z,along=dx*forward.x+dz*forward.z,side=Math.abs(dx*forward.z-dz*forward.x);
  if(Math.hypot(dx,dz)>9||along< -2.1||Math.abs(y-p.y)>6)return;
  const piece={...base,x,y,z},key=cellKey(piece);
  const aimY=type==='wall'?y+1.5:type==='stairs'?y+2:y;
  const score=Math.hypot(x-aim.x,z-aim.z)*.65+Math.abs(aimY-aim.y)*.65+side*.45+Math.abs(along-4)*.15-(connected?1.2:0);
  if(!options.has(key)||options.get(key).score>score)options.set(key,{piece,score});
 };
 const cx=Math.round((p.x+forward.x*3-offsetX)/GRID)*GRID+offsetX,cz=Math.round((p.z+forward.z*3-offsetZ)/GRID)*GRID+offsetZ;
 for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++){
  const x=cx+ix*GRID,z=cz+iz*GRID;
  const ys=type==='wall'?[groundAt(map,x,z)]:[Math.max(...[[-1.9,-1.9],[-1.9,1.9],[1.9,-1.9],[1.9,1.9],[0,0]].map(([dx,dz])=>groundAt(map,x+dx,z+dz)))];
  for(const box of nearWorld)if(Math.abs(box.x-x)<box.w/2+2&&Math.abs(box.z-z)<box.d/2+2&&Math.abs(box.y+box.h-p.y)<5)ys.push(box.y+box.h);
  for(const y of ys)add(x,y,z);
 }
 for(const b of nearBuilds){
  for(const y of [b.y,b.y+GRID])for(const [dx,dz]of [[0,0],[-4,0],[4,0],[0,-4],[0,4],[-2,0],[2,0],[0,-2],[0,2]])add(b.x+dx,y,b.z+dz,true);
  // The top edge of a ramp is an explicit attachment, even while climbing it.
  if(b.type==='stairs'){
   const d=direction(b.rotation*Math.PI/2,0),top={x:b.x+d.x*GRID,y:b.y+GRID,z:b.z+d.z*GRID};
   add(top.x,top.y,top.z,true);
   const q=options.get(cellKey({...base,x:Math.round((top.x-offsetX)/GRID)*GRID+offsetX,y:top.y,z:Math.round((top.z-offsetZ)/GRID)*GRID+offsetZ}));
   if(q&&Math.abs(p.x-b.x)<2.6&&Math.abs(p.z-b.z)<2.6&&p.y>b.y+.8&&forward.x*d.x+forward.z*d.z>.6&&p.pitch>-.65)q.score-=3;
  }
 }
 const ranked=[...options.values()].sort((a,b)=>a.score-b.score||cellKey(a.piece).localeCompare(cellKey(b.piece)));
 let best=null,firstReason='Needs support';
 for(const option of ranked){
  if(best&&option.score>best.score+.5)break;
  const reason=validPlacement(option.piece,map,builds,players);
  if(!best&&option===ranked[0])firstReason=reason;
  if(reason)continue;
  // Test the sight line to the near face; tiny props never veto a connection.
  const q=option.piece,tx=q.x-eye.x,ty=q.y+(type==='wall'?1.4:type==='stairs'?2:.15)-eye.y,tz=q.z-eye.z,len=Math.hypot(tx,ty,tz)||1;
  if(nearWorld.some(b=>rayBox(eye,{x:tx/len,y:ty/len,z:tz/len},b)<len-2.2))continue;
  if(!best||preferred&&cellKey(q)===preferred)best=option;
 }
 return {piece:best?.piece||ranked[0]?.piece||base,reason:best?'':firstReason||'Blocked'};
}
export function aimedObject(map,p,range=5){
 const hit=worldHit(map,{x:p.x,y:p.y+eyeHeight(p),z:p.z},direction(p.yaw,p.pitch),range);
 return hit?.box?hit:null;
}
export function rebuildMap(sim){
 sim.map.boxes=[...sim.worldBoxes.filter(b=>!sim.worldDamage[b.objectId]?.destroyed).map(b=>worldDoorBox(b,sim.doors)),...sim.builds.flatMap(pieceBoxes)];invalidateCollision(sim.map);sim.lootSupportDirty=true;sim.navigationRevision=(sim.navigationRevision||0)+1;
}
export function resetBuilding(sim){
 sim.worldBoxes=authoredBoxes(sim.map);sim.worldDamage={};sim.builds=[];sim.buildId=0;sim.buildVersion=0;rebuildMap(sim);
}
export function collapse(sim){
 const supported=new Set(sim.builds.filter(b=>anchored(b,sim.map)).map(b=>b.id)),cache=new Map(sim.builds.map(b=>[b.id,bounds(b)]));let changed=true;
 while(changed){changed=false;for(const b of sim.builds)if(!supported.has(b.id)&&sim.builds.some(a=>supported.has(a.id)&&touching(cache.get(a.id),cache.get(b.id)))){supported.add(b.id);changed=true;}}
 if(supported.size!==sim.builds.length){sim.builds=sim.builds.filter(b=>supported.has(b.id));sim.buildVersion++;rebuildMap(sim);}
}
export function damageObject(sim,box,amount,harvester=null){
 if(!box||box.indestructible||!Number.isFinite(amount)||amount<=0)return;
 const built=box.buildId?sim.builds.find(b=>b.id===box.buildId):null;
 if(box.buildId&&!built)return; // Stale references can never become environmental resources.
 if(!built&&!sim.worldBoxes.some(b=>b.objectId===box.objectId))return;
 const definition=harvestDefinition(box,sim.map),material=built?.material||definition.material,max=built?.maxHealth||box.health||definition.health;
 const object=built||(sim.worldDamage[box.objectId]??={health:max,maxHealth:max,destroyed:false,resourceBudget:definition.resources,resourcePaid:0});
 if(object.destroyed||object.health<=0)return;
 const before=object.health,taken=Math.min(before,amount);object.health-=taken;object.lastDamage=sim.time;
 if(harvester&&!built){
  const budget=object.resourceBudget??definition.resources;
  const available=Math.max(0,budget-(object.resourcePaid||0));
  const reward=Math.min(available,Math.floor((max-object.health)*budget/max)-Math.floor((max-before)*budget/max));
  object.resourcePaid=(object.resourcePaid||0)+reward;
  const earned=Math.max(0,Math.min(CAP-(harvester.materials[material]||0),reward));
  harvester.materials[material]=(harvester.materials[material]||0)+earned;
  if(earned){harvester.lastHarvest={material,amount:earned,time:sim.time};sim.emit('harvest',{player:harvester.id,material,amount:earned,x:box.x,y:box.y+1,z:box.z});}
 }
 if(object.health<=0){object.destroyed=true;if(built)sim.builds=sim.builds.filter(b=>b!==built);sim.emit('royale-fx',{kind:'break',x:box.x,y:box.y,z:box.z});rebuildMap(sim);collapse(sim);}
 sim.buildVersion++;
}
export function swingPickaxe(sim,p){
 if(!canFight(p))return;
 if(sim.time<(p.nextHarvest||0))return;p.nextHarvest=sim.time+PICKAXE.interval;p.swingAt=sim.time;
 sim.emit('royale-cue',{cue:'pickaxe-swing',player:p.id,x:p.x,y:p.y,z:p.z});
 const hit=aimedObject(sim.map,p,PICKAXE.range),o={...p,y:p.y+eyeHeight(p)},d=direction(p.yaw,p.pitch);let target=null,range=hit?.distance??PICKAXE.range;
 for(const other of sim.players.values())if(other!==p&&other.health>0){const t=rayEgg(o,d,other);if(t<range){target=other;range=t;}}
 if(target)sim.damage(target,p,PICKAXE.player,'Pickaxe');else if(hit){const entry=sim.worldDamage[hit.box.objectId],weak=entry?.weakpoint,bonus=weak&&Math.hypot(hit.point.x-weak.x,hit.point.y-weak.y,hit.point.z-weak.z)<.4;damageObject(sim,hit.box,(hit.box.buildId?PICKAXE.structure:PICKAXE.environment)*(bonus?PICKAXE.weakMultiplier:1),p);const object=sim.worldDamage[hit.box.objectId];if(object&&!object.destroyed){const offset=Math.sin(sim.time*7)*.35;object.weakpoint={x:Math.max(hit.box.x-hit.box.w/2+.03,Math.min(hit.box.x+hit.box.w/2-.03,hit.point.x+(Math.abs(d.z)>.7?offset:0))),y:Math.max(hit.box.y+.3,Math.min(hit.box.y+hit.box.h-.2,hit.point.y+.25)),z:Math.max(hit.box.z-hit.box.d/2+.03,Math.min(hit.box.z+hit.box.d/2-.03,hit.point.z+(Math.abs(d.x)>.7?offset:0)))};}sim.emit('royale-cue',{cue:'harvest-hit',player:p.id,x:hit.point.x,y:hit.point.y,z:hit.point.z});}
}
export function buildingTick(sim,p,input){
 if(!canFight(p)){p.building=false;p.editing=false;return false;}
 const wasBuilding=p.building;
 p.buildFacing=snappedFacing(p.yaw,wasBuilding?p.buildFacing:undefined);
 const enabled=sim.options?.building!==false;
 p.editing=enabled&&!!input.editing;p.building=enabled&&!!input.buildMode||p.editing;p.buildType=input.buildType||'wall';
 const requested=MATERIALS[input.buildMaterial]?input.buildMaterial:'wood';
 if(requested!==p.buildRequested||!p.buildMaterial){p.buildMaterial=requested;p.buildRequested=requested;}
 p.buildMaterial=selectMaterial(p.materials,p.buildMaterial)||p.buildMaterial;p.buildRotation=Number.isInteger(input.buildRotation)?((input.buildRotation%4)+4)%4:0;
 if(p.editing){p.use=null;p.reloadEnd=0;p.burstLeft=0;p.aim=false;return true;}
 if(p.building){
  p.use=null;p.reloadEnd=0;p.burstLeft=0;p.aim=false;
  if(input.fire&&sim.time>=(p.nextBuild||0)){
   p.nextBuild=sim.time+.15;
   const mat=p.buildMaterial;
   const {piece:build,reason}=solvePlacement(p,p.buildType,p.buildRotation,mat,sim.map,sim.builds,[...sim.players.values()],input.buildAnchor);
   p.buildReason=reason;
   if(!reason&&p.materials[mat]>=COST){const def=MATERIALS[mat];p.materials[mat]-=COST;sim.builds.push({...build,id:'build-'+(++sim.buildId),owner:p.id,team:p.team,teamMode:sim.options.mode==='teams',health:def.start,maxHealth:def.health,constructionRemaining:def.health-def.start,constructionTick:sim.time+.5,revision:0,created:sim.time,lastDamage:-100});p.buildMaterial=selectMaterial(p.materials,mat)||mat;sim.buildVersion++;rebuildMap(sim);sim.emit('royale-cue',{cue:'build-place',player:p.id,x:build.x,y:build.y,z:build.z});}
  }
  return true;
 }
 if(p.slot===0){if(input.fire)swingPickaxe(sim,p);return true;}
 return false;
}
export function targetBuild(map,builds,p){
 const hit=aimedObject(map,p,EDIT_RANGE),o={x:p.x,y:p.y+eyeHeight(p),z:p.z},d=direction(p.yaw,p.pitch);
 let best=null,limit=hit?.distance??EDIT_RANGE;
 for(const b of builds){const grid=editRay(b,o,d,EDIT_RANGE);if(grid&&grid.distance<=limit+.2){best=b;limit=grid.distance;}}
 return best||builds.find(b=>b.id===hit?.box.buildId)||null;
}
export function editBuilding(sim,p,action){
 if(!canFight(p))return false;
 let cmd,legacy=/^build-edit-(\d+)-(build-\d+)$/.exec(action);
 if(action.startsWith('build-change:')){try{cmd=JSON.parse(action.slice(13));}catch{return false;}}
 else if(legacy)cmd={id:legacy[2],mask:Number(legacy[1]),path:[]};
 if(cmd&&Number.isFinite(cmd.yaw)&&Number.isFinite(cmd.pitch))p={...p,yaw:cmd.yaw,pitch:Math.max(-1.48,Math.min(1.48,cmd.pitch))};
 const aimed=targetBuild(sim.map,sim.builds,p),b=sim.builds.find(b=>b.id===(cmd?.id||aimed?.id));
 const fail=reason=>{sim.emit('build-result',{player:p.id,buildId:cmd?.id,ok:false,reason});return false;};
 if(!b||!canEdit(b,p)||p.health<=0||p.flight!=='ground')return fail('You cannot edit this structure');
 // Retest line of sight against its original plane; holes remain targetable.
 const ray=editRay(b,{x:p.x,y:p.y+eyeHeight(p),z:p.z},direction(p.yaw,p.pitch),EDIT_RANGE);
 const hit=aimedObject(sim.map,p,EDIT_RANGE);
 if(!ray&&hit?.box.buildId!==b.id)return fail('Aim at the structure');
 if(hit&&hit.box.buildId!==b.id&&hit.distance+.2<(ray?.distance??Infinity))return fail('Structure is obstructed');
 if(cmd&&cmd.revision!=null&&cmd.revision!==(b.revision||0))return fail('Structure changed — reopen edit');
 if(action==='build-repair'){
  if(sim.time<(p.nextRepair||0))return false;p.nextRepair=sim.time+.25;
  const missing=b.maxHealth-b.health-(b.constructionRemaining||0)-(b.repairRemaining||0),cost=Math.ceil(missing/b.maxHealth*COST);
  if(missing<=0||p.materials[b.material]<cost)return fail('Repair unavailable');
  p.materials[b.material]-=cost;b.repairRemaining=missing;b.constructionTick=Math.max(b.constructionTick||0,sim.time+.5);
 }else{
  if(!cmd||!Array.isArray(cmd.path||[])||(cmd.path||[]).length>9)return fail('Invalid edit');
  const proposal={...b,mask:cmd.mask,path:cmd.path||[],doorOpen:false};
  if(!validEdit(proposal))return fail('Invalid selection');
  if(JSON.stringify([b.mask,b.path||[]])===JSON.stringify([proposal.mask,proposal.path])){sim.emit('build-result',{player:p.id,buildId:b.id,ok:true});return true;}
  const overlaps=(box,p)=>p.health>0&&p.y<box.y+box.h-.03&&p.y+bodyHeight(p)>box.y+.03&&Math.abs(p.x-box.x)<box.w/2+RADIUS+.03&&Math.abs(p.z-box.z)<box.d/2+RADIUS+.03;
  if(pieceBoxes(proposal).some(box=>[...sim.players.values()].some(p=>overlaps(box,p))))return fail('Player in the way');
  b.mask=proposal.mask;b.path=proposal.path;b.doorOpen=false;b.revision=(b.revision||0)+1;
 }
 sim.buildVersion++;rebuildMap(sim);collapse(sim);sim.emit('build-result',{player:p.id,buildId:b.id,ok:true,changed:true});return true;
}
export function toggleDoor(sim,p){
 if(!canFight(p))return false;
 const hit=aimedObject(sim.map,p,3),b=sim.builds.find(b=>b.id===hit?.box.buildId);
 if(!b||wallPattern(b.mask)?.door==null||sim.time<(p.nextDoor||0))return false;
 const proposal={...b,doorOpen:!b.doorOpen};
 for(const box of pieceBoxes(proposal).filter(b=>b.door))if([...sim.players.values()].some(o=>o.health>0&&o.y<box.y+box.h&&o.y+bodyHeight(o)>box.y&&Math.abs(o.x-box.x)<box.w/2+RADIUS+.04&&Math.abs(o.z-box.z)<box.d/2+RADIUS+.04))return false;
 b.doorOpen=proposal.doorOpen;b.revision=(b.revision||0)+1;p.nextDoor=sim.time+.25;sim.buildVersion++;rebuildMap(sim);return true;
}
export function constructionTick(sim){
 for(const b of sim.builds){
  const stats=buildStats(b);
  b.constructionRemaining??=Math.max(0,b.maxHealth-stats.start);
  b.constructionTick??=b.created+.5;
  if(sim.time+1e-8<b.constructionTick||(!(b.constructionRemaining>0)&&!(b.repairRemaining>0)))continue;
  const ticks=Math.min(60,Math.floor((sim.time-b.constructionTick+1e-8)/stats.tick)+1);b.constructionTick+=ticks*stats.tick;
  const gain=Math.min(b.constructionRemaining,stats.gain*ticks);b.constructionRemaining-=gain;
  const repair=Math.min(b.repairRemaining||0,stats.gain*ticks);b.repairRemaining=Math.max(0,(b.repairRemaining||0)-repair);
  b.health=Math.min(b.maxHealth,b.health+gain+repair);sim.buildVersion++;
 }
}
// Remote prediction and rendering use their own map; simulation maps never mutate the authored island.
export function applyBuildState(map,r){
 const key=r.matchId+':'+r.round+':'+(r.builds||[]).map(b=>[b.id,b.mask,b.path,b.doorOpen,b.rotation,b.material,b.x,b.y,b.z].join(',')).join(';')+':'+Object.keys(r.worldDamage||{}).filter(k=>r.worldDamage[k].destroyed).join(',')+':'+Object.keys(r.doors||{}).filter(k=>r.doors[k].open).join(',');if(map.buildKey===key)return;
 map.authored??=authoredBoxes(map);map.boxes=[...map.authored.filter(b=>!r.worldDamage?.[b.objectId]?.destroyed).map(b=>worldDoorBox(b,r.doors)),...(r.builds||[]).flatMap(pieceBoxes)];map.buildKey=key;invalidateCollision(map);
}
