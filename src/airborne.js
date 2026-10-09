// Host and prediction share motion state; only the host applies landing damage.
// Classic BR reference: damage begins above 3 build stories, lethal at 6.
// Epic does not publish the intermediate curve. This quadratic is Ravelfront's tuning.
export const FALL_RULES=Object.freeze({story:4,safe:12,lethal:24,firstDamage:10});
export const LAUNCH_RULES=Object.freeze({
 normal:{immune:false,redeploy:false,forceGlider:false},
 impulse:{immune:true,redeploy:false,forceGlider:false},
 shockwave:{immune:true,redeploy:false,forceGlider:false},
 launchpad:{immune:true,redeploy:true,forceGlider:true},
 bus:{immune:true,redeploy:true,forceGlider:false},
});
export function resetAirborne(p){p.fall=null;p.landing=null;p.launchVelocity=null;p.redeploy=false;p.forceGlider=false;p.grapple=null;}
export function launchPlayer(p,{source='normal',vy=0,vx=0,vz=0,...overrides}={}){
 const rule={...(LAUNCH_RULES[source]||LAUNCH_RULES.normal),...overrides};
 p.fall={apex:p.y,immune:!!rule.immune,source};p.landing=null;p.grounded=false;p.vy=vy;
 p.launchVelocity={x:vx,z:vz};p.redeploy=!!rule.redeploy;p.forceGlider=!!rule.forceGlider;
 p.flight=source==='bus'?'dive':rule.forceGlider?'launch':'ground';p.flightLatch=true;
}
export function beginFallStep(p){
 if(!p.grounded&&!p.fall)p.fall={apex:p.y,immune:false,source:'normal'};
 if(p.fall)p.fall.apex=Math.max(p.fall.apex,p.y);
 return {y:p.y,grounded:p.grounded};
}
export function finishFallStep(p,before,normalY=1){
 if(!p.grounded){p.fall??={apex:before.y,immune:false,source:'normal'};p.fall.apex=Math.max(p.fall.apex,p.y);return;}
 if(p.fall){const distance=Math.max(0,p.fall.apex-p.y);p.landing={distance,immune:p.fall.immune,normalY,source:p.fall.source};}
 p.fall=null;p.launchVelocity=null;p.redeploy=false;p.forceGlider=false;
}
export function fallDamage(landing){
 if(!landing||landing.immune||landing.distance<=FALL_RULES.safe+.01)return 0;
 const progress=(landing.distance-FALL_RULES.safe)/(FALL_RULES.lethal-FALL_RULES.safe);
 return Math.round((FALL_RULES.firstDamage+90*progress*progress)*Math.max(0,Math.min(1,landing.normalY??1))**2);
}
