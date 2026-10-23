import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadWrenStudy,animateWrenStudy} from './wren-study-model.js';
import './wren-study.css';
const root=document.querySelector('#wren-study');
root.innerHTML=`<header><a href="./">RAVELFRONT ↗</a><span>CHARACTER DEVELOPMENT / 01</span></header><main><div class="study-title"><div><p>SKYBOUND</p><h1>Wren.</h1></div><div><strong>A new body. A real 3D asset.</strong><p>Compare the original artwork with the textured, skinned model.<br>Rotate her through every angle and try the game’s animations.</p></div></div><div class="study-views"><section class="art-panel"><div class="panel-label">ORIGINAL CHARACTER ART</div><img src="./shop/wren.webp" alt="Original Wren artwork: orange aviator jacket, scarf, goggles and leather boots"><span>Visual target</span></section><section class="model-panel"><div class="panel-label">ACTUAL 3D MODEL <b>PROTOTYPE</b></div><canvas aria-label="Wren 3D model. Drag to rotate and scroll to zoom."></canvas><div class="model-status" role="status">Loading Wren’s mesh and textures…</div><div class="camera-controls"><button data-angle="0">Front</button><button data-angle="-1.570796">Side</button><button data-angle="3.141593">Back</button><button data-rotate aria-pressed="false">Auto rotate</button></div></section></div><div class="study-tools"><label>Pose <select id="pose"><option value="bind">Modeling pose</option><option value="idle">Idle</option><option value="walk">Walk</option><option value="run">Run</option><option value="crouch">Crouch</option><option value="aim">Aim</option><option value="glide">Glide</option></select></label><button id="wire" aria-pressed="false">Show topology</button><a class="download" href="./models/operators/wren-prototype.glb" download>Download 3D model ↓</a></div><footer><strong>Model study · Not the final production character</strong><p>This is a custom Blender mesh with a 32-joint skin, shaped clothing, scarf, hair, hands and boots. The UV texture is baked from the generated turnaround with blended side materials; hair, likeness and garment deformation still need refinement. Animations use the game’s actual character code. The live Wren outfit is unchanged during this review.</p><details><summary>Asset details & credits</summary><p id="stats"></p><p>Original Wren artwork and modeling reference views generated with OpenAI image tools. Mesh construction, skinning, optimization and game-rig conversion authored for Ravelfront using Blender and Three.js. No external character model was used.</p></details></footer></main>`;
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
root.querySelector('#wire').onclick=e=>{wire=!wire;if(model)model.userData.human.mesh.material.wireframe=wire;e.currentTarget.setAttribute('aria-pressed',wire);e.currentTarget.textContent=wire?'Hide topology':'Show topology';};
root.querySelector('#pose').onchange=e=>{pose=e.target.value;elapsed=0;controls.target.set(0,pose==='glide'?1.04:.93,0);camera.position.set(0,1.03,pose==='glide'?-4.7:-3.9);controls.update();if(model)model.userData.human.mocap=null;};
try{
 model=await loadWrenStudy();model.rotation.y=0;scene.add(model);camera.position.set(0,1,-3.9);controls.update();status.textContent='Drag to rotate · Scroll to zoom';status.classList.add('is-ready');
 const mesh=model.userData.human.mesh;root.querySelector('#stats').textContent=`${(mesh.geometry.index.count/3).toLocaleString()} triangles · ${mesh.skeleton.bones.length} joints · 1 skinned draw · shared texture · GLB format`;
 window.__wrenStudy={model,renderer,scene,camera,get frames(){return frames;},get pose(){return pose;},get time(){return elapsed;}};
}catch(error){status.textContent='The model could not load. '+error.message;status.classList.add('is-error');console.error(error);}
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;elapsed+=dt;
 if(model){
  if(pose==='bind'){for(const b of Object.values(model.userData.human.bones)){b.position.copy(b.userData.rest);b.quaternion.identity();}}
  else {const p={health:100,grounded:true,vx:0,vz:0,yaw:0,flight:'ground',pitch:0};if(pose==='walk')p.vz=-2.4;if(pose==='run'){p.vz=-5;p.sprinting=true;}if(pose==='crouch')p.crouching=true;if(pose==='aim'){p.aim=true;p.weapon='sprinter';}if(pose==='glide'){p.flight='glide';p.grounded=false;}animateWrenStudy(model,p,dt,elapsed);}
  if(auto)angle+=dt*.3;model.rotation.y=angle;
 }
 controls.update();renderer.render(scene,camera);frames++;requestAnimationFrame(frame);
}requestAnimationFrame(frame);
