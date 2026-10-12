import {BOSSES} from './bosses.js';
import {launchPlayer} from './airborne.js';
// Season rules shared by host, dedicated authority, prediction and presentation.
export const SEASON=Object.freeze({number:1,name:'Operation Breakwater',boss:BOSSES[0],rig:{charges:4,recharge:15,cooldown:1,vertical:26,horizontal:30},flight:{glide:16,dive:13,launch:20,glideFall:4.8,diveFall:20},slide:{slope:.2,gravity:18,cap:10.5,startSpeed:5.5,stopSpeed:2.6}});
const PUBLIC_AVAILABILITY=Object.freeze({open:true,label:'Always open · 24/7',timezone:'America/New_York'});
export function publicWindow(){return PUBLIC_AVAILABILITY;}
export function rigCharges(item,time){if(!item||item.id!=='jumpRig')return 0;item.charges??=SEASON.rig.charges;item.rechargeAt??=0;if(item.charges<SEASON.rig.charges&&time>=item.rechargeAt){const added=1+Math.floor((time-item.rechargeAt)/SEASON.rig.recharge);item.charges=Math.min(SEASON.rig.charges,item.charges+added);item.rechargeAt=item.charges===SEASON.rig.charges?0:item.rechargeAt+added*SEASON.rig.recharge;}return item.charges;}

export function rigRechargeState(item,time){const charges=Math.max(0,Math.min(SEASON.rig.charges,item?.charges??SEASON.rig.charges)),active=item?.id==='jumpRig'&&charges<SEASON.rig.charges&&Number.isFinite(item.rechargeAt)&&item.rechargeAt>0,remaining=active?Math.max(0,Math.min(SEASON.rig.recharge,item.rechargeAt-time)):0;return {active,charges,remaining,progress:active?1-remaining/SEASON.rig.recharge:1};}
export function startJumpRig(p,item,time){
 if(!rigCharges(item,time)||time<(item.readyAt||0)||p.health<=0||p.spectating||p.downed||p.vehicleId||p.flight==='transport')return false;
 if(item.charges===SEASON.rig.charges)item.rechargeAt=time+SEASON.rig.recharge;
 item.charges--;item.readyAt=time+SEASON.rig.cooldown;
 const d=p.shadowDirection||{x:-Math.sin(p.yaw),z:-Math.cos(p.yaw)},length=Math.hypot(d.x,d.z)||1;
 p.grapple=null;p.traversal=null;p.mantle=null;p.use=null;p.reloadEnd=0;
 launchPlayer(p,{source:'shockwave',vy:SEASON.rig.vertical,vx:d.x/length*SEASON.rig.horizontal,vz:d.z/length*SEASON.rig.horizontal});return true;
}
