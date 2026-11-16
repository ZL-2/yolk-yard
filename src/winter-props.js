import * as T from 'three';

const pine=new T.ConeGeometry(1,1,9);
const bulb=new T.IcosahedronGeometry(1,0);
pine.userData.shared=bulb.userData.shared=true;
const lights=[0xff696a,0xffdb7c,0x7fe4cf,0xfff3cb].map(color=>new T.MeshBasicMaterial({color,toneMapped:false}));
for(const material of lights)material.userData.shared=true;
function lamp(group,x,y,z,size,color){
 const mesh=new T.Mesh(bulb,lights[color%lights.length]);
 mesh.position.set(x,y,z);
 mesh.scale.setScalar(size);
 group.add(mesh);
}

export function winterProp(group,p,{block:B,cylinder:C,beam},detail){
 const {kind,x,y,z,w,h,d}=p;
 if(kind==='winter-lantern'){
  C(group,x,y+h*.45,z,.052,h*.9,0x263a43,8,'metal');
  B(group,x,y+h*.85,z,w*.77,.36,d*.77,0x263a43,'metal');
  lamp(group,x,y+h*.84,z,.165,1);
  B(group,x,y+h*.96,z,w,.08,d,0xd5e8ec,'paint');
 }else if(kind==='winter-parcel'){
  const color=[0x9b313e,0x1d6457,0x31527b][p.seed%3];
  B(group,x,y+h*.48,z,w,h*.96,d,color,'paint');
  B(group,x,y+h*.965,z,w*1.045,.07,d*1.045,color,'paint');
  B(group,x,y+h*.49,z,w*.18,h,d*1.025,0xdfb663,'paint');
  B(group,x,y+h*.49,z,w*1.025,h,d*.18,0xdfb663,'paint');
  beam(group,[x-.18,y+h+.03,z],[x+.18,y+h+.14,z],.06,0xf4d582,'paint');
  beam(group,[x-.18,y+h+.14,z],[x+.18,y+h+.03,z],.06,0xf4d582,'paint');
 }else if(kind==='winter-spruce'){
  const foliage=new T.MeshLambertMaterial({color:0x244f48});
  const snow=new T.MeshLambertMaterial({color:0xd3e5ed});
  C(group,x,y+h*.12,z,w*.052,h*.24,0x604234,9,'bark');
  for(let tier=0;tier<5;tier++){
   const radius=w*(.49-tier*.071),cy=y+h*(.31+tier*.125),height=h*(.42-tier*.035);
   for(const [scale,raise,material] of [[1,0,foliage],[.80,.067,snow]]){
    const b=new T.Mesh(pine,material);
    b.position.set(x,cy+h*raise,z);b.scale.set(radius*scale,height*(1-raise*3),radius*scale);
    b.rotation.y=tier*1.2;b.castShadow=true;group.add(b);
   }
   const count=detail?9:5;
   for(let i=0;i<count;i++){
    const a=(i/count+tier*.39)*Math.PI*2;
    lamp(group,x+Math.cos(a)*radius*.88,cy-height*.31,z+Math.sin(a)*radius*.88,w*.033,i+tier);
   }
  }
  const star=new T.Mesh(bulb,lights[1]);star.position.set(x,y+h*.99,z);star.scale.set(w*.08,h*.064,w*.08);group.add(star);
 }else if(kind==='winter-transmitter'){
  const base=0x2e495b,silver=0x97b6c3;
  B(group,x,y+.25,z,w,.5,d,base,'metal');
  for(const side of [-1,1]){
   C(group,x+side*.51,y+h*.49,z,.075,h*.85,silver,8,'metal');
   beam(group,[x+side*.50,y+.5,z],[x-side*.50,y+h*.39,z],.055,silver,'metal');
   beam(group,[x+side*.50,y+h*.39,z],[x-side*.50,y+h*.72,z],.055,silver,'metal');
  }
  for(const level of [.4,.72,.87])B(group,x,y+h*level,z,1.25,.10,.32,base,'metal');
  const reflector=new T.Mesh(pine,new T.MeshLambertMaterial({color:0xe2edf2}));
  reflector.scale.set(1.06,.52,1.06);reflector.position.set(x,y+h*.85,z);reflector.rotation.x=Math.PI*.67;group.add(reflector);
  lamp(group,x,y+h*.985,z,.20,2);
 }else if(kind==='winter-board'){
  for(const side of [-1,1])B(group,x+side*w*.40,y+h*.4,z,.09,h*.80,.12,0x344b57,'metal');
  B(group,x,y+h*.74,z,w,h*.47,.13,0x213847,'metal');
  B(group,x,y+h*.98,z,w*1.05,.075,.19,0xc6e1ed,'paint');
  if(typeof document==='undefined'||!p.message)return true;
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=252;
  const ctx=canvas.getContext('2d');
  if(!ctx)return true;
  ctx.fillStyle='#172b39';ctx.fillRect(0,0,640,252);
  ctx.fillStyle='#f0c16f';ctx.fillRect(24,22,592,6);ctx.fillRect(24,222,592,6);
  ctx.textAlign='center';ctx.textBaseline='middle';
  const [title,body]=p.message.split(' / ');
  ctx.fillStyle='#f0c16f';ctx.font='bold 44px sans-serif';ctx.fillText(title,320,86,565);
  ctx.fillStyle='#e8f6ff';ctx.font='bold 36px sans-serif';ctx.fillText(body||'',320,161,565);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const panel=new T.Mesh(new T.PlaneGeometry(w*.97,h*.43),new T.MeshBasicMaterial({map:texture}));
  panel.position.set(x,y+h*.74,z+.073);
  panel.userData.keepDynamic=true;panel.userData.ownedMaterial=true;group.add(panel);
 }else return false;
 return true;
}
