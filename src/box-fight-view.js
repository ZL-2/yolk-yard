import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Static surfaces share six merged batches. No dynamic lights or terrain streaming.
export function buildBoxArena(world,map){
 const a=map.boxArena,w=a.width/2,d=a.depth/2,groups=new Map();
 const materials={floor:new THREE.MeshStandardMaterial({color:0x344a58,roughness:.76,metalness:.25}),wall:new THREE.MeshStandardMaterial({color:map.id==='box-drydock'?0x445b65:0x243443,roughness:.67,metalness:.35}),trim:new THREE.MeshStandardMaterial({color:0x111d29,roughness:.5,metalness:.65}),light:new THREE.MeshBasicMaterial({color:a.color}),warm:new THREE.MeshBasicMaterial({color:a.accent}),white:new THREE.MeshBasicMaterial({color:0xbacdd6})};
 const box=(kind,x,y,z,sx,sy,sz)=>{const g=new THREE.BoxGeometry(sx,sy,sz);g.translate(x,y,z);if(!groups.has(kind))groups.set(kind,[]);groups.get(kind).push(g);};
 box('trim',0,-.3,0,a.width+2,.6,a.depth+2);
 for(let x=-w+2;x<w;x+=4)for(let z=-d+2;z<d;z+=4){box('floor',x,-.045,z,3.94,.08,3.94);box('trim',x,.005,z-1.96,3.9,.012,.035);for(const dx of [-1.8,1.8])for(const dz of [-1.8,1.8])box('white',x+dx,.014,z+dz,.05,.018,.05);}
 for(const side of [-1,1]){
  box('wall',side*(w+.3),4,0,.6,8,a.depth+1);box('wall',0,4,side*(d+.3),a.width,8,.6);
  box('trim',side*(w+.08),.35,0,.16,.7,a.depth);box('trim',0,.35,side*(d+.08),a.width,.7,.16);
  box('light',side*(w-.02),7.2,0,.07,.08,a.depth);box(side<0?'light':'warm',0,.025,side*(d-4),a.width,.02,.08);
  box(side<0?'light':'warm',0,6.9,side*(d-.02),a.width,.1,.06);
  for(let z=-d+2;z<d;z+=4){box('trim',side*(w-.06),4,z,.14,8,.25);box('floor',side*(w-.09),4.6,z,.18,3.6,2.7);box('light',side*(w-.2),6.4,z,.04,.055,2.4);}
  for(let x=-w+2;x<w;x+=4){box('trim',x,4,side*(d-.06),.24,8,.14);box('floor',x,2,side*(d-.09),2.8,2.8,.18);}
  for(let x=-w+.4;x<w;x+=.9)box('warm',x,.025,side*(d-.4),.42,.025,.25);
 }
 // The two-storey ceiling is a physical limit; bright crossbars keep edits legible.
 box('trim',0,8.2,0,a.width,.4,a.depth);
 for(let z=-d+2;z<d;z+=4){box('floor',0,7.94,z,a.width,.12,.25);box('white',0,7.85,z,a.width*.7,.035,.12);}
 for(const x of [-w+1,w-1])box('light',x,7.8,0,.08,.045,a.depth);
 for(const [kind,parts]of groups){const geometry=mergeGeometries(parts);for(const g of parts)g.dispose();const mesh=new THREE.Mesh(geometry,materials[kind]);mesh.userData.ownedMaterial=true;mesh.receiveShadow=true;mesh.castShadow=kind==='wall';world.add(mesh);}
 const label=(text,z,rotation)=>{const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#101c29';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#7ee2ea';ctx.font='700 25px system-ui';ctx.textAlign='center';ctx.fillText('RAVEL FRONT  /  COMBAT SIMULATION',512,55);ctx.fillStyle='#f1f5f5';ctx.font='900 76px system-ui';ctx.fillText(text.toUpperCase(),512,149);ctx.fillStyle='#a3b9c9';ctx.font='600 23px system-ui';ctx.fillText('BUILD. EDIT. CLUTCH.',512,215);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(9.4,2.35),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));mesh.userData.ownedMaterial=true;mesh.position.set(0,5.5,z);mesh.rotation.y=rotation;world.add(mesh);};
 label(a.name,-d+.04,0);label('Box Fights',d-.04,Math.PI);
 const gate=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0x142c3c,side:THREE.DoubleSide});
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(a.width,8),material);panel.position.y=4;panel.userData.ownedMaterial=true;gate.add(panel);
 for(const z of [-2.05,2.05]){const side=new THREE.Mesh(new THREE.PlaneGeometry(a.width,8),new THREE.MeshBasicMaterial({color:a.color,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));side.position.set(0,4,z);side.userData.ownedMaterial=true;gate.add(side);}
 const stripes=new THREE.GridHelper(a.width,Math.round(a.width/2),a.color,a.color);stripes.rotation.x=Math.PI/2;stripes.position.set(0,4,.015);stripes.scale.z=8/a.width;gate.add(stripes);world.add(gate);
 world.userData.boxfight={gate,ffa:new THREE.Group(),key:''};world.add(world.userData.boxfight.ffa);
}
export function updateBoxArena(world,state){
 const box=world.userData.boxfight;if(!box)return;
 const prep=state?.boxfight&&['prepare','waiting'].includes(state.boxfight.stage);box.gate.visible=!!prep&&state.options.boxFormat!=='ffa';box.ffa.visible=!!prep&&state.options.boxFormat==='ffa';
 if(!box.ffa.visible)return;
 const key=state.royale.matchId+':'+state.round;if(key===box.key)return;box.key=key;
 for(const m of [...box.ffa.children]){m.geometry.dispose();m.material.dispose();box.ffa.remove(m);}
 for(const p of state.players.filter(p=>p.contestant&&p.boxSpawn)){const shape=new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4,8,3.4)),mesh=new THREE.LineSegments(shape,new THREE.LineBasicMaterial({color:0x7bd9e7,transparent:true,opacity:.8}));mesh.userData.ownedMaterial=true;mesh.position.set(p.boxSpawn.x,4,p.boxSpawn.z);box.ffa.add(mesh);}
}
