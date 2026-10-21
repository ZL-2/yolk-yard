// Rendered from the actual mission scene. No prerecorded footage or remote assets.
export const INTRO_DURATION=36;
export const INTRO_SHOTS=Object.freeze([
 {start:0,end:8,from:[-106,31,77],to:[-79,35,8],lookFrom:[0,23,-29],lookTo:[-12,28,-40],fov:56,speaker:'CONTROL',text:'Station Seven. One uplink. Thousands of people who never agreed to be targets.',title:'THE NORTHERN COAST',sub:'02:17 LOCAL / STATION SEVEN'},
 {start:8,end:16,from:[44,6.2,99],to:[42,6.5,58],lookFrom:[40,8,45],lookTo:[30,18,-12],fov:67,speaker:'CONTROL',text:'The occupying force is broadcasting the evacuation manifest. Cut the perimeter feed, then get inside operations.',title:'OPERATION BLACKGLASS',sub:'WARDEN / SOLO INFILTRATION'},
 {start:16,end:24,from:[-59,42,-8],to:[-48,47,-59],lookFrom:[-22,34,-42],lookTo:[-22,36,-42],fov:60,speaker:'WARDEN',text:'I see the dish. Command gallery first. Archive below it. Then we sever the signal.',title:'NO SIGNAL. NO TARGETS.',sub:'RECOVER / DISABLE / EXTRACT'},
 {start:24,end:30,from:[30,14.2,3],to:[30,14.3,-5],lookFrom:[26,14,-12],lookTo:[22,16,-14],fov:64,speaker:'CONTROL',text:'Their patrols will search your last position. Move quietly, use the side routes, and keep changing cover.',title:'STATION SEVEN',sub:'OPERATIONS / INTERIOR'},
 {start:30,end:36,from:[42,6.3,102],to:[42,5.64,96],lookFrom:[40,8,48],lookTo:[42,5.64,70],fov:73,speaker:'WARDEN',text:'On the coast. Beginning the approach.',title:'WARDEN',sub:'TAKE CONTROL'},
]);
export function cinematicFrame(time){
 const t=Math.max(0,Math.min(time,INTRO_DURATION)),index=INTRO_SHOTS.findIndex(s=>t<s.end),shot=INTRO_SHOTS[index<0?INTRO_SHOTS.length-1:index],u=Math.min(1,(t-shot.start)/(shot.end-shot.start)),smooth=u*u*(3-2*u),mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*smooth);
 return {...shot,index:index<0?INTRO_SHOTS.length-1:index,position:mix(shot.from,shot.to),look:mix(shot.lookFrom,shot.lookTo),fade:Math.max(0,1-(t-shot.start)/.6,1-(shot.end-t)/.6),done:t>=INTRO_DURATION};
}
