import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Shared by the playable weapon and every reward portrait. Two draw calls per
// tool: textured, beveled metalwork and a single unlit luminous inlay batch.
export function royalePickaxeModel(i,g,{box,tube,part,blade}){
 const glow=[],metal=i.metal,dark=i.color;
 const light=(geometry,x=0,y=0,z=0)=>{geometry.translate(x,y,z);glow.push(geometry);};
 const line=(a,b,r=.009)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start),geo=new THREE.CylinderGeometry(r,r,d.length(),6);geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));geo.translate(...start.add(end).multiplyScalar(.5).toArray());glow.push(geo);};
 const ring=(r,y,z=0,c=metal,t=.016)=>part(g,new THREE.TorusGeometry(r,t,6,32),c,0,y,z,'metal');
 const edge=(points,c=metal,depth=.075,z=0)=>{const m=blade(g,c,points,depth);m.position.z=z;return m;};
 const gem=(x,y,z,r=.045)=>{part(g,new THREE.OctahedronGeometry(r*1.4),metal,x,y,z,'metal');light(new THREE.OctahedronGeometry(r),x,y,z-.025);};
 tube(g,dark,[0,-.66,0],[0,.83,0],.043,'metal');
 for(let j=0;j<10;j++){const wrap=box(g,'#142128',0,-.49+j*.055,0,.093,.03,.096,'rubber');wrap.rotation.y=j*.24;}
 for(const y of [-.64,-.53,.10,.43]){part(g,new THREE.CylinderGeometry(.061,.061,.036,12),metal,0,y,0,'metal');}
 for(const s of [-1,1])line([s*.025,.17,-.041],[s*.025,.52,-.041],.006);
 gem(0,-.69,0,.052);
 // The rank seal is engraved as physical geometry, visible on both faces.
 for(const z of [-.078,.078]){
  const badge=part(g,new THREE.CylinderGeometry(.09,.09,.018,6),metal,0,.33,z,'metal');badge.rotation.x=Math.PI/2;
  box(g,dark,0,.33,z+Math.sign(z)*.013,.116,.09,.013,'metal');
  const letters=i.glyph.split(''),w=.032,begin=-(letters.length-1)*w/2,front=z+Math.sign(z)*.023;
  letters.forEach((letter,k)=>{const x=begin+k*w,y=.33;if(letter==='I')tube(g,metal,[x,y-.028,front],[x,y+.028,front],.004);else{tube(g,metal,[x-.012,y+.027,front],[letter==='V'?x:x+.012,y-.027,front],.004);tube(g,metal,[x+.012,y+.027,front],[letter==='V'?x:x-.012,y-.027,front],.004);}});
 }
 if(i.rank===25){
  edge([[-.12,.61],[-.16,.87],[.03,1.05],[.41,1.02],[.64,.79],[.55,.41],[.41,.52],[.45,.76],[.25,.84],[.08,.76]]);
  edge([[-.09,.65],[-.11,.85],[.05,.98],[.39,.96],[.54,.80],[.49,.55],[.48,.79],[.25,.91],[.06,.82]],dark,.088);
  edge([[-.1,.72],[-.39,.87],[-.54,.77],[-.25,.67]],metal,.06);
  for(const z of [-.054,.054]){line([.02,.89,z],[.29,.93,z]);line([.29,.93,z],[.48,.79,z]);line([.48,.79,z],[.48,.66,z]);}
  gem(.09,.84,-.068,.08);for(const x of [-.06,.23,.36])gem(x,.89,-.059,.016);
 }else if(i.rank===10){
  for(const s of [-1,1]){
   const shape=[[.13,.94],[.25,1.14],[.53,1.14],[.68,.90],[.62,.62],[.39,.42],[.48,.69],[.47,.90],[.33,.99]];
   edge(shape.map(([x,y])=>[x*s,y]),metal,.07);
   edge([[.22,.96],[.28,1.08],[.49,1.08],[.60,.89],[.55,.64],[.53,.88],[.40,1.02]].map(([x,y])=>[x*s,y]),dark,.085);
   for(const z of [-.052,.052]){line([s*.31,1.055,z],[s*.50,1.015,z]);line([s*.50,1.015,z],[s*.57,.84,z]);}
   tube(g,metal,[s*.06,.55,0],[s*.20,.72,0],.028);
  }
  ring(.19,.83,0,metal,.022);ring(.14,.83,0,dark,.018);light(new THREE.TorusGeometry(.155,.009,5,32),0,.83,-.03);gem(0,.83,0,.105);
 }else if(i.rank===5){
  edge([[-.19,.59],[-.27,.93],[-.11,1.18],[.21,1.16],[.56,1.02],[.66,.68],[.51,.41],[.24,.50],[.11,.68]],metal,.10);
  edge([[-.13,.65],[-.20,.92],[-.08,1.1],[.20,1.08],[.48,.96],[.55,.70],[.44,.52],[.25,.59],[.12,.76]],dark,.12);
  for(const z of [-.073,.073]){ring(.13,.87,z,metal,.012);light(new THREE.TorusGeometry(.105,.01,5,24),0,.87,z);for(let n=0;n<8;n++){const a=n*Math.PI/4;line([Math.sin(a)*.15,.87+Math.cos(a)*.15,z],[Math.sin(a)*.21,.87+Math.cos(a)*.21,z],.012);}line([.26,1.02,z],[.49,.91,z]);line([.49,.91,z],[.51,.68,z]);}
  gem(0,.87,0,.092);edge([[-.15,.84],[-.49,.98],[-.39,.65],[-.16,.63]],metal,.07);
 }else{
  for(const s of [-1,1]){
   edge([[.10,.72],[.19,1.00],[.46,1.16],[.72,1.10],[.52,.86],[.43,.59],[.28,.47],[.34,.81]].map(([x,y])=>[x*s,y]),'#e5edf0',.065);
   edge([[.18,.78],[.25,.98],[.47,1.09],[.60,1.07],[.46,.91],[.37,.69],[.39,.90]].map(([x,y])=>[x*s,y]),metal,.086);
   edge([[.20,.80],[.28,.96],[.49,1.04],[.41,.93]].map(([x,y])=>[x*s,y]),dark,.10);
   for(const z of [-.061,.061])line([s*.25,.84,z],[s*.46,1.01,z]);
   for(let n=0;n<3;n++)gem(s*(.29+n*.075),.95+n*.033,-.064,.014);
  }
  ring(.165,.82,0,metal,.025);ring(.116,.82,0,dark,.013);gem(0,.82,0,.099);
  // Floating crown: separated from the halo by an intentional visible gap.
  edge([[-.16,1.16],[-.19,1.35],[-.08,1.27],[0,1.40],[.08,1.27],[.19,1.35],[.16,1.16]],metal,.065);
  box(g,dark,0,1.18,0,.25,.035,.08,'metal');for(const x of [-.10,0,.10])gem(x,1.23,-.052,.022);
  for(const z of [-.04,.04])line([-.09,1.08,z],[.09,1.08,z],.007);
 }
 if(glow.length){const parts=glow.map(p=>{const geo=p.index?p.toNonIndexed():p.clone();if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));return geo;}),geometry=mergeGeometries(parts);[...glow,...parts].forEach(p=>p.dispose());const material=new THREE.MeshBasicMaterial({color:i.accent,transparent:true,opacity:.97,toneMapped:false});const mesh=new THREE.Mesh(geometry,material);mesh.userData.keepDynamic=true;g.add(mesh);}
 g.userData.rankReward=i.rank;return g;
}
