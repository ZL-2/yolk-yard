// Shared authoritative/predicted dash. Swept motion with fall protection until landing; no combat invulnerability.
export const SHADOWSTEP=Object.freeze({charges:6,recharge:10,cooldown:1,duration:.18,speed:50,targetBreak:.65});
export function shadowCharges(item,time){
 if(item?.id!=='shadowstep')return 0;
 item.charges??=SHADOWSTEP.charges;item.rechargeAt??=0;
 if(item.charges<SHADOWSTEP.charges&&item.rechargeAt>0&&time>=item.rechargeAt){const add=1+Math.floor((time-item.rechargeAt)/SHADOWSTEP.recharge);item.charges=Math.min(SHADOWSTEP.charges,item.charges+add);item.rechargeAt=item.charges===SHADOWSTEP.charges?0:item.rechargeAt+add*SHADOWSTEP.recharge;}
 return item.charges;
}
export function shadowRechargeState(item,time){const charges=item?.charges??SHADOWSTEP.charges,active=item?.id==='shadowstep'&&charges<SHADOWSTEP.charges&&item.rechargeAt>0,remaining=active?Math.max(0,Math.min(SHADOWSTEP.recharge,item.rechargeAt-time)):0;return {active,charges,remaining,progress:active?1-remaining/SHADOWSTEP.recharge:1};}
export function startShadowstep(p,item,time){
 if(!shadowCharges(item,time)||time<(item.readyAt||0)||p.health<=0||p.spectating||p.downed||p.flight!=='ground'||p.traversal||p.grapple)return false;
 const dir=p.shadowDirection||{x:-Math.sin(p.yaw),z:-Math.cos(p.yaw)},length=Math.hypot(dir.x,dir.z)||1;
 if(item.charges===SHADOWSTEP.charges)item.rechargeAt=time+SHADOWSTEP.recharge;
 item.charges--;item.readyAt=time+SHADOWSTEP.cooldown;
 p.shadowstep={x:dir.x/length,z:dir.z/length,remaining:SHADOWSTEP.duration};p.aimBreakUntil=time+SHADOWSTEP.targetBreak;
 p.fall={apex:p.y,immune:true,source:'shadowstep'};p.landing=null;p.sliding=false;p.sprinting=false;return true;
}
export function stepShadowstep(p,map,dt,canOccupy,groundAt,height,radius){
 const dash=p.shadowstep;if(!dash)return false;
 if(p.downed||p.health<=0||p.flight!=='ground'||p.traversal){p.shadowstep=null;return false;}
 p.fall={...(p.fall||{apex:p.y}),immune:true,source:'shadowstep'};
 const travel=Math.min(dt,dash.remaining)*SHADOWSTEP.speed,steps=Math.ceil(travel/.15);
 for(let i=0;i<steps;i++){
  const point={x:p.x+dash.x*travel/steps,y:p.y,z:p.z+dash.z*travel/steps},ground=groundAt(map,point.x,point.z);
  if(ground>point.y+.43||!canOccupy(map,point,height,radius)){dash.remaining=0;break;}
  p.x=point.x;p.z=point.z;
  if(p.grounded&&Math.abs(ground-p.y)<.035)p.y=ground;
 }
 dash.remaining=Math.max(0,dash.remaining-dt);if(!dash.remaining)p.shadowstep=null;
 return true;
}
