// Kestrel Forward Airfield. One static mesh/collision authoring for every client.
const size=68,cell=2,n=69,heights=new Float32Array(n*n);
for(let z=0;z<n;z++)for(let x=0;x<n;x++){const wx=x*cell-size,wz=z*cell-size,edge=Math.max(Math.abs(wx)/63,Math.abs(wz)/62);heights[z*n+x]=Math.max(0,Math.min(3.2,(1-edge)*24));}
const boxes=[],props=[],trees=[],navLinks=[],signs=[];
const box=(x,z,w,d,h,y=3.2,color=0x5b7077,kind='building',material='metal')=>{const b={x,z,w,d,h,y,color,kind,material,objectId:'departure-'+boxes.length};boxes.push(b);return b;};
const prop=(kind,x,z,w=2,d=2,h=1.3,y=3.2)=>{props.push({kind,x,z,w,d,h,y,seed:props.length});box(x,z,w,d,h,y,0x677b71,'prop',kind==='rock'?'brick':['car','truck','lamp','container','generator'].includes(kind)?'metal':'wood').prop=props.length-1;};
// Runway 18/36, turning apron, runway edge lights, and a parked R-04.
const roads=[{kind:'runway',width:20,points:[[25,-72],[25,72]]},{kind:'taxiway',width:12,points:[[-39,-31],[25,-31]]},{kind:'taxiway',width:8,points:[[-47,60],[-47,-54]]},{kind:'path',width:5,points:[[-62,18],[-9,18],[-9,-23]]}];
for(let z=-64;z<=66;z+=12)box(25,z,.45,5,.025,3.205,0xe6e8d5,'marking');
for(const side of [-1,1]){box(25+side*9,-1,.22,137,.025,3.205,0xc4c9bb,'marking');for(let z=-68;z<=68;z+=12)box(25+side*12,z,.35,.35,.12,3.2,0x8edbd8,'runway-light');}
for(const z of [-65,65])for(let x=18;x<=32;x+=2)box(x,z,.8,5,.03,3.205,0xe7e6d2,'marking');
const parkedTransport={x:25,y:4.68,z:-35,yaw:0};
box(25,-35,5.8,17,4.6,3.5,0x344d57,'parked-aircraft');box(25,-35.7,16.5,3.6,.5,6.9,0x425c65,'parked-aircraft');
// Open maintenance hangar, with service bay and staging equipment.
box(-28,-47,34,27,.25,2.95,0x6a7a79,'foundation');box(-28,-60.5,34,.6,9,3.2,0x647983);
for(const side of [-1,1]){box(-28+side*17,-47,.6,27,9,3.2,0x526b78);box(-28+side*15,-33.5,4,.5,9,3.2,0x40545e);}
box(-28,-47,35,28,.4,12.2,0x3e5965);box(-28,-33.5,26,.5,2,10.2,0x526b78);
for(let i=0;i<4;i++)prop('crate',-40+i*6,-55,2.8,2.3,1.8);prop('wreck',-28,-45,11,5,3);
// Operations hut and broad observation deck with ordinary walkable stairs.
box(-58,-17,18,13,.25,2.95,0x697c7b,'foundation');box(-58,-23.5,18,.5,4.5,3.2,0x65766a);
for(const side of [-1,1])box(-58+side*9,-17,.5,13,4.5,3.2,0x65766a);box(-58,-17,19,14,.3,7.7,0x344f55);
prop('console',-58,-21,3.6,1.4,1.2);prop('radio',-73,-17,3,3,21);
for(let i=0;i<12;i++)box(-72,2-i*1.1,3.8,1.12,(i+1)*.4,3.2,0x677e7e,'step');box(-64,-11,19,4,.3,7.7,0x526e79,'floor');navLinks.push({from:{x:-72,y:3.2,z:3},to:{x:-72,y:8,z:-12}});
// Firing lanes, protective berms, recovery tent, cargo and movement course.
for(const x of [-66,-58,-50,-42]){prop('target',x,51,1.2,.5,2.3);prop('crate',x,33,2.2,1.2,1.2);box(x,55,7,2,4.5,3.2,0x6b785d,'range-berm','brick');}
prop('medical-tent',-24,52,9,8,3.8);prop('truck',-18,34,3,6,2.8);prop('generator',-10,-18,2.6,2.4,1.7);
for(const [x,z]of [[-62,17],[-54,17],[-34,10],[-25,10]])prop('container',x,z,7,3.2,2.8);
for(let i=0;i<7;i++)box(-6,26+i*4,3.6,2.4,.35,3.2+i*.35,0x6f7d72,'step');
for(const [x,z]of [[-42,-28],[-13,-28],[-44,22],[-15,22],[-72,33]])prop('lamp',x,z,.35,.35,4.5);
for(const side of [-1,1])for(let z=-60;z<=64;z+=12)box(side*79,z,.18,9,2.1,3.2,0x546b64,'fence');
for(let i=0;i<18;i++){const x=-82+(i%3)*3,z=-70+Math.floor(i/3)*28;trees.push({x,z,y:3.2,h:7+i%3,kind:'pine',seed:i});box(x,z,.7,.7,4,3.2,0x75634e,'tree','wood').tree=trees.length-1;}
signs.push({text:'KESTREL FORWARD AIRFIELD',x:-28,y:10,z:-32.9},{text:'RANGE / LIVE TRAINING',x:-54,y:6,z:54},{text:'36 / HOLD SHORT',x:25,y:4,z:70},{text:'OPERATIONS / R-04',x:-58,y:6.8,z:-10.2},{text:'FIELD MEDICAL',x:-24,y:6.2,z:56},{text:'MOVEMENT / BUILD PRACTICE',x:-5,y:6,z:24});
// Compact the horizontal footprint, retaining full-height cover, safe stairs and
// the full-size Kestrel. Terrain area is 50% smaller; the runway stays 20m wide.
const footprint=.7;
for(const b of boxes){b.x=['marking','runway-light'].includes(b.kind)?25*footprint+(b.x-25):b.x*footprint;b.z*=footprint;if(b.kind!=='parked-aircraft'){b.w*=footprint;b.d*=footprint;}}
for(const p of props){p.x*=footprint;p.z*=footprint;p.w*=footprint;p.d*=footprint;}
for(const p of [...trees,...signs,parkedTransport]){p.x*=footprint;p.z*=footprint;}
for(const road of roads){for(const p of road.points){p[0]*=footprint;p[1]*=footprint;}if(road.kind!=='runway')road.width*=footprint;}
for(const link of navLinks)for(const p of [link.from,link.to]){p.x*=footprint;p.z*=footprint;}
export const SPAWN_REGIONS=Array.from({length:8},(_,sector)=>({id:sector,points:[]}));
for(let z=-48;z<=48;z+=4.2)for(let x=-48;x<=48;x+=4.2){if(boxes.some(b=>b.y<5.1&&b.y+b.h>3.2&&Math.abs(b.x-x)<b.w/2+1.1&&Math.abs(b.z-z)<b.d/2+1.1))continue;const sector=Math.floor(((Math.atan2(z,x)+Math.PI*2)%(Math.PI*2))/(Math.PI/4));SPAWN_REGIONS[sector].points.push([x,z]);}
const spawns=SPAWN_REGIONS.flatMap(r=>r.points);
export function distributedSpawn(players,random=Math.random,points=spawns){
 const regions=points===spawns?SPAWN_REGIONS:SPAWN_REGIONS.map(r=>({id:r.id,points:points.filter(([x,z])=>Math.floor(((Math.atan2(z,x)+Math.PI*2)%(Math.PI*2))/(Math.PI/4))===r.id)}));
 const occupied=[...players].filter(p=>p.health>0&&Number.isFinite(p.x)),offset=Math.floor(random()*8);
 const candidates=regions.map((r,i)=>({...r,order:(i-offset+8)%8,count:occupied.filter(p=>r.points.some(([x,z])=>Math.hypot(p.x-x,p.z-z)<5)).length})).sort((a,b)=>a.count-b.count||a.order-b.order);
 for(const region of candidates){const points=[...region.points];for(let i=points.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[points[i],points[j]]=[points[j],points[i]];}
  const point=points.find(([x,z])=>occupied.every(p=>Math.hypot(p.x-x,p.z-z)>3));if(point)return {point,region:region.id};
 }
 return {point:points.reduce((best,p)=>Math.min(...occupied.map(o=>Math.hypot(o.x-p[0],o.z-p[1])))>Math.min(...occupied.map(o=>Math.hypot(o.x-best[0],o.z-best[1])))?p:best,points[0]),region:0};
}

export const SPAWN_ISLAND={id:'hatchery-atoll',name:'Kestrel Forward Airfield',revision:5,size,navCell:1.5,navMax:25,theme:'royale',sky:0xb0c7d1,ground:0x798a70,accent:0xe0b866,boxes,props,trees,navLinks,spawns,pickups:[],floorLoot:[],chests:[],buildings:[],shelters:[],lanes:[],landmarks:[],doors:[],traversal:[],bases:[[-20,0],[20,0]],zone:[0,0,0],districts:[{name:'Kestrel Airfield',x:-25,z:0,color:0xdab975}],roads,signs,parkedTransport,terrain:{size,cell,n,heights,max:3.2}};
