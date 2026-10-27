import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {animateHumanoid} from '../../../src/humanoid.js';
import {updateArms} from '../../../src/arms.js';
import {VIEWMODEL} from '../../../src/physics.js';
import {eyeHeight} from '../../../src/stance.js';
import {makeJim} from './model.js';
import './review.css';
const faceReference=new URL('../textures/face-closeup-reference.jpeg',import.meta.url).href;
const poses=['bind','idle','walk','run','sprint','strafe','backward','crouch','aim','jump','fall','slide','crawl','revive','reload','melee','salute','shuffle','cheer','glide'];
const root=document.querySelector('#jim-review');
root.innerHTML=`<header><span class="brand">RAVELFRONT <i> / CHARACTER STUDY</i></span><span class="pending"><b></b> Awaiting approval</span></header>
<main><div class="intro"><div><p class="eyebrow">TWO STYLES. ONE CHARACTER.</p><h1>Jim McLaughlin<span>.</span></h1></div><p class="lead">Sweatshirt for the everyday.<br>Golf for the special style.</p></div>
<section class="stage" aria-label="Interactive outfit review"><div class="style-labels"><div data-label="normal"><small>NORMAL STYLE</small><h2>Sweatshirt</h2></div><div data-label="golf"><small>SPECIAL STYLE</small><h2>Golf</h2></div></div><canvas aria-label="Jim's 3D outfits. Drag to rotate, pinch or scroll to zoom."></canvas><div class="status" role="status">Loading both 3D outfits…</div><div class="stage-note">ACTUAL 3D ASSETS · GAME ANIMATION RIG</div></section>
<div class="controls"><div class="segmented" aria-label="Style"><button data-style="both" aria-pressed="true">Compare</button><button data-style="normal" aria-pressed="false">Normal</button><button data-style="golf" aria-pressed="false">Special</button></div><label>Pose <select id="pose">${poses.map(p=>`<option value="${p}" ${p==='bind'?'selected':''}>${p==='bind'?'Modeling pose':p[0].toUpperCase()+p.slice(1)}</option>`).join('')}</select></label><div class="views"><button data-view="front">Front</button><button data-view="side">Side</button><button data-view="back">Back</button><button data-view="face">Face</button><button data-view="shoes">Footwear</button></div><button id="pause" aria-pressed="false">Pause</button></div>
<details class="reference-panel"><summary>Compare with your face reference</summary><figure><img src="${faceReference}" alt="The supplied close-up used to align Jim’s face"><figcaption>Your supplied reference. Use the Face view above to inspect the actual 3D model.</figcaption></figure></details><div class="details"><article><span>01 / NORMAL</span><h3>Faded blue-gray hoodie</h3><p>Raglan seams, hanging drawstrings, a kangaroo pocket and ribbed cuffs. Black athletic shorts, bare legs and taupe suede clogs with an open heel, shaped cork footbed, sloping straps and outside buckles.</p></article><article><span>02 / SPECIAL</span><h3>White golf polo</h3><p>Navy shorts, a patterned belt, white ankle socks and worn cream sneakers with green side marks, layered panels, crossed laces and brown toe tread. Left-hand golf glove and right-wrist watch.</p></article><article class="review-note"><span>FOR YOUR REVIEW</span><h3>Likeness & fit</h3><p>Revised against your close-up and outfit photographs. Profile and back details are inferred. Review the face, curls, proportions and clothing before approval. This study has not been deployed.</p></article></div><details class="technical"><summary>Model details</summary><p id="stats"></p><p>Original geometry and skinning authored in Blender. The supplied close-up is mapped directly onto the measured facial mesh. Earlier construction imagery assists the clothing textures. These previews render the exported meshes; they are not painted concept images.</p></details></main>`;
const canvas=root.querySelector('canvas'),stage=root.querySelector('.stage'),status=root.querySelector('.status');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.93;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.01,40);camera.position.set(0,1,-4.2);
scene.add(new T.HemisphereLight(0xf3f4f5,0x6a5d4c,1.4));
for(const [c,p,pos]of [[0xfff3e6,2.1,[-3,5,-4]],[0xd5e5ff,1.2,[3,2,-2]],[0xffffff,1.2,[1,3,3]]]){const l=new T.DirectionalLight(c,p);l.position.set(...pos);scene.add(l);}
const floor=new T.Mesh(new T.CircleGeometry(2,80),new T.MeshBasicMaterial({color:0x737c79,transparent:true,opacity:.10,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.scale.set(1,.55,1);scene.add(floor);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,.95,0);controls.enablePan=false;controls.minDistance=.45;controls.maxDistance=7;controls.enableDamping=true;controls.update();
const models={},positions={normal:.60,golf:-.60};let pose='bind',style='both',view='front',paused=false,last=performance.now(),elapsed=0,frames=0;
const resize=()=>{const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(stage);resize();
function arrange(){
 for(const [id,m]of Object.entries(models)){m.visible=style==='both'||style===id;m.position.x=style==='both'?positions[id]:0;m.rotation.y=view==='side'?Math.PI/2:view==='back'?Math.PI:0;}
 for(const label of root.querySelectorAll('[data-label]'))label.hidden=style!=='both'&&style!==label.dataset.label;
 stage.dataset.style=style;
 const close=view==='face',shoes=view==='shoes',narrow=camera.aspect<.9;
 stage.dataset.view=view;
 if(shoes){const k=narrow?1.45:1;camera.position.set(.44*k,.09+.30*k,-.04-.79*k);controls.target.set(0,.09,-.04);}
 else{camera.position.set(0,close?1.684:1.02,close?(style==='both'?-2.6:(narrow?-.98:-.77)):(style==='both'&&narrow?-5.9:-3.95));controls.target.set(0,close?1.674:.94,0);}
 controls.update();
}
function setStyle(s){style=s;if(s==='both'&&['face','shoes'].includes(view))view='front';for(const b of root.querySelectorAll('[data-style]'))b.setAttribute('aria-pressed',b.dataset.style===s);arrange();}
function setPose(p){pose=p;elapsed=0;for(const m of Object.values(models)){const h=m.userData.human;h.mocap=null;h.previous=null;h.speed=0;h.phase=0;h.clock=0;h.nextUpdate=0;}root.querySelector('#pose').value=p;}
root.querySelectorAll('[data-style]').forEach(b=>b.onclick=()=>setStyle(b.dataset.style));
root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;if(['face','shoes'].includes(view)){setPose('bind');if(style==='both')setStyle('normal');}arrange();});
root.querySelector('#pose').onchange=e=>setPose(e.target.value);
root.querySelector('#pause').onclick=e=>{paused=!paused;e.currentTarget.setAttribute('aria-pressed',paused);e.currentTarget.textContent=paused?'Play':'Pause';};
function poseModel(model,dt,distance=0){
 const h=model.userData.human;model.userData.held.visible=['aim','reload'].includes(pose);
 if(pose==='bind'){for(const b of Object.values(h.bones)){b.position.copy(b.userData.rest);b.quaternion.identity();}h.mesh.geometry=distance>36?h.asset.lod.geometry:h.asset.geometry;model.updateMatrixWorld(true);h.mesh.skeleton.update();return;}
 const p={health:100,grounded:true,vx:0,vz:0,yaw:0,flight:'ground',pitch:0,inventory:[null],slot:0};
 if(pose==='walk')p.vz=-2.4;if(pose==='run')p.vz=-5;if(pose==='sprint'){p.vz=-8;p.sprinting=true;}
 if(pose==='strafe')p.vx=2.4;if(pose==='backward')p.vz=2.4;if(pose==='crouch')p.crouching=true;
 if(['aim','reload'].includes(pose)){p.aim=true;p.weapon='sprinter';p.inventory=[{id:'sprinter',weapon:true}];}
 if(pose==='reload'){p.reloadEnd=elapsed+2-(elapsed%2);p.reloadDuration=2;}
 if(pose==='melee'){p.swingAt=elapsed-.25;p.inventory=[{id:'pickaxe',pickaxe:true}];}
 if(['jump','fall'].includes(pose)){p.grounded=false;p.vy=pose==='jump'?4:-4;}
 if(pose==='slide'){p.sliding=true;p.slideAge=.25;}if(pose==='crawl'){p.downed=true;p.vz=-.8;}if(pose==='revive')p.reviving='teammate';
 if(['salute','shuffle','cheer'].includes(pose))p.emote={id:pose,start:0};if(pose==='glide'){p.flight='glide';p.grounded=false;}
 if(model.userData.held.visible){const hands=updateArms(model.userData.arms,pose==='reload'?(elapsed%2)/2:-1,model.userData.blaster);model.userData.held.rotation.set(...hands.rotation);model.userData.held.position.set(VIEWMODEL.x,eyeHeight(p)+VIEWMODEL.y-hands.dip,VIEWMODEL.z);}
 animateHumanoid(model,p,dt,elapsed,{distance});model.updateMatrixWorld(true);h.mesh.skeleton.update();
}
function advance(n=60,distance=0){for(let i=0;i<n;i++){elapsed+=1/60;for(const m of Object.values(models))poseModel(m,1/60,distance);}renderer.render(scene,camera);}
try{
 for(const id of ['normal','golf']){models[id]=await makeJim(id);scene.add(models[id]);await models[id].userData.human.asset.lodRequest;}
 arrange();advance(1);status.textContent='Drag to rotate · Pinch or scroll to zoom';status.classList.add('ready');
 root.querySelector('#stats').textContent=Object.entries(models).map(([s,m])=>{const a=m.userData.human.asset;return `${s==='normal'?'Normal':'Special'}: ${(a.geometry.index.count/3).toLocaleString()} triangles, ${(a.lod.geometry.index.count/3).toLocaleString()} at distance`}).join(' · ')+' · 32 joints · 5 material groups each, including a dedicated footwear texture.';
 window.__jimReview={models,renderer,scene,camera,controls,advance,setPose,setStyle,setView(v){view=v;arrange();},setPaused(v){paused=v;},get frames(){return frames;},get pose(){return pose;},get time(){return elapsed;}};
}catch(e){status.textContent='Could not load the review: '+e.message;status.classList.add('error');console.error(e);}
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused){elapsed+=dt;for(const m of Object.values(models))poseModel(m,dt);}controls.update();renderer.render(scene,camera);frames++;requestAnimationFrame(frame);}requestAnimationFrame(frame);
