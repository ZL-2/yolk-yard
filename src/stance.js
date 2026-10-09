// Gameplay dimensions, independent of skins, attachments and animation meshes.
export const STANCE = Object.freeze({
  standing:{height:1.85,eye:1.70,speed:1},
  crouching:{height:1.25,eye:1.12,speed:.48},
  compact:{height:.96,eye:.82,speed:.36},
  sliding:{height:.96,eye:.82,speed:1},
  downed:{height:.8,eye:.60,speed:.22},
});
export const stanceOf=p=>p?.downed?'downed':p?.sliding?'sliding':p?.lowCrouch?'compact':p?.crouching?'crouching':'standing';
export const bodyHeight=p=>STANCE[stanceOf(p)].height;
export const eyeHeight=p=>STANCE[stanceOf(p)].eye;
export const canFight=p=>!!p&&p.health>0&&!p.downed&&!p.spectating&&!p.reviving;
export function resetStance(p){Object.assign(p,{stamina:100,sprintRest:0,sprintBlend:0,sprintRecovery:0,tacticalSprint:false,sprinting:false,exhausted:false,traversal:null,traversalLock:0,vaultProgress:0,crouching:false,lowCrouch:false,sliding:false,crouchLatch:false,slideVX:0,slideVZ:0,slideAge:0,slideCooldown:0,downed:false,lifeState:'ALIVE',downCount:0,reviving:null,reviverId:null,reviveProgress:0,knockedBy:null,knockSource:null,reviveBlockedUntil:0,lastInterruptDamage:undefined});}
// Standardized anatomical pose. Decorative clothing/hair/backpacks never enter this path.
export function regionPose(h,p){
 const mode=stanceOf(p),speed=Math.hypot(p.vx||0,p.vz||0);
 let x=h.x,y=h.y,z=h.z,rx=h.rx,ry=h.ry,rz=h.rz;
 if(mode==='downed'){
  if(h.region==='head'){y=.60;z=-.65;}
  else if(h.y>1.05){y=.41+(h.y-1.24)*.3;z=-.28-(h.y-1.24)*.6+(h.z||0)*.4;ry*=.62;rz*=1.3;}
  else if(h.y>.8){y=.40;z=.16;ry*=.65;}
  else{y=.19;z=h.y>.5?.35:.57;ry*=.52;rz*=1.5;}
 }else if(mode==='sliding'){
  if(h.y>=.9){y-=.90;z+=h.y>1.4?.19:0;}
  else{y=h.y>.5?.25:.16;z=h.y>.5?-.25:-.57;ry*=.6;rz*=1.4;}
 }else if(mode==='crouching'||mode==='compact'){
  if(h.y>=.9){y-=mode==='compact'?.88:.58;z-=h.y>1.3?.04:0;}
  else if(h.y>.5){y=.37;z=-.17;ry*=.7;}
  else{y=.21;z=.03;ry*=.8;}
 }else{const lower=(.09+(p.sprinting?.025:0))*Math.min(1,speed/2);y-=h.y>=.9?lower:h.y>=.5?lower*.5:0;}
 return {...h,x,y,z,rx,ry,rz};
}
