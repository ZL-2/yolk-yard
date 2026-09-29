import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {shopItem} from './shop-catalog.js';

// One anatomical bind pose and skeleton contract for every cosmetic. Distances
// are metres. Rigid gear and clothing are cosmetic; physics never reads this mesh.
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const defs=[['root',null,[0,0,0]],['hips','root',[0,.93,0]],['spine','hips',[0,1.09,0]],['chest','spine',[0,1.32,0]],['neck','chest',[0,1.52,0]],['head','neck',[0,1.64,0]]];
for(const side of [-1,1]){const s=side<0?'L':'R';defs.push(
 [`shoulder${s}`,'chest',[side*.235,1.43,0]],[`arm${s}`,`shoulder${s}`,[side*.285,1.42,0]],
 [`forearm${s}`,`arm${s}`,[side*.39,1.14,.012]],[`hand${s}`,`forearm${s}`,[side*.44,.88,0]],
 [`thigh${s}`,'hips',[side*.115,.9,0]],[`shin${s}`,`thigh${s}`,[side*.12,.49,-.015]],
 [`foot${s}`,`shin${s}`,[side*.12,.09,0]],[`toe${s}`,`foot${s}`,[side*.12,.055,-.13]]);
 for(let i=0;i<5;i++)defs.push([`finger${s}${i}`,`hand${s}`,[side*(.435+(i===4?-.041:(i-1.5)*.016)),.833, i===4?-.025:0]]);
}
export const HUMANOID_BONES=Object.freeze(defs.map(d=>d[0]));
const ids=Object.fromEntries(defs.map((d,i)=>[d[0],i])),points=Object.fromEntries(defs.map(d=>[d[0],V(...d[2])]));
const geometries=new Map();
const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.76,metalness:.07});material.userData.shared=true;
function template(profile){
 const item=shopItem(profile.outfit),style=item?.shape??0,skin=['#c58a65','#754b37','#d7a47f','#a86d4f','#dfb696','#543728'][style%6];
 const colors={cloth:item?.color||profile.color||'#334952',trim:item?.accent||profile.accent||'#e8ae4c',skin,armor:'#243039',dark:'#121c23',sole:'#11171b',hair:['#241b19','#161619','#302620','#3e2b21'][style%4]};
 if(profile.teamColor){colors.cloth=profile.teamColor;colors.trim=profile.teamColor;}
 const trouser=new T.Color(colors.cloth).multiplyScalar(.84),seam=new T.Color(colors.cloth).multiplyScalar(.68);
 const key=JSON.stringify([colors,style%6]);if(geometries.has(key))return geometries.get(key);
 const parts=[];
 function add(g,color,bone,next=null,blend=null){
  if(bone==='head'){g.translate(0,-1.666,0);g.scale(1.06,1,1.05);g.translate(0,1.666,0);}
  const n=g.attributes.position.count,c=new T.Color(color),rgb=new Float32Array(n*3),index=new Uint16Array(n*4),weights=new Float32Array(n*4);
  for(let i=0;i<n;i++){rgb.set([c.r,c.g,c.b],i*3);const t=blend?blend(g.attributes.position,i):0;index[i*4]=ids[bone];index[i*4+1]=ids[next||bone];weights[i*4]=1-t;weights[i*4+1]=t;}
  g.setAttribute('color',new T.BufferAttribute(rgb,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(index,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));parts.push(g);
 }
 function ellipsoid(x,y,z,rx,ry,rz,color,bone,detail=10){const g=new T.SphereGeometry(1,detail,Math.max(6,detail-4));g.scale(rx,ry,rz);g.translate(x,y,z);add(g,color,bone);}
 function panel(x,y,z,w,h,d,color,bone){const g=mergeVertices(new RoundedBoxGeometry(w,h,d,1,Math.min(w,h,d)*.22));g.translate(x,y,z);add(g,color,bone);}
 function rings(rows,color,bone,next=null){const pos=[],uv=[],ind=[],sides=16;
  for(let j=0;j<rows.length;j++){const [y,rx,rz,cx=0,cz=0]=rows[j];for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;pos.push(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);uv.push(i/sides,j/(rows.length-1));if(j<rows.length-1&&i<sides){const k=j*(sides+1)+i;ind.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();add(g,color,bone,next,next?(p,i)=>T.MathUtils.smoothstep(p.getY(i),rows[0][0],rows.at(-1)[0])*.8:null);
 }
 function limb(a,b,radii,color,bone,next){const A=points[a],B=points[b],delta=B.clone().sub(A),length=delta.length();
  const g=new T.LatheGeometry(radii.map(([t,r])=>new T.Vector2(r,t*length)),12);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),delta.clone().normalize()));g.translate(A.x,A.y,A.z);add(g,color,bone,next,(p,i)=>{const t=V(p.getX(i),p.getY(i),p.getZ(i)).sub(A).dot(delta)/(length*length);return next?T.MathUtils.smoothstep(t,.72,1)*.48:0;});
 }
 // Shaped hips, abdomen, ribcage and clavicles, underneath fitted outerwear.
 rings([[.84,.13,.10],[.88,.18,.12],[.98,.178,.115],[1.04,.15,.10],[1.1,.153,.105],[1.18,.18,.12],[1.3,.23,.135],[1.39,.24,.12],[1.46,.195,.09],[1.49,.10,.07]],colors.cloth,'hips','chest');
 rings([[1.02,.161,.105],[1.06,.174,.12],[1.19,.203,.144],[1.34,.23,.15],[1.41,.22,.125],[1.435,.17,.095]],style%3===2?colors.cloth:colors.armor,'spine','chest');
 // Shoulder straps, segmented carrier panels and fitted collar.
 for(const s of [-1,1]){
  panel(s*.098,1.30,-.145,.158,.188,.030,colors.armor,'chest');
  panel(s*.099,1.365,-.166,.125,.012,.008,colors.cloth,'chest');
  panel(s*.080,1.12,-.145,.127,.108,.043,colors.cloth,'spine');
  panel(s*.08,1.16,-.170,.109,.023,.008,colors.armor,'spine');
  ellipsoid(s*.18,1.397,-.095,.037,.073,.033,colors.trim,'chest');
  ellipsoid(s*.265,1.42,.0,.068,.067,.071,colors.cloth,`arm${s<0?'L':'R'}`);
  panel(s*.074,1.255,-.163,.116,.011,.008,colors.dark,'chest');
  panel(s*.074,1.232,-.163,.116,.011,.008,colors.dark,'chest');
 }
 panel(0,.997,-.11,.29,.038,.015,colors.dark,'hips');panel(0,.997,-.125,.042,.032,.012,colors.trim,'hips');
 for(const x of [-.125,-.06,.06,.125])panel(x,1.002,-.12,.013,.046,.012,colors.cloth,'hips');
 rings([[1.425,.088,.073],[1.465,.088,.073],[1.48,.07,.064]],colors.dark,'neck');
 ellipsoid(0,1.515,0,.064,.082,.062,colors.skin,'neck');
 // Sculpted cranium: jaw narrows below cheeks, recessed temples, defined brow.
 const head=new T.SphereGeometry(1,24,18),hp=head.attributes.position;
 for(let i=0;i<hp.count;i++){let x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i);const jaw=y<-.18?.80+.18*(y+1)/.82:1;const front=Math.max(0,-z);hp.setXYZ(i,x*.118*jaw,1.666+y*.162,z*.109-(y>-.1&&y<.25?.008*front:0));}head.computeVertexNormals();add(head,skin,'head');
 ellipsoid(0,1.553,-.035,.066,.026,.057,skin,'head');
 for(const side of [-1,1]){
  ellipsoid(side*.118,1.667,.0,.019,.038,.023,skin,'head');
  ellipsoid(side*.044,1.692,-.101,.029,.012,.012,skin,'head');
  ellipsoid(side*.044,1.695,-.111,.019,.005,.004,'#d6cec4','head');
  ellipsoid(side*.044,1.695,-.115,.006,.005,.003,'#354c4b','head');
  ellipsoid(side*.045,1.716,-.099,.035,.006,.01,colors.hair,'head');
 }
 ellipsoid(0,1.668,-.115,.016,.037,.021,skin,'head');ellipsoid(0,1.646,-.132,.02,.012,.016,skin,'head');
 ellipsoid(0,1.61,-.098,.035,.005,.006,'#875447','head');ellipsoid(0,1.599,-.094,.03,.004,.005,skin,'head');
 // Close-cropped hair or fitted field helmet, all following the same head bone.
 const helmet=style%4===1||style%4===3;
 const hair=new T.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI*(helmet?.60:.49));hair.scale(helmet?.13:.12,helmet?.171:.166,.116);hair.translate(0,1.669,.005);add(hair,helmet?colors.armor:colors.hair,'head');
 if(helmet){ellipsoid(0,1.745,-.093,.088,.014,.038,colors.trim,'head');for(const s of [-1,1])ellipsoid(s*.12,1.67,.007,.024,.035,.025,colors.dark,'head');}
 if(style%6===4)ellipsoid(0,1.617,-.093,.08,.04,.035,colors.cloth,'head');
 for(const side of [-1,1]){const s=side<0?'L':'R';
  limb('arm'+s,'forearm'+s,[[0,.062],[.12,.074],[.4,.07],[.75,.049],[1,.045]],colors.cloth,'arm'+s,'forearm'+s);
  ellipsoid(side*.39,1.14,.012,.047,.048,.048,colors.cloth,'forearm'+s);
  limb('forearm'+s,'hand'+s,[[0,.046],[.2,.055],[.5,.052],[.8,.037],[1,.031]],style%3===0?skin:colors.cloth,'forearm'+s,'hand'+s);
  ellipsoid(side*.405,1.065,-.028,.043,.058,.025,colors.armor,'forearm'+s);
  ellipsoid(side*.44,.86,0,.042,.057,.027,colors.dark,'hand'+s);
  for(let i=0;i<5;i++){const b='finger'+s+i,P=points[b];const curve=new T.CatmullRomCurve3([P.clone(),P.clone().add(V(side*.002,-.026,-.008)),P.clone().add(V(side*.002,-.042,-.025)),P.clone().add(V(0,-.032,-.033))]);add(new T.TubeGeometry(curve,5,i===4?.01:.008,5,false),colors.dark,b);}
  limb('thigh'+s,'shin'+s,[[0,.094],[.13,.103],[.4,.094],[.69,.078],[.79,.074],[.82,.077],[.86,.069],[1,.062]],trouser,'thigh'+s,'shin'+s);
  limb('shin'+s,'foot'+s,[[0,.062],[.2,.071],[.45,.063],[.7,.049],[.76,.052],[.81,.045],[1,.042]],trouser,'shin'+s,'foot'+s);
  panel(side*.12,.495,-.068,.105,.122,.037,colors.armor,'shin'+s);
  panel(side*.12,.51,-.09,.074,.054,.009,seam,'shin'+s);
  panel(side*.202,.78,.006,.044,.146,.127,trouser,'thigh'+s);
  panel(side*.226,.824,.006,.012,.03,.117,seam,'thigh'+s);
  ellipsoid(side*.12,.145,.004,.05,.099,.059,colors.dark,'foot'+s);
  ellipsoid(side*.12,.055,-.065,.055,.054,.125,colors.dark,'foot'+s);
  ellipsoid(side*.12,.024,-.065,.059,.022,.13,colors.sole,'foot'+s);
  for(let j=0;j<3;j++)ellipsoid(side*.12,.099-j*.011,-.063-j*.018,.04,.006,.006,colors.trim,'foot'+s);
 }
 const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());geo.computeBoundingSphere();geo.userData.shared=true;geometries.set(key,geo);return geo;
}
export function makeHumanoid(profile={}){
 const root=new T.Group();root.name='Ravelfront operator';const bones={},list=[];
 for(const [name,parent,xyz]of defs){const b=new T.Bone();b.name=name;const rest=V(...xyz).sub(parent?points[parent]:V());b.position.copy(rest);b.userData.rest=rest.clone();bones[name]=b;list.push(b);if(parent)bones[parent].add(b);}
 const mesh=new T.SkinnedMesh(template(profile),material);mesh.name='Skinned operator';mesh.add(bones.root);mesh.bind(new T.Skeleton(list));mesh.boundingSphere=new T.Sphere(new T.Vector3(0,.9,0),2);mesh.frustumCulled=true;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 root.userData.human={mesh,bones,clock:0,phase:0,speed:0,previous:null,grounded:true,land:0,air:0,death:0,lastYaw:0,pose:'idle',nextUpdate:0};root.userData.cracks=[];
 return root;
}
const scratchA=V(),scratchB=V(),scratchC=V(),scratchQ=new T.Quaternion();
// Analytic two-bone IK. Targets are in character coordinates. Elbow/knee poles
// remain on the anatomical side; fixed limb lengths prevent stretching.
function solveChain(h,upper,lower,end,target,pole,blend=1){
 const a=h.bones[upper],b=h.bones[lower],c=h.bones[end];h.mesh.updateMatrixWorld(true);
 const inverse=h.mesh.matrixWorld.clone().invert(),start=a.getWorldPosition(V()).applyMatrix4(inverse),L1=b.userData.rest.length(),L2=c.userData.rest.length();
 const dir=target.clone().sub(start),len=T.MathUtils.clamp(dir.length(),.02,L1+L2-.002);dir.normalize();
 const normal=pole.clone().sub(start).addScaledVector(dir,-pole.clone().sub(start).dot(dir)).normalize();
 const along=(L1*L1-L2*L2+len*len)/(2*len),height=Math.sqrt(Math.max(0,L1*L1-along*along)),elbow=start.clone().addScaledVector(dir,along).addScaledVector(normal,height);
 function aim(bone,rest,dest){const parentQ=bone.parent.getWorldQuaternion(new T.Quaternion()),modelQ=h.mesh.getWorldQuaternion(new T.Quaternion());const local=dest.applyQuaternion(modelQ).applyQuaternion(parentQ.invert()).normalize();const q=new T.Quaternion().setFromUnitVectors(rest.clone().normalize(),local);bone.quaternion.slerp(q,blend);bone.updateMatrixWorld(true);}
 aim(a,b.userData.rest,elbow.clone().sub(start));aim(b,c.userData.rest,start.clone().addScaledVector(dir,len).sub(elbow));
}
export function animateHumanoid(model,p={},dt=1/60,time=0,{menu=false,distance=0}={}){
 const h=model.userData.human;if(!h)return;h.clock+=dt;
 // 60 Hz nearby, 20 Hz at distance, 10 Hz far away. Animation clocks continue.
 const interval=distance>90?.1:distance>40?.05:0;if(h.clock<h.nextUpdate){h.skipped=(h.skipped||0)+dt;return;}dt=Math.min(.12,dt+(h.skipped||0));h.skipped=0;h.nextUpdate=h.clock+interval;
 const b=h.bones,alpha=1-Math.exp(-dt*12);for(const bone of Object.values(b)){bone.position.copy(bone.userData.rest);bone.quaternion.slerp(new T.Quaternion(),alpha);}
 const vx=p.vx||0,vz=p.vz||0,speed=Math.min(9,Math.hypot(vx,vz)),grounded=p.grounded!==false;
 h.speed+=(speed-h.speed)*(1-Math.exp(-dt*10));const cycleDistance=p.downed?.85:p.crouching?1.1:p.sprinting?2.0:1.7;h.phase+=speed*dt/cycleDistance*Math.PI*2;
 if(grounded&&!h.grounded)h.land=1;h.grounded=grounded;h.land=Math.max(0,h.land-dt*5);
 const airborne=['dive','glide','launch'].includes(p.flight),dead=p.health!==undefined&&p.health<=0;
 h.air+=(Number(airborne)-h.air)*(1-Math.exp(-dt*7));h.death+=(Number(dead)-h.death)*(1-Math.exp(-dt*6));
 const previousPose=h.pose;h.lowerState=dead?'elimination':p.downed?(speed>.1?'crawling':'downed'):p.reviving?'reviving':p.sliding?'sliding':p.crouching?(speed>.1?'crouch-moving':'crouch-idle'):!grounded?(p.vy>0?'jump':'fall'):p.sprinting?'sprint':speed>.1?'walking':'standing';
 h.upperState=p.downed?(p.reviverId?'being-revived':'downed'):p.reviving?'reviving':p.reloadEnd>time?'reloading':p.shotRecoil>.02?'firing':p.building?(p.editing?'editing':'building'):p.aim?'ads':'ready';
 h.pose=dead?'elimination':p.downed?(p.reviverId?'being-revived':speed>.1?'crawling':'downed'):p.reviving?'reviving':p.sliding?'sliding':p.crouching?(speed>.1?'crouch-moving':'crouch-idle'):p.flight==='dive'?'skydive':p.flight==='glide'?'glide':!grounded?(p.vy>0?'jump':'fall'):p.building?(p.editing?'edit':'build'):p.use?'use':p.swingAt&&time-p.swingAt<.55?'melee':p.reloadEnd>time?'reload':p.equipUntil>time?(p.equipHolster&&time-p.equipStarted<p.equipHolster?'holster':'draw'):p.aim?'aim':p.sprinting?'sprint':h.speed>5.5?'run':h.speed>.2?'locomotion':'idle';
 if(previousPose!==h.pose){h.fromPose=previousPose;h.transition=0;}h.transition=Math.min(1,(h.transition||0)+dt*7);
 const forward=-vx*Math.sin(p.yaw||0)-vz*Math.cos(p.yaw||0),side=vx*Math.cos(p.yaw||0)-vz*Math.sin(p.yaw||0),moving=Math.min(1,h.speed/2),step=cycleDistance*.54/2*moving;
 const blend=1-Math.exp(-dt*14);for(const [key,on]of [['crouch',p.crouching&&!p.sliding],['compact',p.lowCrouch],['slide',p.sliding],['down',p.downed],['revive',p.reviving]])h[key]=(h[key]||0)+(Number(!!on)-(h[key]||0))*blend;
 const lower=Math.max(h.crouch*.53+h.compact*.29,h.slide*.87,h.down*.65,h.revive*.53);
 b.hips.position.y-=lower+(.09+(p.sprinting?.025:0))*moving*(1-Math.max(h.slide,h.down,h.crouch))+h.land*.075+h.death*.58;
 b.hips.rotation.x=-.06*moving-(p.sprinting?.08:0)-h.crouch*.12+h.slide*.27-h.down*1.14-h.revive*.12+h.death*.85;
 const turn=Math.atan2(Math.sin((p.yaw||0)-h.lastYaw),Math.cos((p.yaw||0)-h.lastYaw))/Math.max(.016,dt);h.lastYaw=p.yaw||0;b.spine.rotation.z=T.MathUtils.clamp(-side*.012-turn*.007,-.09,.09);b.hips.rotation.y=T.MathUtils.clamp(turn*.008,-.07,.07);b.chest.rotation.y=Math.sin(h.phase)*.018*moving;b.chest.rotation.x=Math.sin(time*1.8)*.008+(p.lastDamage&&time-p.lastDamage<.18?-.06:0);
 b.head.rotation.x=(menu?Math.sin(time*.7)*.025:-(p.pitch||0)*.3)+h.down*1.04+h.revive*.14;
 if(menu){b.head.rotation.y=p.scan||0;b.chest.rotation.y+=(p.scan||0)*.3;}
 const f=forward/(speed||1),s=side/(speed||1);
 for(const sideSign of [-1,1]){const S=sideSign<0?'L':'R',phase=h.phase+(sideSign<0?Math.PI:0),cycle=((phase/(2*Math.PI))%1+1)%1;
  // Stance travels backward linearly at ground speed; swing lifts the foot.
  const stance=cycle<.54,u=stance?cycle/.54:(cycle-.54)/.46,stride=stance?1-u*2:-Math.cos(u*Math.PI),lift=stance?0:Math.sin(u*Math.PI)*.12*moving;
  let foot=V(sideSign*.12+s*stride*step,.09+lift,-f*stride*step);
  if(!grounded&&!airborne)foot=V(sideSign*.14,.17+(sideSign>0?.10:0),.10);
  if(airborne)foot=V(sideSign*.24,p.flight==='glide'?.22:.2,p.flight==='glide'?.10:.28);
  if(h.slide>.01)foot.lerp(V(sideSign*.17,.12,-.67),h.slide);
  if(h.down>.01)foot.lerp(V(sideSign*.2,.12,.43+Math.sin(phase)*.10*moving),h.down);
  if(h.revive>.01)foot.lerp(V(sideSign*.15,sideSign<0?.10:.13,sideSign<0?-.32:.25),h.revive);
  if(dead)foot=V(sideSign*.23,.12,-.12);
  solveChain(h,'thigh'+S,'shin'+S,'foot'+S,foot,V(sideSign*.15,.5,-1));const footBone=b['foot'+S];footBone.quaternion.copy(footBone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(h.mesh.getWorldQuaternion(new T.Quaternion())));if(!stance)footBone.rotateX(-lift*1.5);
 }
 const held=model.userData.held,arms=model.userData.arms;
 if(held&&arms){held.updateMatrixWorld(true);h.mesh.updateMatrixWorld(true);}
 for(const sideSign of [-1,1]){const S=sideSign<0?'L':'R';let target;
  if(airborne)target=p.flight==='glide'?V(sideSign*.33,1.93,-.06):V(sideSign*.68,1.40,-.1);
  else if(p.building)target=V(sideSign*.25,1.22-lower+(sideSign>0?Math.sin(time*8)*.035:0),-.38);
  else if(p.use)target=V(sideSign*.22,(sideSign>0?1.53:1.2)-lower,-.3);
  else if(held?.visible&&arms){const limb=arms.userData.limbs.find(l=>l.side===sideSign);target=limb.hand.getWorldPosition(V());target.applyMatrix4(h.mesh.matrixWorld.clone().invert());target.y+=.035;}
  else target=V(sideSign*.33,1.03,-Math.sin(h.phase+(sideSign<0?Math.PI:0))*.16*moving);
  if(p.downed)target=V(sideSign*.29,.14+Math.max(0,Math.sin(h.phase+(sideSign<0?Math.PI:0)))*.045*moving,-.46-Math.sin(h.phase+(sideSign<0?Math.PI:0))*.13*moving);
  if(p.reviving)target=V(sideSign*.18,.58+Math.sin(time*3+sideSign)*.025,-.49);
  if(dead)target=V(sideSign*.40,.6,-.10);
  h['handTarget'+S]??=target.clone();h['handTarget'+S].lerp(target,1-Math.exp(-dt*(h.transition<1?16:40)));
  solveChain(h,'arm'+S,'forearm'+S,'hand'+S,h['handTarget'+S],V(sideSign*.65,1.0,.25));
  const hand=b['hand'+S];let handQ=h.mesh.getWorldQuaternion(new T.Quaternion());
  if(held?.visible&&arms&&!airborne&&!p.use&&!p.building){handQ=arms.userData.limbs.find(l=>l.side===sideSign).hand.getWorldQuaternion(new T.Quaternion());}
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(handQ));hand.rotateX(-.12);

 }
 if(model.userData.utility){h.mesh.updateMatrixWorld(true);const position=b.handR.getWorldPosition(V());model.worldToLocal(position);model.userData.utility.position.copy(position);model.userData.utility.rotation.set(p.use?-.35:0,0,0);}
 model.userData.animationState=h.pose;
}
export function humanoidDiagnostics(model){const h=model.userData.human;return h?{bones:h.mesh.skeleton.bones.length,vertices:h.mesh.geometry.attributes.position.count,triangles:h.mesh.geometry.index.count/3,state:h.pose,transition:h.transition,lower:h.lowerState,upper:h.upperState}:null;}
