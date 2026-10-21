import {blockedRay,clamp,distance} from './campaign-mission.js';
const point=e=>({x:e.x,y:e.y||0,z:e.z});
const eye=(e,crouched=false)=>({x:e.x,y:(e.y||0)+(crouched?1.03:1.62),z:e.z});
const age=(e,time)=>e.lastKnown?time-e.lastKnown.time:Infinity;
export class CampaignAI{
 constructor(world,{random=Math.random}={}){this.world=world;this.random=random;this.events=[];this.claims=new Map();this.clock=0;this.nextBark=0;this.pathBudget=0;this.stats={perception:0,paths:0,flanks:0,searches:0,shots:0};}
 reset(enemies){this.events=[];this.claims.clear();this.clock=0;this.nextBark=0;for(const e of enemies)Object.assign(e,{state:'patrol',lastKnown:null,sees:false,alert:0,aware:false,decision:0,nextFire:0,ammo:18,reloadEnd:0,suppression:0,cover:null,goal:null,path:[],pathAt:0,pathEnd:0,reportAt:0,grenadeAt:10,peekAt:0,crouched:false,seenFor:0,stationary:0,searchIndex:0,heardAt:-Infinity});}
 noise(position,radius,time,kind='shot'){this.events.push({...point(position),radius,time,kind});if(this.events.length>24)this.events.shift();}
 remember(e,position,time,certainty='seen'){e.lastKnown={...point(position),time,certainty};e.aware=true;e.alert=1;e.nextFire=Math.max(e.nextFire,time+.45);}
 hit(e,source,time){this.remember(e,source,time,'hit');e.suppression=Math.max(e.suppression,.7);e.decision=0;}
 suppress(origin,end,enemies,time){const dx=end.x-origin.x,dz=end.z-origin.z,len2=dx*dx+dz*dz;for(const e of enemies){if(e.health<=0||!e.mesh?.visible)continue;const t=clamp(((e.x-origin.x)*dx+(e.z-origin.z)*dz)/Math.max(.001,len2),0,1),d=Math.hypot(e.x-origin.x-t*dx,e.z-origin.z-t*dz);if(d<2.1&&Math.abs((e.y+1.2)-(origin.y+(end.y-origin.y)*t))<2){e.suppression=clamp(e.suppression+.48,0,1);if(!e.lastKnown)this.remember(e,origin,time,'shot');e.decision=0;}}}
 sight(e,p,options){
  const d=distance(e,p),forward=(-Math.sin(e.yaw)*(p.x-e.x)-Math.cos(e.yaw)*(p.z-e.z))/Math.max(.01,d);
  const range=options.flashlight?55:options.powerOff?37:48;
  return d<range&&(forward>(e.aware?-.35:.35)||d<3)&&!blockedRay(eye(e,e.crouched),eye(p,p.crouch),this.world.boxes);
 }
 bark(text,time,callback){if(time<this.nextBark)return;this.nextBark=time+5+this.random()*3;callback?.(text);}
 chooseCover(e,target,time,retreat=false){
  let best=null,score=-Infinity;for(const c of this.world.covers){if(Math.abs(c.y-e.y)>1.2||distance(e,c)>22||this.claims.has(c.id)&&this.claims.get(c.id)!==e.id)continue;
   if(!blockedRay(eye(c,true),eye(target),this.world.boxes))continue;
   const d=distance(c,target);if(d<5)continue;const clear= !blockedRay(eye(c),eye(target),this.world.boxes);
   const value=(clear?7:0)+(retreat?Math.min(25,d)*.65:-Math.abs(d-(e.role==='support'?22:13))*.3)-distance(e,c)*.5;
   if(value>score){score=value;best=c;}}
  if(e.cover)this.claims.delete(e.cover.id);e.cover=best;if(best)this.claims.set(best.id,e.id);return best;
 }
 decide(e,p,time,opts){
  const known=e.lastKnown,contactAge=age(e,time),danger=(opts.grenades||[]).find(g=>g.life>0&&g.life<3.2&&Math.abs(g.mesh.position.y-e.y)<4&&distance(g.mesh.position,e)<7);
  e.crouched=false;
  if(danger){const dx=e.x-danger.mesh.position.x,dz=e.z-danger.mesh.position.z,n=Math.hypot(dx,dz)||1;e.goal={x:e.x+dx/n*9,y:e.y,z:e.z+dz/n*9};e.state='evade';this.bark('Grenade! Move!',time,opts.onBark);return;}
  if(e.reloadEnd>time||e.health<35||e.suppression>.55){e.goal=this.chooseCover(e,known||e,time,true)||e.goal;e.state=e.reloadEnd>time?'reload':'cover';e.crouched=!!e.cover&&distance(e,e.cover)<1.3;return;}
  if(!known||contactAge>19){e.aware=false;e.alert=Math.max(0,e.alert-.14);e.state='patrol';e.goal=e.turn?{x:e.startX,y:e.startY,z:e.startZ}:{x:e.patrol[0],y:e.startY,z:e.patrol[1]};if(distance(e,e.goal)<1)e.turn=1-e.turn;if(e.cover){this.claims.delete(e.cover.id);e.cover=null;}return;}
  if(!e.sees&&contactAge>2.4){
   e.state='search';if(!e.goal||distance(e,e.goal)<1.5||e.searchUntil<time){e.searchIndex++;const a=e.searchIndex*2.4+e.index;e.goal={x:known.x+Math.cos(a)*(contactAge>6?7:2),y:known.y,z:known.z+Math.sin(a)*(contactAge>6?7:2)};e.searchUntil=time+4;this.stats.searches++;}return;
  }
  const allies=opts.enemies.filter(a=>a.health>0&&a.group===e.group&&a.id!==e.id&&a.aware);
  const push=opts.reloading&&e.sees&&distance(e,p)<18;
  if((e.role==='flanker'&&allies.some(a=>a.state==='engage'||a.state==='cover')||push)&&e.suppression<.25){
   const dx=e.x-known.x,dz=e.z-known.z,len=Math.hypot(dx,dz)||1,side=e.index%2?1:-1;
   if(e.state!=='flank'||!e.goal||distance(e,e.goal)<2){e.goal={x:known.x+dx/len*9-dz/len*10*side,y:known.y,z:known.z+dz/len*9+dx/len*10*side};this.stats.flanks++;this.bark(push?'He is reloading. Move up!':'Cover me. Taking the side route.',time,opts.onBark);}e.state='flank';return;
  }
  if(!e.cover||!blockedRay(eye(e.cover,true),eye(known),this.world.boxes))this.chooseCover(e,known,time);
  if(e.cover&&distance(e,e.cover)>1){e.goal=e.cover;e.state='cover';return;}
  e.state='engage';e.goal=null;
  if(e.cover){e.crouched=(time+e.index*.8)%3.7<1.3;if(!e.crouched&&!e.sees){const c=e.cover,dx=c.x-c.box.x,dz=c.z-c.box.z;const target={x:c.x+(Math.abs(dx)>Math.abs(dz)?0:(e.index%2?1.6:-1.6)),y:c.y,z:c.z+(Math.abs(dx)>Math.abs(dz)?(e.index%2?1.6:-1.6):0)};e.goal=target;}}
  if(!e.cover&&!e.sees)e.goal=point(known);
  if(e.stationary>7&&time>e.grenadeAt&&e.sees&&distance(e,p)>9&&distance(e,p)<27&&!opts.enemies.some(a=>a!==e&&a.health>0&&distance(a,known)<6)){
   e.grenadeAt=time+24;e.stationary=0;opts.onGrenade?.(e,point(known));this.bark('Frag out!',time,opts.onBark);
  }
 }
 update(dt,time,p,enemies,opts={}){
  this.clock-=dt;const sense=this.clock<=0;if(sense){this.clock=.14;this.pathBudget=3;}
  const visible=enemies.filter(e=>e.health>0&&e.mesh.visible);opts={...opts,enemies:visible};let attackers=0,threats=0;
  this.events=this.events.filter(n=>time-n.time<1.2);
  for(const e of visible){
   e.suppression=Math.max(0,e.suppression-dt*.24);e.crouched=!!e.crouched;
   if(sense){
    this.stats.perception++;const sees=this.sight(e,p,opts);e.sees=sees;e.seenFor=sees?e.seenFor+.14:0;
    if(sees){const gain=p.crouch&&!opts.flashlight ? .065 : .16;e.alert=clamp(e.alert+gain*(distance(e,p)<12?2:1),0,1);if(e.alert>=1){if(!e.aware){e.nextFire=time+.8;this.bark('Contact! At the access route!',time,opts.onBark);}const previous=e.lastKnown;if(previous&&distance(previous,p)<1)e.stationary+=.14;else e.stationary=0;e.lastKnown={...point(p),time,certainty:'seen'};e.aware=true;}}
    else if(!e.aware)e.alert=Math.max(0,e.alert-.035);
    for(const noise of this.events){if(noise.time<=e.heardAt)continue;const wall=blockedRay(eye(e),{x:noise.x,y:noise.y+1,z:noise.z},this.world.boxes);if(distance(e,noise)<noise.radius*(wall?.45:1)){e.heardAt=noise.time;this.remember(e,noise,noise.time,'heard');e.goal=point(noise);e.decision=0;}}
    if(e.aware&&e.sees&&time>=e.reportAt){e.reportAt=time+1.3;for(const ally of visible){if(ally===e||ally.group!==e.group||distance(ally,e)>38)continue;if(age(ally,time)>.8){ally.lastKnown={...e.lastKnown,certainty:'radio'};ally.aware=true;ally.alert=1;ally.nextFire=Math.max(ally.nextFire,time+.7);}}}
   }
   if(e.aware)threats++;
   if(e.ammo<=0&&!e.reloadEnd){e.reloadEnd=time+2.5;e.decision=0;this.bark('Reloading. Cover!',time,opts.onBark);}
   if(e.reloadEnd&&time>=e.reloadEnd){e.reloadEnd=0;e.ammo=18;}
   if(sense&&time>=e.decision){e.decision=time+.55+e.index%4*.07;this.decide(e,p,time,opts);}
   let speed=0;
   if(e.goal){
    if(time>e.pathEnd&&this.pathBudget>0){this.pathBudget--;this.stats.paths++;e.path=this.world.navigation.path(e,e.goal);e.pathAt=0;e.pathEnd=time+1.1+e.index%4*.13;}
    while(e.pathAt<e.path.length&&distance(e,e.path[e.pathAt])<.14)e.pathAt++;
    const target=e.path[e.pathAt];if(target){const dx=target.x-e.x,dz=target.z-e.z,len=Math.hypot(dx,dz);if(len>.08){speed=e.state==='evade'?4.5:e.state==='flank'?3.15:e.aware?2.4:1.1;const before=point(e);this.world.move(e,dx/len*speed*dt,dz/len*speed*dt,.29,1.72);speed=distance(e,before)/Math.max(dt,.001);if(speed<.08)e.pathEnd=0;e.travel+=speed*dt;}}
   }
   const aim=e.sees&&e.aware?point(p):e.goal||e.lastKnown;if(aim){const angle=Math.atan2(-(aim.x-e.x),-(aim.z-e.z)),delta=Math.atan2(Math.sin(angle-e.yaw),Math.cos(angle-e.yaw));e.yaw+=delta*Math.min(1,dt*7);}
   if(e.aware&&e.sees&&!e.crouched&&e.suppression<.7&&!e.reloadEnd&&e.state!=='evade'&&time>=e.nextFire&&e.seenFor>.3&&attackers<(opts.difficulty==='story'?2:3)){
    // Recheck actual line of fire at shot time, including friendly bodies and low cover.
    const muzzle=eye(e),target=eye(p,p.crouch),dx=target.x-e.x,dz=target.z-e.z,len=Math.hypot(dx,dz);
    const friendly=visible.some(a=>{if(a===e||Math.abs(a.y-e.y)>2)return false;const t=((a.x-e.x)*dx+(a.z-e.z)*dz)/Math.max(1,len*len);return t>.03&&t<.97&&Math.hypot(a.x-e.x-dx*t,a.z-e.z-dz*t)<.65;});
    if(!friendly&&!blockedRay(muzzle,target,this.world.boxes)){attackers++;e.ammo--;e.burst=(e.burst||0)+1;e.nextFire=time+(e.burst%3===0?1.25+this.random()*.55:.22);const accuracy=clamp(.62-distance(e,p)*.006-(opts.moving>.3?.2:0)-(p.crouch?.08:0)-e.suppression*.5+Math.min(.1,e.seenFor*.02),.12,.72);opts.onFire?.(e,accuracy);this.stats.shots++;}
   }
   e.speed=speed;
  }return threats;
 }
}
