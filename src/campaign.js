import * as T from 'three';
import {RenderBudget} from './render-budget.js';
import {FramePacer,fpsLimit} from './frame-pacing.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createWorld} from './campaign-world.js';
import {createModels,animateSoldier} from './campaign-models.js';
import {CampaignAI} from './campaign-ai.js';
import {cinematicFrame,INTRO_DURATION} from './campaign-cinematic.js';
import {CampaignAudio} from './campaign-audio.js';
import {STAGES,ENEMIES,SAVE_KEY,PREF_KEY,groupStage,clamp,distance,readSave,checkpoint,createMission,interactionBlocked,rayBox,blockedRay} from './campaign-mission.js';
import './campaign.css';

const ART=import.meta.env.BASE_URL+'campaign/blackglass.webp';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const lines=[
 ['CONTROL','Warden, the junction is beside the gate. Isolate it. Move quietly — their patrols react to noise and light.'],
 ['CONTROL','Perimeter feed is dark. Take the ramp into the logistics yard. Cargo lanes give you two ways to reach operations.'],
 ['WARDEN','Inside. Two stairs to the command gallery above us. Find the archive override.'],
 ['CONTROL','Access obtained. The manifest is in the northeast server room, downstairs. Recover it and take the rear service exit.'],
 ['CONTROL','Manifest secure. Western service ramp to the dish terrace. Disable the transmitter at its southern control panel.'],
 ['PILOT','Uplink is down. Thirty-two seconds to the northern pad. Through the service block and up the ramp. Clear my landing zone.'],
];
const weapons=[{name:'M4-K / SUPPRESSED',size:30,reserve:180,rate:.105,damage:36,reload:2.15},{name:'P9 / SIDEARM',size:12,reserve:60,rate:.24,damage:43,reload:1.55}];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const duration=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

export class BlackglassCampaign{
 constructor({onClose,volume=.65}){
  this.onClose=onClose;this.audio=new CampaignAudio();this.keys=new Set();this.handlers=[];this.phase='briefing';this.time=0;this.last=0;this.disposed=false;this.hudClock=0;this.effectPool=[];this.grenades=[];this.damageFlash=0;this.recoil=0;this.aim=0;this.weaponIndex=0;this.senseClock=0;this.nextShot=0;this.nextFootstep=0;this.interaction=0;this.radioQueue=[];this.radioEnd=0;this.smoke=[];this.flashlightOn=false;this.nightVision=false;this.pathClock=0;
  this.renderBudget=new RenderBudget();this.framePacer=new FramePacer();this.fpsLimit=60;try{this.fpsLimit=fpsLimit(JSON.parse(localStorage.getItem('yolk-settings'))?.fpsLimit);}catch{}
  this.prefs={volume:clamp(volume,0,1),sensitivity:1,quality:'balanced',radio:true,difficulty:'regular'};
  try{const p=JSON.parse(localStorage.getItem(PREF_KEY));if(p){this.prefs={...this.prefs,volume:clamp(Number(p.volume)||0,0,1),sensitivity:clamp(Number(p.sensitivity)||1,.3,2),quality:p.quality==='high'?'high':'balanced',radio:p.radio!==false,difficulty:p.difficulty==='story'?'story':'regular'};}}catch{}
  this.save=readSave(localStorage);this.audio.radio=this.prefs.radio;this.audio.volume=this.prefs.volume;
 }
 async open(){
  this.root=document.createElement('section');this.root.id='blackglass';this.root.tabIndex=-1;this.root.setAttribute('aria-label','Operation Blackglass campaign');
  this.root.innerHTML=`<div class="bg-loading"><span class="bg-kicker">OWNER CAMPAIGN PREVIEW</span><h1>BLACKGLASS</h1><p>Establishing the field…</p></div>`;
  document.body.classList.add('campaign-active');document.body.append(this.root);await new Promise(requestAnimationFrame);
  try{this.build();this.bind();this.showBriefing();this.raf=requestAnimationFrame(t=>this.frame(t));}catch(error){this.close();throw error;}
 }
 build(){
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.prefs.quality==='high'?1.5:1));this.renderer.setSize(innerWidth,innerHeight);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.55;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.renderer.info.autoReset=false;this.renderer.autoClear=false;this.needsRender=true;
  this.canvas=this.renderer.domElement;this.canvas.className='bg-canvas';this.canvas.setAttribute('aria-label','Blackglass 3D mission');this.root.replaceChildren(this.canvas);
  this.scene=new T.Scene();this.scene.fog=new T.FogExp2('#172832',.0045);this.camera=new T.PerspectiveCamera(73,innerWidth/innerHeight,.07,1000);this.camera.rotation.order='YXZ';
  this.scene.add(new T.HemisphereLight('#b4d2de','#394548',1.45));const sun=this.moon=new T.DirectionalLight('#bdd1dc',2.3);sun.position.set(-35,60,-70);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:180});sun.shadow.bias=-.0005;sun.shadow.normalBias=.08;this.scene.add(sun,sun.target);
  const roomEnvironment=new RoomEnvironment(),pmrem=new T.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(roomEnvironment,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.3;roomEnvironment.dispose();pmrem.dispose();
  this.world=createWorld(this.scene);this.ai=new CampaignAI(this.world);this.models=createModels();
  this.weaponScene=new T.Scene();this.weaponScene.add(new T.HemisphereLight('#d4e1e3','#4c5146',1.8));const weaponLight=new T.DirectionalLight('#b0c6d1',2);weaponLight.position.set(-2,4,1);this.weaponScene.add(weaponLight);this.weaponCamera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.01,10);this.weaponRig=new T.Group();this.weaponScene.add(this.weaponRig);this.rifle=this.models.weapon(false,true);this.pistol=this.models.weapon(true,true);this.handModels=this.models.arms();this.weaponRig.add(this.rifle,this.pistol,this.handModels);
  this.weaponScene.environment=this.environment.texture;this.weaponScene.environmentIntensity=.55;
  this.muzzle=new T.Mesh(new T.ConeGeometry(.085,.28,7),new T.MeshBasicMaterial({color:'#ffdca2',transparent:true,opacity:.8,depthTest:false}));this.muzzle.rotation.x=-Math.PI/2;this.muzzle.position.set(0,.015,-1.1);this.muzzle.visible=false;this.weaponRig.add(this.muzzle);
  this.flashlight=new T.SpotLight('#dbe6de',35,40,.44,.6,1.2);this.flashlight.visible=false;this.scene.add(this.flashlight,this.flashlight.target);
  this.heli=this.models.helicopter();this.heli.position.set(65,32,-155);this.scene.add(this.heli);
  this.enemies=ENEMIES.map((spec,i)=>{const mesh=this.models.soldier(spec.role);mesh.traverse(n=>{n.castShadow=false;});mesh.position.set(spec.x,spec.y,spec.z);this.scene.add(mesh);return {...spec,mesh,health:100,startX:spec.x,startY:spec.y,startZ:spec.z,y:spec.y,yaw:spec.yaw,alert:0,aware:false,nextFire:0,burst:0,travel:0,turn:0,deadTime:0,index:i};});
  this.fxGeo=new T.SphereGeometry(1,6,4);this.fxMaterial=new T.MeshBasicMaterial({color:'#ffbc65',transparent:true,opacity:.8,depthWrite:false});
  for(let i=0;i<48;i++){const mesh=new T.Mesh(this.fxGeo,this.fxMaterial);mesh.visible=false;this.scene.add(mesh);this.effectPool.push({mesh,life:0,vx:0,vy:0,vz:0});}
  this.root.insertAdjacentHTML('beforeend',`<div class="bg-vignette"></div><div class="bg-damage"></div><div class="bg-hud" hidden>
   <div class="bg-top"><div class="bg-objective"><span class="bg-kicker" id="bg-chapter"></span><strong id="bg-objective"></strong><small id="bg-detail"></small></div><div class="bg-compass"><span>N</span><b id="bg-bearing">000</b><span>OP / 07</span></div><button class="bg-menu-button" data-bg="pause" aria-label="Pause mission">Ⅱ <span>ESC</span></button></div>
   <div class="bg-marker" aria-hidden="true"><span>◇</span><small></small></div><div class="bg-crosshair"><i></i><b></b><em></em></div><div class="bg-hitmarker"></div><div class="bg-alert" hidden><span></span><b>PATROL ALERTED</b></div>
   <div class="bg-interact" hidden><span><kbd>E</kbd><b></b></span><div><i></i></div><small>HOLD TO INTERACT</small></div>
   <div class="bg-radio" role="status"><span></span><p></p></div><div class="bg-checkpoint" role="status"></div>
   <div class="bg-bottom"><div class="bg-vitals"><span>WARDEN / FIELD STATUS</span><div class="bg-health-track"><i></i></div><small id="bg-health"></small><small id="bg-stance"></small></div><div class="bg-controls"><span><kbd>WASD</kbd> MOVE</span><span><kbd>SHIFT</kbd> SPRINT</span><span><kbd>C</kbd> CROUCH</span><span><kbd>R</kbd> RELOAD</span><span><kbd>G</kbd> FRAG</span><span><kbd>N</kbd> NVG</span></div><div class="bg-ammo"><span id="bg-weapon"></span><div><b id="bg-rounds"></b><small id="bg-reserve"></small></div><small id="bg-equipment"></small></div></div>
  </div><div class="bg-cinematic" hidden><div class="bg-letterbox bg-letterbox-top"></div><div class="bg-letterbox bg-letterbox-bottom"></div><div class="bg-cinema-title"><small></small><h2></h2></div><div class="bg-cinema-subtitle"><b></b><p></p></div><button data-bg="skip-intro">SKIP INTRO <kbd>SPACE</kbd></button><div class="bg-cinema-fade"></div></div><div class="bg-bark" hidden></div><div class="bg-overlay"></div>`);
  this.ui=Object.fromEntries(['chapter','objective','detail','bearing','health','stance','weapon','rounds','reserve','equipment'].map(k=>[k,this.root.querySelector('#bg-'+k)]));
  this.hud=this.root.querySelector('.bg-hud');this.overlay=this.root.querySelector('.bg-overlay');this.interactUI=this.root.querySelector('.bg-interact');this.marker=this.root.querySelector('.bg-marker');this.radioUI=this.root.querySelector('.bg-radio');this.alertUI=this.root.querySelector('.bg-alert');this.hitUI=this.root.querySelector('.bg-hitmarker');this.crosshair=this.root.querySelector('.bg-crosshair');this.damageUI=this.root.querySelector('.bg-damage');this.healthUI=this.root.querySelector('.bg-health-track i');this.checkpointUI=this.root.querySelector('.bg-checkpoint');
  this.cinemaUI=this.root.querySelector('.bg-cinematic');this.barkUI=this.root.querySelector('.bg-bark');this.player={x:42,y:4,z:96,yaw:0,pitch:0,health:100,vy:0,crouch:false,stamina:1,lastDamage:-99};this.world.setStage(0);this.resize();
 }
 listen(target,type,handler,options){target.addEventListener(type,handler,options);this.handlers.push(()=>target.removeEventListener(type,handler,options));}
 bind(){
  this.listen(window,'resize',()=>this.resize());
  this.listen(this.canvas,'webglcontextlost',e=>{e.preventDefault();this.pause('Graphics were interrupted. Your last checkpoint is saved. Exit and reopen the mission.');});
  this.listen(this.root,'contextmenu',e=>e.preventDefault());
  this.listen(this.root,'click',e=>{const button=e.target.closest('[data-bg]');if(button)void this.action(button.dataset.bg);});
  this.listen(this.root,'input',e=>{const key=e.target.dataset.bgSetting;if(!key)return;this.prefs[key]=key==='radio'?e.target.checked:key==='volume'||key==='sensitivity'?Number(e.target.value):e.target.value;this.audio.radio=this.prefs.radio;this.audio.setVolume(this.prefs.volume);this.savePreferences();if(key==='quality'){this.renderBudget.reset();this.resize();}});
  this.listen(window,'keydown',e=>{
   if(this.disposed||e.target.matches('input,select,textarea'))return;
   if(this.phase==='cinematic'){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Space')this.finishIntro();if(e.code==='Escape')this.pause();return;}
   if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(this.phase==='playing')this.pause();return;}
   if(this.phase!=='playing')return;e.preventDefault();e.stopImmediatePropagation();this.keys.add(e.code);if(e.repeat)return;
   if(e.code==='KeyR')this.reload();if(e.code==='Digit1'||e.code==='Digit2')this.swap(e.code==='Digit1'?0:1);if(e.code==='KeyG')this.throwGrenade();if(e.code==='KeyX')this.stim();if(e.code==='KeyF'){this.flashlightOn=!this.flashlightOn;this.audio.sound('click',.3);}if(e.code==='KeyN'){this.nightVision=!this.nightVision;this.root.classList.toggle('bg-nvg',this.nightVision);this.renderer.toneMappingExposure=this.nightVision?2.8:1.55;this.audio.sound('click',.4);}if(e.code==='Space'&&this.player.grounded){this.player.vy=4.3;}
  },true);
  this.listen(window,'keyup',e=>{this.keys.delete(e.code);if(e.code==='KeyE')this.interactLatch=false;if(this.phase==='playing')e.stopImmediatePropagation();},true);
  this.listen(this.canvas,'mousedown',e=>{if(this.phase!=='playing')return;e.preventDefault();if(document.pointerLockElement!==this.canvas){void this.capture();return;}if(e.button===0)this.firing=true;if(e.button===2)this.aiming=true;});
  this.listen(window,'mouseup',e=>{if(e.button===0)this.firing=false;if(e.button===2)this.aiming=false;});
  this.listen(document,'mousemove',e=>{if(this.phase!=='playing'||document.pointerLockElement!==this.canvas)return;const k=.0018*this.prefs.sensitivity*(this.aiming?.58:1);this.player.yaw-=e.movementX*k;this.player.pitch=clamp(this.player.pitch-e.movementY*k,-1.4,1.4);});
  this.listen(document,'pointerlockchange',()=>{if(this.phase==='playing'&&document.pointerLockElement!==this.canvas)this.pause('Click Resume to capture the mouse and continue.');});
  this.listen(document,'pointerlockerror',()=>{if(this.phase==='playing')this.pause('Mouse capture needs a click. Select Resume to try again.');});
  this.listen(window,'blur',()=>{if(['playing','cinematic'].includes(this.phase))this.pause();});
  this.listen(document,'visibilitychange',()=>{if(document.hidden&&['playing','cinematic'].includes(this.phase))this.pause();});
 }
 savePreferences(){try{localStorage.setItem(PREF_KEY,JSON.stringify(this.prefs));}catch{}}
 resize(){if(!this.renderer)return;this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.prefs.quality==='high'?1.5:1,Math.sqrt(2300000/Math.max(1,innerWidth*innerHeight)))*this.renderBudget.scale);this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=this.weaponCamera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.weaponCamera.updateProjectionMatrix();this.needsRender=true;}
 settingsHTML(){return `<details class="bg-settings"><summary>FIELD SETTINGS & CONTROLS</summary><div class="bg-setting-grid"><label>Mouse sensitivity<input aria-label="Mouse sensitivity" data-bg-setting="sensitivity" type="range" min=".3" max="2" step=".05" value="${this.prefs.sensitivity}"></label><label>Audio<input aria-label="Mission volume" data-bg-setting="volume" type="range" min="0" max="1" step=".05" value="${this.prefs.volume}"></label><label>Rendering<select data-bg-setting="quality"><option value="balanced" ${this.prefs.quality==='balanced'?'selected':''}>Balanced</option><option value="high" ${this.prefs.quality==='high'?'selected':''}>High resolution</option></select></label><label class="bg-check"><input type="checkbox" data-bg-setting="radio" ${this.prefs.radio?'checked':''}>Spoken radio · device voice</label></div><p>WASD move · Mouse aim · Left click fire · Right click sights · Shift sprint · C / Ctrl crouch · Space jump · R reload · 1 / 2 weapons · Hold E interact · G grenade · X field dressing · F flashlight · N night vision · Esc pause</p><small>Subtitles always on. Progress saves at mission checkpoints in this browser.</small></details>`;}
 showBriefing(){
  this.phase='briefing';this.overlay.hidden=false;this.hud.hidden=true;this.overlay.style.setProperty('--bg-art',`url("${ART}")`);this.overlay.className='bg-overlay bg-briefing';
  this.overlay.innerHTML=`<div class="bg-title-top"><span>BLACKGLASS / FIELD OPERATIONS</span><span>OWNER PREVIEW <i></i></span></div><div class="bg-brief-content"><span class="bg-kicker">CHAPTER ONE / STATION SEVEN</span><h1>BLACK<br>GLASS<span>OPERATION 01</span></h1><p class="bg-logline">One signal. Thousands of lives.<br>Make sure it never leaves the coast.</p><div class="bg-mission-facts"><span><small>LOCATION</small>NORTHERN COAST</span><span><small>LOCAL TIME</small>02:17 / HEAVY RAIN</span><span><small>CALLSIGN</small>WARDEN</span></div><p class="bg-brief-copy">A private army has seized Station Seven. Its uplink is broadcasting civilian evacuation routes. Infiltrate the compound, recover the archive, and cut the transmission. Control will stay on the radio.</p><label class="bg-difficulty">DIFFICULTY<select data-bg-setting="difficulty"><option value="regular" ${this.prefs.difficulty==='regular'?'selected':''}>Regular · deliberate combat</option><option value="story" ${this.prefs.difficulty==='story'?'selected':''}>Story · lighter incoming fire</option></select></label><div class="bg-actions">${this.save?`<button class="bg-primary" data-bg="continue">CONTINUE <span>→</span><small>${esc(STAGES[this.save.stage].chapter)}</small></button>`:''}<button class="${this.save?'bg-secondary':'bg-primary'}" data-bg="new">${this.save?'NEW MISSION':'BEGIN MISSION'} <span>→</span></button><button class="bg-quiet" data-bg="exit">OWNER CONTROLS</button></div>${this.settingsHTML()}</div><div class="bg-title-bottom"><span>SOLO STORY MISSION</span><span>INFILTRATE / RECOVER / EXTRACT</span></div>`;
 }
 async action(action){
  if(action==='exit'){this.close();return;}
  if(action==='skip-intro'){this.finishIntro();return;}
  if(action==='pause'){this.pause();return;}
  if(action==='new'||action==='continue'||action==='retry'){
   const save=action==='continue'?this.save:action==='retry'?this.mission.checkpoint:null;
   if(action==='new'){try{localStorage.removeItem(SAVE_KEY);}catch{}this.save=null;}
   this.start(save);if(action==='new'){this.beginIntro();}else await this.capture();return;
  }
  if(action==='resume'){if(this.resumePhase==='cinematic'){this.phase='cinematic';this.overlay.hidden=true;this.cinemaUI.hidden=false;void this.audio.start();this.last=performance.now();}else await this.capture();return;}
  if(action==='briefing'){this.audio.pause();this.showBriefing();}
 }
 start(save=null){
  this.audio.resetMission();
  this.mission=createMission(save,this.prefs.difficulty);this.time=0;this.nextShot=0;this.reloadUntil=0;this.interaction=0;this.interactLatch=false;this.radioQueue=[];this.radioEnd=0;this.damageFlash=0;this.hitUntil=0;this.stimUntil=0;this.recoil=0;this.nextFootstep=0;this.senseClock=0;this.pathClock=0;this.nav=null;this.alertSpoken=false;this.heliCalled=false;this.grenadeCooldown=0;this.muzzleUntil=0;this.heli.position.set(65,32,-155);this.grenades.forEach(g=>{this.scene.remove(g.mesh);g.mesh.geometry.dispose();g.mesh.material.dispose();});this.grenades=[];
  const spawn=STAGES[this.mission.stage].spawn;Object.assign(this.player,{...spawn,pitch:0,health:100,vy:0,crouch:false,stamina:1,lastDamage:-99});this.weaponIndex=0;this.ammo=weapons.map(w=>({rounds:w.size,reserve:w.reserve}));this.frags=3;this.dressings=2;this.keys.clear();this.firing=this.aiming=false;
  for(const e of this.enemies){const active=(groupStage(e.group)>=this.mission.stage||e.group===STAGES[this.mission.stage]?.clear)&&!this.mission.defeated.includes(e.id);Object.assign(e,{x:ENEMIES[e.index].x,z:ENEMIES[e.index].z,y:ENEMIES[e.index].y,yaw:ENEMIES[e.index].yaw,health:active?100:0,alert:0,aware:false,nextFire:1+e.index*.13,burst:0,travel:0,deadTime:0,turn:0});e.mesh.visible=active;e.mesh.position.set(e.x,e.y,e.z);e.mesh.userData.rig.rotation.set(0,0,0);e.mesh.userData.rig.position.y=0;}
  this.ai.reset(this.enemies);this.cinemaUI.hidden=true;this.resumePhase='playing';this.suppliesUsed=new Set();for(const fx of this.effectPool){fx.life=0;fx.mesh.visible=false;}this.world.setStage(this.mission.stage);this.updateShadow();this.setObjective();this.radio(...lines[this.mission.stage]);this.phase='playing';this.hud.hidden=false;this.overlay.hidden=true;this.root.classList.remove('bg-dead');this.updateHUD();
 }
 beginIntro(){
  this.phase='cinematic';this.introTime=0;this.introShot=-1;this.hud.hidden=true;this.overlay.hidden=true;this.cinemaUI.hidden=false;this.keys.clear();this.firing=this.aiming=false;this.audio.resetMission();this.radioQueue=[];void this.audio.start().catch(()=>{});this.updateIntro(0);this.cinemaUI.querySelector('button').focus();
 }
 updateIntro(dt){
  this.introTime+=dt;const f=cinematicFrame(this.introTime);this.camera.position.set(...f.position);this.camera.lookAt(...f.look);this.camera.fov=f.fov;this.camera.updateProjectionMatrix();this.cinemaUI.querySelector('.bg-cinema-fade').style.opacity=String(f.fade);
  if(this.introShot!==f.index){this.introShot=f.index;this.cinemaUI.querySelector('h2').textContent=f.title;this.cinemaUI.querySelector('.bg-cinema-title small').textContent=f.sub;this.cinemaUI.querySelector('.bg-cinema-subtitle b').textContent=f.speaker;this.cinemaUI.querySelector('.bg-cinema-subtitle p').textContent=f.text;this.audio.speak(f.text);this.moon.position.set(f.look[0]-30,f.look[1]+65,f.look[2]-35);this.moon.target.position.set(...f.look);this.renderer.shadowMap.needsUpdate=true;}
  this.world.update(this.introTime,{x:f.position[0],y:f.position[1],z:f.position[2]});if(f.done)this.finishIntro();
 }
 finishIntro(){
  if(this.phase!=='cinematic')return;this.cinemaUI.hidden=true;this.audio.resetMission();this.radioQueue=[];this.radioEnd=0;this.radio(...lines[this.mission.stage]);this.phase='paused';this.resumePhase='playing';this.updateShadow();this.updatePlayer(0);this.pause('You are on the coast. Enter the mission to capture your mouse and begin.');const b=this.overlay.querySelector('[data-bg=resume]');if(b)b.textContent='ENTER MISSION →';
 }
 async capture(){
  if(this.disposed)return;this.keys.clear();this.firing=this.aiming=false;this.phase='playing';this.overlay.hidden=true;this.hud.hidden=false;this.last=performance.now();void this.audio.start().catch(()=>{});
  try{await this.canvas.requestPointerLock();}catch{this.pause('Mouse capture needs a click. Select Resume to try again.');}
 }
 pause(message='The field is paused. Your checkpoint is safe.'){
  if(this.disposed||!['playing','paused','cinematic'].includes(this.phase))return;if(this.phase!=='paused')this.resumePhase=this.phase;this.phase='paused';this.cinemaUI.hidden=true;this.keys.clear();this.firing=this.aiming=false;this.audio.pause();if(document.pointerLockElement===this.canvas)document.exitPointerLock();this.overlay.hidden=false;this.overlay.className='bg-overlay bg-pause';this.overlay.innerHTML=`<div class="bg-pause-card"><span class="bg-kicker">OPERATION BLACKGLASS</span><h2>HOLD POSITION</h2><p>${esc(message)}</p><div class="bg-pause-objective"><small>CURRENT OBJECTIVE</small><strong>${esc(STAGES[this.mission.stage].title)}</strong></div><div class="bg-actions"><button class="bg-primary" data-bg="resume">RESUME <span>→</span></button><button class="bg-secondary" data-bg="retry">RESTART CHECKPOINT</button><button class="bg-quiet" data-bg="exit">EXIT TO OWNER CONTROLS</button></div>${this.settingsHTML()}</div>`;this.overlay.querySelector('[data-bg=resume]')?.focus();
 }
 radio(speaker,text){this.radioQueue.push({speaker,text});}
 updateRadio(){if(this.time<this.radioEnd)return;const line=this.radioQueue.shift();if(!line){this.radioUI.classList.remove('visible');return;}this.radioUI.querySelector('span').textContent=line.speaker+' / ENCRYPTED';this.radioUI.querySelector('p').textContent=line.text;this.radioUI.classList.add('visible');this.radioEnd=this.time+Math.max(5,line.text.length*.055);this.audio.speak(line.text);}
 setObjective(){const s=STAGES[this.mission.stage];this.ui.chapter.textContent=s.chapter;this.ui.objective.textContent=s.title;this.ui.detail.textContent=s.detail;this.interaction=0;this.interactLatch=this.keys.has('KeyE');this.checkpointUI.textContent=this.mission.stage?'CHECKPOINT / '+s.title.toUpperCase():'STATION SEVEN / 02:17';this.checkpointUntil=this.time+4;}
 saveCheckpoint(){this.mission.checkpoint=checkpoint(this.mission);this.save=this.mission.checkpoint;try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.save));}catch{this.checkpointUI.textContent='CHECKPOINT HELD FOR THIS SESSION';}}
 advance(){
  if(this.mission.stage===STAGES.length-1){this.complete();return;}
  this.mission.stage++;this.world.setStage(this.mission.stage);this.setObjective();this.saveCheckpoint();this.audio.tone(720,.12,.12);this.audio.tone(1080,.18,.08,.14);this.radio(...lines[this.mission.stage]);this.ammo[0].reserve=Math.max(this.ammo[0].reserve,90);this.player.health=Math.max(this.player.health,75);this.updateShadow();
  if(this.mission.stage===5){this.burstFX(V(-22,37,-42),24,5);this.audio.sound('explosion',.6);this.damageFlash=.3;this.mission.extractionTime=0;}
 }
 updateShadow(){this.shadowAnchor={x:this.player.x,z:this.player.z};this.moon.position.set(this.player.x-30,this.player.y+65,this.player.z-35);this.moon.target.position.set(this.player.x,this.player.y,this.player.z);this.renderer.shadowMap.needsUpdate=true;}
 swap(index){if(this.weaponIndex===index)return;this.weaponIndex=index;this.reloadUntil=0;this.stimUntil=0;this.recoil=.15;this.audio.sound('click',.5);}
 reload(){const a=this.ammo?.[this.weaponIndex],w=weapons[this.weaponIndex];if(!a||this.reloadUntil>this.time||!a.reserve||a.rounds===w.size)return;this.reloadUntil=this.time+w.reload;this.stimUntil=0;this.audio.sound('click',.65);}
 stim(){if(!this.dressings||this.player.health>=100||this.stimUntil>this.time)return;this.stimUntil=this.time+1.5;this.reloadUntil=0;this.dressings--;this.audio.sound('click',.5);}
 direction(spread=0){const p=this.player,yaw=p.yaw+(Math.random()-.5)*spread,pitch=p.pitch+(Math.random()-.5)*spread;return V(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));}
 fire(){
  const w=weapons[this.weaponIndex],a=this.ammo[this.weaponIndex];if(this.time<this.nextShot||this.reloadUntil>this.time||this.stimUntil>this.time)return;if(!a.rounds){this.reload();return;}a.rounds--;this.nextShot=this.time+w.rate;this.mission.shots++;this.recoil=Math.min(.14,this.recoil+.055);this.player.pitch=clamp(this.player.pitch+.006,-1.4,1.4);this.audio.sound(this.weaponIndex?'pistol':'rifle',this.weaponIndex?.7:.6);this.muzzleUntil=this.time+.045;
  const origin=V(this.player.x,this.player.y+(this.player.crouch?1.08:1.64),this.player.z),dir=this.direction(this.aiming?.003:.017);let nearest=100,hit=null,head=false;
  for(const b of this.world.boxes)nearest=Math.min(nearest,rayBox(origin,dir,b,100));
  for(const e of this.enemies){if(!e.mesh.visible||e.health<=0)continue;const body=rayBox(origin,dir,{x:e.x,y:e.y+(e.crouched?.65:1.03),z:e.z,sx:.57,sy:e.crouched?.85:1.2,sz:.46},nearest),skull=rayBox(origin,dir,{x:e.x,y:e.y+(e.crouched?1.2:1.64),z:e.z,sx:.3,sy:.32,sz:.3},nearest);const near=Math.min(body,skull);if(near<nearest){nearest=near;hit=e;head=skull<body;}}
  const point=origin.clone().addScaledVector(dir,nearest);this.burstFX(point,hit?4:3,hit?1.1:1.6);if(hit){this.mission.hits++;this.hurtEnemy(hit,w.damage*(head?3:1));this.hitUntil=this.time+.16;this.audio.tone(hit.health<=0?390:620,.025,.03);}
  this.ai.noise(this.player,this.weaponIndex?45:19,this.time);this.ai.suppress(origin,point,this.enemies,this.time);
 }
 hurtEnemy(e,amount){if(e.health<=0)return;e.health-=amount;this.ai.hit(e,this.player,this.time);if(e.health<=0){this.mission.kills++;this.mission.defeated.push(e.id);e.deadTime=.001;e.mesh.userData.rig.rotation.z=(e.index%2?1:-1)*.12;if(e.cover)this.ai.claims.delete(e.cover.id);this.ai.noise(e,13,this.time,'casualty');}}

 hurt(amount,enemy){if(this.phase!=='playing')return;this.player.health=Math.max(0,this.player.health-amount*(this.mission.difficulty==='story'?.55:1));this.player.lastDamage=this.time;this.damageFlash=Math.min(1,this.damageFlash+.5);this.audio.sound('click',.22);if(this.player.health<=0)this.die();}
 throwGrenade(){
  if(!this.frags||this.time<(this.grenadeCooldown||0))return;this.frags--;this.grenadeCooldown=this.time+1;const dir=this.direction(),material=new T.MeshStandardMaterial({color:'#4e5b43',roughness:.7}),mesh=new T.Mesh(new T.SphereGeometry(.08,7,5),material);mesh.position.set(this.player.x,this.player.y+1.4,this.player.z);this.scene.add(mesh);this.grenades.push({mesh,v:dir.multiplyScalar(12).add(V(0,3,0)),life:2.5});this.audio.sound('click',.6);
 }
 burstFX(position,count=4,speed=2){for(let i=0;i<count;i++){const fx=this.effectPool.find(f=>f.life<=0);if(!fx)break;fx.life=.25+Math.random()*.25;fx.mesh.position.copy(position);fx.mesh.scale.setScalar(.018+Math.random()*.025);fx.mesh.visible=true;fx.vx=(Math.random()-.5)*speed;fx.vy=Math.random()*speed;fx.vz=(Math.random()-.5)*speed;}}
 updateEffects(dt){
  for(const f of this.effectPool){if(f.life<=0)continue;f.life-=dt;f.mesh.visible=f.life>0;f.vy-=6*dt;f.mesh.position.x+=f.vx*dt;f.mesh.position.y+=f.vy*dt;f.mesh.position.z+=f.vz*dt;}
  for(let i=this.grenades.length-1;i>=0;i--){const g=this.grenades[i],p=g.mesh.position,old=p.clone();g.life-=dt;g.v.y-=12*dt;p.addScaledVector(g.v,dt);const floor=this.world.floor(p.x,p.z,p.y+.8);if(p.y<floor+.09){p.y=floor+.09;g.v.y=Math.abs(g.v.y)*.4;g.v.x*=.7;g.v.z*=.7;}
   if(blockedRay(old,p,this.world.boxes)){p.copy(old);g.v.x*=-.5;g.v.z*=-.5;g.v.y=Math.abs(g.v.y)*.4;}
   g.mesh.rotation.x+=dt*4;if(g.life>0)continue;this.audio.sound('explosion',Math.min(1,15/(distance(p,this.player)+1)));this.burstFX(p,22,8);for(const e of this.enemies){if(e.health<=0||!e.mesh.visible)continue;const d=distance(p,e);if(d<8&&!blockedRay({x:p.x,y:p.y+.2,z:p.z},{x:e.x,y:e.y+1,z:e.z},this.world.boxes))this.hurtEnemy(e,150*(1-d/10));if(d<35)this.ai.noise(p,40,this.time,'explosion');}
   const d=distance(p,this.player);if(d<6&&!blockedRay({x:p.x,y:p.y+.2,z:p.z},{x:this.player.x,y:this.player.y+1,z:this.player.z},this.world.boxes))this.hurt(90*(1-d/6));this.scene.remove(g.mesh);g.mesh.geometry.dispose();g.mesh.material.dispose();this.grenades.splice(i,1);
  }
 }
 updateEnemies(dt){
  for(const e of this.enemies){e.mesh.visible=e.health>0||e.deadTime>0;if(e.health<=0&&e.deadTime){e.deadTime+=dt;animateSoldier(e.mesh,0,0,e.deadTime);}}
  this.threats=this.ai.update(dt,this.time,this.player,this.enemies,{stage:this.mission.stage,powerOff:this.mission.stage>0,flashlight:this.flashlightOn,reloading:this.reloadUntil>this.time,moving:this.moving,difficulty:this.mission.difficulty,grenades:this.grenades,
   onFire:(e,chance)=>{const d=distance(e,this.player);this.audio.sound('enemy',Math.min(.6,8/(d+1)),Math.sin(this.player.yaw-e.yaw)*.6);this.burstFX(V(e.x,e.y+1.3,e.z),2,2);if(Math.random()<chance)this.hurt(e.role==='support'?10:8,e);else this.burstFX(V(this.player.x+(Math.random()-.5)*2,this.player.y+.5,this.player.z-1),2,2);},
   onGrenade:(e,target)=>this.enemyGrenade(e,target),onBark:text=>{this.barkUI.hidden=false;this.barkUI.textContent='HOSTILE / '+text;this.barkUntil=this.time+3;this.audio.tone(240,.1,.035);}
  });
  for(const e of this.enemies)if(e.health>0){e.mesh.position.set(e.x,e.y,e.z);e.mesh.rotation.y=e.yaw;animateSoldier(e.mesh,e.travel,e.speed,0,e.crouched,e.state==='reload');}
  if(this.time>this.barkUntil)this.barkUI.hidden=true;this.audio.intensity(Math.min(1,this.threats/4));
 }
 enemyGrenade(e,target){
  const mesh=new T.Mesh(new T.SphereGeometry(.09,8,6),new T.MeshStandardMaterial({color:'#6b6048',emissive:'#b94720',emissiveIntensity:.6}));mesh.position.set(e.x,e.y+1.4,e.z);this.scene.add(mesh);const flight=1.15;this.grenades.push({mesh,v:V((target.x-e.x)/flight,(target.y+ .1-mesh.position.y)/flight+6*flight,(target.z-e.z)/flight),life:3.2,hostile:true});
 }
 updatePlayer(dt){
  const p=this.player,k=this.keys;p.crouch=k.has('KeyC')||k.has('ControlLeft')||k.has('ControlRight');const forward=Number(k.has('KeyW')||k.has('ArrowUp'))-Number(k.has('KeyS')||k.has('ArrowDown')),side=Number(k.has('KeyD')||k.has('ArrowRight'))-Number(k.has('KeyA')||k.has('ArrowLeft')),moving=Math.hypot(forward,side)>0,sprint=moving&&forward>0&&!p.crouch&&!this.aiming&&k.has('ShiftLeft')&&p.stamina>.05;
  p.stamina=clamp(p.stamina+dt*(sprint?-.16:.12),0,1);const speed=p.crouch?1.7:sprint?6.2:this.aiming?2.4:3.5;this.moving=moving?speed:0;
  if(moving){const n=Math.max(1,Math.hypot(forward,side));this.world.move(p,(-Math.sin(p.yaw)*forward+Math.cos(p.yaw)*side)/n*speed*dt,(-Math.cos(p.yaw)*forward-Math.sin(p.yaw)*side)/n*speed*dt,.3,p.crouch?1.15:1.75);if(this.time>this.nextFootstep&&p.grounded){this.nextFootstep=this.time+(sprint?.29:p.crouch?.66:.47);this.audio.sound('step',p.crouch?.35:.9);if(!p.crouch)this.ai.noise(p,sprint?18:9,this.time,'footstep');}}
  const ground=this.world.floor(p.x,p.z,p.y+.5);p.vy-=12*dt;const oldY=p.y;p.y+=p.vy*dt;let floor=ground;
  for(const b of this.world.index.near(p.x,p.z,1)){const top=b.y+b.sy/2;if(b.active!==false&&oldY>=top-.06&&p.x>b.x-b.sx/2-.15&&p.x<b.x+b.sx/2+.15&&p.z>b.z-b.sz/2-.15&&p.z<b.z+b.sz/2+.15)floor=Math.max(floor,top);}
  p.grounded=p.y<=floor;if(p.grounded){p.y=floor;p.vy=0;}if(p.y<-8){this.die();return;}if(distance(p,this.shadowAnchor||p)>12)this.updateShadow();
  if(this.time-p.lastDamage>6&&p.health<100)p.health=Math.min(100,p.health+dt*(this.mission.difficulty==='story'?13:8));
  if(this.stimUntil&&this.time>=this.stimUntil){this.stimUntil=0;p.health=Math.min(100,p.health+65);this.audio.tone(540,.15,.07);}
  if(this.reloadUntil&&this.time>=this.reloadUntil){const a=this.ammo[this.weaponIndex],needed=Math.min(weapons[this.weaponIndex].size-a.rounds,a.reserve);a.rounds+=needed;a.reserve-=needed;this.reloadUntil=0;this.audio.sound('click',.7);}
  if(this.firing&&!sprint)this.fire();
  this.aim=T.MathUtils.damp(this.aim,this.aiming&&!sprint&&this.reloadUntil<=this.time?1:0,13,dt);this.recoil=T.MathUtils.damp(this.recoil,0,15,dt);this.damageFlash=Math.max(0,this.damageFlash-dt*.8);
  const height=p.crouch?1.08:1.64;this.eyeHeight=T.MathUtils.damp(this.eyeHeight||1.64,height,12,dt);const bob=moving?Math.sin(this.time*(sprint?17:11))*.019*(1-this.aim*.8):Math.sin(this.time*1.5)*.003;
  this.camera.position.set(p.x,p.y+this.eyeHeight+bob,p.z);this.camera.rotation.set(p.pitch+this.recoil*.22,p.yaw,0);const fov=73-this.aim*19+(sprint?4:0);if(Math.abs(this.camera.fov-fov)>.02){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
  this.flashlight.visible=this.flashlightOn;this.flashlight.position.copy(this.camera.position);this.flashlight.target.position.copy(this.camera.position).add(this.direction().multiplyScalar(15));
  const reload=this.reloadUntil>this.time?Math.sin((1-(this.reloadUntil-this.time)/weapons[this.weaponIndex].reload)*Math.PI):0;
  this.weaponRig.position.set(.23*(1-this.aim),-.22+(this.weaponIndex?.159:.055)*this.aim-Math.abs(bob)*.7-reload*.22,-.58+this.recoil-reload*.15);this.weaponRig.rotation.set(this.recoil*.5-reload*.5+(sprint?.45:0),reload*-.65,Math.sin(this.time*6)*this.moving*.001+reload*-.4);this.rifle.visible=this.weaponIndex===0;this.pistol.visible=this.weaponIndex===1;this.muzzle.visible=this.time<(this.muzzleUntil||0);this.muzzle.position.z=this.weaponIndex?-.44:-1.1;this.muzzle.scale.setScalar(this.weaponIndex?.7:.45);
  for(const gun of [this.rifle,this.pistol])gun.getObjectByName('magazine').position.y=-reload*.3;
 }
 updateInteraction(dt){
  const stage=STAGES[this.mission.stage],d=Math.hypot(this.player.x-stage.target.x,this.player.y-stage.target.y,this.player.z-stage.target.z),blocked=interactionBlocked(this.mission.stage,this.enemies,this.mission.extractionTime),near=d<3.25;
  if(!this.keys.has('KeyE'))this.interactLatch=false;
  const supply=this.world.supplies.find((s,i)=>!this.suppliesUsed.has(i)&&Math.hypot(s.x-this.player.x,s.y-this.player.y,s.z-this.player.z)<2.3);if(supply&&!near){this.interactUI.hidden=false;this.interactUI.querySelector('b').textContent='Rearm and treat';this.interactUI.querySelector('small').textContent='HOLD E / SUPPLIES';if(this.keys.has('KeyE')){this.interaction+=dt;if(this.interaction>1){this.suppliesUsed.add(this.world.supplies.indexOf(supply));this.ammo.forEach((a,i)=>{a.rounds=weapons[i].size;a.reserve=weapons[i].reserve;});this.player.health=100;this.frags=Math.max(2,this.frags);this.dressings=Math.max(2,this.dressings);this.interaction=0;this.audio.tone(900,.15,.08);}}else this.interaction=0;this.interactUI.querySelector('i').style.width=(this.interaction*100)+'%';return;}
  if(near&&!blocked&&this.keys.has('KeyE')&&!this.interactLatch){this.interaction+=dt;this.firing=false;this.aiming=false;if(this.interaction>=stage.seconds){this.advance();return;}}else this.interaction=0;
  this.interactUI.hidden=!near;this.interactUI.querySelector('b').textContent=blocked||stage.action;this.interactUI.querySelector('i').style.width=(this.interaction/stage.seconds*100)+'%';this.interactUI.querySelector('small').textContent=blocked?'SECURE OBJECTIVE':'HOLD TO INTERACT';
  const p=V(stage.target.x,stage.target.y+1.7,stage.target.z).project(this.camera),visible=p.z<1&&Math.abs(p.x)<.94&&Math.abs(p.y)<.8&&!near;this.marker.hidden=!visible;this.marker.style.transform=`translate(${(p.x*.5+.5)*innerWidth}px,${(-p.y*.5+.5)*innerHeight}px)`;this.marker.querySelector('small').textContent=Math.round(d)+'m';
 }
 updateHUD(){
  const danger=this.grenades.some(g=>g.hostile&&distance(g.mesh.position,this.player)<9&&Math.abs(g.mesh.position.y-this.player.y)<4);this.root.classList.toggle('bg-grenade-danger',danger);
  const p=this.player,a=this.ammo?.[this.weaponIndex];if(!a)return;
  const stage=STAGES[this.mission.stage],remaining=this.enemies.filter(e=>e.group===stage.clear&&e.health>0).length;this.ui.detail.textContent=stage.detail+(remaining?' · '+remaining+' hostile'+(remaining===1?'':'s')+' remaining':'');
  this.ui.bearing.textContent=String(Math.round(((-p.yaw*180/Math.PI)%360+360)%360)).padStart(3,'0');this.ui.health.textContent=p.health<35?'CRITICAL / FIND COVER':p.health<100?'RECOVERING OUT OF FIRE':'CONDITION STABLE';this.ui.stance.textContent=p.crouch?'CROUCHED / LOW VISIBILITY':this.flashlightOn?'FLASHLIGHT ON':'';this.healthUI.style.transform=`scaleX(${p.health/100})`;this.healthUI.style.background=p.health<35?'#e68d6d':'';this.ui.weapon.textContent=weapons[this.weaponIndex].name;this.ui.rounds.textContent=String(a.rounds).padStart(2,'0');this.ui.reserve.textContent='/ '+a.reserve;this.ui.equipment.textContent=this.reloadUntil>this.time?'RELOADING':this.stimUntil>this.time?'APPLYING DRESSING':`${this.frags} FRAG [G]   ${this.dressings} DRESSING [X]`;this.crosshair.classList.toggle('aimed',this.aim>.7);this.hitUI.classList.toggle('visible',this.time<this.hitUntil);this.damageUI.style.opacity=String(this.damageFlash*.7+Math.max(0,(35-p.health)/60));this.alertUI.hidden=!this.threats;this.alertUI.querySelector('span').style.width=Math.min(100,this.threats*25)+'%';const searching=this.enemies.some(e=>e.health>0&&e.state==='search');this.alertUI.querySelector('b').textContent=searching?'HOSTILES SEARCHING':'CONTACT';this.checkpointUI.classList.toggle('visible',this.time<this.checkpointUntil);
 }
 die(){
  this.phase='dead';this.keys.clear();this.firing=this.aiming=false;this.audio.pause();document.exitPointerLock?.();this.root.classList.add('bg-dead');this.overlay.hidden=false;this.overlay.className='bg-overlay bg-pause';this.overlay.innerHTML=`<div class="bg-pause-card"><span class="bg-kicker">SIGNAL LOST</span><h2>WARDEN DOWN</h2><p>Stay behind solid cover. Crouching reduces detection; breaking line of sight gives you time to recover.</p><div class="bg-actions"><button class="bg-primary" data-bg="retry">RESTART CHECKPOINT <span>→</span></button><button class="bg-quiet" data-bg="exit">OWNER CONTROLS</button></div></div>`;
 }
 complete(){
  this.phase='complete';this.mission.completed=true;this.keys.clear();this.firing=this.aiming=false;document.exitPointerLock?.();try{localStorage.removeItem(SAVE_KEY);}catch{}this.save=null;this.audio.speak('Warden is aboard. The manifest is secure. All evacuation routes have been changed. Station Seven is off the air. Good work.');this.hud.hidden=true;this.overlay.hidden=false;this.overlay.className='bg-overlay bg-debrief';
  this.overlay.innerHTML=`<div class="bg-debrief-card"><span class="bg-kicker">TRANSMISSION ENDED / 02:26</span><h2>SIGNAL<br>SILENCED.</h2><p>The archive is secure. Evacuation routes are changing.<br>For the first time tonight, the coast is quiet.</p><div class="bg-results"><div><small>MISSION TIME</small><b>${duration(this.mission.elapsed)}</b></div><div><small>HOSTILES STOPPED</small><b>${this.mission.kills}</b></div><div><small>ACCURACY</small><b>${this.mission.shots?Math.round(this.mission.hits/this.mission.shots*100):0}%</b></div><div><small>DIFFICULTY</small><b>${this.mission.difficulty==='story'?'STORY':'REGULAR'}</b></div></div><blockquote>“Those people get to go home.”<cite>CONTROL / FINAL TRANSMISSION</cite></blockquote><div class="bg-actions"><button class="bg-primary" data-bg="exit">OWNER CONTROLS <span>→</span></button><button class="bg-secondary" data-bg="new">PLAY AGAIN</button></div><small class="bg-preview-note">End of the first playable mission.</small></div>`;
 }
 frame(now){
  if(this.disposed)return;const dt=Math.min(.1,Math.max(0,(now-(this.last||now))/1000));this.last=now;
  if(this.phase==='playing'){
   this.time+=dt;this.mission.elapsed+=dt;if(this.mission.stage===5)this.mission.extractionTime+=dt;this.updatePlayer(dt);if(this.phase==='playing')this.updateEnemies(dt);if(this.phase==='playing'){this.updateInteraction(dt);this.updateRadio();}this.updateEffects(dt);this.world.update(this.time,this.player);this.hudClock+=dt;if(this.hudClock>.08){this.hudClock=0;this.updateHUD();}
   if(this.mission.stage===5){const alpha=clamp(this.mission.extractionTime/32,0,1);this.heli.position.lerpVectors(V(100,65,-155),V(30,21.1,-95),alpha*alpha*(3-2*alpha));this.heli.rotation.y=Math.PI*.8;this.heli.userData.rotor.rotation.y+=dt*32;this.audio.helicopter(alpha);if(alpha>=1&&!this.heliCalled){this.heliCalled=true;this.radio('PILOT','On the pad. Finish clearing the landing zone and get aboard.');}}
  }else if(this.phase==='cinematic'){this.updateIntro(dt);}
  else if(this.phase==='briefing'){const t=now*.00005;this.camera.position.set(-70+Math.sin(t)*8,35,78);this.camera.lookAt(0,26,-35);this.world.update(now/1000,{x:0,z:20});}
  else if(this.phase==='complete'){this.heli.position.y+=dt*1.4;this.heli.position.z-=dt*3;this.heli.userData.rotor.rotation.y+=dt*32;this.camera.position.set(45,26,-78);this.camera.lookAt(this.heli.position);}
  if(!document.hidden&&(this.needsRender||this.phase==='playing'||this.phase==='complete'||this.phase==='cinematic')&&this.framePacer.shouldRender(now,this.fpsLimit)){if(this.renderBudget.sample(now,{quality:this.prefs.quality,limit:this.fpsLimit,active:['playing','cinematic'].includes(this.phase)}))this.resize();if(this.renderer.shadowMap.enabled!==this.renderBudget.shadows){this.renderer.shadowMap.enabled=this.renderBudget.shadows;this.renderer.shadowMap.needsUpdate=true;}this.renderer.info.reset();this.renderer.clear();this.renderer.render(this.scene,this.camera);if(this.phase==='playing'||this.phase==='paused'&&this.resumePhase!=='cinematic'){this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.weaponCamera);}this.needsRender=false;}
  this.raf=requestAnimationFrame(t=>this.frame(t));
 }
 close({returnToOwner=true}={}){
  if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.handlers.forEach(off=>off());this.keys.clear();this.audio.dispose();if(document.pointerLockElement===this.canvas)document.exitPointerLock();this.world?.dispose();this.models?.dispose();this.environment?.dispose();for(const g of this.grenades){g.mesh.geometry.dispose();g.mesh.material.dispose();}this.fxGeo?.dispose();this.fxMaterial?.dispose();this.muzzle?.geometry.dispose();this.muzzle?.material.dispose();this.moon?.shadow.map?.dispose();this.renderer?.dispose();this.renderer?.forceContextLoss();this.root?.remove();document.body.classList.remove('campaign-active');this.onClose?.(returnToOwner);
 }
}
