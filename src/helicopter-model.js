import * as T from 'three';
import {modelMaterial} from './model-surfaces.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const models=new Map();
function batch(group){
 group.updateMatrixWorld(true);const bins=new Map();
 for(const m of [...group.children]){if(!m.isMesh)continue;const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!bins.has(m.material))bins.set(m.material,[]);bins.get(m.material).push(g);m.geometry.dispose();group.remove(m);}
 for(const [material,parts]of bins){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());geometry.userData.shared=true;geometry.computeBoundingSphere();const m=new T.Mesh(geometry,material);m.castShadow=m.receiveShadow=true;group.add(m);}return group;
}
function fuselage(){
 const rings=[[-2.72,.12,.12,1.3],[-2.35,.72,.43,1.4],[-1.65,1.18,.73,1.48],[-.55,1.3,.87,1.47],[.65,1.25,.83,1.45],[1.6,.90,.66,1.5],[2.15,.35,.35,1.6]],p=[],uv=[],index=[],n=28;
 for(let i=0;i<rings.length;i++)for(let j=0;j<=n;j++){const [z,rx,ry,cy]=rings[i],a=j/n*Math.PI*2;p.push(Math.cos(a)*rx,cy+Math.sin(a)*ry,z);uv.push(j/n,i/(rings.length-1));}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+n+1;index.push(a,b,a+1,b,b+1,a+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
export function makeHelicopter({detail=2,environment=null}={}){
 const key=detail+':'+(environment?.uuid||'none');if(models.has(key))return models.get(key).clone();
 const g=new T.Group();g.name='Kestrel H-05 squad helicopter';g.userData.detail=detail;g.userData.artRevision=199;
 const standard=(c,r=.5,m=.4)=>{const mat=modelMaterial(c,r>.85?'rubber':m>.6?'metal':'paint').clone();mat.roughness=r;mat.metalness=m;mat.envMap=environment;mat.envMapIntensity=.7;return mat;};
 const mats={skin:standard(0x4c625c),edge:standard(0x859b92,.38,.7),dark:standard(0x14242a,.65,.25),rubber:standard(0x141b20,.9,.05),gold:standard(0xd2b26a,.4,.65),glass:new T.MeshPhysicalMaterial({color:0x163f4f,roughness:.16,metalness:.65,clearcoat:1,envMap:environment,envMapIntensity:1.2}),white:standard(0xdbe6de,.5,.1),red:new T.MeshBasicMaterial({color:0xff5946}),green:new T.MeshBasicMaterial({color:0x6affab})};
 Object.values(mats).forEach(m=>m.userData.shared=true);
 const add=(target,geo,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,mats[mat]);m.position.set(x,y,z);target.add(m);return m;};
 const box=(target,x,y,z,w,h,d,mat='skin',bevel=.05)=>add(target,Math.min(w,h,d)>.12?new RoundedBoxGeometry(w,h,d,1,Math.min(bevel,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d),mat,x,y,z);
 const cyl=(target,x,y,z,r,h,mat='edge',n=detail>0?16:8)=>add(target,new T.CylinderGeometry(r,r,h,n),mat,x,y,z);
 const beam=(target,a,b,r,mat='edge')=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av),m=add(target,new T.CylinderGeometry(r,r,v.length(),8),mat,...av.add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;};
 add(g,fuselage(),'skin');
 // Faceted canopy follows the tapered nose with deep framing and a lower dash.
 for(const side of [-1,1]){
  const vertices=[0,2.28,-1.22,side*.96,2.04,-1.56,side*.64,1.62,-2.31,0,1.62,-2.53],geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geom.setIndex(side===1?[0,2,1,0,3,2]:[0,1,2,0,2,3]);geom.computeVertexNormals();add(g,geom,'glass');
  for(const [a,b]of [[[0,2.3,-1.2],[side*.98,2.06,-1.55]],[[side*.98,2.06,-1.55],[side*.66,1.62,-2.32]],[[0,1.62,-2.55],[side*.66,1.62,-2.32]]])beam(g,a,b,.045,'dark');
  const window=box(g,side*1.17,1.93,-.70,.035,.55,.78,'glass');window.rotation.z=-side*.09;
  beam(g,[side*1.17,1.6,-1.13],[side*1.17,2.23,-1.13],.04,'dark');beam(g,[side*1.21,1.6,-.26],[side*1.21,2.22,-.26],.04,'dark');
  box(g,side*1.28,1.48,.66,.06,.89,1.24,'dark');box(g,side*1.32,1.52,.67,.025,.62,1.04,'rubber');
  box(g,side*1.78,.34,.32,.9,.16,2.68,'dark');box(g,side*2.14,.44,.3,.07,.16,2.75,'edge');
  for(const z of [-.58,.42,1.37]){beam(g,[side*.9,.68,z],[side*1.9,.34,z],.065);beam(g,[side*1.38,.4,z],[side*1.4,1.87,z],.036,'gold');}
  const skid=beam(g,[side*1.42,.15,-2.12],[side*1.42,.15,1.9],.095,'edge');beam(g,[side*1.42,.15,-2.12],[side*1.42,.37,-2.38],.095,'edge');
  for(const z of [-1.10,1.1])beam(g,[side*.72,.83,z],[side*1.42,.21,z],.075);
  box(g,side*.62,2.32,.35,.65,.35,1.64,'skin',.12);box(g,side*.62,2.36,-.51,.51,.19,.035,'dark');
  const exhaust=cyl(g,side*.69,2.37,1.29,.19,.54,'edge');exhaust.rotation.x=Math.PI/2;const mouth=cyl(g,side*.69,2.37,1.57,.14,.02,'dark');mouth.rotation.x=Math.PI/2;
  box(g,side*1.30,1.15,-.12,.028,.16,.68,'gold');
  cyl(g,side*1.36,1.41,-.82,.048,.04,side<0?'red':'green').rotation.z=Math.PI/2;
  if(detail>0){for(let i=0;i<9;i++){box(g,side*.62,2.57,-.27+i*.13,.51,.015,.034,'dark');box(g,side*1.32,.43,-.8+i*.23,.76,.014,.04,'edge');}for(const z of [-1.05,-.2,.55,1.15])for(const y of [.94,1.27])cyl(g,side*1.27,y,z,.021,.04,'edge',6).rotation.z=Math.PI/2;}
 }
 beam(g,[0,1.64,-2.55],[0,2.31,-1.2],.05,'dark');
 // Tapered tail boom, stabilizer, service markings and exposed transmission.
 const tail=add(g,new T.CylinderGeometry(.17,.42,3.45,12),'skin',0,1.75,3.63);tail.rotation.x=Math.PI/2;
 box(g,0,2.15,5.18,.16,1.47,.67,'skin');box(g,0,2.82,5.19,.18,.13,.67,'gold');box(g,0,1.78,4.35,2.32,.10,.64,'skin');
 for(const side of [-1,1])box(g,side*1.05,1.79,4.35,.24,.12,.64,'gold');
 cyl(g,0,2.61,.07,.33,.38,'dark');cyl(g,0,2.99,.07,.1,.55,'edge');cyl(g,0,3.20,.07,.30,.12,'edge');
 for(const side of [-1,1]){beam(g,[side*.42,2.6,-.2],[side*.18,3.14,.07],.028);beam(g,[side*.40,2.61,.38],[side*.16,3.13,.07],.028);}
 box(g,0,1.02,-2.53,.40,.20,.10,'dark');box(g,0,1.05,-2.60,.27,.12,.025,'white');beam(g,[0,2.5,1.2],[0,3.15,1.8],.016,'dark');
 // Service panels, recessed latches, door runners and pressure lines.
 if(detail>0)for(const side of [-1,1]){
  for(const z of [-.16,1.30]){box(g,side*1.34,1.48,z,.035,.91,.045,'edge');for(const y of [1.18,1.86])box(g,side*1.38,y,z,.055,.10,.09,'dark');}
  box(g,side*1.34,1.98,.60,.035,.035,1.59,'edge');box(g,side*1.36,1.07,.60,.04,.035,1.59,'edge');box(g,side*1.39,1.50,.99,.07,.045,.22,'gold');
  box(g,side*1.22,.88,-.70,.035,.17,.67,'dark');for(let i=0;i<5;i++)box(g,side*1.25,.88,-.95+i*.12,.028,.13,.024,'edge');
  beam(g,[side*.95,2.16,.95],[side*.88,2.41,1.24],.03,'gold');
  for(let i=0;i<12;i++)cyl(g,side*1.31,1.02,-.10+i*.12,.015,.025,'edge',6).rotation.z=Math.PI/2;
  for(let i=0;i<8;i++)cyl(g,side*.985,1.9,-1.47+i*.12,.016,.025,'edge',6).rotation.z=Math.PI/2;
  // Twin cabin seats, a visible instrument cluster and perforated footboards.
  box(g,side*.50,.90,-.47,.51,.18,.58,'rubber');box(g,side*.50,1.22,-.18,.51,.67,.15,'dark');
  beam(g,[side*.52,.92,-.75],[side*.52,1.43,-.95],.025,'dark');box(g,side*.52,1.43,-.96,.18,.06,.06,'rubber');
  for(let i=0;i<12;i++)for(const x of [1.61,1.9])box(g,side*x,.434,-.91+i*.2,.095,.012,.035,'rubber');
 }
 box(g,0,1.50,-1.76,1.32,.12,.34,'dark');for(const x of [-.43,0,.43])box(g,x,1.57,-1.73,.30,.08,.19,'glass');
 const tailHub=cyl(g,.35,2.28,5.18,.12,.21,'edge');tailHub.rotation.z=Math.PI/2;
 beam(g,[0,1.40,4.50],[0,.88,5.36],.055,'edge');beam(g,[0,.88,5.36],[0,.96,5.65],.055,'edge');
 // Original maintenance stencils are small textures on the same gameplay mesh.
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#ddd4ab';ctx.font='900 120px sans-serif';ctx.fillText('KESTREL',28,128);ctx.font='600 34px sans-serif';ctx.fillText('H–05  /  FLIGHT OPERATIONS',34,194);ctx.fillStyle='#e8be60';ctx.fillRect(770,30,215,184);ctx.fillStyle='#263a3c';ctx.font='900 148px sans-serif';ctx.fillText('05',780,171);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.userData.shared=true;const mat=new T.MeshStandardMaterial({map,transparent:true,roughness:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});mat.userData.shared=true;
  for(const side of [-1,1]){const decal=new T.Mesh(new T.PlaneGeometry(1.06,.265),mat);decal.position.set(side*1.325,1.49,.67);decal.rotation.y=side*Math.PI/2;decal.geometry.userData.shared=true;g.add(decal);}
 }
 batch(g);
 const rotor=new T.Group();rotor.name='heli-main-rotor';rotor.position.set(0,3.29,.07);
 for(let i=0;i<4;i++){const blade=new T.Group();blade.rotation.y=i*Math.PI/2;box(blade,2.58,0,0,4.72,.05,.24,'dark');box(blade,4.74,0,-.012,.38,.055,.26,'gold');box(blade,.45,0,0,.55,.09,.16,'edge');batch(blade);rotor.add(blade);}g.add(rotor);
 const tailRotor=new T.Group();tailRotor.name='heli-tail-rotor';tailRotor.position.set(.25,2.28,5.18);for(let i=0;i<4;i++){const b=box(tailRotor,0,Math.cos(i*Math.PI/2)*.42,Math.sin(i*Math.PI/2)*.42,.05,.86,.13,'dark');b.rotation.x=i*Math.PI/2;}batch(tailRotor);g.add(tailRotor);
 for(const [name,r,x,y,z]of [['heli-blur',4.96,0,3.30,.07],['heli-tail-blur',.88,.27,2.28,5.18]]){const m=new T.Mesh(new T.RingGeometry(.23,r,40),new T.MeshBasicMaterial({color:0x263936,transparent:true,opacity:.12,depthWrite:false,side:T.DoubleSide}));m.name=name;m.position.set(x,y,z);m.rotation[name==='heli-blur'?'x':'y']=Math.PI/2;m.visible=false;m.geometry.userData.shared=true;m.material.userData.shared=true;g.add(m);}
 const dust=new T.Mesh(new T.RingGeometry(2.0,7.8,40),new T.MeshBasicMaterial({color:0xb5a886,transparent:true,opacity:.10,depthWrite:false,side:T.DoubleSide}));dust.name='heli-downwash';dust.rotation.x=-Math.PI/2;dust.position.y=.06;dust.visible=false;dust.geometry.userData.shared=true;dust.material.userData.shared=true;g.add(dust);
 // Two reusable exhaust batches, with no particles, lights or per-frame buffers.
 const boost=new T.Group();boost.name='heli-boost';boost.position.set(0,2.37,1.58);boost.visible=false;
 for(const [radius,length,color,opacity]of [[.24,2.1,0xff9638,.78],[.12,1.45,0xb7ecff,.95]]){
  const parts=[-1,1].map(side=>{const geometry=new T.ConeGeometry(radius,length,10);geometry.rotateX(Math.PI/2);geometry.translate(side*.69,0,length/2);return geometry;});
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());geometry.userData.shared=true;
  const material=new T.MeshBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});material.userData.shared=true;
  boost.add(new T.Mesh(geometry,material));
 }
 g.add(boost);
 models.set(key,g);return g.clone();
}
export function animateHelicopter(m,v,time,dt){
 const rpm=v.rotor||0;m.getObjectByName('heli-main-rotor').rotation.y+=dt*rpm*38;m.getObjectByName('heli-tail-rotor').rotation.x+=dt*rpm*73;
 m.getObjectByName('heli-blur').visible=rpm>.5;m.getObjectByName('heli-tail-blur').visible=rpm>.5;
 const dust=m.getObjectByName('heli-downwash');dust.visible=rpm>.3&&(v.grounded||v.groundClearance<7);dust.scale.setScalar(.85+Math.sin(time*9)*.05+rpm*.2);
 const boost=m.getObjectByName('heli-boost');boost.visible=!!v.boosting&&!v.falling&&!v.wrecked;boost.scale.z=.9+Math.sin(time*53)*.12+Math.sin(time*31)*.06;
}
