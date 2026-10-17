// Physics, navigation, map UI and art share this authored open-world layout.
export const Z_WORLD_SIZE=180;
export const Z_ZONES=[
 {id:0,name:'Harbor Approach',x:-108,z:108,w:108,d:108,tier:1,color:0x75847d,theme:'port'},
 {id:1,name:'Old Town',x:0,z:108,w:108,d:108,tier:1,color:0x938978,theme:'town'},
 {id:2,name:'Evacuation Airfield',x:108,z:108,w:108,d:108,tier:1,color:0x7b817b,theme:'airfield'},
 {id:3,name:'Freight Exchange',x:-108,z:0,w:108,d:108,tier:2,color:0x78847d,theme:'freight'},
 {id:4,name:'Lattice Research',x:0,z:0,w:108,d:108,tier:3,color:0x6b7775,theme:'lab'},
 {id:5,name:'Civic Hospital',x:108,z:0,w:108,d:108,tier:2,color:0x8b8f84,theme:'hospital'},
 {id:6,name:'Pine Ridge',x:-108,z:-108,w:108,d:108,tier:2,color:0x748374,theme:'woods'},
 {id:7,name:'Reactor Works',x:0,z:-108,w:108,d:108,tier:3,color:0x777a72,theme:'reactor'},
 {id:8,name:'Signal Observatory',x:108,z:-108,w:108,d:108,tier:3,color:0x898679,theme:'observatory'},
];
export const Z_DOORS=[];
export function zZoneAt(x,z){return Math.max(0,Math.min(2,Math.floor((x+162)/108)))+3*Math.max(0,Math.min(2,Math.floor((162-z)/108)));}
export const zThreatAt=(x,z)=>Z_ZONES[zZoneAt(x,z)].tier;
const at=(id,kind,name,x,z,extra={})=>({id,kind,name,x,y:0,z,zone:zZoneAt(x,z),...extra});
export const Z_EXFILS=[at('exfil-harbor','exfil','HARBOR EXTRACTION',-145,143),at('exfil-airfield','exfil','AIRFIELD EXTRACTION',145,143),at('exfil-observatory','exfil','FINAL EXTRACTION',145,-143)];
const buildings=[
 [0,-127,107,20,17,5.2,'Harbor operations','office'],[0,-94,87,24,20,6,'Customs warehouse','warehouse'],[0,-92,128,18,17,4.7,'Dockside clinic','clinic'],
 [1,-24,89,22,19,6.2,'Civic archives','office'],[1,23,126,20,20,5.5,'Seabrook diner','shop'],[1,23,86,18,22,7,'Town apartments','apartments'],[1,-24,128,17,18,5,'Supply shop','shop'],
 [2,87,88,28,25,7.5,'Hangar 04','hangar'],[2,130,86,16,20,8,'Control tower','tower'],[2,92,129,18,14,4.4,'Field station','office'],
 [3,-130,-23,25,20,7,'Freight terminal','warehouse'],[3,-89,23,22,25,6.5,'Rail depot','warehouse'],[3,-129,24,18,18,5,'Dispatch','office'],
 [4,-24,-22,24,23,7.5,'Lattice laboratory','lab'],[4,24,23,26,24,8,'Containment wing','lab'],[4,23,-23,18,21,6,'Data vault','vault'],
 [5,90,-20,26,25,8,'St. Anselm hospital','hospital'],[5,132,23,20,21,6,'Medical stores','clinic'],[5,89,24,19,20,5,'Ambulance bay','hangar'],
 [6,-128,-124,19,20,5,'Ranger station','cabin'],[6,-87,-90,17,18,4.7,'Research outpost','cabin'],
 [7,-24,-89,25,20,8,'Turbine hall','reactor'],[7,24,-125,24,22,7,'Coolant works','reactor'],[7,24,-86,18,20,5,'Security barracks','barracks'],
 [8,88,-88,22,22,8,'Observatory','tower'],[8,127,-124,23,20,6,'Signal control','lab'],[8,87,-127,20,17,5,'Archive','archive'],
];
export const Z_BUILDINGS=buildings.map(([zone,x,z,w,d,h,name,kind],i)=>({id:'building-'+i,zone,x,z,w,d,h,y:0,name,kind}));
export const Z_STATIONS=[
 at('wall-smg','wall','VX-7 SMG',-119,110,{weapon:'zipper',cost:850}),at('wall-rifle','wall','R-41 Service Rifle',-22,84,{weapon:'sprinter',cost:1400}),at('wall-shotgun','wall','M12 Combat Shotgun',87,82,{weapon:'scatter',cost:1500}),at('wall-dmr','wall','DMR-18 Sentinel',-128,-119,{weapon:'anchor',cost:1800}),at('wall-pulse','wall','ARC-5 Pulse Rifle',122,-126,{weapon:'comet',cost:2400}),
 ...[['vigor','Iron Pulse',-89,130],['quickhands','Quickwire',25,120],['stride','Longstride',-87,-84],['lifeline','Lifeline',131,28],['deadeye','Glass Eye',-26,-84],['recovery','Second Wind',90,-15],['scavenger','Surveyor',-126,18],['elemental','Flux',20,17],['insurance','Echo Keeper',84,-123]].map(([id,name,x,z])=>at('perk-'+id,'perk',name,x,z,{perk:id})),
 at('forge','forge','Resonance Forge',-17,-19),at('forge-north','forge','Resonance Forge',18,-120),
 ...[[-130,116],[25,132],[90,135],[-128,30],[134,30],[-127,-117]].map(([x,z],i)=>at('workbench-'+i,'craft','Field Supply',x,z)),
 ...[[-93,95],[20,82],[129,80],[-84,16],[18,17],[84,-14],[-83,-90],[18,-82],[120,-120]].map(([x,z],i)=>at('arsenal-'+i,'arsenal','Weapon Calibration',x,z)),
 ...[[-142,126],[0,146],[147,126],[-147,0],[0,40],[145,0],[-147,-141],[0,-147],[142,-126]].map(([x,z],i)=>at('ammo-'+i,'ammo','Ammunition Cache',x,z)),
 ...Z_EXFILS,at('trap-freight','trap','Freight induction grid',-108,0,{cost:700,radius:9}),at('trap-reactor','trap','Coolant discharge',0,-108,{cost:1000,radius:10}),
 at('story-terminal','story','Operation Safe Harbor',-125,112),at('rift','rift','Lattice breach',0,-20),at('story-finale','final-operation','Silence the Coast',108,-108),at('doghouse','companion','Rescue containment hound',-120,-100,{cost:2000}),
 at('log-0','log','Harbor manifest',-133,110,{index:0}),at('log-1','log','Medical report',94,-17,{index:1}),at('log-2','log','Final transmission',84,-123,{index:2}),at('secret','secret','Experimental archive',94,-125),
];
export const Z_CACHE_SITES=[at('cache-0','cache','Signal Cache',-130,100),at('cache-1','cache','Signal Cache',-20,130),at('cache-2','cache','Signal Cache',-128,-27),at('cache-3','cache','Signal Cache',126,-126)];
export const Z_CONTRACTS=Z_ZONES.flatMap(zone=>{
 const kinds=zone.tier===1?['recover','defend','hunt']:zone.tier===2?['purge','escort','sabotage']:['hunt','vault','defend'];
 return kinds.map((kind,i)=>at('contract-'+zone.id+'-'+i,'contract',({recover:'Recover supplies',defend:'Restore communications',hunt:'Eliminate marked threat',purge:'Clear the infestation',escort:'Escort rescue rover',sabotage:'Disable hostile relays',vault:'Secure the research vault'})[kind],zone.x+[-8,10,0][i],zone.z+[24,-20,0][i],{contractKind:kind,tier:zone.tier}));
});
export const Z_LOOT_SITES=Z_BUILDINGS.flatMap((b,i)=>[at('loot-'+i+'-0','loot',b.kind==='clinic'||b.kind==='hospital'?'Medical supplies':'Supply locker',b.x-b.w*.27,b.z-b.d*.25,{tier:Z_ZONES[b.zone].tier,medical:['clinic','hospital'].includes(b.kind)}),at('loot-'+i+'-1','loot','Sealed equipment case',b.x+b.w*.27,b.z+b.d*.2,{tier:Z_ZONES[b.zone].tier})]);
export const Z_VEHICLE_SITES=[[-144,120],[-6,142],[137,125],[-140,-5],[138,-5],[-140,-141],[0,-144]].map(([x,z],i)=>at('vehicle-'+i,'vehicle','Field rover',x,z));
export const Z_ENTRANCES=Z_ZONES.flatMap(zone=>Array.from({length:8},(_,i)=>at(`entry-${zone.id}-${i}`,'entry','Infected approach',zone.x+Math.cos(i*Math.PI/4)*43,zone.z+Math.sin(i*Math.PI/4)*43)));
export const Z_LOGS=[
 'HARBOR / A civilian evacuation convoy vanished after a signal from the inland observatory. Recover its supplies and restore communications so we can locate survivors.',
 'HOSPITAL / The infection follows the lattice frequency. Medical teams traced its source to the reactor. Cutting the coolant relays should expose the core.',
 'OBSERVATORY / The Bellwether is transmitting through the missing staff. Recover the research, close the breach, and bring the evidence home. Your extraction is the mission.',
];
const box=(x,z,w,d,h,y=0,kind='wall',extra={})=>({x,z,w,d,h,y,kind,color:'concrete',...extra});
export function makeZombiesMap(){
 const boxes=[];
 for(const b of Z_BUILDINGS){const {x,z,w,d,h}=b;
  boxes.push(box(x-w/2,z,.5,d,h,0,'facade',{building:b.id}),box(x+w/2,z,.5,d,h,0,'facade',{building:b.id}));
  for(const side of [-1,1]){const span=(w-4)/2;for(const end of [-1,1])boxes.push(box(x+end*(w+4)/4,z+side*d/2,span,.5,h,0,'facade',{building:b.id}));boxes.push(box(x,z+side*d/2,4,.5,h-3.2,3.2,'lintel',{building:b.id}));}
  boxes.push(box(x,z,w+.5,d+.5,.25,h,'roof',{building:b.id}),box(x-3,z+1,2.2,1,1,0,'desk'),box(x+3,z-2,1,2,1.5,0,'cabinet'));
  if(b.kind==='tower'||b.kind==='apartments'){boxes.push(box(x,z-3,w-2,4,.25,2.4,'platform'));for(let i=0;i<8;i++)boxes.push(box(x-w/2+3,z+5-i,2.5,1.05,(i+1)*.3,0,'step'));}
 }
 for(const zone of Z_ZONES)for(let i=0;i<4;i++)boxes.push(box(zone.x-37+i*24,zone.z+39,3.2,1.2,1,0,'barrier'));
 for(let i=0;i<5;i++)boxes.push(box(-102+i%2*12,-35+Math.floor(i/2)*10,8,3,2.4,0,'container'));
 for(const x of [-5,5])boxes.push(box(x,-116,5,8,5,0,'reactor'));
 for(const t of Z_STATIONS){if(['wall','exfil','story','rift','log'].includes(t.kind))continue;boxes.push(box(t.x,t.z,t.kind==='forge'?2:.8,t.kind==='forge'?1.3:.65,t.kind==='perk'?1.8:1.2,t.y,'station',{zStation:t.id}));}
 return {id:'blacktide',name:'Blacktide Exclusion Coast',tag:'ZOMBIES / EXTRACTION',theme:'zombies',sky:0xa5b5b6,ground:0x768275,accent:0xf2b96a,size:Z_WORLD_SIZE,revision:2,boxes,buildings:Z_BUILDINGS,districts:Z_ZONES,lanes:[],props:[],pickups:[],bases:[[-143,131],[-139,131]],spawns:[[-143,131],[-139,131],[-143,135],[-139,135]],navMax:3};
}
export const ZOMBIES_MAP=makeZombiesMap();
export const zCollisionMap=()=>ZOMBIES_MAP;
export const zUnlocked=()=>new Set(Z_ZONES.map(z=>z.id));
export const applyZombiesState=()=>ZOMBIES_MAP;
export const zombieClientMap=()=>ZOMBIES_MAP;
export const zInteractionMap=(map,id)=>({...map,boxes:map.boxes.filter(b=>b.zStation!==id)});
