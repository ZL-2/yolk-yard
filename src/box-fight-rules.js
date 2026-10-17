// Original Ravel Front rules, informed by docs/BOX_FIGHTS_REFERENCE.md.
export const BOX_RULES=Object.freeze({prepare:7,between:3,queue:15,stormWait:45,stormClose:40,roundLimit:100,siphon:50,wood:500,woodReward:100,woodCap:500,restart:8,buildLimit:240});
export const BOX_ARENAS=[
 {id:'box-foundry',name:'The Foundry',width:20,depth:28,color:0x50cddd,accent:0xffb568,subtitle:'Precision in close quarters'},
 {id:'box-relay',name:'Relay Chamber',width:28,depth:28,color:0xa599ff,accent:0x73eac3,subtitle:'Own the angles'},
 {id:'box-drydock',name:'Drydock',width:28,depth:36,color:0x6cb9ef,accent:0xf4c26d,subtitle:'Room to build. Nowhere to hide'},
];
export const BOX_LOADOUTS={classic:{name:'Classic',rifle:'sprinter',shotgun:'scatter'},pressure:{name:'Pressure',rifle:'zipper',shotgun:'doubleyolk'}};
export const boxFormat=o=>o.boxFormat==='ffa'?'Free For All':`${o.teamSize}v${o.teamSize}`;
export const boxTeam=(o,p)=>o.boxFormat==='ffa'?p.id:p.team;
export function boxSpawn(map,index,total,team,slot,round,ffa=false){
 const w=map.boxArena.width/2,d=map.boxArena.depth/2;
 if(ffa){const spots=[[-w+2,-d+2],[w-2,d-2],[w-2,-d+2],[-w+2,d-2],[-w+2,-2],[w-2,2],[-2,-d+2],[2,d-2]],p=spots[(index+round-1)%spots.length];return {x:p[0],z:p[1],y:0,yaw:Math.atan2(p[0],p[1])};}
 const side=(team+(round-1)%2)%2,spacing=4,x=(slot-(total-1)/2)*spacing,z=(side?1:-1)*(d-2);
 return {x,z,y:0,yaw:side?0:Math.PI};
}
// Host and guest use the same prep limits, including FFA's individual cells.
export function constrainBoxMovement(p,map,prep=false){
 if(!map.boxArena||p.spectating)return;
 const a=map.boxArena,margin=.42;
 p.x=Math.max(-a.width/2+margin,Math.min(a.width/2-margin,p.x));p.z=Math.max(-a.depth/2+margin,Math.min(a.depth/2-margin,p.z));
 if(prep&&p.boxSpawn){const s=p.boxSpawn;if(p.boxFFA){p.x=Math.max(s.x-1.55,Math.min(s.x+1.55,p.x));p.z=Math.max(s.z-1.55,Math.min(s.z+1.55,p.z));}else if(s.z<0)p.z=Math.min(-2.45,p.z);else p.z=Math.max(2.45,p.z);}
 if(p.y>6.1){p.y=6.1;p.vy=Math.min(0,p.vy);}
}
