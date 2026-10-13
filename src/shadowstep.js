// Unlimited uses; a one-second cooldown bounds movement and target breaking.
export const SHADOWSTEP=Object.freeze({charges:Infinity,recharge:1,cooldown:1,duration:.22,speed:60,targetBreak:.85});
export function shadowCharges(item){return item?.id==='shadowstep'?Infinity:0;}
export function shadowRechargeState(item,time){const remaining=item?.id==='shadowstep'?Math.max(0,(item.readyAt||0)-time):0;return {active:remaining>0,charges:Infinity,remaining,progress:1-Math.min(1,remaining/SHADOWSTEP.cooldown)};}
export function startShadowstep(p,item,time){
 if(!shadowCharges(item)||time<(item.readyAt||0)||p.health<=0||p.spectating||p.downed||p.vehicleId||p.flight==='transport')return false;
 const dir=p.shadowDirection||{x:-Math.sin(p.yaw),z:-Math.cos(p.yaw)},length=Math.hypot(dir.x,dir.z)||1,pitch=p.pitch||0;
 delete item.charges;delete item.rechargeAt;item.readyAt=time+SHADOWSTEP.cooldown;
 p.shadowstep={x:dir.x/length*Math.cos(pitch),y:Math.sin(pitch),z:dir.z/length*Math.cos(pitch),remaining:SHADOWSTEP.duration};p.aimBreakUntil=time+SHADOWSTEP.targetBreak;
 p.flight='ground';p.grapple=null;p.traversal=null;p.mantle=null;p.use=null;p.reloadEnd=0;p.launchVelocity=null;
 p.fall={apex:p.y,immune:true,source:'shadowstep'};p.landing=null;p.sliding=false;p.sprinting=false;p.vy=0;return true;
}
export function stepShadowstep(p,map,dt,canOccupy,groundAt,height,radius){
 const dash=p.shadowstep;if(!dash)return false;
 if(!(dash.remaining>0)||!Number.isFinite(dash.x)||!Number.isFinite(dash.z)){p.shadowstep=null;return false;}
 if(p.downed||p.health<=0||p.flight!=='ground'||p.traversal){p.shadowstep=null;return false;}
 p.fall={...(p.fall||{apex:p.y}),apex:Math.max(p.fall?.apex||p.y,p.y),immune:true,source:'shadowstep'};
 const travel=Math.min(dt,dash.remaining)*SHADOWSTEP.speed,steps=Math.max(1,Math.ceil(travel/.15));
 for(let i=0;i<steps;i++){
  const point={x:p.x+dash.x*travel/steps,y:p.y+(dash.y||0)*travel/steps,z:p.z+dash.z*travel/steps},ground=groundAt(map,point.x,point.z);
  if(point.y<ground)point.y=ground;
  if(ground>p.y+.43&&!(dash.y>0)||Math.abs(point.x)>map.size-.5||Math.abs(point.z)>map.size-.5||!canOccupy(map,point,height,radius)){dash.remaining=0;break;}
  p.x=point.x;p.y=point.y;p.z=point.z;p.grounded=Math.abs(point.y-ground)<.035;
 }
 p.vy=0;dash.remaining=Math.max(0,dash.remaining-dt);if(!dash.remaining)p.shadowstep=null;
 return true;
}
