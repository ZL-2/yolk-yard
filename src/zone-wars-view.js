import * as T from 'three';
import {architectureMaterial} from './architecture-surfaces.js';
import {bake} from './royale-view.js';
import {updateWorldDamage} from './damage-visuals.js';
export function buildZoneDistrict(world,map){
 const block=(b)=>{const m=new T.Mesh(new T.BoxGeometry(b.w,b.h,b.d),architectureMaterial(b.color,b.surface||'concrete'));m.position.set(b.x,b.y+b.h/2,b.z);m.userData.objectId=b.objectId;world.add(m);return m;};
 block({x:0,y:-.5,z:0,w:144,h:.3,d:144,color:0x7b9967});
 block({x:0,y:-.16,z:0,w:124,h:.15,d:124,color:0xb5b1a0});
 for(const r of map.roads){block({...r,y:0,h:.025,color:0x555e64});const alongX=r.w>r.d;for(let n=-62;n<62;n+=7)block({x:alongX?n:r.x,y:.027,z:alongX?r.z:n,w:alongX?3:.11,h:.015,d:alongX?.11:3,color:0xe6d89b,surface:'paint'});}
 for(const b of map.authored)block(b);for(const b of map.decor)block(b);
 // Crosswalks, a marked basketball court, curb stones and parking bays.
 for(const x of [-22,20])for(const z of [-19,22])for(let n=-3;n<=3;n++)for(const side of [-1,1])block({x:x+n,y:.05,z:z+side*6.8,w:.65,h:.015,d:2.3,color:0xf2eee0,surface:'paint'});
 block({x:-58,y:.03,z:37,w:10,h:.015,d:22,color:0x637f72,surface:'paint'});
 for(const x of [-62.5,-53.5])block({x,y:.05,z:37,w:.12,h:.015,d:21,color:0xd6ded1,surface:'paint'});
 for(const z of [27,37,47])block({x:-58,y:.05,z,w:9,h:.015,d:.12,color:0xd6ded1,surface:'paint'});
 for(const x of [-58,58])for(let z=-54;z<55;z+=6)if(x>0||z<24)block({x,y:.035,z,w:6,h:.015,d:.1,color:0xe8e6d4,surface:'paint'});
 // Hills frame the district without covering the playable roads.
 for(let i=0;i<16;i++){const a=i*Math.PI/8,m=new T.Mesh(new T.ConeGeometry(20+8*Math.sin(i),14+7*Math.cos(i),7),architectureMaterial(0x698765,'plaster'));m.position.set(Math.cos(a)*92,3,Math.sin(a)*92);world.add(m);}
 for(const b of map.authored.filter(b=>b.harvestType==='tree')){const m=new T.Mesh(new T.IcosahedronGeometry(3.6,1),architectureMaterial(0x598265,'plaster'));m.position.set(b.x,5.8,b.z);m.scale.y=1.3;m.userData.objectId=b.objectId;world.add(m);}
 bake(world,true,true);
 const sign=(text,x,y,z,width=8,rotation=0)=>{const c=document.createElement('canvas');c.width=768;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#203944';ctx.fillRect(0,0,768,160);ctx.strokeStyle='#b7caba';ctx.lineWidth=7;ctx.strokeRect(8,8,752,144);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 58px Inter,system-ui';ctx.fillStyle='#f4e6bc';ctx.fillText(text,384,83,720);const m=new T.Mesh(new T.PlaneGeometry(width,width*160/768),new T.MeshBasicMaterial({map:new T.CanvasTexture(c)}));m.userData.ownedMaterial=true;m.position.set(x,y,z);m.rotation.y=rotation;world.add(m);};
 sign('PAWN & REPAIR',39,3.1,14.18,12);sign('CORNER MARKET',-40,3.1,10.18,15);sign('DINER',39,3.1,47.18,12);sign('TILTED DISTRICT',0,5,64,18,Math.PI);
 // Four readable clock faces on the tower.
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#f1e8cb';ctx.beginPath();ctx.arc(128,128,118,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#273943';ctx.lineWidth=10;ctx.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(128+Math.sin(a)*90,128-Math.cos(a)*90);ctx.lineTo(128+Math.sin(a)*106,128-Math.cos(a)*106);ctx.stroke();}ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(128,128);ctx.lineTo(128,57);ctx.moveTo(128,128);ctx.lineTo(175,151);ctx.stroke();const clockMaterial=new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true});
 for(let side=0;side<4;side++){const a=side*Math.PI/2,m=new T.Mesh(new T.PlaneGeometry(4.3,4.3),clockMaterial);m.position.set(-42+Math.sin(a)*5.17,25.5,37+Math.cos(a)*5.17);m.rotation.y=a;m.userData.ownedMaterial=true;world.add(m);}
 const gates=new T.Group();world.add(gates);world.userData.zoneWars={gates,key:''};
}
export function updateZoneDistrict(world,state){
 const z=world.userData.zoneWars;if(!z)return;z.gates.visible=!!state.zonewars&&['waiting','prepare'].includes(state.zonewars.stage);
 const key=state.royale?.matchId+':'+state.round;
 if(z.gates.visible&&key!==z.key){z.key=key;for(const m of [...z.gates.children]){m.geometry.dispose();m.material.dispose();z.gates.remove(m);}for(const p of state.players.filter(p=>p.contestant&&p.boxSpawn)){const s=p.boxSpawn,geo=new T.BoxGeometry(3.45,3.7,3.45),m=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x65c9f6,transparent:true,opacity:.11,depthWrite:false,side:T.DoubleSide}));m.position.set(s.x,s.y+1.85,s.z);m.userData.ownedMaterial=true;z.gates.add(m);const edge=new T.LineSegments(new T.EdgesGeometry(geo),new T.LineBasicMaterial({color:0x8ee6ff,transparent:true,opacity:.7}));edge.position.copy(m.position);edge.userData.ownedMaterial=true;z.gates.add(edge);}}
 updateWorldDamage(world,state.royale?.worldDamage,key+':'+state.royale?.buildVersion);
}
