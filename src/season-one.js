import {BOSSES} from './bosses.js';
// Season rules shared by host, dedicated authority, prediction and presentation.
export const SEASON=Object.freeze({number:1,name:'Operation Breakwater',boss:BOSSES[0],rig:{charges:3,recharge:12,cooldown:1.2,vertical:19,horizontal:18},flight:{glide:16,dive:13,launch:20,glideFall:4.8,diveFall:20},slide:{slope:.2,gravity:18,cap:10.5}});
const PUBLIC_AVAILABILITY=Object.freeze({open:true,label:'Always open · 24/7',timezone:'America/New_York'});
export function publicWindow(){return PUBLIC_AVAILABILITY;}
export function rigCharges(item,time){if(!item||item.id!=='jumpRig')return 0;item.charges??=SEASON.rig.charges;item.rechargeAt??=0;if(item.charges<SEASON.rig.charges&&time>=item.rechargeAt){const added=1+Math.floor((time-item.rechargeAt)/SEASON.rig.recharge);item.charges=Math.min(SEASON.rig.charges,item.charges+added);item.rechargeAt=item.charges===SEASON.rig.charges?0:item.rechargeAt+added*SEASON.rig.recharge;}return item.charges;}

export function rigRechargeState(item,time){const charges=Math.max(0,Math.min(SEASON.rig.charges,item?.charges??SEASON.rig.charges)),active=item?.id==='jumpRig'&&charges<SEASON.rig.charges&&Number.isFinite(item.rechargeAt)&&item.rechargeAt>0,remaining=active?Math.max(0,Math.min(SEASON.rig.recharge,item.rechargeAt-time)):0;return {active,charges,remaining,progress:active?1-remaining/SEASON.rig.recharge:1};}
