import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {animateHumanoid} from './humanoid.js';
import {makeEgg} from './view.js';
import {loadOperatorAsset,OPERATOR_ASSET_IDS} from './operator-assets.js';
import {shopItem} from './shop-catalog.js';
const requested=new URL(location.href).searchParams.get('operator'),assetId=OPERATOR_ASSET_IDS.includes(requested)?requested:'wren',item=shopItem('outfit-'+assetId);
const animateWrenStudy=(m,p,dt,t)=>{animateHumanoid(m,p,dt,t);m.updateMatrixWorld(true);};
import './wren-study.css';
const root=document.querySelector('#wren-study');
root.innerHTML=`<header><a href="./">RAVELFRONT ↗</a><span>CHARACTER ROSTER / 216</span></header><main><div class="study-title"><div><p>RAVELFRONT OPERATORS</p><h1>${item.name}.</h1></div><div><strong>Character anatomy & movement.</strong><p>Compare the original artwork with the textured, skinned model.<br>Rotate through every angle and try the game’s animations.</p></div></div><div class="study-views"><section class="art-panel"><div class="panel-label">${item.default?'CHARACTER PORTRAIT':'ORIGINAL CHARACTER ART'}</div><img src="./shop/${assetId}.webp" alt="${item.default?'Rendered':'Original'} ${item.name} character artwork"><span>${item.default?'Rendered from this game model':'Visual target'}</span></section><section class="model-panel"><div class="panel-label">ACTUAL 3D MODEL <b>PRODUCTION ASSET</b></div><canvas aria-label="${item.name} 3D model. Drag to rotate and scroll to zoom."></canvas><div class="model-status" role="status">Loading the authored mesh and textures…</div><div class="camera-controls"><button data-angle="0">Front</button><button data-angle="-1.570796">Side</button><button data-angle="3.141593">Back</button><button data-rotate aria-pressed="false">Auto rotate</button></div></section></div><div class="study-tools"><label>Character <select id="operator">${OPERATOR_ASSET_IDS.map(id=>`<option value="${id}" ${id===assetId?'selected':''}>${shopItem('outfit-'+id).name}</option>`).join('')}</select></label><label>Pose <select id="pose"><option value="bind">Modeling pose</option><option value="idle">Idle</option><option value="walk">Walk</option><option value="run">Run</option><option value="crouch">Crouch</option><option value="aim">Aim</option><option value="sprint">Sprint</option><option value="strafe">Strafe</option><option value="backward">Backpedal</option><option value="jump">Jump</option><option value="fall">Fall</option><option value="slide">Slide</option><option value="crawl">Crawl</option><option value="revive">Revive</option><option value="reload">Reload</option><option value="melee">Pickaxe swing</option><option value="salute">Salute</option><option value="shuffle">Shuffle</option><option value="cheer">Cheer</option><option value="glide">Glide</option></select></label><button id="wire" aria-pressed="false">Show topology</button><a class="download" href="./models/operators/${assetId}.glb" download>Download 3D model ↓</a></div><footer><strong>${item.name} · Authored Blender model, game animation rig</strong><p>This is an editable Blender mesh with shaped clothing, sculpted equipment, hands and boots. This viewer uses the same asset and animations as the game. Hidden surfaces were inferred from the construction sheet.</p><details><summary>Asset details & credits</summary><p id="stats"></p><p>Original character artwork and modeling reference views generated with OpenAI image tools. Mesh construction, skinning, optimization and game-rig conversion authored for Ravelfront using Blender and Three.js. No external character model was used.</p></details></footer></main>`;
const canvas=root.querySelector('canvas'),panel=root.querySelector('.model-panel'),status=root.querySelector('.model-status');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.01,40);camera.position.set(0,1,3.9);
scene.add(new T.HemisphereLight(0xe9f5ff,0x4a4237,2));
const key=new T.DirectionalLight(0xffe9d6,2);key.position.set(-3,5,-4);scene.add(key);const rim=new T.DirectionalLight(0xc6eaff,1.4);rim.position.set(3,3,3);scene.add(rim);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,.93,0);controls.enablePan=false;controls.minDistance=1.3;controls.maxDistance=6;controls.minPolarAngle=.3;controls.maxPolarAngle=2.7;controls.enableDamping=true;controls.update();
const resize=()=>{const r=panel.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(panel);resize();
let model,pose='bind',angle=0,auto=false,wire=false,last=performance.now(),elapsed=0,frames=0;
root.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{angle=Number(b.dataset.angle);camera.position.set(0,1,-3.9);controls.target.set(0,.93,0);controls.update();});
root.querySelector('[data-rotate]').onclick=e=>{auto=!auto;e.currentTarget.setAttribute('aria-pressed',auto);};
root.querySelector('#wire').onclick=e=>{wire=!wire;if(model)for(const m of [].concat(model.userData.human.mesh.material))m.wireframe=wire;e.currentTarget.setAttribute('aria-pressed',wire);e.currentTarget.textContent=wire?'Hide topology':'Show topology';};
root.querySelector('#operator').onchange=e=>{const url=new URL(location.href);url.searchParams.set('operator',e.target.value);location.href=url.href;};
root.querySelector('#pose').onchange=e=>{pose=e.target.value;elapsed=0;controls.target.set(0,pose==='glide'?1.04:.93,0);camera.position.set(0,1.03,pose==='glide'?-4.7:-3.9);controls.update();if(model)model.userData.human.mocap=null;};
try{
 await loadOperatorAsset(assetId);model=makeEgg({outfit:item.id,weapon:'sprinter'},-1,true);model.userData.held.visible=false;model.rotation.y=0;scene.add(model);camera.position.set(0,1,-3.9);controls.update();status.textContent='Drag to rotate · Scroll to zoom';status.classList.add('is-ready');
 const mesh=model.userData.human.mesh;root.querySelector('#stats').textContent=`${(mesh.geometry.index.count/3).toLocaleString()} triangles · ${mesh.skeleton.bones.length} joints · ${[].concat(mesh.material).length} material draws · shared textures · GLB format`;
 window.__wrenStudy={model,renderer,scene,camera,get frames(){return frames;},get pose(){return pose;},get time(){return elapsed;},advance(count=60){for(let i=0;i<count;i++){elapsed+=1/60;poseModel(1/60);}model.updateMatrixWorld(true);renderer.render(scene,camera);}};
}catch(error){status.textContent='The model could not load. '+error.message;status.classList.add('is-error');console.error(error);}
function poseModel(dt){
 if(!model)return;
 if(model.userData.held)model.userData.held.visible=['aim','reload'].includes(pose);
 if(pose==='bind'){for(const b of Object.values(model.userData.human.bones)){b.position.copy(b.userData.rest);b.quaternion.identity();}return;}
 const p={health:100,grounded:true,vx:0,vz:0,yaw:0,flight:'ground',pitch:0,inventory:[null],slot:0};
 if(pose==='walk')p.vz=-2.4;
 if(pose==='run')p.vz=-5;
 if(pose==='sprint'){p.vz=-8;p.sprinting=true;}
 if(pose==='strafe')p.vx=2.4;
 if(pose==='backward')p.vz=2.4;
 if(pose==='crouch')p.crouching=true;
 if(['aim','reload'].includes(pose)){p.aim=true;p.weapon='sprinter';p.inventory=[{id:'sprinter',weapon:true}];}
 if(pose==='reload'){p.reloadEnd=elapsed+1;p.reloadDuration=2;}
 if(pose==='melee'){p.swingAt=elapsed-.25;p.inventory=[{id:'pickaxe',pickaxe:true}];}
 if(['jump','fall'].includes(pose)){p.grounded=false;p.vy=pose==='jump'?4:-4;}
 if(pose==='slide'){p.sliding=true;p.slideAge=.25;}
 if(pose==='crawl'){p.downed=true;p.vz=-.8;}
 if(pose==='revive')p.reviving='teammate';
 if(['salute','shuffle','cheer'].includes(pose))p.emote={id:pose,start:0};
 if(pose==='glide'){p.flight='glide';p.grounded=false;}
 animateWrenStudy(model,p,dt,elapsed);
}
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;elapsed+=dt;
 if(model){poseModel(dt);
  if(auto)angle+=dt*.3;model.rotation.y=angle;
 }
 controls.update();renderer.render(scene,camera);frames++;requestAnimationFrame(frame);
}requestAnimationFrame(frame);
