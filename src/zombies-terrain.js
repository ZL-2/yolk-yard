import * as T from 'three';
import {groundAt} from './terrain.js';
const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
// Meter-based terrain is shared by movement, bullets, navigation and rendering.
// Roads and foundations remain flat; slopes occupy the intervening landscape.
export function makeBlacktideTerrain(buildings, stations, zones) {
 const size=180,cell=2,n=181,heights=new Float32Array(n*n);
 const pads=[...buildings.map(b=>({...b,margin:5})),...stations.map(s=>({...s,w:7,d:7,margin:4}))];
 let max=0;
 for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){
  const x=ix*cell-size,z=iz*cell-size;
  let h=.8+Math.sin(x*.037)*Math.cos(z*.031)*.65;
  for(const [cx,cz,r,height]of [[-148,-66,32,8],[-66,-146,28,7],[153,-68,30,8],[62,-145,27,6],[150,62,27,4],[-145,65,24,3]]){const d=Math.hypot(x-cx,z-cz)/r;if(d<1)h+=height*(1-d*d)**2;}
  let fade=1;
  for(const road of [-162,-54,54,162])fade=Math.min(fade,smooth((Math.min(Math.abs(x-road),Math.abs(z-road))-6)/7));
  for(const zone of zones)if(Math.abs(x-zone.x)<50&&Math.abs(z-zone.z)<50)fade=Math.min(fade,smooth((Math.min(Math.abs(x-zone.x),Math.abs(z-zone.z))-6)/6));
  for(const p of pads){const d=Math.max(Math.abs(x-p.x)-(p.w||0)/2,Math.abs(z-p.z)-(p.d||0)/2);if(d<p.margin+7)fade=Math.min(fade,smooth((d-p.margin)/7));}
  h=Math.max(0,h*fade);heights[iz*n+ix]=h;max=Math.max(max,h);
 }
 return {size,cell,n,heights,max};
}
export function blacktideTerrainMesh(map){
 const t=map.terrain,g=new T.PlaneGeometry(360,360,t.n-1,t.n-1);g.rotateX(-Math.PI/2);
 const p=g.attributes.position,colors=new Float32Array(p.count*3),c=new T.Color();
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=groundAt(map,x,z);p.setY(i,y-.012);const shade=.92+Math.sin(x*.9+z*.7)*.04;c.setHex(y>4?0x65736a:z<-65?0x53664c:0x6b7963).multiplyScalar(shade);colors.set([c.r,c.g,c.b],i*3);}
 g.setAttribute('color',new T.BufferAttribute(colors,3));g.computeVertexNormals();
 const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0}));m.receiveShadow=true;m.userData.ownedMaterial=true;return m;
}
// Low-cost static interior plans share collision data with the world renderer.
export function furnishBlacktide(buildings, protectedPoints){
 const boxes=[];
 for(const b of buildings){
  const add=(dx,dz,w,d,h,y=0,kind='furniture')=>{const x=b.x+dx,z=b.z+dz;if(protectedPoints.some(s=>Math.abs(s.x-x)<w/2+1.5&&Math.abs(s.z-z)<d/2+1.5))return;boxes.push({x,z,w,d,h,y,kind,color:'concrete',building:b.id});};
  const side=b.w/2-1.6,end=b.d/2-2;
  if(['warehouse','hangar'].includes(b.kind)){for(const x of [-side,side])for(const z of [-end,0,end])add(x,z,2.2,2.8,2.4,0,'shelves');add(-side+3,-end,3,2,1.4,0,'pallet');}
  else if(['clinic','hospital'].includes(b.kind)){for(const x of [-side+1,side-1])for(const z of [-end+2,end-2]){add(x,z,2.4,1.3,.65,0,'bed');add(x,z+1.7,2.7,.12,2.1,0,'curtain');}}
  else if(['lab','vault','reactor'].includes(b.kind)){for(const x of [-side,side])for(const z of [-end,0,end])add(x,z,1.2,1.6,2.2,0,'server');add(side-3,end,2.4,1.2,1,0,'workbench');}
  else if(b.kind==='shop'){for(const z of [-end,end])for(const x of [-side+2,side-2]){add(x,z,2,1,.75,0,'table');add(x,z-1.1,1.5,.45,.85,0,'booth');}add(-side,0,1,5,1.1,0,'counter');}
  else if(['cabin','barracks','apartments'].includes(b.kind)){add(-side,-end,2.1,3,.65,0,'bed');add(side,end,2,1,.9,0,'dresser');add(side,-end,1.5,1,2,0,'shelves');}
  else{for(const x of [-side+1,side-1]){add(x,-end,3,1.2,.8,0,'workbench');add(x,end,3,1,2,0,'shelves');}add(-side,0,.5,3,1.6,0,'archive');}
  // Partial partitions create rooms without blocking the central through-route.
  if(['hospital','apartments','office','lab'].includes(b.kind))for(const s of [-1,1])add(s*(b.w/4+1),0,b.w/2-4,.18,2.4,0,'partition');
 }
 return boxes;
}
