import {AMMO_RULES,RARITY_SCALE,UTILITY_WEAPONS,ammoTypeFor} from './weapon-balance.js';
import {weapon,clamp} from './data.js';
export const RARITIES=[
 {name:'Common',color:'#b8c5cb',}, {name:'Uncommon',color:'#71d996',},
 {name:'Rare',color:'#60b6ff',},{name:'Epic',color:'#c58bff',},{name:'Legendary',color:'#ffcc67',},
].map((r,i)=>({...r,mult:RARITY_SCALE[i].damage}));
RARITIES.push({name:'Mythic',color:'#ffd46b',mult:1});
export const AMMO_CAPS=Object.fromEntries(Object.entries(AMMO_RULES).map(([id,r])=>[id,r.cap]));
export const ammoType=ammoTypeFor;
export const ROYALE_GUN_IDS=['sprinter','scatter','needle','zipper','thumper','anchor','duet','pip','peeper','doubleyolk','comet'];
export const ITEMS={
 asterKeycard:{name:'Voss Vault Keycard',kind:'keycard',duration:0,stack:1,color:'#80d9ed',icon:'▣'},
 jumpRig:{name:'Kestrel Jump Rig',kind:'jumpRig',duration:.16,stack:1,color:'#ffd46b',icon:'↟'},
 smoke:{name:'Smoke Canister',kind:'smoke',duration:.4,stack:3,color:'#c5d0cc',icon:'◌'},
 scanner:{name:'Recon Pulse',kind:'scanner',duration:1.2,stack:2,color:'#5cd9d0',icon:'◎'},
 bandage:{name:'Field Dressing',kind:'heal',amount:25,cap:75,duration:2.5,stack:5,color:'#f4f4dd',icon:'✚'},
 medkit:{name:'Trauma Kit',kind:'heal',amount:100,cap:100,duration:6,stack:2,color:'#8be4b7',icon:'✚'},
 mini:{name:'Mini Shield',kind:'shield',amount:25,cap:50,duration:2,stack:6,color:'#65bdfa',icon:'◈'},
 flask:{name:'Shield Flask',kind:'shield',amount:50,cap:100,duration:4,stack:3,color:'#81a5ff',icon:'◈'},
 splash:{name:'Restoration Capsule',kind:'splash',amount:30,duration:.55,stack:4,color:'#74ebd9',icon:'✦'},
 popper:{name:'Frag Grenade',kind:'popper',duration:UTILITY_WEAPONS.popper.useTime,stack:6,color:'#c091ef',icon:'●'},
 impulse:{name:'Impulse Charge',kind:'impulse',duration:.35,stack:3,color:'#ec9fff',icon:'◎'},
 launchpad:{name:'Launch Pad',kind:'launchpad',duration:.6,stack:2,color:'#f9ca65',icon:'↟'},
};
export const itemInfo=item=>!item?{name:'Empty slot',color:'#7c8a98',icon:''}:item.pickaxe?{name:'Pickaxe',color:'#7aaddb',icon:''}:item.weapon?{...weapon(item.id),color:(RARITIES[item.rarity||0]||{color:'#ffd46b'}).color,icon:'',name:weapon(item.id).name}:ITEMS[item.id]||{name:item.id,color:'#d6caa5',icon:'▥'};
// 32 contestants / 512 m island. Opening loot time grows; later stages tighten.
export const STORM_STEPS=[
 {radius:225,wait:115,close:65,dps:1},{radius:160,wait:35,close:50,dps:2},
 {radius:108,wait:25,close:40,dps:3},{radius:68,wait:20,close:30,dps:5},
 {radius:40,wait:15,close:25,dps:7},{radius:20,wait:12,close:20,dps:9},
 {radius:7,wait:8,close:18,dps:12},{radius:0,wait:5,close:18,dps:20},
];
export function makeStorm(random,speed='normal'){
 let x=0,z=0,radius=365,at=35;
 return STORM_STEPS.map((s,i)=>{
  const angle=random()*Math.PI*2,offset=(radius-s.radius)*Math.sqrt(random())*.6;
  const toX=clamp(x+Math.cos(angle)*offset,-195+s.radius/3,195-s.radius/3);
  const toZ=clamp(z+Math.sin(angle)*offset,-195+s.radius/3,195-s.radius/3);
  const scale=speed==='quick'?.55:1;
  const phase={index:i,fromX:x,fromZ:z,fromRadius:radius,x:toX,z:toZ,radius:s.radius,start:at,closeAt:at+s.wait*scale,end:at+(s.wait+s.close)*scale,dps:s.dps};
  x=toX;z=toZ;radius=s.radius;at=phase.end;return phase;
 });
}
export function stormAt(steps,elapsed){
 const s=steps.find(p=>elapsed<p.end)||steps.at(-1),t=clamp((elapsed-s.closeAt)/(s.end-s.closeAt),0,1);
 return {...s,x:s.fromX+(s.x-s.fromX)*t,z:s.fromZ+(s.z-s.fromZ)*t,radius:s.fromRadius+(s.radius-s.fromRadius)*t,nextX:s.x,nextZ:s.z,nextRadius:s.radius,closing:elapsed>=s.closeAt,seconds:Math.max(0,(elapsed<s.closeAt?s.closeAt:s.end)-elapsed),active:elapsed>=35};
}
export function makeFlight(random){const angle=random()*Math.PI*2;return {fromX:Math.cos(angle)*238,fromZ:Math.sin(angle)*238,toX:-Math.cos(angle)*238,toZ:-Math.sin(angle)*238,y:105,duration:35};}
export function transportAt(route,elapsed){const t=clamp(elapsed/route.duration,0,1);return {x:route.fromX+(route.toX-route.fromX)*t,y:route.y,z:route.fromZ+(route.toZ-route.fromZ)*t,yaw:Math.atan2(route.fromX-route.toX,route.fromZ-route.toZ)};}
export const queueCandidates=rooms=>rooms.filter(r=>r.mode==='royale'&&r.phase==='lobby'&&r.players<r.capacity).sort((a,b)=>b.players-a.players||a.code.localeCompare(b.code));
export const randomRarity=(r,bonus=0)=>clamp((r<.45?0:r<.73?1:r<.90?2:r<.98?3:4)+bonus,0,4);
