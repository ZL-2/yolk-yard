import {moveBody} from './campaign-mission.js';
// One measured source for rendering, collision, navigation and mission placement.
// Blueprint X/Y -> world x=X-80, z=110-Y. Heights are metres above sea level.
export const FACILITY_BOUNDS={minX:-76,maxX:78,minZ:-108,maxZ:108};
export const FACILITY={operations:{x:32,z:-12,w:48,d:36,ground:12,upper:16,roof:20},dish:{x:-22,z:-42,radius:14,terrace:16},mast:{x:63,z:-67,height:48,base:16},pad:{x:30,z:-95,y:20,radius:13}};
export function surfaceHeight(s,x,z){
 if(x<s.x-s.sx/2||x>s.x+s.sx/2||z<s.z-s.sz/2||z>s.z+s.sz/2)return null;
 const t=s.axis==='x'?(x-(s.x-s.sx/2))/s.sx:(z-(s.z-s.sz/2))/s.sz;
 return s.y+(s.rise||0)*t;
}
export function floorAt(surfaces,x,z,ceiling=Infinity){let best=-Infinity;for(const s of surfaces){const y=surfaceHeight(s,x,z);if(y!==null&&y<=ceiling+.001)best=Math.max(best,y);}return best;}
export function createFacilityLayout(){
 const boxes=[],surfaces=[],covers=[],props=[],lights=[];
 const box=(id,x,y,z,sx,sy,sz,material='concrete',extra={})=>{const b={id,x,y,z,sx,sy,sz,material,...extra};boxes.push(b);return b;};
 const floor=(id,x,z,sx,sz,y,material='asphalt')=>{surfaces.push({id,x,z,sx,sz,y});box(id,x,y-.25,z,sx,.5,sz,material,{floor:true});};
 const ramp=(id,x,z,sx,sz,y,rise,axis='z')=>surfaces.push({id,x,z,sx,sz,y,rise,axis,ramp:true});
 const wall=(id,x,z,sx,sz,y=12,h=4)=>box(id,x,y+h/2,z,sx,h,sz);
 const cover=(id,x,z,sx,sz,y=12,h=1.15,material='crate')=>{const b=box(id,x,y+h/2,z,sx,h,sz,material,{cover:true});for(const [dx,dz]of [[sx/2+.8,0],[-sx/2-.8,0],[0,sz/2+.8],[0,-sz/2-.8]])covers.push({id:id+':'+dx+':'+dz,x:x+dx,y,z:z+dz,box:b});return b;};
 const prop=(type,x,y,z,extra={})=>props.push({type,x,y,z,...extra});
 // Approach bends from the southeast; all terraces are traversable, not a flat backdrop.
 floor('approach-east',58,99,36,16,4);floor('approach-turn',42,83,16,36,4);floor('gate-road',40,54,16,28,4);
 ramp('yard-ascent',40,30,12,20,12,-8);floor('south-yard',38,13,54,14,12);
 floor('operations-terrace',30,-12,66,38,12);floor('west-service-walk',1,-4,10,48,12);
 floor('east-service-walk',63,-4,10,48,12);floor('rear-apron',32,-32,54,4,12);floor('rear-west-corner',6,-29,4,10,12);floor('rear-east-corner',58,-29,4,10,12);
 ramp('west-terrace-ascent',1,-34,8,12,16,-4);ramp('east-terrace-ascent',63,-34,8,12,16,-4);
 floor('dish-terrace',-22,-42,38,42,16);floor('relay-link',30,-46,68,12,16);
 floor('north-support-terrace',30,-64,68,26,16);
 ramp('extraction-ascent',30,-80,10,12,20,-4);floor('extraction-terrace',30,-97,40,22,20);
 // Outer road barriers break sightlines without closing the path.
 for(const [x,z,w,d,y]of [[30,67,1,19,4],[50,60,1,33,4],[30,88,1,16,4],[70,90,1,16,4],[59,107,36,1,4],[-41,-42,1,43,16],[-22,-63,38,1,16],[10,-106,1,23,20],[50,-106,1,23,20]])box('barrier',x,y+.65,z,w,1.3,d,'darkConcrete');
 // South gate opens after the junction is isolated. Flanking routes begin in the yard.
 box('gate',40,5.7,44,15,3.4,.22,'steel',{unlock:1});
 box('gatehouse',54,5.7,47,8,3.4,8,'darkConcrete');prop('gatehouse',54,4,47);
 prop('terminal',32,4,51,{label:'PERIMETER',sub:'01 / GRID ISOLATION'});
 for(const x of [32,48])prop('gatepost',x,4,44);
 cover('road-cover',42,67,5,1,4,1.1,'darkConcrete');
 cover('yard-cargo-west',18,17,7,3,12,2.8,'olive');cover('yard-cargo-east',58,13,4,5,12,2.8,'olive');
 cover('yard-low-west',29,15,3.5,1.6);cover('yard-low-east',47,17,3,1.7);prop('truck',50,12,21);box('truck-body',50,13.3,21,2.8,2.6,6,'dark',{invisible:true});
 // Operations exterior: south entry, west alternate approach, rear service exit.
 wall('ops-west',8,-12,.55,36);wall('ops-east',56,-12,.55,36);
 wall('ops-south-west',18,6,20,.55);wall('ops-south-east',44,6,24,.55);box('entry-lintel',30,15.5,6,4,1,.55);
 wall('ops-north-west',17,-30,18,.55);wall('ops-north-east',43,-30,26,.55);box('rear-lintel',28,15.5,-30,4,1,.55);
 box('operations-door',30,13.5,6,3.9,3,.3,'steel',{unlock:2});box('archive-exit',28,13.5,-30,3.9,3,.3,'steel',{unlock:4});
 // North and south rooms joined by two genuine doorways to a central corridor.
 for(const z of [-7,-14])for(const [x,w]of [[17,6],[30,12],[45,10]])wall('partition',x,z,w,.25);
 // Openings at x20-24 and x36-40: desk cover in control, briefing, comms and server rooms.
 wall('room-divider',32,-.5,.25,12);wall('archive-divider',32,-22,.25,16);
 for(const [x,z]of [[14,-2],[19,-2],[45,-2],[50,-2],[14,-21],[21,-24]]){cover('console',x,z,3,1.25,12,1.05,'dark');prop('console',x,12,z);}
 prop('table',43,12,-22);prop('rack',35,12,-22);prop('rack',35,12,-27);prop('rack',52,12,-22);prop('rack',52,12,-27);
 for(const [x,z]of [[35,-22],[35,-27],[52,-22],[52,-27]])box('rack',x,13.25,z,1.1,2.5,1.4,'dark');
 prop('terminal',48,12,-27,{label:'ARCHIVE',sub:'03 / EVACUATION MANIFEST'});
 prop('sign',30,15.5,6.32,{label:'OPERATIONS',sub:'STATION SEVEN / 07',w:4});
 prop('sign',28,15,-29.65,{label:'UPLINK →',sub:'WEST SERVICE TERRACE',w:3});
 // Upper slab has separate stair wells at both sides. No fake stairs / floor teleport.
 floor('upper-core',32,-12,36,36,16,'darkConcrete');floor('upper-west-south',11,1,6,10,16,'darkConcrete');floor('upper-west-north',11,-22,6,16,16,'darkConcrete');
 floor('upper-east-south',53,1,6,10,16,'darkConcrete');floor('upper-east-north',53,-22,6,16,16,'darkConcrete');
 ramp('west-stairs',11,-9,6,10,16,-4);ramp('east-stairs',53,-9,6,10,16,-4);
 for(const x of [8,56])wall('upper-side',x,-12,.55,36,16,4);
 for(const z of [6,-30]){for(const x of [13,23,33,43,53])wall('upper-pier',x,z,1, .55,16,4);wall('upper-sill',32,z,48,.55,16,1.1);wall('upper-header',32,z,48,.55,19,1);}
 floor('operations-roof',32,-12,49,37,20,'darkConcrete');
 ramp('roof-service-stairs',63,-12,4,20,20,-8);floor('roof-access-bridge',60,-24,9,4,20,'steel');
 wall('roof-parapet-west',7.6,-12,.4,37,20,.9);wall('roof-parapet-south',32,6.5,49,.4,20,.9);wall('roof-parapet-north',32,-30.5,49,.4,20,.9);wall('roof-parapet-east-south',56.5,-5,.4,23,20,.9);wall('roof-parapet-east-north',56.5,-28,.4,5,20,.9);
 // Upper command gallery and optional information / supplies reward exploration.
 for(const [x,z]of [[22,-2],[29,-2],[39,-2],[45,-2]]){cover('command-console',x,z,3,1.3,16,1.05,'dark');prop('console',x,16,z);}
 wall('upper-room-partition',32,-17,35,.25,16,3.5);prop('table',27,16,-24);prop('workbench',43,16,-24);
 prop('terminal',22,16,-3,{label:'COMMAND',sub:'02 / ROUTE OVERRIDE'});
 for(const [x,z]of [[18,-25],[44,-21]])prop('hvac',x,20,z);prop('radome',45,20,-8);prop('smallDish',21,20,0);
 // Primary dish: monumental pedestal and wraparound maintenance routes.
 box('dish-pedestal',-22,21,-42,18,10,18,'darkConcrete');
 prop('dish',-22,16,-42);prop('terminal',-11,16,-33,{label:'UPLINK',sub:'04 / TRANSMITTER CONTROL'});
 cover('dish-low',-9,-28,3,2,16,1.1);cover('dish-crates',-36,-31,3,3,16,1.4);cover('relay-low',16,-44,4,1.6,16);cover('relay-container',42,-45,7,3,16,2.6,'olive');
 // Service block houses workshops and generators with an open central route.
 for(const x of [9,51])wall('support-side',x,-65,.5,22,16,4);
 for(const z of [-54,-76])for(const [x,w]of [[17,16],[39,24]])wall('support-front',x,z,w,.5,16,4);
 floor('support-roof',30,-65,43,23,20,'darkConcrete');
 prop('generator',15,16,-61);prop('generator',15,16,-69);for(const z of [-61,-69])box('generator-body',15,17,z,3,2,4,'olive',{invisible:true});prop('workbench',43,16,-69);
 cover('support-cover',40,-60,3,1.8,16);prop('mast',63,16,-67);
 cover('pad-crates-west',15,-88,3,2,20);cover('pad-crates-east',45,-97,3,2,20);cover('pad-south',39,-86,4,1.8,20);
 prop('helipad',30,20,-95);prop('supply',26,12,3);prop('supply',46,16,-73);
 for(const [x,y,z]of [[31,4,92],[49,4,65],[31,4,46],[34,8,31],[14,12,19],[63,12,18],[2,12,2],[65,12,-23],[-36,16,-26],[-36,16,-59],[4,16,-45],[53,16,-50],[53,16,-74],[13,20,-89],[47,20,-104]])lights.push({x,y,z});
 const propBounds={terminal:[1.3,1.6,.55],hvac:[3,1.6,2],radome:[3.6,2.8,3.6],table:[4,.95,1.8],workbench:[4,1.4,1.8],supply:[1.4,1,.65],mast:[2.6,48,2.6]};
 for(const p of props){const dims=propBounds[p.type];if(dims)box('prop-'+p.type,p.x,p.y+dims[1]/2,p.z,...dims,'dark',{invisible:true});}
 return {boxes,surfaces,covers,props,lights,bounds:FACILITY_BOUNDS};
}
// Broad phase for movement / grid construction. Immutable walls are indexed once.
export class CollisionIndex{
 constructor(boxes,size=8){this.boxes=boxes;this.size=size;this.cells=new Map();for(const b of boxes){for(let x=Math.floor((b.x-b.sx/2)/size);x<=Math.floor((b.x+b.sx/2)/size);x++)for(let z=Math.floor((b.z-b.sz/2)/size);z<=Math.floor((b.z+b.sz/2)/size);z++){const key=x+':'+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(b);}}}
 near(x,z,r=1){const out=new Set();for(let xx=Math.floor((x-r)/this.size);xx<=Math.floor((x+r)/this.size);xx++)for(let zz=Math.floor((z-r)/this.size);zz<=Math.floor((z+r)/this.size);zz++)for(const b of this.cells.get(xx+':'+zz)||[])out.add(b);return [...out];}
}

export function moveFacilityBody(world,body,dx,dz,radius=.3,height=1.7){
 const {surfaces}=world;const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));for(let i=0;i<count;i++){
   const old={x:body.x,z:body.z,y:body.y},nx=body.x+dx/count,nz=body.z+dz/count,ground=floorAt(surfaces,nx,nz,body.y+.5);
   if(!Number.isFinite(ground)||ground<body.y-2.4&&!(body.vy>0))continue;
   if(ground>body.y&&ground-body.y<=.5)body.y=ground;
   moveBody(body,dx/count,dz/count,world.index.near(body.x,body.z,2).filter(b=>!b.floor||b.y+b.sy/2>body.y+.5),radius,height);
   const floor=floorAt(surfaces,body.x,body.z,body.y+.5);if(!Number.isFinite(floor)){Object.assign(body,old);continue;}if(!body.vy||body.vy<=0&&body.y-floor<.55)body.y=floor;
  }}
