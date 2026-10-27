import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {ICON_BUNDLE_ITEMS,ICON_BUNDLE_IDS} from '../../src/icon-bundle-catalog.js';
import {makeShopPickaxe,makeShopBack,makeShopGlider,makeShopTrail} from '../../src/shop-models.js';
import {updateIconGear} from '../../src/icon-bundle-models.js';
import {makeBlaster,disposeBlaster} from '../../src/weapons.js';
import {pickaxePose} from '../../src/pickaxe-animation.js';
import './review.css';

const labels={pickaxe:'Pickaxe',wrap:'Weapon wrap',backbling:'Back accessory',glider:'Glider',trail:'Dive trail'};
const specs={
 pickaxe:['60° physical loft · ten milled grooves','Stepped chrome shaft · rubber wrap','Two-hand shaft anchors · 0.45 s swing'],
 wrap:['CUBA Watermelon can-lid graphics and fruit print','Cream, forest green and watermelon red','Applies to the actual game weapon models'],
 backbling:['Clear glass · red screw cap · long neck','Crown Russe label · fitted side straps','0.61 m height · animated liquid surface'],
 glider:['Twenty quilted sections · visible lining','Zipper teeth · padded hood · trailing ties','Unfolding canopy · eight moving rig lines'],
 trail:['Four tapered strands with moving ripples','Twenty-eight continuously recycled droplets','Glossy white finish · animated on the GPU'],
};
const notes={pickaxe:'Cosmetic only. Existing reach, damage and harvest timing are preserved.',wrap:'CUBA Watermelon branding. Sight glass remains clear.',backbling:'Crown Russe Vodka bottle matched to the supplied reference. The mannequin is only a scale reference.',glider:'Same flight mechanics and hand anchors as the existing gliders. The mannequin is only a scale reference.',trail:'Flowing white slime. The mannequin is only a scale reference.'};
const root=document.querySelector('#bundle-review');
root.innerHTML=`<main class="shell"><header class="mast"><div class="brand">RAVEL <em>FRONT</em></div><span class="status">PRIVATE REVIEW · UNPUBLISHED</span></header><section class="intro"><div><p class="eyebrow">JIM MCLAUGHLIN / ICON SERIES / EQUIPMENT STUDY 01</p><h1>Jim’s <span>off-duty kit.</span></h1></div><p>Five accessories. Built as real game models.<br>Choose an item, rotate it, get close, and replay its motion.</p></section><nav class="tabs" role="tablist" aria-label="Bundle items">${ICON_BUNDLE_ITEMS.map((i,n)=>`<button class="tab" id="tab-${i.slot}" role="tab" aria-controls="item-panel" aria-selected="${n===0}" tabindex="${n===0?0:-1}" data-slot="${i.slot}"><small>0${n+1} / ${labels[i.slot]}</small><strong>${i.name}</strong></button>`).join('')}</nav><section id="item-panel" class="workspace" role="tabpanel" aria-labelledby="tab-pickaxe"><div class="stage"><div class="stage-label"><i></i><span>ACTUAL GAME MODEL / DRAG TO ROTATE</span></div><div class="view-buttons" aria-label="Camera views"><button data-view="hero" class="active">Hero</button><button data-view="back">Back</button><button data-view="detail">Detail</button></div><p class="stage-help">Drag to orbit · Scroll or pinch to zoom</p><button class="action" id="replay">↻ Replay swing</button></div><aside class="details" aria-live="polite"><span class="index">01 / 05</span><p class="eyebrow" id="item-category"></p><h2 id="item-name"></h2><p id="item-description"></p><ul id="item-specs"></ul><p class="scale-note" id="item-note"></p></aside></section><section class="controls" aria-label="Preview controls"><div class="control-group"><button id="pause" aria-pressed="false">Pause motion</button><label>Speed <select id="speed" aria-label="Animation speed"><option value="0.35">0.35×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label><label><input type="checkbox" id="rotate">Turntable</label><label><input type="checkbox" id="dark">Dark studio</label></div><div class="control-group"><label id="scale-control" hidden><input type="checkbox" id="mannequin">On operator</label><label id="weapon-control" hidden>Weapon <select id="weapon"><option value="sprinter">Service Rifle</option><option value="doubleyolk">Breacher Shotgun</option><option value="crackshot">Sniper</option><option value="pip">Sidearm</option></select></label><button id="reset">Reset view</button></div></section><p class="overview-title">THE COMPLETE EQUIPMENT SET</p><div class="overview">${ICON_BUNDLE_ITEMS.map((i,n)=>`<button data-overview="${i.slot}"><img alt="${i.name} model preview"><div><small>0${n+1} / ${labels[i.slot].toUpperCase()}</small><strong>${i.name}</strong></div></button>`).join('')}</div><footer class="foot"><span>Outfit reviewed separately · Voting retirement prepared with this branch</span><strong>No deployment has been performed.</strong></footer></main>`;

const stage=document.querySelector('.stage');let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});}catch(e){stage.innerHTML='<p class="error">This review needs WebGL. Open the downloaded HTML in a browser with hardware acceleration.</p>';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Interactive three-dimensional accessory preview');
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.01,100),orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.12;orbit.minDistance=.18;orbit.maxDistance=18;
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
const hemi=new THREE.HemisphereLight('#f6ffeb','#65766e',.65);scene.add(hemi);
const key=new THREE.DirectionalLight('#fff4d4',2.5);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=5;key.shadow.camera.bottom=-4;key.shadow.normalBias=.025;scene.add(key);
const rim=new THREE.DirectionalLight('#cbeafa',1.7);rim.position.set(-4,3,-3);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(12,80),new THREE.ShadowMaterial({color:'#385142',opacity:.13}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const content=new THREE.Group();scene.add(content);
const state={slot:'pickaxe',time:0,paused:false,rotate:false,speed:1,camera:'hero',deployStart:-10,swingStart:-10,weapon:'sprinter',mannequin:false};
const models=new Map();let current,fitSize=1,fitCenter=new THREE.Vector3(),animationRoot=null;

function mannequin(pose='stand'){
  const g=new THREE.Group();g.name='scale-mannequin';const mat=new THREE.MeshStandardMaterial({color:'#77877b',roughness:.87,metalness:.05});
  const part=(geo,p,s=[1,1,1])=>{const m=new THREE.Mesh(geo,mat);m.position.set(...p);m.scale.set(...s);m.castShadow=true;g.add(m);return m;};
  const segment=(a,b,r)=>{const d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),m=part(new THREE.CapsuleGeometry(r,Math.max(0,d.length()-2*r),5,12),a.map((v,i)=>(v+b[i])/2));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;};
  part(new THREE.SphereGeometry(1,20,16),[0,1.69,0],[.102,.14,.103]);segment([0,1.38,0],[0,1.56,0],.065);
  part(new RoundedBoxGeometry(.37,.48,.2,3,.055),[0,1.24,0]);part(new THREE.SphereGeometry(1,16,12),[0,.96,0],[.19,.12,.12]);
  for(const side of [-1,1]){
    const hand=pose==='glide'?[side*.33,1.94,-.06]:pose==='dive'?[side*.55,1.3,.24]:[side*.29,.88,-.02],elbow=pose==='glide'?[side*.42,1.64,0]:pose==='dive'?[side*.42,1.18,.16]:[side*.27,1.13,0];
    segment([side*.19,1.43,0],elbow,.055);segment(elbow,hand,.045);part(new THREE.SphereGeometry(.047,12,8),hand,[.85,1.2,.8]);
    const hip=[side*.105,.96,0],knee=[side*(pose==='dive'?.20:.11),.52,pose==='dive'?-.08:0],ankle=[side*(pose==='dive'?.20:.12),.12,pose==='dive'?.20:0];segment(hip,knee,.076);segment(knee,ankle,.052);part(new RoundedBoxGeometry(.12,.08,.22,2,.025),[ankle[0],.05,ankle[2]-.04]);
  }
  return g;
}
function createModel(slot){
  const wrap=new THREE.Group();wrap.name=slot+'-review';let asset;
  if(slot==='pickaxe'){asset=makeShopPickaxe(ICON_BUNDLE_IDS.pickaxe);asset.rotation.z=-.28;asset.rotation.y=-.23;wrap.add(asset);}
  if(slot==='wrap'){asset=makeBlaster(state.weapon,ICON_BUNDLE_IDS.wrap);wrap.add(asset);}
  if(slot==='backbling'){asset=makeShopBack(ICON_BUNDLE_IDS.backbling);wrap.add(asset);const body=mannequin();body.visible=false;body.name='body';wrap.add(body);}
  if(slot==='glider'){asset=makeShopGlider(ICON_BUNDLE_IDS.glider);wrap.add(asset,mannequin('glide'));}
  if(slot==='trail'){asset=makeShopTrail(ICON_BUNDLE_IDS.trail);wrap.add(asset,mannequin('dive'));wrap.rotation.z=-.18;}
  wrap.traverse(m=>{for(const mat of m.isMesh?(Array.isArray(m.material)?m.material:[m.material]):[])mat.envMap=environment.texture;});wrap.userData.asset=asset;return wrap;
}
function bounds(){current.updateMatrixWorld(true);const box=new THREE.Box3();current.traverse(m=>{if(m.isMesh&&m.visible&&m.parent?.visible!==false&&!m.isInstancedMesh){m.geometry.computeBoundingBox();box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));}});return box;}
function fit(view='hero'){
  state.camera=view;const box=bounds(),size=box.getSize(new THREE.Vector3());box.getCenter(fitCenter);fitSize=Math.max(size.x,size.y,size.z);floor.position.y=box.min.y-.025;
  const direction=state.slot==='wrap'?new THREE.Vector3(2.2,.8,1.1):new THREE.Vector3(.9,.45,1.8);
  if(state.slot==='glider')direction.set(2,2.7,-3.5);if(state.slot==='trail')direction.set(1,.55,3.2);if(state.slot==='backbling')direction.set(.8,.32,2.2);
  if(view==='back')direction.set(-direction.x,direction.y,-direction.z);
  let radius=fitSize*(camera.aspect<1?2.65:1.95);
  if(view==='detail'){
    if(state.slot==='pickaxe'){
      const head=current.getObjectByName('forged-60-degree-head');head.localToWorld(fitCenter.set(.10,.01,0));radius=.66;direction.set(.5,1.4,1.7);
    }else if(state.slot==='glider'){current.getObjectByName('icon-hood').getWorldPosition(fitCenter);radius=1.9;direction.set(1,2,-2.5);}
    else if(state.slot==='wrap'){fitCenter.y+=.04;radius=fitSize*.7;direction.set(2.8,.6,.6);}
    else if(state.slot==='backbling'){current.userData.asset.localToWorld(fitCenter.set(0,.02,.14));radius=.55;direction.set(.2,.15,2.8);}
    else {fitCenter.set(.55,2.35,.3).applyMatrix4(current.matrixWorld);radius=1.6;direction.set(.6,.3,2.8);}
    if(state.slot==='pickaxe'){state.paused=true;syncControls();}
  }
  camera.position.copy(fitCenter).add(direction.normalize().multiplyScalar(radius));orbit.target.copy(fitCenter);orbit.update();
  for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===view);
}
function syncControls(){const b=document.querySelector('#pause');b.textContent=state.paused?'Play motion':'Pause motion';b.setAttribute('aria-pressed',String(state.paused));document.querySelector('#rotate').checked=state.rotate;}
function select(slot){
  state.slot=slot;stage.classList.toggle('dark',slot==='trail');document.querySelector('#dark').checked=slot==='trail';state.camera='hero';state.rotate=false;state.swingStart=-10;state.deployStart=-10;state.mannequin=false;syncControls();
  if(current)content.remove(current);if(!models.has(slot))models.set(slot,createModel(slot));current=models.get(slot);content.add(current);current.rotation.y=0;
  const item=ICON_BUNDLE_ITEMS.find(i=>i.slot===slot),index=ICON_BUNDLE_ITEMS.indexOf(item);
  document.querySelector('.index').textContent=`0${index+1} / 05`;document.querySelector('#item-category').textContent=labels[slot];document.querySelector('#item-name').textContent=item.name;document.querySelector('#item-description').textContent=item.description;
  document.querySelector('#item-specs').innerHTML=specs[slot].map((v,n)=>`<li><span>0${n+1}</span>${v}</li>`).join('');document.querySelector('#item-note').textContent=notes[slot];
  document.querySelector('#replay').textContent=({pickaxe:'↻ Replay swing',glider:'↻ Unzip & deploy',trail:'↻ Restart flow',wrap:'↻ Rotate weapon',backbling:'↻ Rotate accessory'})[slot];
  document.querySelector('#weapon-control').hidden=slot!=='wrap';document.querySelector('#scale-control').hidden=slot!=='backbling';
  for(const b of document.querySelectorAll('[data-slot]')){const active=b.dataset.slot===slot;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
  document.querySelector('#item-panel').setAttribute('aria-labelledby','tab-'+slot);update(0);fit();render();
}
function update(dt){
  if(!current)return;const asset=current.userData.asset;
  if(state.rotate)current.rotation.y+=dt*.28;
  const deploy=state.slot==='glider'?Math.min(1,Math.max(0,(state.time-state.deployStart)/1.4)):1;
  updateIconGear(asset,state.time,{deploy});
  if(state.slot==='pickaxe'){
    const age=state.time-state.swingStart,pose=pickaxePose(ICON_BUNDLE_IDS.pickaxe,age),rest=pickaxePose(ICON_BUNDLE_IDS.pickaxe,-1);
    asset.rotation.set(pose.rotation[0]-rest.rotation[0],pose.rotation[1]-.23,pose.rotation[2]-rest.rotation[2]-.28);asset.position.set(...pose.offset);asset.position.y+=0;
  }
  if(state.slot==='backbling'){
    const body=current.getObjectByName('body');body.visible=document.querySelector('#mannequin').checked;
    asset.position.set(0,body.visible?1.26:0,body.visible?.21:0);
  }
}
function render(){orbit.update();renderer.render(scene,camera);}
function resize(){const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();if(current)fit(state.camera);render();}
new ResizeObserver(resize).observe(stage);
document.querySelectorAll('[data-slot],[data-overview]').forEach(b=>b.onclick=()=>select(b.dataset.slot||b.dataset.overview));
document.querySelector('.tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const items=ICON_BUNDLE_ITEMS,n=items.findIndex(i=>i.slot===state.slot),index=e.key==='Home'?0:e.key==='End'?4:(n+(e.key==='ArrowRight'?1:4))%5;select(items[index].slot);document.querySelector('#tab-'+state.slot).focus();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>fit(b.dataset.view));
document.querySelector('#pause').onclick=()=>{state.paused=!state.paused;syncControls();};
document.querySelector('#speed').onchange=e=>state.speed=Number(e.target.value);
document.querySelector('#rotate').onchange=e=>state.rotate=e.target.checked;
document.querySelector('#dark').onchange=e=>{stage.classList.toggle('dark',e.target.checked);renderer.toneMappingExposure=e.target.checked?.95:.98;};
document.querySelector('#reset').onclick=()=>{current.rotation.y=0;fit();};
document.querySelector('#mannequin').onchange=()=>{update(0);fit();};
document.querySelector('#weapon').onchange=e=>{state.weapon=e.target.value;const old=models.get('wrap');if(old){content.remove(old);disposeBlaster(old.userData.asset);}models.delete('wrap');select('wrap');};
document.querySelector('#replay').onclick=()=>{state.paused=false;if(state.slot==='pickaxe'){state.swingStart=state.time;state.speed=.35;document.querySelector('#speed').value='0.35';if(state.camera==='detail')fit();}else if(state.slot==='glider')state.deployStart=state.time;else if(state.slot==='trail')state.time=0;else state.rotate=!state.rotate;syncControls();};

function stats(g=current){let meshes=0,triangles=0;g.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);});return {meshes,triangles};}
select('pickaxe');resize();
// The cards are rendered from the exact same objects. They are not concept art.
for(const item of ICON_BUNDLE_ITEMS){select(item.slot);render();document.querySelector(`[data-overview="${item.slot}"] img`).src=renderer.domElement.toDataURL('image/png');}
select('pickaxe');
window.__bundleReview={state,models,scene,camera,renderer,select,fit,stats,setPaused(v){state.paused=v;syncControls();},setTime(t){state.time=t;update(0);render();},advance(n=1,dt=1/60){for(let i=0;i<n;i++){state.time+=dt;update(dt);}render();},replay(){document.querySelector('#replay').click();},capture(){render();return renderer.domElement.toDataURL('image/png');},get current(){return current;}};
let previous=performance.now();function tick(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(!document.hidden){if(!state.paused){state.time+=dt*state.speed;update(dt*state.speed);}render();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
