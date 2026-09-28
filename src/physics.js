import {beginFallStep,finishFallStep} from "./airborne.js";
import { clamp, weapon } from "./data.js";
import {groundAt,terrainHit} from './terrain.js';
export const RADIUS = 0.32,
  HEIGHT = 1.85,
  EYE = 1.70;
export const ROYALE_MOVEMENT = Object.freeze({walk:5, sprint:7.4});
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
  let lo = 0,
    hi = max;
  for (const [axis, min, maxV] of [
    ["x", b.x - b.w / 2, b.x + b.w / 2],
    ["y", b.y, b.y + b.h],
    ["z", b.z - b.d / 2, b.z + b.d / 2],
  ]) {
    if (Math.abs(d[axis]) < 1e-8) {
      if (o[axis] < min || o[axis] > maxV) return Infinity;
      continue;
    }
    let a = (min - o[axis]) / d[axis],
      c = (maxV - o[axis]) / d[axis];
    if (a > c) [a, c] = [c, a];
    lo = Math.max(lo, a);
    hi = Math.min(hi, c);
    if (lo > hi) return Infinity;
  }
  return lo;
}
// Spatial buckets keep large-island collision proportional to nearby cover.
const collisionIndex = new WeakMap();
export function invalidateCollision(map){collisionIndex.delete(map);}
export function candidates(map,o,d=null,max=0,radius=RADIUS){
 if(map.theme!=='royale')return map.boxes;
 let grid=collisionIndex.get(map);
 if(!grid){grid=new Map();for(const b of map.boxes){for(let x=Math.floor((b.x-b.w/2)/16);x<=Math.floor((b.x+b.w/2)/16);x++)for(let z=Math.floor((b.z-b.d/2)/16);z<=Math.floor((b.z+b.d/2)/16);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(b);}}collisionIndex.set(map,grid);}
 const found=new Set(),visited=new Set(),length=d?Math.min(Number.isFinite(max)?max:1600,1600):0,steps=Math.max(1,Math.ceil(length*Math.hypot(d?.x||0,d?.z||0)/16));
 // Query the swept segment's actual buckets, including the full player/bolt
 // radius. Nine whole neighboring buckets per point used to dominate bot cost.
 for(let i=0;i<steps;i++){
  const from=length*i/steps,to=length*(i+1)/steps,ax=o.x+(d?.x||0)*from,az=o.z+(d?.z||0)*from,bx=o.x+(d?.x||0)*to,bz=o.z+(d?.z||0)*to;
  for(let x=Math.floor((Math.min(ax,bx)-radius)/16);x<=Math.floor((Math.max(ax,bx)+radius)/16);x++)for(let z=Math.floor((Math.min(az,bz)-radius)/16);z<=Math.floor((Math.max(az,bz)+radius)/16);z++){
   const key=x+','+z;if(visited.has(key))continue;visited.add(key);for(const b of grid.get(key)||[])found.add(b);
  }
 }
 return found;
}
export function wallDistance(map, o, d, max = 200) {
  let t = max;
  for (const b of candidates(map,o,d,max)) t = Math.min(t, rayBox(o, d, b, t));
  const ground=terrainHit(map,o,d,t);if(ground)t=Math.min(t,ground.distance);
  return t;
}
// Fixed anatomical regions, independent of cosmetics and visual animation.
// Torso/limbs all deal body damage. Only the head region is critical.
export const HUMAN_HIT=[
 {region:'head',x:0,y:1.68,z:0,rx:.145,ry:.18,rz:.145},
 {region:'body',x:0,y:1.24,z:0,rx:.26,ry:.30,rz:.17},
 {region:'body',x:0,y:.92,z:0,rx:.20,ry:.19,rz:.17},
 ...[-1,1].flatMap(side=>[
  {region:'body',x:side*.31,y:1.29,z:-.03,rx:.095,ry:.19,rz:.13},
  {region:'body',x:side*.24,y:1.15,z:-.22,rx:.10,ry:.13,rz:.20},
  {region:'body',x:side*.12,y:.65,z:0,rx:.11,ry:.26,rz:.13},
  {region:'body',x:side*.12,y:.25,z:0,rx:.08,ry:.23,rz:.1}])
];
export const humanFlightPitch=p=>p.flight==='dive'?.78:p.flight==='glide'?.09+Math.max(-.06,Math.min(.11,(-(p.vx||0)*Math.sin(p.yaw||0)-(p.vz||0)*Math.cos(p.yaw||0))*.005)):0;
export function humanHit(o,d,p){
 const yaw=p.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),dx=o.x-p.x,dz=o.z-p.z;
 const origin={x:dx*c-dz*s,y:o.y-p.y,z:dx*s+dz*c},v={x:d.x*c-d.z*s,y:d.y,z:d.x*s+d.z*c};
 const lower=(.15+(p.sprinting?.03:0))*Math.min(1,Math.hypot(p.vx||0,p.vz||0)/2);
 const pitch=humanFlightPitch(p),cp=Math.cos(pitch),sp=Math.sin(pitch);for(const vector of [origin,v]){const y=vector.y,z=vector.z;vector.y=y*cp+z*sp;vector.z=-y*sp+z*cp;}
 let result={distance:Infinity,region:null};
 for(const h of HUMAN_HIT){
  const a=[(origin.x-h.x)/h.rx,(origin.y-h.y+(h.y>=.9?lower:h.y>=.5?lower*.5:0))/h.ry,(origin.z-h.z)/h.rz],b=[v.x/h.rx,v.y/h.ry,v.z/h.rz];
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
    p.y + HEIGHT > b.y + 0.02 &&
    Math.abs(p.x - b.x) < b.w / 2 + RADIUS &&
    Math.abs(p.z - b.z) < b.d / 2 + RADIUS
  );
}
export function canStand(map,p,margin=RADIUS) {
 if(Math.abs(p.x)>map.size-margin||Math.abs(p.z)>map.size-margin)return false;
 return ![...candidates(map,p,null,0,margin)].some(b=>p.y+.035<b.y+b.h&&p.y+HEIGHT>b.y+.02&&Math.abs(p.x-b.x)<b.w/2+margin&&Math.abs(p.z-b.z)<b.d/2+margin);
}
function pushAxis(p,map,axis,delta) {
 if(Math.abs(delta)<1e-10)return;
 const start=p[axis],base=p.y,other=axis==='x'?'z':'x',size=axis==='x'?'w':'d';
 let target=start+delta;
 const nearby=[...candidates(map,{...p,[axis]:target})];
 const hits=nearby.filter(b=>p.y<b.y+b.h-.015&&p.y+HEIGHT>b.y+.02&&Math.abs(p[other]-b[other])<(other==='x'?b.w:b.d)/2+RADIUS&&Math.abs(target-b[axis])<b[size]/2+RADIUS);
 // One stair rise per axis. Never stack multiple step corrections in one move.
 const top=Math.max(base,...hits.map(b=>b.y+b.h));
 if(hits.length&&p.grounded&&top-base>0&&top-base<=.43&&canStand(map,{...p,[axis]:target,y:top})) {
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
    if(p.grounded&&map.terrain&&Math.abs(p.y-groundAt(map,p.x,p.z))<.05){const gx=(groundAt(map,p.x+.3,p.z)-groundAt(map,p.x-.3,p.z))/.6,gz=(groundAt(map,p.x,p.z+.3)-groundAt(map,p.x,p.z-.3))/.6;normalY=1/Math.hypot(1,gx,gz);}
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
  if (p.flight === 'dive' || p.flight === 'glide' || p.flight === 'launch') {
    const toggle=input.jump&&!p.flightLatch;p.flightLatch=!!input.jump;
    const f=clamp(input.forward || 0,-1,1),s=clamp(input.strafe || 0,-1,1),length=Math.max(1,Math.hypot(f,s));
    const speed=p.flight==='glide'?24:p.flight==='launch'?26:17;
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
    }else{if(p.y-floor<=24)p.flight='glide';p.vy=p.flight==='glide'?-6:-25;}
    p.y+=p.vy*dt;p.grounded=false;
    if(p.y<=floor){p.y=floor;p.vy=0;p.grounded=true;p.flight='ground';p.jumpLatch=!!input.jump;}
    p.sprinting=false;if(p.inventory){p.sprintRest=(p.sprintRest||0)+dt;if(p.sprintRest>1.3)p.stamina=Math.min(100,(p.stamina??100)+18*dt);if(p.stamina>=20)p.exhausted=false;}return;
  }
  if (p.inventory) {
    p.stamina ??= 100; p.sprintRest ??= 0;
    if(p.stamina>=20)p.exhausted=false;
    p.sprinting=!!input.sprint && !p.exhausted && p.stamina>0 && !input.aim && !input.fire && !p.use && Math.hypot(input.forward||0,input.strafe||0)>.1 && p.grounded;
    if(p.sprinting){p.stamina=Math.max(0,p.stamina-22*dt);p.sprintRest=0;if(p.stamina===0)p.exhausted=true;}
    else {p.sprintRest+=dt;if(p.sprintRest>1.3)p.stamina=Math.min(100,p.stamina+18*dt);}
  }
  let f = clamp(input.forward || 0, -1, 1),
    s = clamp(input.strafe || 0, -1, 1),
    len = Math.hypot(f, s);
  if (len > 1) {
    f /= len;
    s /= len;
  }
  const speed =
    (p.inventory ? ROYALE_MOVEMENT[p.sprinting ? 'sprint' : 'walk'] : weapon(p.weapon).speed) *
    (input.aim ? 0.7 : 1) *
    (p.crown != null ? 0.88 : 1)*(p.quickstep?1.12:1);
  const dx = (-Math.sin(p.yaw) * f + Math.cos(p.yaw) * s) * speed * dt,
    dz = (-Math.cos(p.yaw) * f - Math.sin(p.yaw) * s) * speed * dt;
  if (input.jump && p.grounded && !p.jumpLatch) {
    p.vy = 8.6;
    p.grounded = false;
  }
  p.jumpLatch = !!input.jump;
  const wasGrounded=p.grounded&&p.vy<=0;
  const oldSurfaceY=p.y, followedGround=!!map.terrain&&wasGrounded&&Math.abs(p.y-groundAt(map,p.x,p.z))<.1;
  pushAxis(p, map, "x", dx);
  pushAxis(p, map, "z", dz);
  if(p.launchVelocity&&!p.grounded){pushAxis(p,map,'x',p.launchVelocity.x*dt);pushAxis(p,map,'z',p.launchVelocity.z*dt);p.launchVelocity.x*=Math.exp(-.4*dt);p.launchVelocity.z*=Math.exp(-.4*dt);}
  const ground=groundAt(map,p.x,p.z);
  if(followedGround&&Math.abs(p.y-oldSurfaceY)<.05&&Math.abs(ground-oldSurfaceY)<=.43)p.y=ground;
  // Follow short descents without falling and landing on every individual tread.
  if(wasGrounded){
    let support=ground;
    for(const b of candidates(map,p))if(b.y+b.h<=p.y+.001&&Math.abs(p.x-b.x)<b.w/2+RADIUS&&Math.abs(p.z-b.z)<b.d/2+RADIUS)support=Math.max(support,b.y+b.h);
    if(p.y-support<=.43&&canStand(map,{...p,y:support})){p.y=support;p.vy=0;}
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
    } else if (p.vy > 0 && oldY + HEIGHT <= b.y + 0.03 && p.y + HEIGHT >= b.y) {
      p.y = b.y - HEIGHT;
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
    sprint: !!i.sprint, interact: !!i.interact, drop: !!i.drop,
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
    y: p.y + EYE + up.y * height + f.y * forward,
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
