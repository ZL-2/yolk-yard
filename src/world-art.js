// Original military infrastructure. All parts are merged with their static chunk.
export function frontierProp(g,p,k){
 const {block:B,cylinder:C,beam,cone,rock}=k,{kind,x,y,z,w,d,h}=p;
 if(kind==='vault-rack'){
  for(const zz of [-d/2,d/2])for(const xx of [-w/2,w/2])B(g,x+xx,y+h/2,z+zz,.09,h,.09,0x70898b);
  for(let level=0;level<3;level++){const yy=y+.3+level*1.1;B(g,x,yy,z,w,.12,d,0x5a737a);for(let j=-2;j<=2;j++){B(g,x,yy+.35,z+j*2.2,w*.85,.6,1.5,j%2?0x69785c:0x3e606d);B(g,x+(x>117?-.81:.81),yy+.36,z+j*2.2,.03,.16,.5,0xd3bb74);}}
 }else if(kind==='gantry'||kind==='headframe'){
  const spread=kind==='gantry'?9:4;
  for(const side of [-1,1]){B(g,x+side*spread,y+h/2,z,.8,h,.8,0x9c885b);for(let j=0;j<h-2;j+=3)beam(g,[x+side*spread,y+j,z],[x-side*spread,y+j+3,z],.10,0x576c71);}
  B(g,x,y+h,z,spread*2+8,1,3.6,0xb7a15b);B(g,x+spread,y+h-1.1,z,3,2.2,2.4,0x344d5b);beam(g,[x+2,y+h,z],[x+2,y+3,z],.055,0x253944);B(g,x+2,y+2.6,z,1.3,.5,1.3,0x34464a);
 }else if(kind==='watchtower'||kind==='water-tower'){
  for(const sx of [-1,1])for(const sz of [-1,1])beam(g,[x+sx*w*.45,y,z+sz*d*.45],[x+sx*w*.3,y+h-4,z+sz*d*.3],.15,0x647169);
  for(let yy=2;yy<h-4;yy+=4)for(const sz of [-1,1])beam(g,[x-w*.4,y+yy,z+sz*d*.4],[x+w*.4,y+yy+3,z+sz*d*.4],.09,0x5e6e64);
  if(kind==='water-tower'){C(g,x,y+h-2.4,z,w*.65,4.8,0x8da7a3,12);cone(g,x,y+h+.35,z,w*.67,.9,0x4e6e72);}
  else{B(g,x,y+h-3.7,z,w+2,.4,d+2,0x766445);B(g,x,y+h-2,z,w,3.1,d,0x627565);for(const side of [-1,1])B(g,x,y+h-1.9,z+side*(d/2+.03),w*.85,1.3,.08,0x90b5b5);const roof=B(g,x,y+h,z,w+2,.3,d+2,0x344e46);roof.rotation.z=.08;}
 }else if(kind==='tent'||kind==='medical-tent'){
  for(const side of [-1,1]){const panel=B(g,x+side*w*.25,y+h*.58,z,w*.58,.12,d,kind==='medical-tent'?0x879b89:0x6a735a);panel.rotation.z=-side*.8;beam(g,[x+side*w*.5,y,z-d/2],[x,y+h,z-d/2],.07,0xb8bea5);}
  B(g,x,y+.18,z,w,.36,d,0x535f50);if(kind==='medical-tent'){B(g,x,y+h-.5,z+d/2+.02,1,.2,.06,0xe5d4b5);B(g,x,y+h-.5,z+d/2+.04,.22,1,.06,0xe5d4b5);}
 }else if(kind==='checkpoint'){
  for(const side of [-1,1])B(g,x+side*w*.42,y+.9,z,.5,1.8,.7,0x6e7c78);
  B(g,x,y+1.4,z,w,.22,.25,0xbda862);for(let i=0;i<7;i++)B(g,x-w*.4+i*w*.8/6,y+1.4,z+.14,.22,.22,.03,i%2?0xc5ad60:0x30444c);
  B(g,x-w*.35,y+.6,z+1.2,1.6,1.2,1,0x788b7c);
 }else if(kind==='wreck'){
  const hull=B(g,x,y+h*.4,z,w*.7,h*.55,d*.8,0x424f54);hull.rotation.z=.13;const wing=B(g,x+w*.2,y+.45,z,w*.55,.2,d*1.6,0x687771);wing.rotation.y=.3;
  B(g,x-w*.4,y+h*.8,z,.3,h,d*.7,0x66766d);for(const side of [-1,1])C(g,x,y+.7,z+side*d*.45,.55,1.3,0x1f343c,8);rock(g,x+w*.4,y+.3,z+d*.3,1.3,.6,1.5,0x333f3d);
 }else if(kind==='excavator'){
  for(const side of [-1,1])B(g,x+side*w*.35,y+.5,z,w*.28,1,d*.85,0x384545);
  B(g,x,y+1.3,z,w,1,d*.7,0xbba05b);B(g,x-w*.2,y+2.6,z-d*.1,w*.45,1.8,d*.4,0x748b8b);B(g,x-w*.2,y+2.7,z+d*.12,w*.4,1.2,.05,0x324f5b);
  beam(g,[x+w*.3,y+2,z],[x+w*.5,y+h,z-d*.7],.24,0xc1a363);beam(g,[x+w*.5,y+h,z-d*.7],[x+w*.6,y+1.5,z-d*1.1],.2,0xa38b56);B(g,x+w*.6,y+1,z-d*1.1,2,1.4,1.5,0x48514c);
 }else if(kind==='logs'){
  for(let i=0;i<5;i++){const log=C(g,x+(i%3-1)*.7,y+.4+Math.floor(i/3)*.65,z,.4,d,0x756247,8);log.rotation.x=Math.PI/2;}
 }else if(kind==='bio-dome'){
  // Opaque segmented crown: silhouette without expensive transparent glass layers.
  for(let i=0;i<8;i++){const a=i*Math.PI/4;for(let j=0;j<4;j++){const t=j*Math.PI/8,t2=(j+1)*Math.PI/8;beam(g,[x+Math.cos(a)*Math.cos(t)*w*.5,y+Math.sin(t)*h,z+Math.sin(a)*Math.cos(t)*d*.5],[x+Math.cos(a)*Math.cos(t2)*w*.5,y+Math.sin(t2)*h,z+Math.sin(a)*Math.cos(t2)*d*.5],.15,0x9bbeb1);}}
  cone(g,x,y+h*.2,z,w*.48,h*.6,0x4e8279,.35);C(g,x,y+h*.9,z,.65,.6,0xcbd8af,8);
 }else return false;
 return true;
}
