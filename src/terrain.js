// Shared triangulated terrain: geometry, minimap, walking, landing, shots and bots.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const HILLS=[[-110,105,85,19],[110,-140,78,31],[-10,-184,65,22],[88,45,72,14],[-210,-40,48,16],[8,125,55,10],[-170,-135,80,7],[180,175,56,8]];
export const riverX=z=>24+Math.sin(z*.018)*22+Math.sin(z*.043)*5;
export function naturalHeight(x,z){
 let h=6+Math.sin(x*.027+Math.cos(z*.019))*1.8+Math.sin(z*.045+x*.014)*1.4;
 for(const [hx,hz,r,peak] of HILLS){const t=Math.hypot(x-hx,z-hz)/r;if(t<1)h+=peak*(1-t*t)**2;}
 // An old extraction bowl, split ridge and spring-fed lake interrupt the hills.
 const quarry=Math.hypot((x+164)/35,(z-67)/29);if(quarry<1.3)h=h*(smooth((quarry-.65)/.65))+(2.8)*(1-smooth((quarry-.65)/.65));
 const lake=Math.hypot(x-165,z+27);h=h*smooth((lake-17)/13)+.16*(1-smooth((lake-17)/13));
 // The freight port opens into a sheltered tidal inlet.
 const harbor=smooth((z-196)/12)*(1-smooth((Math.abs(x-149)-29)/13));h=h*(1-harbor)+.1*harbor;
 const river=Math.abs(x-riverX(z));h=h*smooth((river-3.5)/12)+.12*(1-smooth((river-3.5)/12));
 const edge=(Math.abs(x/254)**4+Math.abs(z/254)**4)**.25;
 return Math.max(0,h*smooth((1-edge)/.13));
}
export function terrainColor(map,x,z){
 const h=groundAt(map,x,z),edge=(Math.abs(x/254)**4+Math.abs(z/254)**4)**.25;
 if(h<.7)return 0x429aa8;
 if(h<2||edge>.925)return 0xddc88e;
 if(Math.hypot((x+164)/44,(z-67)/40)<1.25)return h<6?0xb5a88d:0x9da397;
 if(h>24)return 0x9bab95;
 if(x<-38&&z>93)return 0x668f66;
 if(x<-95&&z<-85)return 0xabb26c;
 return h>14?0x88a477:0x81b178;
}
export function createTerrain(buildings=[],districts=[],shelters=[]){
 const size=256,cell=2,n=257,heights=new Float32Array(n*n);let max=0;
 const pads=[...buildings,...shelters];
 for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){
  const x=ix*cell-size,z=iz*cell-size;let h=naturalHeight(x,z);
  // A neighboring pad must never tilt the floor of a closer building.
  let nearest=null,nearestDistance=Infinity;
  for(const p of pads){const distance=Math.max(Math.abs(x-p.x)-(p.w||8)/2,Math.abs(z-p.z)-(p.d||8)/2);if(distance<nearestDistance){nearest=p;nearestDistance=distance;}}
  if(nearest&&nearestDistance<9){const flat=1-smooth((nearestDistance-2)/7),level=(nearest.baseY??naturalHeight(nearest.x,nearest.z))-.2;h=h*(1-flat)+level*flat;}
  heights[iz*n+ix]=h;max=Math.max(max,h);
 }
 return {size,cell,n,heights,max};
}
export function groundAt(map,x,z) {
  const t=map.terrain;if(!t)return 0;
  const gx=Math.max(0,Math.min(t.n-1.000001,(x+t.size)/t.cell)),gz=Math.max(0,Math.min(t.n-1.000001,(z+t.size)/t.cell));
  const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*t.n+ix;
  const a=t.heights[i],b=t.heights[i+1],c=t.heights[i+t.n],d=t.heights[i+t.n+1];
  return u+v<=1 ? a+(b-a)*u+(c-a)*v : d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function terrainHit(map,o,d,max=200,radius=0) {
  if(!map.terrain){
    if(d.y>=0)return null;const distance=(radius-o.y)/d.y;
    return distance>=0&&distance<=max?{distance,point:{x:o.x+d.x*distance,y:radius,z:o.z+d.z*distance},normal:{x:0,y:1,z:0}}:null;
  }
  if(max<0||Math.min(o.y,o.y+d.y*max)>map.terrain.max+radius)return null;
  const clearance = s => o.y+d.y*s-radius-groundAt(map,o.x+d.x*s,o.z+d.z*s);
  let prev=0,hit=clearance(0)<=0?0:null;
  const steps=Math.max(1,Math.ceil(max*Math.max(Math.hypot(d.x,d.z),Math.abs(d.y))/1));
  for(let i=1;hit===null&&i<=steps;i++){
    const at=max*i/steps;
    if(clearance(at)<=0){let a=prev,b=at;for(let j=0;j<10;j++){const m=(a+b)/2;if(clearance(m)>0)a=m;else b=m;}hit=b;}
    prev=at;
  }
  if(hit===null)return null;
  const point={x:o.x+d.x*hit,y:o.y+d.y*hit,z:o.z+d.z*hit};
  const nx=(groundAt(map,point.x-.1,point.z)-groundAt(map,point.x+.1,point.z))/.2;
  const nz=(groundAt(map,point.x,point.z-.1)-groundAt(map,point.x,point.z+.1))/.2, l=Math.hypot(nx,1,nz);
  return {distance:hit,point,normal:{x:nx/l,y:1/l,z:nz/l}};
}
