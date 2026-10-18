// Reference notes and the explicit differences are in docs/ZONE_WARS_REFERENCE.md.
export const ZONE_RULES=Object.freeze({prepare:8,between:5,queue:15,stormWait:12,roundLimit:210,siphon:50,wood:500,woodReward:50,woodCap:500,restart:8,buildLimit:560});
export const ZONE_PHASES=Object.freeze([
 {wait:12,duration:30,radius:62,move:13,dps:5},
 {wait:6,duration:30,radius:40,move:20,dps:5},
 {wait:5,duration:28,radius:24,move:23,dps:8},
 {wait:4,duration:25,radius:13,move:25,dps:10},
 {wait:0,duration:24,radius:7,move:26,dps:10},
 {wait:0,duration:22,radius:0,move:9,dps:15},
]);
export function zoneStormPath(random){let x=0,z=0,radius=94,time=0;return ZONE_PHASES.map((p,index)=>{const angle=random()*Math.PI*2,nextX=Math.max(-48,Math.min(48,x+Math.cos(angle)*p.move)),nextZ=Math.max(-48,Math.min(48,z+Math.sin(angle)*p.move));const phase={...p,index,x,z,startRadius:radius,nextX,nextZ,start:time};x=nextX;z=nextZ;radius=p.radius;time+=p.wait+p.duration;return phase;});}
export function zoneStormAt(path,age){const p=path.find(p=>age<p.start+p.wait+p.duration)||path.at(-1),local=Math.max(0,age-p.start),t=Math.max(0,Math.min(1,(local-p.wait)/p.duration)),closing=local>=p.wait;return {active:age>=ZONE_RULES.stormWait,index:p.index,x:p.x+(p.nextX-p.x)*t,z:p.z+(p.nextZ-p.z)*t,radius:p.startRadius+(p.radius-p.startRadius)*t,nextX:p.nextX,nextZ:p.nextZ,nextRadius:p.radius,seconds:Math.max(0,(closing?p.duration+p.wait:p.wait)-local),closing,dps:p.dps};}
const pick=(r,a)=>a[Math.min(a.length-1,Math.floor(r()*a.length))];
export function zoneLoadout(random){
 const rarity=()=>pick(random,[2,2,3,3,4]),weapon=id=>({id,weapon:true,count:1,rarity:rarity()});
 // Slot roles are guaranteed; randomizing each role cannot create an unusable kit.
 return [weapon(pick(random,['scatter','scatter','doubleyolk'])),weapon(pick(random,['sprinter','sprinter','duet'])),random()<.65?weapon(pick(random,['zipper','needle','anchor','peeper'])):{id:'impulse',count:2,rarity:3},pick(random,[{id:'mini',count:6,rarity:1},{id:'flask',count:3,rarity:2},{id:'splash',count:4,rarity:2}]),pick(random,[{id:'medkit',count:2,rarity:1},{id:'splash',count:4,rarity:2},{id:'impulse',count:2,rarity:3},{id:'launchpad',count:1,rarity:3}])].map(i=>({...i}));
}
export function constrainZoneMovement(p,map,prep=false){if(!map.zoneWars||p.spectating)return;const edge=map.size-.6;p.x=Math.max(-edge,Math.min(edge,p.x));p.z=Math.max(-edge,Math.min(edge,p.z));if(prep&&p.boxSpawn){const s=p.boxSpawn;p.x=Math.max(s.x-1.5,Math.min(s.x+1.5,p.x));p.z=Math.max(s.z-1.5,Math.min(s.z+1.5,p.z));p.y=s.y;p.vy=0;p.grounded=true;}if(p.y>72){p.y=72;p.vy=Math.min(0,p.vy);}}
