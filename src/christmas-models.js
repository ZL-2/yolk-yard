import * as T from 'three';

const red='#ab243e', green='#205849', white='#f6e9d8', gold='#dbab51', dark='#1e342f';
function star(group,part,x,y,z,radius,angle=0){
 const point=new T.Shape();
 for(let i=0;i<10;i++){
  const a=Math.PI/2+i*Math.PI/5,r=i%2?radius*.45:radius;
  if(i===0)point.moveTo(Math.cos(a)*r,Math.sin(a)*r);
  else point.lineTo(Math.cos(a)*r,Math.sin(a)*r);
 }
 point.closePath();
 const geometry=new T.ExtrudeGeometry(point,{depth:.015,bevelEnabled:false});
 const mesh=part(group,geometry,gold,x,y,z,'metal');
 mesh.rotation.z=angle;
}
function parcel(group,{box},x,y,z,w,h,d,color,ribbon){
 box(group,color,x,y,z,w,h,d,'paint');
 box(group,ribbon,x,y,z,w*.15,h*1.035,d*1.04,'cloth');
 box(group,ribbon,x,y,z,w*1.035,h*1.045,d*.16,'cloth');
 for(const side of [-1,1]){
  const loop=box(group,ribbon,x+side*w*.125,y+h*.54,z,w*.24,h*.10,d*.17,'cloth');
  loop.rotation.z=side*.32;
 }
}
export function dressChristmasGear(group,slot,kit){
 const {part,box,tube}=kit;
 if(slot==='pickaxe'){
  // Equal-length sections follow the same candy-cane curve. Each pair shares
  // its join so the red and ivory bands remain readable from the player camera.
  const curve=new T.CurvePath();
  curve.add(new T.LineCurve3(new T.Vector3(0,-.65,0),new T.Vector3(0,.62,0)));
  curve.add(new T.CubicBezierCurve3(new T.Vector3(0,.62,0),new T.Vector3(0,1.27,0),new T.Vector3(.64,1.27,0),new T.Vector3(.64,.66,0)));
  for(let i=0;i<24;i++){
   const a=curve.getPointAt(i/24).toArray(),b=curve.getPointAt((i+1)/24).toArray();
   tube(group,i%2?red:white,a,b,.055,'paint');
   part(group,new T.SphereGeometry(.055,8,5),i%2?red:white,...a,'paint');
  }
  tube(group,dark,[0,-.60,0],[0,-.22,0],.066,'rubber');
  for(const y of [-.60,-.52,-.44,-.36,-.28,-.22])tube(group,gold,[0,y,0],[0,y+.017,0],.073,'metal');
  part(group,new T.SphereGeometry(.063,10,7),gold,.64,.66,0,'metal');
 }else if(slot==='backbling'){
  box(group,dark,0,0,-.04,.40,.53,.08,'polymer');
  parcel(group,kit,-.035,-.105,.105,.43,.26,.25,red,gold);
  parcel(group,kit,.087,.122,.093,.24,.21,.20,green,white);
  parcel(group,kit,-.148,.089,.104,.16,.145,.185,'#305677','#e9bf72');
  for(const side of [-1,1]){
   tube(group,dark,[side*.21,-.27,.08],[side*.21,.24,.09],.021,'metal');
   tube(group,gold,[side*.17,-.233,.255],[side*.17,.205,.23],.012,'cloth');
  }
  box(group,white,.065,-.093,.246,.125,.068,.009,'cloth').rotation.z=.16;
 }else if(slot==='glider'){
  box(group,red,0,3.05,-.05,1.60,.22,1.95,'paint');
  box(group,green,0,3.28,.62,1.52,.36,.24,'cloth');
  box(group,dark,0,3.22,.43,1.24,.115,.55,'cloth');
  box(group,red,0,3.24,-.92,1.43,.36,.38,'paint').rotation.x=-.28;
  star(group,part,0,3.40,-1.14,.20);
  for(const side of [-1,1]){
   const x=side*.78;
   box(group,red,x,3.26,-.14,.15,.34,1.62,'paint');
   tube(group,gold,[x,3.45,-.95],[x,3.45,.73],.028);
   const runners=[[x,2.73,1.11],[x,2.69,.77],[x,2.68,-.75],[x,2.73,-1.11],[x,2.85,-1.37],[x,3.03,-1.43],[x,3.19,-1.30]];
   const curve=new T.CatmullRomCurve3(runners.map(p=>new T.Vector3(...p)));
   part(group,new T.TubeGeometry(curve,24,.048,7,false),gold,0,0,0,'metal');
   for(const z of [-.50,.60])tube(group,gold,[x,2.73,z],[x,2.99,z],.027);
   tube(group,white,[x,3.04,-.54],[side*.33,1.96,-.06],.012,'cloth');
   tube(group,white,[x,3.04,.54],[side*.33,1.96,-.06],.012,'cloth');
   box(group,dark,side*.33,1.94,-.06,.14,.08,.12,'rubber');
  }
  parcel(group,kit,-.35,3.38,.26,.35,.40,.40,green,gold);
  parcel(group,kit,.27,3.32,.07,.45,.27,.37,white,red);
 }else if(slot==='trail'){
  const segments=18;
  for(const side of [-1,1]){
   const points=Array.from({length:segments},(_,i)=>new T.Vector3(
    side*(.39+i*.023)+Math.sin(i*.54)*.12,1.1+i*.15,.19+Math.cos(i*.54)*.12
   ));
   const path=new T.CatmullRomCurve3(points);
   for(let i=0;i<3;i++){
    const ribbon=new T.CatmullRomCurve3(path.getPoints(18).slice(i*6,i*6+7));
    part(group,new T.TubeGeometry(ribbon,6,.023,4,false),side<0?red:'#86e5c4',0,0,0,'paint');
   }
   for(let i=1;i<segments;i+=3){
    const {x,y,z}=points[i];
    star(group,part,x+side*.10,y,z,.075,i*.53);
    part(group,new T.OctahedronGeometry(.042),white,x-side*.13,y+.075,z-.03,'paint').rotation.z=i;
   }
  }
 }
 return group;
}

export function peppermintBand(x,y){
 const stripe=(4*x+3*y)%128;
 if(y<4||y>123||stripe<7)return 2;
 return stripe<46?1:0;
}
