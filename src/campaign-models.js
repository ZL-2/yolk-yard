import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original rigid-joint field gear. Geometry is shared by every patrol member.
export function createModels(){
 const geometries=new Set(),materials=new Set(),templates=new Map();
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.69,metalness:.2});materials.add(material);
 function maker(){
  const pieces=[];
  const part=(geometry,color,x,y,z,rotation=[0,0,0])=>{geometry.rotateX(rotation[0]);geometry.rotateY(rotation[1]);geometry.rotateZ(rotation[2]);geometry.translate(x,y,z);const c=new T.Color(color),v=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<v.length;i+=3){v[i]=c.r;v[i+1]=c.g;v[i+2]=c.b;}geometry.setAttribute('color',new T.BufferAttribute(v,3));pieces.push(geometry);};
  const box=(x,y,z,w,h,d,color,round=.02)=>part(new RoundedBoxGeometry(w,h,d,1,Math.min(round,w/4,h/4,d/4)),color,x,y,z);
  const sphere=(x,y,z,w,h,d,color)=>{const g=new T.SphereGeometry(1,12,8);g.scale(w,h,d);part(g,color,x,y,z);};
  const cylinder=(x,y,z,r,length,color,rotation=[Math.PI/2,0,0])=>part(new T.CylinderGeometry(r,r,length,12),color,x,y,z,rotation);
  const finish=()=>{const non=pieces.map(g=>g.index?g.toNonIndexed():g);const geo=mergeGeometries(non);pieces.forEach(g=>g.dispose());non.forEach(g=>g.dispose());geometries.add(geo);const mesh=new T.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;};
  return {box,sphere,cylinder,finish};
 }
 function weapon(pistol=false){
  const id=pistol?'pistol':'rifle';if(templates.has(id))return templates.get(id).clone(true);
  const g=new T.Group(),b=maker(),black='#242c2d',steel='#586265',poly='#444c42';
  if(pistol){b.box(0,0,-.11,.073,.11,.25,black);b.box(0,-.08,.015,.065,.16,.1,poly);b.cylinder(0,.015,-.3,.025,.2,steel);b.box(0,.061,-.15,.02,.015,.015,'#b7c4a7');b.box(0,.067,-.02,.035,.014,.025,black);}
  else{
   b.box(0,0,-.17,.1,.13,.3,black);b.box(0,.005,-.46,.085,.09,.32,poly);b.box(0,-.12,-.05,.067,.18,.085,poly);b.box(0,.0,.11,.075,.09,.2,steel);b.box(0,-.025,.23,.1,.18,.10,poly);b.cylinder(0,.015,-.72,.021,.25,steel);b.cylinder(0,.015,-.92,.036,.2,black);
   b.box(0,.082,-.24,.055,.035,.5,steel);for(let z=-.47;z<.01;z+=.025)b.box(0,.102,z,.07,.012,.012,black,.002);
   for(const x of [-.044,.044])for(let z=-.57;z<-.3;z+=.045)b.box(x,.017,z,.005,.035,.028,black,.001);
   b.box(.06,.02,-.13,.025,.035,.07,steel);b.box(.055,-.02,-.18,.016,.036,.11,black);b.box(.065,.02,-.29,.055,.045,.11,black);
   // Open reflex optic leaves an unobstructed view through the centre.
   for(const x of [-.036,.036])b.box(x,.16,-.13,.012,.09,.045,black,.005);b.box(0,.205,-.13,.084,.012,.045,black,.004);b.box(0,.115,-.13,.08,.018,.075,black,.004);
   b.cylinder(.058,-.02,-.47,.022,.13,steel);b.box(0,-.085,-.42,.043,.07,.10,poly);
  }
  g.add(b.finish());
  const mag=maker();mag.box(0,-.105,pistol?.0:-.17,pistol?.052:.065,pistol?.13:.22,pistol?.075:.13,poly);const magazine=mag.finish();magazine.name='magazine';g.add(magazine);
  templates.set(id,g);return g.clone(true);
 }
 function soldier(){
  if(!templates.has('soldier')){
   const root=new T.Group(),rig=new T.Group();rig.name='rig';root.add(rig);
   const color='#414b40',dark='#202a28',pad='#323c37',strap='#8d8a70';
   const body=maker();body.box(0,1.16,0,.38,.46,.22,color,.06);body.box(0,1.24,-.13,.36,.36,.08,pad);body.box(0,1.22,.14,.33,.35,.13,dark);body.box(0,.97,0,.38,.055,.26,dark);for(const x of [-.12,0,.12])body.box(x,1.18,-.196,.095,.15,.075,strap);for(const x of [-.15,.15])body.box(x,1.37,-.14,.045,.12,.05,strap);body.box(.22,1.03,.02,.085,.13,.16,pad);body.box(-.22,1.03,.02,.08,.14,.13,pad);rig.add(body.finish());
   const head=maker();head.sphere(0,1.61,0,.125,.17,.12,'#605c4f');head.sphere(0,1.7,.012,.15,.10,.145,pad);head.box(0,1.61,-.115,.21,.072,.03,'#182429');head.box(0,1.525,-.09,.17,.11,.085,dark);for(const x of [-.145,.145])head.box(x,1.61,0,.045,.10,.10,dark);head.box(0,1.74,-.14,.075,.055,.055,dark);rig.add(head.finish());
   for(const side of [-1,1]){
    const hip=new T.Group();hip.name=side<0?'leftLeg':'rightLeg';hip.position.set(side*.115,.91,0);const thigh=maker();thigh.box(0,-.19,0,.17,.42,.20,color,.055);thigh.box(side*.075,-.14,.025,.06,.15,.15,pad);thigh.box(0,-.37,-.10,.13,.13,.04,pad);hip.add(thigh.finish());
    const knee=new T.Group();knee.name=side<0?'leftKnee':'rightKnee';knee.position.y=-.40;const shin=maker();shin.box(0,-.19,.0,.13,.36,.15,color,.04);shin.box(0,-.37,-.055,.15,.13,.26,dark,.03);knee.add(shin.finish());hip.add(knee);rig.add(hip);
    const arm=new T.Group();arm.name=side<0?'leftArm':'rightArm';arm.position.set(side*.24,1.38,0);const upper=maker();upper.box(0,-.13,0,.15,.29,.16,color,.04);upper.box(side*.06,-.07,-.01,.035,.095,.10,strap);arm.add(upper.finish());const elbow=new T.Group();elbow.position.y=-.27;const fore=maker();fore.box(0,-.12,0,.12,.26,.14,color,.04);fore.box(0,-.265,0,.10,.09,.12,dark,.025);elbow.add(fore.finish());elbow.rotation.x=-1.30;arm.rotation.x=-.65;arm.rotation.z=side*-.16;arm.add(elbow);rig.add(arm);
   }
   const gun=weapon();gun.position.set(.09,1.21,-.35);gun.scale.setScalar(.8);rig.add(gun);templates.set('soldier',root);
  }
  const root=templates.get('soldier').clone(true);root.userData={rig:root.getObjectByName('rig'),left:root.getObjectByName('leftLeg'),right:root.getObjectByName('rightLeg'),lk:root.getObjectByName('leftKnee'),rk:root.getObjectByName('rightKnee')};return root;
 }
 function arms(){
  const b=maker();for(const side of [-1,1]){b.box(side*(side<0?.11:.15),-.18,side<0?-.48:.04,.11,.12,.15,'#303a34',.03);const a=maker();}
  b.box(.16,-.28,.12,.14,.32,.19,'#4a5142',.045);b.box(-.14,-.25,-.32,.13,.13,.34,'#4a5142',.04);b.box(.16,-.14,.02,.10,.09,.10,'#242c2b');b.box(-.10,-.16,-.44,.11,.085,.16,'#242c2b');return b.finish();
 }
 function helicopter(){
  const group=new T.Group(),b=maker();b.sphere(0,1,0,1.1,1.05,2.25,'#343f3d');b.sphere(0,1.35,-1.2,.98,.61,1.05,'#1a3036');b.box(0,.6,0,1.8,.7,2.5,'#323d38',.2);b.box(0,1.1,3.8,.3,.4,5.7,'#37423d');b.box(0,2.2,6.4,.15,2.1,1,'#37423d');b.box(0,1.2,5.7,3.5,.10,.7,'#424c45');b.box(0,2.15,.4,1.2,.65,2,'#303938',.15);for(const x of [-1.3,1.3]){b.box(x,-.3,0,.12,.12,3.8,'#252e2d');b.box(x,-.02,-.8,.09,.55,.1,'#3c4743');b.box(x,-.02,1,.09,.55,.1,'#3c4743');b.box(x,1,0,.1,1.3,1.4,'#18252a');}group.add(b.finish());const rotor=new T.Group(),blade=maker();blade.box(0,2.8,0,12,.045,.32,'#202b28');blade.box(0,2.8,0,.32,.045,12,'#202b28');blade.cylinder(0,2.55,0,.12,.5,'#424c45',[0,0,0]);rotor.add(blade.finish());group.add(rotor);group.userData.rotor=rotor;return group;
 }
 return {weapon,soldier,arms,helicopter,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}

export function animateSoldier(root,time,speed,dead=0){
 const {rig,left,right,lk,rk}=root.userData;
 if(dead){rig.rotation.x=-Math.min(1,dead*2)*Math.PI/2;rig.position.y=-Math.min(.7,dead*.8);return;}
 rig.rotation.x=0;rig.position.y=Math.abs(Math.sin(time*8))*Math.min(.035,speed*.02);const stride=Math.sin(time*7)*Math.min(.5,speed*.23);left.rotation.x=stride;right.rotation.x=-stride;lk.rotation.x=Math.max(0,-stride)*1.2;rk.rotation.x=Math.max(0,stride)*1.2;
}
