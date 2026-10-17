// The collision, navigation, interactables and art share these authored coordinates.
export const Z_ZONES=[
 {id:0,name:'Arrival Yard',x:-29,z:22,w:30,d:44,color:0x526267},
 {id:1,name:'Pump Hall',x:0,z:22,w:28,d:44,color:0x58605c},
 {id:2,name:'Freight Arcade',x:29,z:22,w:30,d:44,color:0x665d53},
 {id:3,name:'Reactor Court',x:0,z:-22,w:28,d:44,color:0x3f5861},
 {id:4,name:'Signal Gallery',x:-29,z:-22,w:30,d:44,color:0x555e68},
 {id:5,name:'Beacon Platform',x:29,z:-22,w:30,d:44,color:0x42595e},
];
export const Z_DOORS=[
 {id:'pump',name:'Pump Hall',a:0,b:1,x:-14,z:26,w:1,d:6,cost:750},
 {id:'gallery',name:'Signal Gallery',a:0,b:4,x:-29,z:0,w:6,d:1,cost:1000},
 {id:'freight',name:'Freight Arcade',a:1,b:2,x:14,z:26,w:1,d:6,cost:1100},
 {id:'reactor',name:'Reactor Court',a:1,b:3,x:0,z:0,w:6,d:1,cost:1500},
 {id:'service',name:'Reactor shortcut',a:4,b:3,x:-14,z:-24,w:1,d:6,cost:1000},
 {id:'beacon',name:'Beacon Platform',a:3,b:5,x:14,z:-24,w:1,d:6,cost:1700},
 {id:'dock',name:'Freight shortcut',a:2,b:5,x:30,z:0,w:6,d:1,cost:900},
];
const at=(id,kind,name,x,z,zone,extra={})=>({id,kind,name,x,y:0,z,zone,...extra});
export const Z_STATIONS=[
 at('wall-smg','wall','VX-7 SMG',-40,30,0,{weapon:'zipper',cost:850}),
 at('wall-rifle','wall','R-41 Service Rifle',8,34,1,{weapon:'sprinter',cost:1400}),
 at('wall-shotgun','wall','M12 Combat Shotgun',39,16,2,{weapon:'scatter',cost:1500}),
 at('wall-dmr','wall','DMR-18 Sentinel',-38,-12,4,{weapon:'anchor',cost:1800}),
 at('wall-pulse','wall','ARC-5 Pulse Rifle',37,-30,5,{weapon:'comet',cost:2400}),
 at('perk-vigor','perk','Iron Pulse',-40,12,0,{perk:'vigor'}),
 at('perk-quickhands','perk','Quickwire',-8,38,1,{perk:'quickhands'}),
 at('perk-stride','perk','Longstride',-39,-35,4,{perk:'stride',y:2.4}),
 at('perk-lifeline','perk','Lifeline',38,38,2,{perk:'lifeline'}),
 at('perk-deadeye','perk','Glass Eye',-8,-36,3,{perk:'deadeye'}),
 at('perk-recovery','perk','Second Wind',38,-38,5,{perk:'recovery'}),
 at('power','power','Restore the lattice',0,-35,3),
 at('forge','forge','Resonance Forge',8,-19,3),
 at('workbench','craft','Fabricator',3,38,1),
 at('arsenal','arsenal','Calibration Bench',-8,-15,3),
 at('ammo','ammo','Ammunition locker',-21,12,0),
 at('exfil','exfil','Extraction beacon',32,-10,5),
 at('trap-pump','trap','Floodgate discharge',6,14,1,{cost:700,radius:8}),
 at('trap-reactor','trap','Induction grid',0,-11,3,{cost:1000,radius:9}),
 at('core-1','core','Survey core',-36,-29,4,{index:0,y:2.4}),
 at('core-2','core','Evacuation core',34,8,2,{index:1}),
 at('core-3','core','Tidal core',38,-19,5,{index:2}),
 at('console','console','Lattice sequence',0,-29,3),
 at('conduit-0','conduit','West conduit',-29,-12,4,{index:0}),
 at('conduit-1','conduit','East conduit',28,31,2,{index:1}),
 at('conduit-2','conduit','Beacon conduit',28,-30,5,{index:2}),
 at('finale','finale','Silence the signal',28,-21,5),
 at('log-0','log','Maintenance tape',-38,39,0,{index:0}),
 at('log-1','log','Evacuation tape',38,29,2,{index:1}),
 at('log-2','log','Final transmission',-22,-36,4,{index:2,y:2.4}),
 at('secret','secret','Sealed archive',-18,-39,4,{y:2.4}),
 at('trial','trial','Station trial',21,8,2),
];
export const Z_CACHE_SITES=[at('cache-0','cache','Signal Cache',-23,35,0),at('cache-1','cache','Signal Cache',32,18,2),at('cache-2','cache','Signal Cache',-22,-8,4),at('cache-3','cache','Signal Cache',22,-36,5)];
export const Z_ENTRANCES=Z_ZONES.flatMap(zone=>[{id:`entry-${zone.id}-0`,zone:zone.id,x:zone.x-8,z:zone.z+(zone.z>0?18:-18),y:zone.id===4?2.4:0},{id:`entry-${zone.id}-1`,zone:zone.id,x:zone.x+8,z:zone.z+(zone.z>0?-17:17),y:0}]);
export const Z_LOGS=[
 'MAINTENANCE / 03:17 — The tide stopped moving before the alarms started. We heard footsteps inside the disconnected aerial. Three cores can break its feedback loop.',
 'EVACUATION / 04:02 — Keep the doors powered. The west array answers FIRST, the east answers SECOND, and the beacon answers LAST. Do not let the voice choose the order.',
 'FINAL / 04:41 — We called it the Bellwether. It does not command the infected. It is listening through them. Charge all three conduits, then silence the transmitter. The archive key is in these recordings.',
];
export function zZoneAt(x,z){return z>=0?(x<-14?0:x>14?2:1):(x<-14?4:x>14?5:3);}
const box=(x,z,w,d,h=5.2,y=0,kind='wall')=>({x,z,w,d,h,y,kind,color:kind==='roof'?'steel':'concrete'});
function splitWall(boxes,axis,fixed,start,end,openings){let last=start;for(const c of openings.sort((a,b)=>a-b)){if(c-3>last)boxes.push(axis==='x'?box(fixed,(last+c-3)/2,1,c-3-last):box((last+c-3)/2,fixed,c-3-last,1));last=c+3;}if(last<end)boxes.push(axis==='x'?box(fixed,(last+end)/2,1,end-last):box((last+end)/2,fixed,end-last,1));}
export function makeZombiesMap(){
 const boxes=[];
 for(const side of [-1,1])boxes.push(box(side*45,0,2,92,7,0,'boundary'),box(0,side*45,88,2,7,0,'boundary'));
 splitWall(boxes,'x',-14,-44,44,[-24,26]);splitWall(boxes,'x',14,-44,44,[-24,26]);splitWall(boxes,'z',0,-44,44,[-29,0,30]);
 // Broad gallery at 2.4 m, with two 3 m wide stair approaches and open sightlines.
 boxes.push(box(-29,-35,27,16,2.4,0,'platform'));
 for(const x of [-38,-20])for(let i=0;i<8;i++)boxes.push(box(x,-17.625-i*1.25,3,1.3,(i+1)*.3,0,'step'));
 // Covered machine hall / freight arcade; roofs are collision solids, not visual-only cover.
 boxes.push(box(0,30,27,26,.35,5.2,'roof'),box(29,33,28,20,.35,5.2,'roof'));
 for(const x of [-10,10])for(const z of [18,40])boxes.push(box(x,z,.65,.65,5.2,0,'column'));
 for(const x of [18,40])for(const z of [24,40])boxes.push(box(x,z,.65,.65,5.2,0,'column'));
 // Central machines have generous loops around them; no accidental one-exit camp.
 boxes.push(box(0,-20,5,7,3,0,'reactor'),box(0,24,4,7,2.5,0,'pump'),box(29,26,5,5,1.8,0,'cargo'),box(-31,20,4,3,1.15,0,'cargo'),box(-24,-12,4,3,1.2,0,'console'));
 // A recessed archive above the gallery; its west opening remains navigable.
 boxes.push(box(-18.3,-42,6.4,.4,2.8,2.4,'archive'),box(-15.4,-39,.4,6,2.8,2.4,'archive'),box(-18.3,-36,6.4,.4,2.8,2.4,'archive'),box(-21.4,-41.3,.4,1.4,2.8,2.4,'archive'),box(-21.4,-36.5,.4,1,2.8,2.4,'archive'));
 for(const t of Z_STATIONS){if(t.kind==='wall')continue;const [w,d,h]=t.kind==='forge'?[2.2,1.3,2.2]:t.kind==='perk'?[.82,.68,1.8]:t.kind==='core'?[.45,.45,1.3]:t.kind==='log'?[.6,.35,1.35]:[1.1,.7,1.5];boxes.push({...box(t.x,t.z,w,d,h,t.y,'station'),zStation:t.id});}
 return {id:'blacktide',name:'Blacktide Relay',tag:'ZOMBIES / COASTAL QUARANTINE',theme:'zombies',sky:0x152830,ground:0x405257,accent:0xf2b96a,size:44,revision:1,boxes,lanes:[],props:[],pickups:[],bases:[[-29,30],[-29,34]],spawns:[[-31,31],[-27,31],[-31,35],[-27,35]],navMax:3};
}
export const ZOMBIES_MAP=makeZombiesMap();
let clientMap=null,clientKey='';
export function applyZombiesState(state){const key=(state?.open||[]).join('|');if(!clientMap||key!==clientKey){clientKey=key;clientMap=zCollisionMap(state?.open||[]);}return clientMap;}
export const zombieClientMap=()=>clientMap||applyZombiesState(null);
export function zCollisionMap(open=[]){const unlocked=new Set(open);return {...ZOMBIES_MAP,boxes:[...ZOMBIES_MAP.boxes,...Z_DOORS.filter(d=>!unlocked.has(d.id)).map(d=>({...box(d.x,d.z,d.w,d.d,5.2),zDoor:d.id}))],geometryRevision:open.length};}
export function zUnlocked(open=[]){const zones=new Set([0]),ids=new Set(open);let changed=true;while(changed){changed=false;for(const d of Z_DOORS)if(ids.has(d.id)&&(zones.has(d.a)||zones.has(d.b))){const size=zones.size;zones.add(d.a);zones.add(d.b);changed||=zones.size!==size;}}return zones;}


export const zInteractionMap=(map,id)=>({...map,boxes:map.boxes.filter(b=>b.zStation!==id)});
