import * as THREE from 'three';
import {artKit} from './royale-art.js';
import {bake} from './royale-view.js';
let template;
function makeATV(raw){
 const k=artKit(raw),g=new THREE.Group(),body=new THREE.Group();g.add(body);
 // Twin seats, cage, suspension and plow distinguish a quad from parked cars.
 k.rounded(body,0,.68,0,1.24,.38,1.85,0xe69335,.1);
 k.rounded(body,0,.81,-.82,1.4,.22,.55,0xf2ad47,.08);
 k.rounded(body,0,.94,.16,.54,.22,1.06,0x23333b,.07);
 k.block(body,0,.43,0,1,.23,1.5,0x293d46);
 k.rounded(body,0,.57,-1.26,1.56,.7,.22,0x456273,.08);
 for(const x of [-.6,-.2,.2,.6])k.block(body,x,.57,-1.4,.05,.48,.03,0x9eabb0);
 k.beam(body,[-.67,.74,.9],[.67,.74,.9],.065,0xc4cecb);
 k.beam(body,[-.67,.74,.9],[-.67,.47,.74],.055,0x4c6770);k.beam(body,[.67,.74,.9],[.67,.47,.74],.055,0x4c6770);
 k.beam(body,[0,.87,-.56],[0,1.28,-.63],.045,0x34474e);
 k.beam(body,[-.4,1.28,-.63],[.4,1.28,-.63],.04,0xb8c9cc);
 for(const x of [-.38,.38])k.block(body,x,.86,-1.07,.23,.12,.035,0xf6efc1);
 k.cylinder(body,0,.51,.98,.2,.17,0x5f6e78,10).rotation.x=Math.PI/2;
 for(const x of [-.45,.45])for(const z of [-.76,.76]){k.beam(body,[x,.66,z],[x*1.85,.44,z],.05,0x3d4d56);k.beam(body,[x,.75,z],[x*1.85,.55,z],.035,0xe9bd60);}
 bake(body,false,true);body.name='atv-body';
 const wheel=new THREE.Group();const tire=k.torus(wheel,0,0,0,.39,.145,0x182127);tire.rotation.y=Math.PI/2;
 const rim=k.cylinder(wheel,0,0,0,.29,.24,0x8cabb3,12);rim.rotation.z=Math.PI/2;
 for(let i=0;i<18;i++){const a=i/18*Math.PI*2,t=k.block(wheel,0,Math.sin(a)*.52,Math.cos(a)*.52,.25,.085,.14,0x253139);t.rotation.x=-a;}
 bake(wheel,false,true);wheel.traverse(o=>{if(o.geometry)o.geometry.userData.shared=true;});
 for(const [i,[x,z]]of [[-.85,-.76],[.85,-.76],[-.85,.76],[.85,.76]].entries()){const w=wheel.clone();w.name='atv-wheel-'+i;w.position.set(x,.53,z);g.add(w);}
 const flame=new THREE.Mesh(new THREE.ConeGeometry(.15,.9,8),new THREE.MeshBasicMaterial({color:0x76dfff,transparent:true,opacity:.8,depthWrite:false}));flame.name='atv-boost';flame.rotation.x=-Math.PI/2;flame.position.set(0,.5,1.25);flame.userData.ownedMaterial=true;g.add(flame);
 g.traverse(o=>{if(o.geometry)o.geometry.userData.shared=true;});return g;
}
export function updateVehicles(rv,state,local,dt){
 rv.vehicleMeshes??=new Map();const key=state.royale.matchId+':'+state.round;
 if(rv.vehicleKey!==key){for(const m of rv.vehicleMeshes.values()){m.removeFromParent();rv.view.disposeGroup(m);}rv.vehicleMeshes.clear();rv.vehicleKey=key;}
 for(const source of state.royale.vehicles||[]){
  const v=rv.view.predictedVehicle?.id===source.id?rv.view.predictedVehicle:source;
  let m=rv.vehicleMeshes.get(v.id);const near=local&&Math.hypot(local.x-v.x,local.z-v.z)<170;
  if(!m&&near){template??=makeATV(rv.kit);m=template.clone();const boost=m.getObjectByName('atv-boost');boost.material=boost.material.clone();m.userData.wheels=[0,1,2,3].map(i=>m.getObjectByName('atv-wheel-'+i));m.userData.boost=boost;rv.root.add(m);rv.vehicleMeshes.set(v.id,m);}
  if(!m)continue;m.visible=!!near&&v.health>0;if(!m.visible)continue;
  m.position.set(v.x,v.y,v.z);m.rotation.set(v.pitch||0,v.yaw,v.roll||0,'YXZ');
  for(const [i,w]of m.userData.wheels.entries()){w.rotation.x-=(v.speed||0)*dt/.53;w.rotation.y=i<2?-(v.steering||0)*.28:0;}
  m.userData.boost.visible=v.boosting;m.userData.boost.scale.y=.85+Math.sin(state.time*55)*.16;
 }
}
