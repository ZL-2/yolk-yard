import * as T from 'three';
import {architectureMaterial} from './architecture-surfaces.js';
import {bake} from './royale-view.js';
import {updateWorldDamage} from './damage-visuals.js';

export function buildZoneDistrict(world,map){
 const cube=new T.BoxGeometry(1,1,1);cube.userData.shared=true;
 const add=(geometry,color,surface,x,y,z,sx=1,sy=1,sz=1,id)=>{const m=new T.Mesh(geometry,architectureMaterial(color,surface));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.userData.objectId=id;world.add(m);return m;};
 const block=b=>add(cube,b.color,b.surface||'concrete',b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,b.objectId);
 const box=(x,y,z,w,h,d,color,surface='concrete',id)=>block({x,y,z,w,h,d,color,surface,objectId:id});
 const cylinder=(x,y,z,r,h,color,surface='metal',n=12,id)=>add(new T.CylinderGeometry(r,r,h,n),color,surface,x,y+h/2,z,1,1,1,id);
 const line=(a,b,r,color,surface='metal',id)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av),m=add(new T.CylinderGeometry(r,r,v.length(),6),color,surface,...av.add(bv).multiplyScalar(.5).toArray(),1,1,1,id);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;};
 const ring=(x,y,z,r,t,color,rotation=-Math.PI/2,id)=>{const m=add(new T.TorusGeometry(r,t,4,32),color,'paint',x,y,z,1,1,1,id);m.rotation.x=rotation;return m;};
 // Flat dry asphalt, pale tiled pavement and narrow curbs fill the rock bowl.
 const terrain=new T.PlaneGeometry(360,360,24,24);const positions=terrain.attributes.position;for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getY(i),outer=Math.max(0,Math.min(1,(Math.max(Math.abs(x),Math.abs(z))-65)/35));positions.setZ(i,outer*(8+9*Math.sin(x*.038)*Math.cos(z*.042)));}terrain.computeVertexNormals();const landscape=add(terrain,0x7b8f64,'plaster',0,-1,0);landscape.rotation.x=-Math.PI/2;
 box(0,-.42,0,150,.35,150,0x9e8060,'plaster');box(0,-.08,0,106,.08,106,0x68655e,'concrete');
 for(const b of map.authored)if(!b.hidden)block(b);
 for(const b of map.decor)block(b);
 for(const s of map.sidewalks){
  for(let x=s.x-s.w/2+2;x<s.x+s.w/2;x+=2)box(x,.122,s.z,.025,.008,s.d,0x9a988c,'concrete');
  for(let z=s.z-s.d/2+2;z<s.z+s.d/2;z+=2)box(s.x,.122,z,s.w,.008,.025,0x9a988c,'concrete');
 }
 // Arched shop openings and stone frames remain open to players and gunfire.
 const frameCache=new Map();
 for(const w of map.windows){
  const depth=.16,r=w.w/2+.13,inner=w.w/2,head=w.h-(w.arch?inner:0),key=[w.w,w.h,w.arch].join(':');let geometry=frameCache.get(key);
  if(!geometry){
   const s=new T.Shape(),hole=new T.Path();s.moveTo(-r,-.08);s.lineTo(r,-.08);
   if(w.arch){s.lineTo(r,head);s.absarc(0,head,r,0,Math.PI,false);}else{s.lineTo(r,w.h+.13);s.lineTo(-r,w.h+.13);}s.closePath();
   hole.moveTo(-inner,.04);hole.lineTo(-inner,head);if(w.arch)hole.absarc(0,head,inner,Math.PI,0,true);else{hole.lineTo(-inner,w.h);hole.lineTo(inner,w.h);}hole.lineTo(inner,.04);hole.closePath();s.holes.push(hole);
   geometry=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:8});geometry.userData.shared=true;frameCache.set(key,geometry);
  }
  const angle=w.side*Math.PI/2,m=add(geometry,w.storefront?0x355b43:w.color,'concrete',w.x+Math.sin(angle)*.18,w.y,w.z+Math.cos(angle)*.18,1,1,1,w.objectId);m.rotation.y=angle;
  // Dark wood mullions are narrow; the openings stay visibly transparent.
  if(!w.storefront){box(w.x,w.y+w.h*.46,w.z,w.side%2?.22:w.w,.065,w.side%2?w.w:.22,0x625e50,'timber',w.objectId);}
  if(w.storefront){box(w.x+Math.sin(angle)*.6,w.y+2.95,w.z+Math.cos(angle)*.6,w.side%2?1.1:w.w+.3,.14,w.side%2?w.w+.3:1.1,0x4a6b4b,'fabric',w.objectId);}
 }
 // Central high-rise: continuous masonry pilasters, rooftop crown and shop wing.
  for(const x of [-7.7,-3.7,3.7,7.7])for(const z of [-12.2,4.2])box(x,12,z,.32,16,.38,0xb0ae9a);
 for(const x of [-8.2,8.2])for(const z of [-11.7,-7.7,-.3,3.7])box(x,0,z,.35,28,.34,0xa8a593);
 for(const x of [-8,8])for(const z of [-12,4]){box(x,28,z,1.1,.55,1.1,0xc6beaa);box(x,28.55,z,.7,.55,.7,0xb2a58e);}
 // Reference street furniture: parked cars, circular manholes and streetlights.
 for(const c of map.cars){
  const before=world.children.length,across=Math.abs(c.yaw)>1;
  const local=(x,y,z,w,h,d,color,surface='metal')=>{const m=box(c.x+x,.12+y,c.z+z,w,h,d,color,surface,c.objectId);return m;};
  local(0,1.15,0,1.8,.6,2.25,0x354951,'glass');local(0,1.72,.1,1.8,.09,1.55,c.color,'paint');local(0,.3,2.22,2,.2,.12,0xadb2ac);local(0,.3,-2.22,2,.2,.12,0xadb2ac);
  for(const x of [-1,1])for(const z of [-1.5,1.5]){const wheel=add(new T.CylinderGeometry(.43,.43,.22,12),0x292e2d,'paint',c.x+x,.55,c.z+z,1,1,1,c.objectId);wheel.rotation.z=Math.PI/2;}
  for(const x of [-.7,.7]){local(x,.7,2.3,.35,.2,.04,0xf4e4b6,'paint');local(x,.7,-2.3,.35,.2,.04,0x9d3030,'paint');}
  if(across)for(const m of world.children.slice(before)){const x=m.position.x-c.x,z=m.position.z-c.z;m.position.x=c.x+z;m.position.z=c.z-x;m.rotateY(Math.PI/2);}
 }
 for(const [x,z]of [[-12,-17],[17,7],[-16,15],[34,12]]){cylinder(x,.005,z,.55,.025,0x41494a);ring(x,.04,z,.44,.025,0x8e9692);}
 for(const [x,z]of [[-11,13],[11,-14],[-42,-17],[41,14]]){cylinder(x,0,z,.11,5.8,0x4d5551);line([x,5.75,z],[x+.8,5.9,z],.08,0x4d5551);box(x+.8,5.83,z,.8,.12,.4,0xd4ccaa,'paint');}
 // Full round crowns and planters, with tree damage linked to each trunk.
 for(const t of map.trees){
  if(t.planter==='round'){cylinder(t.x,0,t.z,1.6,.23,0xc7c0aa,'concrete',20);cylinder(t.x,.23,t.z,1.33,.035,0x60503c,'plaster',20);ring(t.x,.24,t.z,1.47,.1,0xd9d1bd);}
  else box(t.x,.185,t.z,3.7,.025,3.7,0x668442,'plaster');
  for(const [dx,dy,dz,scale]of [[0,0,0,1],[-.9,.25,.2,.75],[.9,.2,-.2,.76],[.1,.9,.2,.72]])add(new T.IcosahedronGeometry(1,2),0x6c8f2f,'plaster',t.x+dx,4.9+dy,t.z+dz,t.r*scale,t.r*.84*scale,t.r*.9*scale,t.objectId);
  line([t.x,2.4,t.z],[t.x+1.2,4.5,t.z+.4],.18,0x786245,'timber',t.objectId);
 }
 // Elevated basketball court: painted lines, chain-link fence, two backboards.
 const c=map.court,cy=c.y+.025;
 box(c.x,cy,c.z,18,.025,22,0x999a8c,'concrete');
 for(const x of [c.x-8.6,c.x+8.6])box(x,cy+.03,c.z,.08,.015,21,0xe1ddca,'paint');
 for(const z of [c.z-10.5,c.z,c.z+10.5])box(c.x,cy+.03,z,17.2,.015,.08,0xe1ddca,'paint');
 ring(c.x,cy+.06,c.z,2.6,.045,0xe1ddca);
 for(const end of [-1,1]){const z=c.z+end*9.5;box(c.x,cy+.03,z-end*2.5,5.2,.015,.08,0xe1ddca,'paint');for(const x of [c.x-2.6,c.x+2.6])box(x,cy+.03,z-end*1.1,.08,.015,4.7,0xe1ddca,'paint');cylinder(c.x,cy,z,.08,3.2,0x525c58);box(c.x,cy+2.7,z,2.5,1.3,.15,0xdedcc9,'paint');box(c.x,cy+2.96,z-end*.09,.75,.5,.025,0xa65b3b,'paint');ring(c.x,cy+2.65,z-end*.65,.4,.05,0xb2613d);}
 for(const side of [0,1,2,3]){
  const first=world.children.length;
  const alongX=side%2===0,length=alongX?20:24,x=c.x+(side===1?10:side===3?-10:0),z=c.z+(side===0?12:side===2?-12:0);
  for(let p=-length/2;p<=length/2;p+=4){if(side===0&&Math.abs(p)<4)continue;cylinder(x+(alongX?p:0),4,z+(alongX?0:p),.055,3,0x424d46,'metal',6);}
  for(const y of [4.8,6.9]){if(side!==0)line([x-(alongX?length/2:0),y,z-(alongX?0:length/2)],[x+(alongX?length/2:0),y,z+(alongX?0:length/2)],.04,0x424d46);else for(const end of [-1,1])line([x+end*4,y,z],[x+end*10,y,z],.04,0x424d46);}
  for(let p=-length/2;p<length/2;p+=.65){if(side===0&&Math.abs(p)<4)continue;line([x+(alongX?p:0),4.8,z+(alongX?0:p)],[x+(alongX?Math.min(p+1.25,length/2):0),6.9,z+(alongX?0:Math.min(p+1.25,length/2))],.012,0x626e60);}
  for(const m of world.children.slice(first))m.userData.objectId=c.fenceIds[side];
 }
 // Square blue bounce pads use the same bounds as the shared movement rule.
 for(const p of map.bouncePads){const y=p.y+.135;box(p.x,y,p.z,p.size-.15,.04,p.size-.15,0x3c78a9,'paint',p.objectId);for(const d of [-1,1]){box(p.x+d*(p.size/2-.12),y+.03,p.z,.18,.05,p.size,0xb8d9e4,'metal',p.objectId);box(p.x,y+.03,p.z+d*(p.size/2-.12),p.size,.05,.18,0xb8d9e4,'metal',p.objectId);}for(const dx of [-.85,.85])for(const dz of [-.85,.85]){const q=box(p.x+dx,y+.08,p.z+dz,.65,.035,.65,0xcef2ff,'paint',p.objectId);q.rotation.y=Math.PI/4;}}
 // Faceted warm cliffs and conifers replace the previous loose green hills.
 const pine=(x,y,z,height)=>{cylinder(x,y,z,.35,height*.65,0x6c6347,'timber',6);for(let n=0;n<3;n++)add(new T.ConeGeometry(height*(.26-n*.04),height*.48,7),[0x547743,0x5e8346,0x75934f][n],'plaster',x,y+height*(.4+n*.2),z);};
 for(const c of map.cliffs){
  const x=c.x+(Math.abs(c.x)>Math.abs(c.z)?Math.sign(c.x)*2:0),z=c.z+(Math.abs(c.z)>=Math.abs(c.x)?Math.sign(c.z)*2:0);const m=add(new T.DodecahedronGeometry(1,0),c.color,'plaster',x,c.h*.36,z,c.w*.69,c.h*.73,c.d*.69);m.rotation.y=(c.seed%7)*.31;
  add(new T.IcosahedronGeometry(1,0),0xbb8b62,'plaster',x+Math.sin(c.seed)*3,c.h*.73,z+Math.cos(c.seed)*3,c.w*.35,c.h*.39,c.d*.35);
  if(c.seed%2===0)pine(x,c.h*.9,z,13+c.seed%4);
 }
 for(let i=0;i<9;i++){const a=i*Math.PI*2/9,r=136+i%2*18,h=30+i%4*9;add(new T.CylinderGeometry(8,27,h,7),0x8ea69b,'plaster',Math.cos(a)*r,h/2-4,Math.sin(a)*r);add(new T.CylinderGeometry(8.2,8.7,1,7),0x72884b,'plaster',Math.cos(a)*r,h-4,Math.sin(a)*r);}
 bake(world,true,true);
 // All sixteen clock faces share a single texture, with their own damage owner.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
 ctx.clearRect(0,0,256,256);ctx.fillStyle='#755034';ctx.beginPath();ctx.arc(128,128,124,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c4a577';ctx.beginPath();ctx.arc(128,128,112,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f1ebd8';ctx.beginPath();ctx.arc(128,128,102,0,Math.PI*2);ctx.fill();ctx.fillStyle='#373a33';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 23px Georgia';for(let i=1;i<=12;i++){const a=i*Math.PI/6;ctx.fillText(String(i),128+Math.sin(a)*81,128-Math.cos(a)*81);}ctx.strokeStyle='#38372e';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(128,128);ctx.lineTo(128,61);ctx.moveTo(128,128);ctx.lineTo(90,147);ctx.stroke();ctx.beginPath();ctx.arc(128,128,7,0,Math.PI*2);ctx.fill();
 const clockMaterial=new T.MeshStandardMaterial({map:new T.CanvasTexture(canvas),transparent:true,roughness:.88});clockMaterial.map.colorSpace=T.SRGBColorSpace;
 for(const b of map.buildings.filter(b=>b.clock))for(let side=0;side<4;side++){const a=side*Math.PI/2,m=new T.Mesh(new T.PlaneGeometry(3.4,3.4),clockMaterial);m.position.set(b.x+Math.sin(a)*3.2,22.1,b.z+Math.cos(a)*4.2);m.rotation.y=a;m.userData.ownedMaterial=true;m.userData.damageObjectId=b.clockOwners[side];world.add(m);}
 const gates=new T.Group();world.add(gates);world.userData.zoneWars={gates,key:''};world.userData.geometryRevision=map.revision;
}
export function updateZoneDistrict(world,state){
 const z=world.userData.zoneWars;if(!z)return;z.gates.visible=!!state.zonewars&&['waiting','prepare'].includes(state.zonewars.stage);
 const key=state.royale?.matchId+':'+state.round;
 if(z.gates.visible&&key!==z.key){z.key=key;for(const m of [...z.gates.children]){m.geometry.dispose();m.material.dispose();z.gates.remove(m);}for(const p of state.players.filter(p=>p.contestant&&p.boxSpawn)){const s=p.boxSpawn,geo=new T.BoxGeometry(3.45,3.7,3.45),m=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x65c9f6,transparent:true,opacity:.11,depthWrite:false,side:T.DoubleSide}));m.position.set(s.x,s.y+1.85,s.z);m.userData.ownedMaterial=true;z.gates.add(m);const edge=new T.LineSegments(new T.EdgesGeometry(geo),new T.LineBasicMaterial({color:0x8ee6ff,transparent:true,opacity:.7}));edge.position.copy(m.position);edge.userData.ownedMaterial=true;z.gates.add(edge);}}
 updateWorldDamage(world,state.royale?.worldDamage,key+':'+state.royale?.buildVersion);
}
