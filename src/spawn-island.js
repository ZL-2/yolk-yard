// Kestrel departure atoll. Static authored scenery never travels over the network.
const size=64,cell=2,n=65,heights=new Float32Array(n*n);
for(let z=0;z<n;z++)for(let x=0;x<n;x++){
 const wx=x*cell-size,wz=z*cell-size,r=Math.hypot(wx/61,wz/57);
 heights[z*n+x]=Math.max(0,Math.min(3.2,(1-r)*12));
}
const boxes=[],props=[],trees=[],navLinks=[];
const box=(x,z,w,d,h,y=3.2,color='stone',kind='building',material='brick')=>{const b={x,z,w,d,h,y,color,kind,material,objectId:'departure-'+boxes.length};boxes.push(b);return b;};
const prop=(kind,x,z,w=2,d=2,h=1.3,y=3.2)=>{props.push({kind,x,z,w,d,h,y,seed:props.length});box(x,z,w,d,h,y,'crate','prop',kind==='rock'?'brick':['car','lamp','container','generator'].includes(kind)?'metal':'wood').prop=props.length-1;};
// Open-sided terminal, boarding deck, practice range, cargo court and parkour pier.
box(0,-18,26,10,.3,3,'foundation');box(0,-21.5,26,.4,4,3.2,'steel');
for(const x of [-12,12])box(x,-18,.55,8,4,3.2,'steel');
box(0,-18,27,11,.35,7.2,'gold');box(-8,-17,5,1,1.1,3.2,'crate','furniture','wood');
box(8,-17,5,1,1.1,3.2,'crate','furniture','wood');
for(let i=0;i<10;i++)box(18,-19+i*.8,4,.82,.3,3.2+i*.4,'crate','step','wood');
box(18,-12,4,4,.3,7.2,'floor');navLinks.push({from:{x:18,y:3.2,z:-20},to:{x:18,y:7.5,z:-11}});
for(let i=0;i<7;i++){box(-29+i*3,19,2.2,3,.35,3.2+i*.36,'crate','step','wood');}
box(-8,19,6,6,.4,5.36,'crate','bridge','wood');
for(const x of [24,31,38]){prop('target',x,6,1.2,.5,2.4);prop('crate',x,12,2.2,1.4,1.2);}
for(const [kind,x,z,w,d,h]of [['container',-28,-12,7,3,2.5],['container',-28,-4,6,3,2.5],['car',-13,-29,2.2,4,1.4],['generator',12,24,2,2,1.6],['bench',-9,7,3,1,1],['bench',-9,11,3,1,1],['lamp',-15,-8,.5,.5,4],['lamp',13,-8,.5,.5,4]])prop(kind,x,z,w,d,h);
for(let i=0;i<22;i++){const a=i*2.39996,r=37+i%4*2,x=Math.cos(a)*r,z=Math.sin(a)*r;trees.push({x,z,y:3.2,h:7+i%3,kind:i%3?'palm':'oak',seed:i});box(x,z,.7,.7,4,3.2,'crate','tree','wood').tree=trees.length-1;}
// Eight equal-area sectors and several radii cover the dry, navigable plateau.
// Keep clear of solid scenery, the movement course and the shoreline slope.
export const SPAWN_REGIONS=Array.from({length:8},(_,sector)=>({id:sector,points:[]}));
for(let z=-36;z<=36;z+=6)for(let x=-36;x<=36;x+=6){
 if(Math.hypot(x/45,z/41)>1||boxes.some(b=>b.y<5.1&&b.y+b.h>3.2&&Math.abs(b.x-x)<b.w/2+1.1&&Math.abs(b.z-z)<b.d/2+1.1))continue;
 const sector=Math.floor(((Math.atan2(z,x)+Math.PI*2)%(Math.PI*2))/(Math.PI/4));SPAWN_REGIONS[sector].points.push([x,z]);
}
const spawns=SPAWN_REGIONS.flatMap(r=>r.points);
export function distributedSpawn(players,random=Math.random){
 const occupied=[...players].filter(p=>p.health>0&&Number.isFinite(p.x)),offset=Math.floor(random()*8);
 const candidates=SPAWN_REGIONS.map((r,i)=>({...r,order:(i-offset+8)%8,count:occupied.filter(p=>r.points.some(([x,z])=>Math.hypot(p.x-x,p.z-z)<5)).length})).sort((a,b)=>a.count-b.count||a.order-b.order);
 for(const region of candidates){const points=[...region.points];for(let i=points.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[points[i],points[j]]=[points[j],points[i]];}
  const point=points.find(([x,z])=>occupied.every(p=>Math.hypot(p.x-x,p.z-z)>3));if(point)return {point,region:region.id};
 }
 return {point:spawns.reduce((best,p)=>Math.min(...occupied.map(o=>Math.hypot(o.x-p[0],o.z-p[1])))>Math.min(...occupied.map(o=>Math.hypot(o.x-best[0],o.z-best[1])))?p:best,spawns[0]),region:0};
}

export const SPAWN_ISLAND={id:'hatchery-atoll',name:'Relay Cay',revision:3,size,navCell:1.5,navMax:20,theme:'royale',sky:0xaedcea,ground:0x81b178,accent:0xf6cc66,boxes,props,trees,navLinks,spawns,pickups:[],floorLoot:[],chests:[],buildings:[],shelters:[],lanes:[],landmarks:[],bases:[[-20,0],[20,0]],zone:[0,0,0],districts:[{name:'Relay Cay',x:0,z:0,color:0xf1cd7a}],roads:[{kind:'path',width:5,points:[[-30,-8],[0,-8],[30,-8]]}],signs:[{text:'KESTREL DEPARTURES',x:0,y:6.1,z:-21},{text:'FIRING RANGE',x:31,y:6,z:5},{text:'MOVEMENT COURSE',x:-24,y:5.7,z:19}],terrain:{size,cell,n,heights,max:3.2}};
