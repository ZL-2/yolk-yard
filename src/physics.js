import {TACTICAL_SPRINT} from './world-rules.js';
import {stepGrapple} from './grappler.js';
import {stepShadowstep} from './shadowstep.js';
import {SEASON} from './season-one.js';
import {beginFallStep,finishFallStep} from "./airborne.js";
import { clamp, weapon, gun } from "./data.js";
import {groundAt,terrainHit} from './terrain.js';
import {STANCE,bodyHeight,eyeHeight,regionPose} from './stance.js';
export const RADIUS = 0.32,
  HEIGHT = 1.85,
  EYE = 1.70;
export const ROYALE_MOVEMENT = Object.freeze({walk:5, sprint:TACTICAL_SPRINT.speed});
export const dist = (a, b) =>
  Math.hypot(a.x - b.x, (a.y || 0) - (b.y || 0), a.z - b.z);
export function direction(yaw, pitch = 0) {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}
export function rayBox(o, d, b, max = Infinity) {
  // Slab intersection without per-box arrays, iterators or dynamic property lookups.
  // This runs for every sight line, navigation probe and projectile collision.
  let lo=0,hi=max,a,c,min=b.x-b.w/2,upper=b.x+b.w/2;
  if(Math.abs(d.x)<1e-8){if(o.x<min||o.x>upper)return Infinity;}
  else{a=(min-o.x)/d.x;c=(upper-o.x)/d.x;if(a>c){const swap=a;a=c;c=swap;}lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return Infinity;}
  min=b.y;upper=b.y+b.h;
  if(Math.abs(d.y)<1e-8){if(o.y<min||o.y>upper)return Infinity;}
  else{a=(min-o.y)/d.y;c=(upper-o.y)/d.y;if(a>c){const swap=a;a=c;c=swap;}lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return Infinity;}
  min=b.z-b.d/2;upper=b.z+b.d/2;
  if(Math.abs(d.z)<1e-8){if(o.z<min||o.z>upper)return Infinity;}
  else{a=(min-o.z)/d.z;c=(upper-o.z)/d.z;if(a>c){const swap=a;a=c;c=swap;}lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return Infinity;}
  return lo;
}
// Spatial buckets keep large-island collision proportional to nearby cover.
const collisionIndex = new WeakMap();
export function invalidateCollision(map){collisionIndex.delete(map);}
function collisionGrid(map){
 let grid=collisionIndex.get(map);
 if(grid&&grid.boxes===map.boxes&&grid.count===map.boxes.length)return grid;
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(const b of map.boxes){minX=Math.min(minX,Math.floor((b.x-b.w/2)/8));maxX=Math.max(maxX,Math.floor((b.x+b.w/2)/8));minZ=Math.min(minZ,Math.floor((b.z-b.d/2)/8));maxZ=Math.max(maxZ,Math.floor((b.z+b.d/2)/8));}
 if(!map.boxes.length)minX=minZ=maxX=maxZ=0;
 const width=maxX-minX+1,height=maxZ-minZ+1,buckets=new Array(width*height);
 for(let id=0;id<map.boxes.length;id++){const b=map.boxes[id];for(let x=Math.floor((b.x-b.w/2)/8);x<=Math.floor((b.x+b.w/2)/8);x++)for(let z=Math.floor((b.z-b.d/2)/8);z<=Math.floor((b.z+b.d/2)/8);z++){const key=(x-minX)*height+z-minZ;const bucket=buckets[key]??={ids:[],boxes:[]};bucket.ids.push(id);bucket.boxes.push(b);}}
 grid={boxes:map.boxes,count:map.boxes.length,minX,minZ,maxX,maxZ,height,buckets,stamp:0,seen:new Uint32Array(map.boxes.length),queries:new Map()};collisionIndex.set(map,grid);return grid;
}
function queryStamp(grid){if(++grid.stamp===0xffffffff){grid.seen.fill(0);grid.stamp=1;}return grid.stamp;}
const EMPTY_BOXES=Object.freeze([]);
export function candidates(map,o,d=null,max=0,radius=RADIUS){
 if(map.theme!=='royale')return map.boxes;
 const grid=collisionGrid(map);
 // Reuse exact bucket unions for movement and short collision/LOS probes.
 // Cached arrays are read-only; invalidation discards every geometry reference.
 const length=d?Math.min(Number.isFinite(max)?max:1600,1600):0;
 const steps=Math.max(1,Math.ceil(length*Math.hypot(d?.x||0,d?.z||0)/8));
 if(!d||steps===1){
  const ex=o.x+(d?.x||0)*length,ez=o.z+(d?.z||0)*length;
  const x0=Math.max(grid.minX,Math.floor((Math.min(o.x,ex)-radius)/8)),x1=Math.min(grid.maxX,Math.floor((Math.max(o.x,ex)+radius)/8)),z0=Math.max(grid.minZ,Math.floor((Math.min(o.z,ez)-radius)/8)),z1=Math.min(grid.maxZ,Math.floor((Math.max(o.z,ez)+radius)/8));
  if(x0>x1||z0>z1)return EMPTY_BOXES;
  const first=(x0-grid.minX)*grid.height+z0-grid.minZ,last=(x1-grid.minX)*grid.height+z1-grid.minZ;
  if(first===last)return grid.buckets[first]?.boxes||EMPTY_BOXES;
  const key=first*grid.buckets.length+last,cached=grid.queries.get(key);if(cached)return cached;
  let nearby;
  const stamp=queryStamp(grid);nearby=[];for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const bucket=grid.buckets[(x-grid.minX)*grid.height+z-grid.minZ];if(bucket)for(const id of bucket.ids)if(grid.seen[id]!==stamp){grid.seen[id]=stamp;nearby.push(grid.boxes[id]);}}
  if(grid.queries.size>=512)grid.queries.delete(grid.queries.keys().next().value);
  grid.queries.set(key,nearby);return nearby;
 }
 const found=[],stamp=queryStamp(grid);
 // Query the swept segment's actual buckets, including the full player/bolt
 // radius. Nine whole neighboring buckets per point used to dominate bot cost.
 for(let i=0;i<steps;i++){
  const from=length*i/steps,to=length*(i+1)/steps,ax=o.x+(d?.x||0)*from,az=o.z+(d?.z||0)*from,bx=o.x+(d?.x||0)*to,bz=o.z+(d?.z||0)*to;
  for(let x=Math.floor((Math.min(ax,bx)-radius)/8);x<=Math.floor((Math.max(ax,bx)+radius)/8);x++)for(let z=Math.floor((Math.min(az,bz)-radius)/8);z<=Math.floor((Math.max(az,bz)+radius)/8);z++){
   if(x<grid.minX||x>grid.maxX||z<grid.minZ||z>grid.maxZ)continue;const bucket=grid.buckets[(x-grid.minX)*grid.height+z-grid.minZ];if(bucket)for(const id of bucket.ids)if(grid.seen[id]!==stamp){grid.seen[id]=stamp;found.push(grid.boxes[id]);}
  }
 }
 return found;
}
export function wallDistance(map, o, d, max = 200) {
  let t = max;
  if(map.theme!=='royale'){for(const b of map.boxes)t=Math.min(t,rayBox(o,d,b,t));}
  else{
   // Visit ray buckets in order and stop at the nearest hit. No candidate Set,
   // strings or result array is allocated for the many bot sight-line probes.
   const grid=collisionGrid(map),stamp=queryStamp(grid),length=Math.min(Number.isFinite(max)?max:1600,1600),steps=Math.max(1,Math.ceil(length*Math.hypot(d.x,d.z)/8));
   for(let i=0;i<steps&&length*i/steps<=t;i++){
    const from=length*i/steps,to=Math.min(t,length*(i+1)/steps),ax=o.x+d.x*from,az=o.z+d.z*from,bx=o.x+d.x*to,bz=o.z+d.z*to;
    for(let x=Math.max(grid.minX,Math.floor(Math.min(ax,bx)/8));x<=Math.min(grid.maxX,Math.floor(Math.max(ax,bx)/8));x++)for(let z=Math.max(grid.minZ,Math.floor(Math.min(az,bz)/8));z<=Math.min(grid.maxZ,Math.floor(Math.max(az,bz)/8));z++){
     const bucket=grid.buckets[(x-grid.minX)*grid.height+z-grid.minZ];if(bucket)for(const id of bucket.ids)if(grid.seen[id]!==stamp){grid.seen[id]=stamp;t=Math.min(t,rayBox(o,d,grid.boxes[id],t));}
    }
   }
  }
  const ground=terrainHit(map,o,d,t);if(ground)t=Math.min(t,ground.distance);
  return t;
}
// Fixed anatomical regions, independent of cosmetics and visual animation.
// Torso/limbs all deal body damage. Only the head region is critical.
export const HUMAN_HIT=[
 {region:'head',x:0,y:1.68,z:0,rx:.157,ry:.18,rz:.155},
 {region:'body',x:0,y:1.24,z:0,rx:.26,ry:.30,rz:.17},
 {region:'body',x:0,y:.92,z:0,rx:.20,ry:.19,rz:.17},
 ...[-1,1].flatMap(side=>[
  {region:'body',x:side*.31,y:1.29,z:-.03,rx:.095,ry:.19,rz:.13},
  {region:'body',x:side*.24,y:1.15,z:-.22,rx:.10,ry:.13,rz:.20},
  {region:'body',x:side*.12,y:.65,z:0,rx:.11,ry:.26,rz:.13},
  {region:'body',x:side*.12,y:.25,z:0,rx:.08,ry:.23,rz:.1}])
];
export const humanFlightPitch=p=>p.flight==='dive'?.78:p.flight==='glide'?.09+Math.max(-.06,Math.min(.11,(-(p.vx||0)*Math.sin(p.yaw||0)-(p.vz||0)*Math.cos(p.yaw||0))*.005)):0;
export function humanHit(o,d,p,radius=0){
 const yaw=p.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),dx=o.x-p.x,dz=o.z-p.z;
 const origin={x:dx*c-dz*s,y:o.y-p.y,z:dx*s+dz*c},v={x:d.x*c-d.z*s,y:d.y,z:d.x*s+d.z*c};
 const pitch=humanFlightPitch(p),cp=Math.cos(pitch),sp=Math.sin(pitch);for(const vector of [origin,v]){const y=vector.y,z=vector.z;vector.y=y*cp+z*sp;vector.z=-y*sp+z*cp;}
 let result={distance:Infinity,region:null};
 for(const base of HUMAN_HIT){
  const posed=regionPose(base,p),h={...posed,rx:posed.rx+radius,ry:posed.ry+radius,rz:posed.rz+radius},a=[(origin.x-h.x)/h.rx,(origin.y-h.y)/h.ry,(origin.z-h.z)/h.rz],b=[v.x/h.rx,v.y/h.ry,v.z/h.rz];
  const A=b.reduce((n,x)=>n+x*x,0),B=2*a.reduce((n,x,i)=>n+x*b[i],0),C=a.reduce((n,x)=>n+x*x,0)-1,D=B*B-4*A*C;
  if(A<1e-12||D<0)continue;const t=C<=0?0:(-B-Math.sqrt(D))/(2*A);
  if(t>=0&&t<result.distance)result={distance:t,region:h.region};
 }return result;
}
// Stable internal API retained for saved simulations and existing callers.
export const rayEgg=(o,d,p)=>humanHit(o,d,p).distance;
export const rayHuman=rayEgg;
function overlaps(p, b) {
  return (
    p.y < b.y + b.h - 0.015 &&
    p.y + bodyHeight(p) > b.y + 0.02 &&
    Math.abs(p.x - b.x) < b.w / 2 + RADIUS &&
    Math.abs(p.z - b.z) < b.d / 2 + RADIUS
  );
}
export function canStand(map,p,margin=RADIUS) {
 return canOccupy(map,p,HEIGHT,margin);
}
export function canOccupy(map,p,height=bodyHeight(p),margin=RADIUS) {
 if(Math.abs(p.x)>map.size-margin||Math.abs(p.z)>map.size-margin)return false;
 for(const b of candidates(map,p,null,0,margin))if(p.y+.035<b.y+b.h&&p.y+height>b.y+.02&&Math.abs(p.x-b.x)<b.w/2+margin&&Math.abs(p.z-b.z)<b.d/2+margin)return false;
 return true;
}
function pushAxis(p,map,axis,delta) {
 if(Math.abs(delta)<1e-10)return;
 const start=p[axis],base=p.y,other=axis==='x'?'z':'x',size=axis==='x'?'w':'d';
 let target=start+delta;
 const height=bodyHeight(p),point={x:p.x,y:p.y,z:p.z};point[axis]=target;
 const hits=[];let top=base;
 for(const b of candidates(map,point))if(p.y<b.y+b.h-.015&&p.y+height>b.y+.02&&Math.abs(p[other]-b[other])<(other==='x'?b.w:b.d)/2+RADIUS&&Math.abs(target-b[axis])<b[size]/2+RADIUS){hits.push(b);top=Math.max(top,b.y+b.h);}
 // One stair rise per axis. Never stack multiple step corrections in one move.
 if(hits.length&&p.grounded&&top-base>0&&top-base<=.43&&canOccupy(map,{...point,y:top},height)) {
  p[axis]=target;p.y=top;return;
 }
 for(const b of hits){
  const edge=b[axis]-Math.sign(delta)*(b[size]/2+RADIUS+.001);
  // Clamp against the entry face; an unrelated box cannot teleport the player.
  target=delta>0?Math.min(target,Math.max(start,edge)):Math.max(target,Math.min(start,edge));
 }
 p[axis]=target;
}
export function movePlayer(p, input, map, dt) {
  // Bound displacement through narrow risers, including low-frame-rate clients.
  const steps=Math.max(1,Math.ceil(Math.min(dt,.1)/(1/60)));
  for(let i=0;i<steps;i++){
    const before=beginFallStep(p);movePlayerStep(p,input,map,Math.min(dt,.1)/steps);
    let normalY=1;
    if(p.fall&&p.grounded&&map.terrain&&Math.abs(p.y-groundAt(map,p.x,p.z))<.05){const gx=(groundAt(map,p.x+.3,p.z)-groundAt(map,p.x-.3,p.z))/.6,gz=(groundAt(map,p.x,p.z+.3)-groundAt(map,p.x,p.z-.3))/.6;normalY=1/Math.hypot(1,gx,gz);}
    if(p.flight!=='transport')finishFallStep(p,before,normalY);
  }
}
function movePlayerStep(p, input, map, dt) {
  if (p.health <= 0) return;
  if ((input.jumpPress || 0) > (p.lastJumpPress || 0)) {
    p.lastJumpPress = input.jumpPress;
    p.jumpLatch = p.flightLatch = false;
  }
  p.yaw = Number.isFinite(input.yaw) ? input.yaw : p.yaw;
  p.pitch = clamp(
    Number.isFinite(input.pitch) ? input.pitch : p.pitch,
    -1.48,
    1.48,
  );
  if (p.flight === 'transport') return;
  if(stepGrapple(p,input,map,dt,canStand,groundAt))return;
  stepShadowstep(p,map,dt,canOccupy,groundAt,bodyHeight(p),RADIUS);
  p.traversalLock=Math.max(0,(p.traversalLock||0)-dt);
  if(p.traversal){
    const ride=p.traversal,line=map.traversal?.find(l=>l.id===ride.id);
    if(!line||p.downed||input.jump){p.traversal=null;p.traversalLock=.8;p.vy=input.jump?4:0;p.grounded=false;p.jumpLatch=!!input.jump;return;}
    const route=ride.route||[ride.from,ride.to],lengths=route.slice(1).map((q,i)=>Math.hypot(q.x-route[i].x,q.y-route[i].y,q.z-route[i].z)),length=lengths.reduce((a,b)=>a+b,0)||1,next=Math.min(1,ride.progress+line.speed*dt/length);let travel=next*length,segment=0;while(segment<lengths.length-1&&travel>lengths[segment])travel-=lengths[segment++];const a=route[segment],b=route[segment+1],t=Math.min(1,travel/(lengths[segment]||1)),point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
    if(!canStand(map,point)){p.traversal=null;p.vy=0;return;}
    Object.assign(p,point);ride.progress=next;p.grounded=false;p.vy=0;p.sprinting=p.tacticalSprint=false;p.crouching=p.sliding=false;p.fall={apex:Math.max(p.fall?.apex||p.y,p.y),immune:true,source:'traversal'};
    if(next>=1){p.traversal=null;p.traversalLock=.8;p.vy=0;p.grounded=false;p.jumpLatch=true;}return;
  }

  if (p.flight === 'dive' || p.flight === 'glide' || p.flight === 'launch') {
    p.crouching=false;p.lowCrouch=false;p.sliding=false;p.crouchLatch=!!input.crouch;
    const toggle=input.jump&&!p.flightLatch;p.flightLatch=!!input.jump;
    const f=clamp(input.forward || 0,-1,1),s=clamp(input.strafe || 0,-1,1),length=Math.max(1,Math.hypot(f,s));
    const speed=SEASON.flight[p.flight];
    pushAxis(p,map,'x',(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)/length*speed*dt);
    pushAxis(p,map,'z',(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)/length*speed*dt);
    p.x=clamp(p.x,-map.size+.5,map.size-.5);p.z=clamp(p.z,-map.size+.5,map.size-.5);
    let floor=groundAt(map,p.x,p.z);for(const b of candidates(map,p))if(b.y+b.h<=p.y+.045&&Math.abs(p.x-b.x)<b.w/2+RADIUS-.015&&Math.abs(p.z-b.z)<b.d/2+RADIUS-.015)floor=Math.max(floor,b.y+b.h);
    if(!p.fall)p.fall={apex:p.y,immune:true,source:'bus'};
    if(toggle){if(p.flight==='dive')p.flight='glide';else if(p.flight==='glide'&&p.y-floor>32)p.flight='dive';}
    if(p.flight==='launch'){
      p.vy-=20*dt;
      const ceiling=worldHit(map,{x:p.x,y:p.y+HEIGHT,z:p.z},{x:0,y:1,z:0},Math.max(0,p.vy*dt));
      if(ceiling||p.vy<=0){p.flight=p.forceGlider?'glide':'ground';p.vy=Math.min(0,p.vy);}
    }else{if(p.y-floor<=24)p.flight='glide';p.vy=p.flight==='glide'?-SEASON.flight.glideFall:-SEASON.flight.diveFall;}
    p.y+=p.vy*dt;p.grounded=false;
    if(p.y<=floor){p.y=floor;p.vy=0;p.grounded=true;p.flight='ground';p.jumpLatch=!!input.jump;}
    p.sprinting=p.tacticalSprint=false;p.sprintBlend=0;p.sprintRest=(p.sprintRest||0)+dt;if(p.sprintRest>TACTICAL_SPRINT.delay)p.stamina=Math.min(100,(p.stamina??100)+TACTICAL_SPRINT.recharge*dt);if(p.stamina>=TACTICAL_SPRINT.restart)p.exhausted=false;return;
  }
  {
    const rule=TACTICAL_SPRINT,was=p.sprinting;p.stamina??=100;p.sprintRest??=0;p.sprintRecovery=Math.max(0,(p.sprintRecovery||0)-dt);
    if(p.stamina>=rule.restart)p.exhausted=false;
    p.sprinting=!!input.sprint&&!p.boss&&!p.downed&&!p.reviving&&!p.crouching&&!p.sliding&&!p.exhausted&&p.stamina>0&&!input.aim&&!input.fire&&!p.use&&!input.buildMode&&!input.editing&&!p.reloadEnd&&(input.forward||0)>.2&&p.grounded;
    p.tacticalSprint=p.sprinting;p.sprintBlend=Math.min(1,Math.max(0,(p.sprintBlend||0)+(p.sprinting?1:-2)*rule.acceleration*dt));
    if(p.sprinting){p.stamina=Math.max(0,p.stamina-rule.drain*dt);p.sprintRest=0;if(p.stamina===0)p.exhausted=true;}
    else{p.sprintRest+=dt;if(p.sprintRest>rule.delay)p.stamina=Math.min(100,p.stamina+rule.recharge*dt);}
    if(was&&!p.sprinting)p.sprintRecovery=rule.raiseTime;
  }
  let f = clamp(input.forward || 0, -1, 1),
    s = clamp(input.strafe || 0, -1, 1),
    len = Math.hypot(f, s);
  if (len > 1) {
    f /= len;
    s /= len;
  }
  p.slideCooldown=Math.max(0,(p.slideCooldown||0)-dt);
  // Packet gaps are not a physical stop. Use the most recently executed move,
  // bounded by server freshness, so crouch edges can initiate slides under jitter.
  const momentumX=p.motionFresh?p.motionVX:p.vx,momentumZ=p.motionFresh?p.motionVZ:p.vz;
  const speedBefore=Math.hypot(momentumX||0,momentumZ||0),crouchEdge=!!input.crouch&&!p.crouchLatch;
  const gx=p.grounded&&input.crouch?(groundAt(map,p.x+.3,p.z)-groundAt(map,p.x-.3,p.z))/.6:0,gz=p.grounded&&input.crouch?(groundAt(map,p.x,p.z+.3)-groundAt(map,p.x,p.z-.3))/.6:0,slope=Math.hypot(gx,gz);
  if(!p.downed&&!p.reviving&&input.crouch&&p.grounded&&!p.sliding&&slope>=SEASON.slide.slope&&p.slideCooldown===0){p.sliding=true;p.slideAge=0;p.slideVX=-gx/slope*3;p.slideVZ=-gz/slope*3;}
  if(!p.downed&&!p.reviving&&crouchEdge&&p.grounded&&speedBefore>=5.5&&p.slideCooldown===0){
    p.sliding=true;p.slideAge=0;const boost=Math.min(9,speedBefore+.35)/Math.max(.01,speedBefore);p.slideVX=momentumX*boost;p.slideVZ=momentumZ*boost;
  }
  p.crouchLatch=!!input.crouch;
  if(p.sliding){
    p.slideAge=(p.slideAge||0)+dt;
    if(!input.crouch||input.jump||p.downed||p.reviving||slope<SEASON.slide.slope&&(p.slideAge>=3.4||Math.hypot(p.slideVX,p.slideVZ)<2.6)){p.sliding=false;p.slideCooldown=.65;}
  }
  p.crouching=!p.downed&&(p.sliding||!!p.reviving||!!input.crouch||!canStand(map,p));
  p.lowCrouch=!!p.crouching&&!p.sliding&&!canOccupy(map,p,STANCE.crouching.height);
  if(p.crouching||p.downed||p.reviving)p.sprinting=false;
  if(p.downed){input={...input,jump:false,aim:false};p.crouching=false;p.sliding=false;}
  if(p.reviving){f=0;s=0;}
  const speed =
    (p.inventory ? ROYALE_MOVEMENT.walk+(ROYALE_MOVEMENT.sprint-ROYALE_MOVEMENT.walk)*(p.sprinting?p.sprintBlend:0) : weapon(p.weapon).speed*(1+(TACTICAL_SPRINT.arenaMultiplier-1)*(p.sprinting?p.sprintBlend:0))) *
    (input.aim ? gun(p).adsMove : 1) *
    (p.quickstep?1.12:1)*(p.downed?STANCE.downed.speed:p.lowCrouch?STANCE.compact.speed:p.crouching&&!p.sliding?STANCE.crouching.speed:1);
  let mx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)*speed,mz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)*speed;
  if(p.sliding){
    let vx=p.slideVX||0,vz=p.slideVZ||0,v=Math.hypot(vx,vz);
    if(p.grounded){
      const gx=(groundAt(map,p.x+.3,p.z)-groundAt(map,p.x-.3,p.z))/.6,gz=(groundAt(map,p.x,p.z+.3)-groundAt(map,p.x,p.z-.3))/.6;
      vx-=gx*SEASON.slide.gravity*dt;vz-=gz*SEASON.slide.gravity*dt;
      const loss=Math.max(0,1-(slope>=SEASON.slide.slope?2.4:3.8)*dt/Math.max(v,.01));vx*=loss;vz*=loss;
    }
    v=Math.hypot(vx,vz);const wanted=Math.hypot(mx,mz);
    if(wanted>.1){const blend=Math.min(.055,dt*.85);vx=vx*(1-blend)+mx/wanted*v*blend;vz=vz*(1-blend)+mz/wanted*v*blend;const n=Math.hypot(vx,vz)||1;vx*=v/n;vz*=v/n;}
    const cap=Math.min(1,SEASON.slide.cap/(Math.hypot(vx,vz)||1));p.slideVX=mx=vx*cap;p.slideVZ=mz=vz*cap;
  }else if(!p.grounded&&p.slideAge>0&&!p.downed){mx=mx*.2+(p.slideVX||0)*.8;mz=mz*.2+(p.slideVZ||0)*.8;}
  else if(p.grounded&&!p.sliding)p.slideAge=0;
  const dx=mx*dt,dz=mz*dt;
  if (input.jump && p.grounded && !p.jumpLatch && !p.reviving && !p.downed && canStand(map,p)) {
    p.crouching=false;p.sliding=false;
    p.vy = 8.6;
    p.grounded = false;
  }
  p.jumpLatch = !!input.jump;
  const wasGrounded=p.grounded&&p.vy<=0;
  const oldSurfaceY=p.y, followedGround=!!map.terrain&&wasGrounded&&Math.abs(p.y-groundAt(map,p.x,p.z))<.035;
  pushAxis(p, map, "x", dx);
  pushAxis(p, map, "z", dz);
  if(p.launchVelocity&&!p.grounded){pushAxis(p,map,'x',p.launchVelocity.x*dt);pushAxis(p,map,'z',p.launchVelocity.z*dt);p.launchVelocity.x*=Math.exp(-.4*dt);p.launchVelocity.z*=Math.exp(-.4*dt);}
  const ground=groundAt(map,p.x,p.z);
  if(followedGround&&Math.abs(p.y-oldSurfaceY)<.05&&Math.abs(ground-oldSurfaceY)<=.43)p.y=ground;
  // Follow short descents without falling and landing on every individual tread.
  if(wasGrounded){
    let support=ground;
    for(const b of candidates(map,p))if(b.y+b.h<=p.y+.001&&Math.abs(p.x-b.x)<b.w/2+RADIUS&&Math.abs(p.z-b.z)<b.d/2+RADIUS)support=Math.max(support,b.y+b.h);
    if(p.y-support<=.43&&canOccupy(map,{x:p.x,y:support,z:p.z},bodyHeight(p))){p.y=support;p.vy=0;}
  }
  const oldY = p.y;
  p.vy -= 24 * dt;
  p.y += p.vy * dt;
  p.grounded = false;
  for (const b of candidates(map,p)) {
    if (
      Math.abs(p.x - b.x) >= b.w / 2 + RADIUS ||
      Math.abs(p.z - b.z) >= b.d / 2 + RADIUS
    )
      continue;
    if (p.vy <= 0 && oldY >= b.y + b.h - 0.045 && p.y <= b.y + b.h) {
      p.y = b.y + b.h;
      p.vy = 0;
      p.grounded = true;
    } else if (p.vy > 0 && oldY + bodyHeight(p) <= b.y + 0.03 && p.y + bodyHeight(p) >= b.y) {
      p.y = b.y - bodyHeight(p);
      p.vy = 0;
    }
  }
  if (p.y <= ground) {
    p.y = ground;
    p.vy = 0;
    p.grounded = true;
  }
  p.x = clamp(p.x, -map.size + RADIUS, map.size - RADIUS);
  p.z = clamp(p.z, -map.size + RADIUS, map.size - RADIUS);
}
export function sanitizeInput(i = {}) {
  const num = (n, a, b) => clamp(Number.isFinite(n) ? n : 0, a, b);
  return {
    seq: Math.floor(num(i.seq, 0, 1e10)),
    yaw: num(i.yaw, -1e6, 1e6),
    pitch: num(i.pitch, -1.48, 1.48),
    forward: num(i.forward, -1, 1),
    strafe: num(i.strafe, -1, 1),
    jump: !!i.jump,
    fire: !!i.fire,
    aim: !!i.aim,
    shotTime: Number.isFinite(i.shotTime)?i.shotTime:null,
    reload: !!i.reload,
    popper: !!i.popper,
    slot: Number.isInteger(i.slot) && i.slot>=0 && i.slot<6 ? i.slot : 0,
    buildAnchor:typeof i.buildAnchor==='string'&&/^[0-9.,-]{1,80}$/.test(i.buildAnchor)?i.buildAnchor:null, editing:!!i.editing, buildMode: !!i.buildMode, buildType: ["wall","floor","stairs","roof"].includes(i.buildType)?i.buildType:"wall", buildMaterial:["wood","brick","metal"].includes(i.buildMaterial)?i.buildMaterial:"wood", buildRotation:Number.isInteger(i.buildRotation)?((i.buildRotation%4)+4)%4:0,
    sprint: !!i.sprint, crouch:!!i.crouch, interact: !!i.interact, drop: !!i.drop,
    swapSlot: Number.isInteger(i.swapSlot) && i.swapSlot>=1 && i.swapSlot<6 ? i.swapSlot : -1,
  };
}

export const VIEWMODEL = { scale: 0.55, x: 0.10, y: -0.26, z: -0.20 };
export function muzzleOrigin(p, w) {
  const f = direction(p.yaw, p.pitch),
    right = { x: Math.cos(p.yaw), y: 0, z: -Math.sin(p.yaw) };
  const up = {
    x: Math.sin(p.yaw) * Math.sin(p.pitch),
    y: Math.cos(p.pitch),
    z: Math.cos(p.yaw) * Math.sin(p.pitch),
  };
  const side = p.aim ? 0 : VIEWMODEL.x,
    height = p.aim ? -w.sightY * VIEWMODEL.scale : VIEWMODEL.y,
    forward = -VIEWMODEL.z + w.muzzle * VIEWMODEL.scale;
  return {
    x: p.x + right.x * side + up.x * height + f.x * forward,
    y: p.y + eyeHeight(p) + up.y * height + f.y * forward,
    z: p.z + right.z * side + up.z * height + f.z * forward,
  };
}
// Swept segment collision supplies the actual surface normal for impact and bounce effects.
export function worldHit(map, o, d, max = 200, radius = 0) {
  let result = null,
    best = max;
  for (const source of candidates(map,o,d,max,radius)) {
    const b = radius
      ? {
          ...source,
          w: source.w + radius * 2,
          d: source.d + radius * 2,
          y: source.y - radius,
          h: source.h + radius * 2,
        }
      : source;
    const t = rayBox(o, d, b, best);
    if (!Number.isFinite(t) || t > best) continue;
    const hit = { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
    const faces = [
      ["x", b.x - b.w / 2, -1],
      ["x", b.x + b.w / 2, 1],
      ["y", b.y, -1],
      ["y", b.y + b.h, 1],
      ["z", b.z - b.d / 2, -1],
      ["z", b.z + b.d / 2, 1],
    ];
    faces.sort(
      (a, b) => Math.abs(hit[a[0]] - a[1]) - Math.abs(hit[b[0]] - b[1]),
    );
    const normal = { x: 0, y: 0, z: 0 };
    normal[faces[0][0]] = faces[0][2];
    best = t;
    result = { distance: t, point: hit, normal, box: source };
  }
  const ground=terrainHit(map,o,d,best,radius);if(ground)result=ground;
  return result;
}
