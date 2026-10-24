import {CombatParticles,visibleShot} from './combat-particles.js';
import {ShaderPreparation} from './shader-preparation.js';
import {buildZoneDistrict,updateZoneDistrict} from './zone-wars-view.js';
import {buildBoxArena,updateBoxArena} from './box-fight-view.js';
import {buildBlacktide,ZombiesView} from './zombies-view.js';
import {cameraPose,thirdPersonActive,THIRD_PERSON,sightRay,weaponCameraAllowed,reticleTarget,weaponAimAt} from './perspective.js';
import {warmArchitectureSurfaces} from './architecture-surfaces.js';
import {RenderBudget,shadowAnchor} from './render-budget.js';
import {perspectiveFov} from './settings.js';
import {canSpectate} from './spectator-status.js';
import {ThrowablePreview} from './throwable-view.js';
import {weaponMotion} from './weapon-motion.js';
import {modelMaterial,MODEL_ART_REVISION} from './model-surfaces.js';
import {updateEnvironmentSurfaces,environmentSurfaceDiagnostics} from './environment-surfaces.js';
import {updateTerrainEnvironment,terrainDetailDiagnostics} from './terrain-detail.js';
import {decorateBoss,updateCelebration} from './celebration-view.js';
import {updateBossAlert} from './boss-alert-view.js';
import {authoredBoxes} from './building.js';
import {RenderPool} from './render-pool.js';
import {makeHumanoid,animateHumanoid,humanoidDiagnostics} from './humanoid.js';
import {EliminationEffects} from './elimination-effects.js';
import {lobbyScene} from './lobby-scene.js';
import {lootModel,gliderModel} from './royale-art.js';
import {inventoryPreview} from './inventory-previews.js';
import {adsFov,viewmodelProfile} from './weapon-presentation.js';
import {animatePickaxe} from './pickaxe-animation.js';
import {buildIsland,buildIslandSteps,RoyaleView} from './royale-view.js';
import {shopItem} from './shop-catalog.js';
import {makeShopBack,makeShopPickaxe,makeShopGlider,makeShopTrail} from './shop-models.js';
import {stairCamera} from './stair-camera.js';
import {cameraDistance,cameraNearPlane,smoothCameraDistance} from './camera-collision.js';
import {LobbyMotion} from './lobby-motion.js';
import {FrontierAtmosphere} from './atmosphere.js';
import {eyeHeight,bodyHeight,canFight,eyePosition,leanPoint,leanAmount,LEAN} from './stance.js';
import * as THREE from "three";
import {equipPose,itemDrawProfile,drawTransform} from "./equip.js";
import { makeArms, updateArms, reloadProgress, utilityArms, throwArms, armAppearance } from "./arms.js";
import { patternedShell, addHeadwear, addEyewear, optionProfile } from "./cosmetics.js";
import { getMap } from "./maps.js";
import { gun, weapon, TEAM_COLORS, mode, clamp, NO_EYEWEAR } from "./data.js";
import { EYE, VIEWMODEL, direction, wallDistance, worldHit, rayEgg } from "./physics.js";
import {weaponPortrait} from "./weapons.js";
import {makeBlaster,setResonance} from "./zombies-weapons.js";
import { buildArena } from "./arenas.js";
const palette = {
  sand: 0xe9d9b2,
  stone: 0xd4d5c6,
  navy: 0x31566a,
  blue: 0x399bba,
  coral: 0xe37b61,
  crate: 0xad8961,
  gold: 0xe5b844,
  terracotta: 0xd58f72,
  steel: 0x6b8292,
  cream: 0xece5d0,
};
function makeRenderer(options){
  const renderer=new THREE.WebGLRenderer(options);
  // Driver diagnostic queries synchronously wait for compilation. Keep them in
  // development; published builds precompile map programs asynchronously.
  renderer.debug.checkShaderErrors=!!import.meta.env?.DEV;
  return renderer;
}
const materials = new Map(),
  boxGeo = new THREE.BoxGeometry(1, 1, 1),
  sphereGeo = new THREE.SphereGeometry(1, 16, 12);
boxGeo.userData.shared=sphereGeo.userData.shared=true;
function mat(color) {
  if (!materials.has(color))
    materials.set(
      color,
      new THREE.MeshLambertMaterial({ color, flatShading: true }),
    );
  return materials.get(color);
}
function block(parent, x, y, z, w, h, d, color) {
  const m = new THREE.Mesh(boxGeo, mat(color));
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function ball(parent, x, y, z, rx, ry, rz, color) {
  const m = new THREE.Mesh(sphereGeo, mat(color));
  m.position.set(x, y, z);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function cylinder(parent, x, y, z, radius, height, color, segments = 16) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    mat(color),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// Compatibility export; all callers now construct the shared human rig.
export function makeEgg(profile, team = -1, withWeapon = true) {
  const group=makeHumanoid({...profile,teamColor:team>=0?(team===0?'#3d8ce8':'#d94949'):null});
  const integratedBack=['voss','rook'].includes(group.userData.asset)&&profile.backbling==='backbling-'+group.userData.asset;
  if(shopItem(profile.backbling)&&!integratedBack){const badgeOnly=group.userData.asset?.startsWith('rank-')&&profile.backbling==='backbling-'+group.userData.asset;const back=makeShopBack(profile.backbling,profile.royaleRank,badgeOnly);back.position.set(0,-.09,badgeOnly?0:.18);group.userData.human.bones.chest.add(back);group.userData.back=back;}
  if(withWeapon){
    const held=new THREE.Group(),blaster=makeBlaster(profile.weapon,profile.wrap),arms=makeArms(profile.weapon,profile,false);
    held.position.set(VIEWMODEL.x,EYE+VIEWMODEL.y,VIEWMODEL.z);held.scale.setScalar(VIEWMODEL.scale);
    arms.visible=false;held.add(blaster,arms);group.add(held);Object.assign(group.userData,{blaster,held,arms});
  }
  animateHumanoid(group,{health:100,grounded:true},1/60,0,{menu:true});
  return group;
}
function label(text, color = "#ffffff", compact = false, critical = false, runs = null) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext("2d");
  ctx.font = compact ? (critical ? "italic 900 64px Arial" : "900 54px Arial") : "bold 34px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(23,43,57,.82)";
  ctx.beginPath();
  ctx.roundRect(10, 7, 492, 80, 24);
  if (!compact) ctx.fill();
  ctx.fillStyle = color;
  if (compact) {
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#172b39";
    ctx.lineWidth = critical ? 7 : 6;
    ctx.strokeText(text.slice(0, 22), 256, 49, 460);
  }
  if(runs){
    ctx.textAlign='left';const width=runs.reduce((n,r)=>n+ctx.measureText(r.text).width,0),scale=Math.min(1,460/Math.max(1,width));ctx.translate(256-width*scale/2,0);ctx.scale(scale,1);let x=0;
    for(const r of runs){ctx.fillStyle=r.color;ctx.strokeText(r.text,x,49);ctx.fillText(r.text,x,49);x+=ctx.measureText(r.text).width;}
  }else ctx.fillText(text.slice(0, 22), 256, 49, 460);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: true,
      transparent: true,
    }),
  );
  sprite.scale.set(2.5, 0.47, 1);
  return sprite;
}
export const worldKit={block,ball,cylinder,mat,palette};
export class View {
  get mapCompile(){return this.mapPreparation.pending;}
  cancelMapPreparation(){if(this.mapCompile){this.mapPreparation.cancel();this.needsMapCompile=true;}}
  constructor(canvas, settings) {
    this.mapPreparation=new ShaderPreparation();this.renderBudget=new RenderBudget();
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = makeRenderer({
      canvas,
      antialias: settings.quality !== 'low',
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.renderer.shadowMap.autoUpdate=false;
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.throwablePreview=new ThrowablePreview(this.scene);
    this.atmosphere=new FrontierAtmosphere(this.scene);
    this.camera = new THREE.PerspectiveCamera(
      settings.fov || 85,
      1,
      0.025,
      260,
    );
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.hemi=new THREE.HemisphereLight(0xe5f4ff,0x88a16a,2.25);this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff3de, 2.2);
    sun.position.set(-15, 38, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -42,
      right: 42,
      top: 42,
      bottom: -42,
      near: 1,
      far: 140,
    });
    sun.shadow.bias = -0.0005;sun.shadow.normalBias=.045;
    this.scene.add(sun,sun.target);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.actors = new THREE.Group();
    this.scene.add(this.actors);
    this.effects = new THREE.Group();
    this.scene.add(this.effects);
    this.eliminations=new EliminationEffects(this.effects);
    this.combatParticles=new CombatParticles(this.effects);
    this.models = new Map();
    this.projectiles = new Map();
    this.renderPool=new RenderPool();
    this.shotOffsets = new Map();
    this.pickupMeshes = new Map();
    this.fx = [];
    this.recoil = 0;
    this.clock = 0;
    this.localThrowStart = -Infinity;
    this.mapId = null;
    this.menuEgg = null;
    this.lobbyMotion = new LobbyMotion();
    this.localWeapon = null;
    this.gunGroup = new THREE.Group();
    this.gunGroup.scale.setScalar(VIEWMODEL.scale);
    this.portraits = new Map();
    this.pendingShots = [];
    this.aimBlend = 0;
    this.scopeTarget = new THREE.WebGLRenderTarget(
      settings.quality === "low" ? 512 : 768,
      settings.quality === "low" ? 512 : 768,
    );
    this.scopeCamera = new THREE.PerspectiveCamera(27, 1, 0.06, 260);
    const reticle = document.createElement("canvas");
    reticle.width = reticle.height = 512;
    const r = reticle.getContext("2d");
    r.strokeStyle = "rgba(18,34,40,.93)";
    r.lineWidth = 1.7;
    r.beginPath();
    for (const [x1, y1, x2, y2] of [
      [0, 256, 240, 256],
      [272, 256, 512, 256],
      [256, 0, 256, 240],
      [256, 272, 256, 512],
    ]) {
      r.moveTo(x1, y1);
      r.lineTo(x2, y2);
    }
    for (let i = 1; i < 6; i++)
      for (const sign of [-1, 1]) {
        r.moveTo(250, 256 + sign * i * 29);
        r.lineTo(262, 256 + sign * i * 29);
        r.moveTo(256 + sign * i * 29, 250);
        r.lineTo(256 + sign * i * 29, 262);
      }
    r.stroke();
    r.fillStyle = "#e96d46";
    r.beginPath();
    r.arc(256, 256, 3, 0, Math.PI * 2);
    r.fill();
    r.fillStyle = "rgba(28,54,61,.7)";
    r.font = "bold 13px monospace";
    r.textAlign = "center";
    r.fillText("RF / OPTICS", 256, 424);
    this.reticleTexture = new THREE.CanvasTexture(reticle);
    this.viewmodelScene=new THREE.Scene();
    this.viewmodelCamera=new THREE.PerspectiveCamera(70,1,.008,20);
    this.viewmodelCamera.add(this.gunGroup);this.viewmodelScene.add(this.viewmodelCamera);
    this.viewmodelScene.add(new THREE.HemisphereLight(0xf0f8fc,0x52606a,2.1));
    const vmKey=new THREE.DirectionalLight(0xffedcf,2.4);vmKey.position.set(-2,4,3);this.viewmodelCamera.add(vmKey);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.royaleView = new RoyaleView(this, {block,ball,cylinder,mat,palette});this.zombiesView=new ZombiesView(this.scene,this.world);

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("graphics-lost"));
    });
  }
  resize() {
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio || 1,
        this.settings.quality === "low" ? 1 : this.settings.quality==='high'?2:1.5,
        Math.sqrt((this.settings.quality==='low'?1500000:this.settings.quality==='high'?3200000:2300000) / Math.max(1, innerWidth * innerHeight)),
      ) * (this.renderScale || 1),
    );
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    if(this.viewmodelCamera){this.viewmodelCamera.aspect=this.camera.aspect;this.viewmodelCamera.updateProjectionMatrix();}
  }
  setQuality() {
    warmArchitectureSurfaces();
    this.renderBudget.reset();this.renderScale=1;this.lastShadowAt=-Infinity;
    this.renderer.shadowMap.enabled = this.settings.quality !== "low";
    this.resize();
  }
  disposeGroup(group) {
    group.userData.details?.close();
    group.userData.groundCover?.close();
    group.traverse((o) => {
      if (o.isSkinnedMesh) o.skeleton?.dispose();
      if (o.isLine) { o.geometry.dispose(); o.material.dispose(); }
      if (o.isSprite) {
        o.material.map?.dispose();
        o.material.dispose();
      } else if (
        o.isMesh &&
        o.geometry !== boxGeo &&
        o.geometry !== sphereGeo &&
        !o.geometry.userData.shared
      )
        o.geometry?.dispose();
    });
    group.traverse((o) => {
      if (o.userData.ownedMaterial) {
       for(const material of Array.isArray(o.material)?o.material:[o.material]){
        if (
          material.map &&
          !material.map.userData.shared &&
          material.map !== this.scopeTarget.texture &&
          material.map !== this.reticleTexture
        )
          material.map.dispose();
        material.dispose();
       }
      }
    });
    group.clear();
  }
  prepareBattleMap(){
    const layout=getMap('sunnybreak').layoutKey||'';
    if(this.preparedBattle&&this.preparedBattle.layout!==layout){this.disposeGroup(this.preparedBattle.group);this.preparedBattle=null;}
    if(this.mapId==='sunnybreak'||this.preparedBattle?.done)return;
    if(!this.preparedBattle){
      const map=getMap('sunnybreak'),group=new THREE.Group();
      // Use the same IDs as prediction/destruction when the first battle packet arrives.
      map.authored??=authoredBoxes(map);
      this.preparedBattle={group,layout,steps:buildIslandSteps(group,map.authored?{...map,boxes:map.authored}:map,{block,ball,cylinder,mat,palette}),done:false};
    }
    const pending=this.preparedBattle,deadline=performance.now()+4;
    do{pending.done=pending.steps.next().done;}while(!pending.done&&performance.now()<deadline);
    if(pending.done){
      // Compile the detached scene while the player is still on Spawn Island.
      const scene=new THREE.Scene();scene.fog=new THREE.Fog(getMap('sunnybreak').sky,330,1000);scene.add(pending.group);
      this.renderer.compileAsync(scene,this.camera,this.scene).catch(()=>{});
    }
  }
  loadMap(id) {
    const layout=getMap(id).layoutKey||'';
    if (id === this.mapId&&this.mapLayout===layout) return;
    this.mapLayout=layout;
    if(this.preparedBattle&&this.preparedBattle.layout!==(getMap('sunnybreak').layoutKey||'')){this.disposeGroup(this.preparedBattle.group);this.preparedBattle=null;}
    this.mapId = id;
    this.mapPreparation.cancel();
    this.needsMapCompile=true;
    const map = getMap(id);
    this.disposeGroup(this.world);delete this.world.userData.details;delete this.world.userData.geometryRevision;delete this.world.userData.groundCover;delete this.world.userData.terrainEnvironment;delete this.world.userData.blacktide;delete this.world.userData.boxfight;delete this.world.userData.zoneWars;
    this.scene.background = new THREE.Color(map.sky);
    this.scene.fog = new THREE.Fog(map.theme==='royale'?0xc1e6f0:map.sky, map.theme==='royale'?280:72, map.theme==='royale'?1050:175);
    this.camera.far=this.scopeCamera.far=map.theme==='royale'?1400:260;
    this.camera.near=map.theme==='royale'?.15:.12;
    this.camera.updateProjectionMatrix();this.scopeCamera.updateProjectionMatrix();
    if(id==='sunnybreak'&&this.preparedBattle){
      const pending=this.preparedBattle;
      // A full-human early departure may arrive before preparation finishes.
      if(!pending.done)for(const _ of pending.steps){}
      this.world.add(...pending.group.children.slice());if(pending.group.userData.details)pending.group.userData.details.attach(this.world);if(pending.group.userData.groundCover)pending.group.userData.groundCover.attach(this.world);this.world.userData.terrainEnvironment=pending.group.userData.terrainEnvironment;this.preparedBattle=null;
    }else if(map.zoneWars)buildZoneDistrict(this.world,map);else if(map.theme==='boxfight')buildBoxArena(this.world,map);else if(map.theme==='zombies')buildBlacktide(this.world);else (map.theme==='royale'?buildIsland:buildArena)(this.world, map.authored?{...map,boxes:map.authored}:map, { block, ball, cylinder, mat, palette });
    for (let i = 0; i < (['zombies','boxfight','zonewars'].includes(map.theme)?0:2); i++) {
      const [x, z] = map.bases[i];
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.1, 0.08, 8, 48),
        mat(TEAM_COLORS[i]),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.06, z);
      this.world.add(ring);
    }
    this.pickupMeshes.clear();
    for (const [id, [x, z, type]] of map.pickups.entries()) {
      const group = new THREE.Group();
      let y = 0;
      for (const b of map.boxes)
        if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2)
          y = Math.max(y, b.y + b.h);
      group.position.set(x, y + 0.65, z);
      group.userData.baseY = y + 0.65;
      if (type === "health") {
        block(group, 0, 0, 0, 0.25, 0.75, 0.23, 0xf8faf2);
        block(group, 0, 0, 0, 0.75, 0.25, 0.23, 0xf8faf2);
      } else if (type === "ammo") {
        block(group, 0, 0, 0, 0.55, 0.44, 0.4, 0xf5bf4f);
        for (let j = 0; j < 3; j++)
          cylinder(group, (j - 1) * 0.16, 0.29, 0, 0.05, 0.23, 0xf9e7ab);
      } else {const popper=this.royaleView.itemModel({id:'popper',count:1},false);popper.scale.setScalar(.9);group.add(popper);}
      const pad = cylinder(
        group,
        0,
        -0.34,
        0,
        0.48,
        0.06,
        type === "health" ? 0x63ceaa : type === "ammo" ? 0xf2b62e : 0xbaa4df,
      );
      this.world.add(group);
      this.pickupMeshes.set(id, group);
    }

  }
  placeCameraBehind(state,p,origin,back,length,dt,mode){
    if(this.cameraBoom&&Math.hypot(p.x-this.cameraBoom.x,p.y-this.cameraBoom.y,p.z-this.cameraBoom.z)>8)this.cameraBoom=null;
    const distance=cameraDistance(this.buildMap?.id===state.options.map?this.buildMap:getMap(state.options.map),origin,back,length);
    this.cameraBoom=smoothCameraDistance(this.cameraBoom,distance,dt,`${state.round}:${state.options.map}:${p.id}:${mode}`);
    Object.assign(this.cameraBoom,{x:p.x,y:p.y,z:p.z});
    this.camera.position.copy(origin).addScaledVector(back,this.cameraBoom.distance);
  }
  setParty(profiles){
    const key=JSON.stringify(profiles);if(key===this.partyPreviewKey)return;this.partyPreviewKey=key;
    for(const egg of this.partyEggs||[]){this.scene.remove(egg);this.disposeGroup(egg);}this.partyEggs=[];
    for(const [i,profile]of profiles.slice(0,3).entries()){const egg=makeEgg(profile,-1);egg.scale.setScalar(2.3);egg.position.set([3.2,-3.2,6.4][i],.08,-1.4);egg.rotation.y=Math.PI+.35;egg.userData.lobbyMotion=new LobbyMotion(11.3+i*5.7);this.scene.add(egg);this.partyEggs.push(egg);}
  }
  preview(profile) {
    const signature = JSON.stringify(profile);
    if (signature === this.previewSignature) return;
    this.previewSignature = signature;
    if (this.menuEgg) {
      this.disposeGroup(this.menuEgg);
      this.scene.remove(this.menuEgg);
    }
    this.menuEgg = makeEgg(profile, -1);
    this.menuEgg.scale.setScalar(2.3);
    this.menuEgg.position.set(0, 0.08, 0);
    const held=this.menuEgg.userData.held;held.updateMatrix();
    this.menuShoulders=this.menuEgg.userData.arms.userData.limbs.map(l=>l.shoulder.clone().applyMatrix4(held.matrix));
    this.scene.add(this.menuEgg);
    if(!this.lobbyStage){this.lobbyStage=lobbyScene();this.scene.add(this.lobbyStage);}
  }
  projectMarker(point){
    const v=new THREE.Vector3(point.x,point.y+.7,point.z),local=this.camera.worldToLocal(v.clone()),behind=local.z>0;
    v.project(this.camera);if(behind){v.x=-v.x;v.y=-v.y;}
    return {x:THREE.MathUtils.clamp((v.x+1)*50,7,93),y:THREE.MathUtils.clamp((1-v.y)*50,16,78),offscreen:behind||Math.abs(v.x)>1||Math.abs(v.y)>1};
  }
  animateLobbyCharacter(model,motion,dt,yawOffset=0){
    const pose=motion.update(dt),held=model.userData.held;
    model.userData.lobbyPose=pose;
    model.rotation.y=pose.yaw+yawOffset;
    held.position.set(.07+pose.weaponSide,1.32+pose.breath+pose.grip+pose.weaponBob,-.14+pose.weaponDepth);
    held.rotation.set(pose.pitch,pose.weaponYaw,pose.roll,'YXZ');
    updateArms(model.userData.arms,-1,model.userData.blaster);
    animateHumanoid(model,{health:100,grounded:true,yaw:model.rotation.y,pitch:pose.pitch,
      scan:pose.scan,lobbyPatrol:pose,vx:-Math.sin(model.rotation.y)*pose.speed,vz:-Math.cos(model.rotation.y)*pose.speed},dt,motion.time,{menu:true});
  }
  diagnostics() {
    let lobbyBounds=null;
    if(this.menuEgg?.visible){
      this.menuEgg.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(this.menuEgg),points=[];
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(this.camera));
      lobbyBounds={left:Math.min(...points.map(p=>(p.x+1)*innerWidth/2)),right:Math.max(...points.map(p=>(p.x+1)*innerWidth/2)),top:Math.min(...points.map(p=>(1-p.y)*innerHeight/2)),bottom:Math.max(...points.map(p=>(1-p.y)*innerHeight/2))};
    }
    return {
      streaming:this.world.userData.details?.diagnostics()||null,
      environment:{terrain:terrainDetailDiagnostics(this.world),surfaces:environmentSurfaceDiagnostics(),groundCover:this.world.userData.groundCover?.diagnostics()||null},
      renderPool:this.renderPool?.diagnostics(),
      geometryBytes:(()=>{const seen=new Set();let bytes=0;this.world.traverse(m=>{if(m.geometry&&!seen.has(m.geometry)){seen.add(m.geometry);for(const a of Object.values(m.geometry.attributes))bytes+=a.array.byteLength;}});return bytes;})(),
      lobbyBounds,
      lobbyMotion: this.lobbyMotion,
      viewmodel:{fov:this.viewmodelCamera.fov,near:this.viewmodelCamera.near,position:this.gunGroup.position.toArray(),scale:this.gunGroup.scale.x},
      humanoid: humanoidDiagnostics(this.menuEgg),
      humans: [...this.models.values()].map(humanoidDiagnostics),
      weapon: this.localWeapon,
      draw: this.drawPresentation,
      outgoing: !!this.outgoing,
      remoteArms: [...this.models.entries()].map(([id, model]) => ({id, progress: model.userData.arms?.userData.progress, appearance: model.userData.arms?.userData.appearance, draw: model.userData.draw?.progress})),
      arms: this.localArms ? { weapon: this.localArms.userData.id, appearance: this.localArms.userData.appearance, progress: this.localArms.userData.progress, hands: this.localArms.userData.limbs.map(l=>l.hand.position.toArray()) } : null,
      muzzle: this.localModel?.userData.muzzle
        ?.getWorldPosition(new THREE.Vector3())
        .toArray(),
      flash: this.lastMuzzleFlash?.toArray(),
      projectiles: this.projectiles.size,
      scopeFov: this.scopeCamera.fov,
    };
  }
  eggOptionPortrait(key, value) {
    this.cosmeticPortraits ||= new Map();
    const id = `${key}:${value}`;
    if (!this.cosmeticPortraits.has(id)) {
      this.cosmeticPortraits.set(id, this.eggPortrait(optionProfile(key, value), 160, false));
    }
    return this.cosmeticPortraits.get(id);
  }
  eggPortrait(profile, size = 440, withWeapon = true) {
    if (!this.portraitRenderer) {
      this.portraitRenderer = makeRenderer({alpha: true, antialias: true});

      this.portraitRenderer.setPixelRatio(1);
    }
    this.portraitRenderer.setSize(size, size);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8c82, 2.8));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(-3, 5, -4); scene.add(light);
    const egg = makeEgg(profile, -1, withWeapon);
    egg.rotation.y = -.25; scene.add(egg);
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 20);
    camera.position.set(withWeapon ? -2.5 : 0, 1.5, withWeapon ? -4.8 : -4.2); camera.lookAt(0, 1.1, withWeapon ? -.2 : 0);
    this.portraitRenderer.render(scene, camera);
    const image = this.portraitRenderer.domElement.toDataURL();
    this.disposeGroup(egg);
    return image;
  }
  weaponPreview(id) {
    if(!this.generatingPreviews&&inventoryPreview(id))return inventoryPreview(id);
    if (!this.portraits.has(id))
      this.portraits.set(id, weaponPortrait(this.renderer, id));
    return this.portraits.get(id);
  }
  shopPortrait(item,angle=0){
    this.shopPortraits??=new Map();const key=(item.previewKey||item.id)+':'+angle;if(this.shopPortraits.has(key))return this.shopPortraits.get(key);if(this.shopPortraits.size>140)this.shopPortraits.delete(this.shopPortraits.keys().next().value);
    if(!this.portraitRenderer){this.portraitRenderer=makeRenderer({alpha:true,antialias:true});this.portraitRenderer.setPixelRatio(1);}
    const resolution=item.characterInspection?600:item.rankReward?400:320;this.portraitRenderer.setSize(resolution,resolution);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x768697,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,5,-4);scene.add(light);
    let model;
    if(item.starter){const kit={block,ball,cylinder,mat,palette};model=item.slot==='pickaxe'?lootModel({id:'pickaxe',pickaxe:true},kit,{ground:false}):item.slot==='glider'?gliderModel(kit):item.slot==='wrap'?makeBlaster('sprinter'):makeEgg({...item.profile,outfit:''},-1,!!item.characterInspection&&item.showWeapon!==false);}
    else if(item.slot==='outfit')model=makeEgg({...item.profile,outfit:item.id},-1,!!item.characterInspection&&item.showWeapon!==false);
    else if(item.slot==='wrap')model=makeBlaster('sprinter',item.id);
    else if(item.slot==='pickaxe')model=makeShopPickaxe(item.id);
    else if(item.slot==='backbling')model=makeShopBack(item.id,item.royaleRank);
    else if(item.slot==='glider')model=makeShopGlider(item.id);
    else if(item.slot==='trail'){model=makeEgg({color:item.color,eyewear:6,...(item.rankReward?{outfit:'outfit-rank-'+item.rank}:{})},-1,false);model.add(makeShopTrail(item.id));}
    else model=makeEgg({color:'#fff6da',accent:'#3d8ce8',eyewear:6,...item.profile},-1,false);
    model.rotation.y=angle+(item.slot==='wrap'?1.15:item.slot==='backbling'?Math.PI:-.35);if(item.rankReward&&item.slot==='glider')model.rotation.x=-.45;scene.add(model);
    const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());model.position.sub(center);
    const d=Math.max(size.x,size.y,size.z)*.65,camera=new THREE.OrthographicCamera(-d,d,d,-d,.01,30);camera.position.set(-2,1,-6);camera.lookAt(0,0,0);this.portraitRenderer.render(scene,camera);
    const result=this.portraitRenderer.domElement.toDataURL();this.disposeGroup(model);this.shopPortraits.set(key,result);return result;
  }
  rocketModel(){
    const g=new THREE.Group(),body=modelMaterial(0x587c6d,'paint'),trim=modelMaterial(0xf3c45b,'metal');g.name='Fin-stabilized rocket';g.userData.artRevision=MODEL_ART_REVISION;
    const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.5,24),body);g.add(cylinder);
    const nose=new THREE.Mesh(new THREE.LatheGeometry([[.108,0],[.103,.047],[.080,.126],[.046,.192],[.008,.23]].map(([r,y])=>new THREE.Vector2(r,y)),24),trim);nose.position.y=.25;g.add(nose);
    for(const y of [-.16,.23]){const collar=new THREE.Mesh(new THREE.CylinderGeometry(.111,.111,.029,24),trim);collar.position.y=y;g.add(collar);}
    const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.075,.063,.075,20,1,true),modelMaterial(0x35434a,'metal'));nozzle.position.y=-.276;g.add(nozzle);
    for(let i=0;i<4;i++){const a=i*Math.PI/2,shape=new THREE.Shape();shape.moveTo(0,.06);shape.lineTo(.16,-.12);shape.lineTo(.16,-.20);shape.lineTo(0,-.18);const geometry=new THREE.ExtrudeGeometry(shape,{depth:.016,bevelEnabled:false});geometry.translate(0,0,-.008);const fin=new THREE.Mesh(geometry,body);fin.rotation.y=a;fin.position.set(Math.cos(a)*.079,-.08,-Math.sin(a)*.079);g.add(fin);}
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.075,.6,10),new THREE.MeshBasicMaterial({color:0xffad45,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));flame.rotation.z=Math.PI;flame.position.y=-.54;g.add(flame);g.userData.flame=flame;
    const core=new THREE.Mesh(new THREE.ConeGeometry(.04,.4,10),new THREE.MeshBasicMaterial({color:0xfff1b0,transparent:true,opacity:.95,depthWrite:false,toneMapped:false}));core.rotation.z=Math.PI;core.position.y=-.40;g.add(core);
    return g;
  }
  itemPreview(item) {
    if(!this.generatingPreviews&&inventoryPreview(item.id))return inventoryPreview(item.id);
    if(item.weapon)return this.weaponPreview(item.id);
    const key='item:'+item.id;if(this.portraits.has(key))return this.portraits.get(key);
    if(!this.portraitRenderer){this.portraitRenderer=makeRenderer({alpha:true,antialias:true});this.portraitRenderer.setPixelRatio(1);}
    this.portraitRenderer.setSize(192,144);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x7d8c82,2.8));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,5,4);scene.add(light);
    const model=this.royaleView.itemModel(item,false);model.rotation.y=['asterKeycard','scanner','shadowstep'].includes(item.id)?Math.PI+.45:item.id==='jumpRig'?.25:-.35;scene.add(model);
    const camera=new THREE.PerspectiveCamera(35,4/3,.05,10);camera.position.set(1.1,1,1.8);camera.lookAt(0,.2,0);
    this.portraitRenderer.render(scene,camera);const image=this.portraitRenderer.domElement.toDataURL();this.portraits.set(key,image);this.disposeGroup(model);return image;
  }
  clearOutgoing(owner) {
    if(!owner.outgoing)return;
    const {group}=owner.outgoing;
    group.removeFromParent();this.disposeGroup(group);owner.outgoing=null;
  }
  lowerOutgoing(owner,pose,visible=true) {
    const old=owner.outgoing;if(!old)return;
    if(!visible || pose.holster>=1){this.clearOutgoing(owner);return;}
    old.group.position.copy(old.position);
    const stow=drawTransform(old.profile||itemDrawProfile({id:'pip'}),1-pose.holster);
    old.group.position.x+=stow.position[0];old.group.position.y+=stow.position[1]*(old.thirdPerson?.5:1);old.group.position.z+=stow.position[2];
    old.group.rotation.copy(old.rotation);
    old.group.rotation.x+=stow.rotation[0];old.group.rotation.y+=stow.rotation[1];old.group.rotation.z+=stow.rotation[2];
    old.group.visible=true;
  }
  setWeapon(p,draw) {
    const id = gun(p).id;
    const previousDrawItem=this.localDrawItem;this.localDrawItem=p.inventory?.[p.slot]||{id,weapon:true};
    const appearance=JSON.stringify([armAppearance(p),p.wrap,p.outfit]);
    if (id === this.localWeapon && appearance === this.armStyle) return;
    this.clearOutgoing(this);
    if(this.localModel && this.localWeapon!==id && draw.holster<1 && this.gunGroup.visible){
      updateArms(this.localArms,-1,this.localModel);
      const old=new THREE.Group();old.scale.copy(this.gunGroup.scale);
      old.position.copy(this.gunGroup.position);old.rotation.copy(this.gunGroup.rotation);
      while(this.gunGroup.children.length)old.add(this.gunGroup.children[0]);
      this.viewmodelCamera.add(old);
      this.outgoing={group:old,position:old.position.clone(),rotation:old.rotation.clone(),profile:itemDrawProfile(previousDrawItem||{id:this.localWeapon,weapon:true})};
    }
    this.armStyle = appearance;
    this.localWeapon = id;
    this.disposeGroup(this.gunGroup);
    this.heldItem=null;this.heldItemKey=null;
    const model = makeBlaster(id,p.wrap);
    this.gunGroup.add(model);
    this.localModel = model;
    this.opticLens = model.userData.lens || null;
    if (this.opticLens) {
      this.opticLens.material.map = this.scopeTarget.texture;
      this.opticLens.material.color.setHex(0xffffff);
      const radius = gun(p).ads?.radius-.012 || .103;
      const reticle = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({
          map: this.reticleTexture,
          transparent: true,
          depthWrite: false,
        }),
      );
      reticle.position.copy(this.opticLens.position);
      reticle.position.z += 0.002;
      reticle.userData.ownedMaterial = true;
      model.add(reticle);
    }
    this.localArms = makeArms(id, p, true);
    this.gunGroup.add(this.localArms);
  }
  event(e, localId,state=null) {
    this.royaleView.event(e);
    if (["hit","vehicle-hit"].includes(e.type) && e.player === localId && Number.isFinite(e.x)) {
      const key=e.shotId!=null?e.player+':'+e.shotId+':'+e.target:null;
      const previous=key&&this.fx.find(f=>f.damageText&&f.shotKey===key&&f.life>0);
      const total=(previous?.amount||0)+e.amount,critical=!!(e.precision||previous?.critical),shield=(previous?.shield||0)+(e.shield?e.amount:0),health=total-shield;
      const runs=[];if(health>0)runs.push({text:String(Math.max(1,Math.round(health)))+(critical?'!':''),color:critical?'#ffcf52':'#ffffff'});if(shield>0)runs.push({text:(health>0?'  ':'')+'◆'+Math.max(1,Math.round(shield))+(critical?'!':''),color:'#79d9ff'});
      const next=label('', '#ffffff',true,critical,runs);
      next.material.sizeAttenuation=false;next.material.needsUpdate=true;
      if(previous){
        previous.mesh.material.map?.dispose();previous.mesh.material.dispose();previous.mesh.material=next.material;
        previous.amount=total;previous.shield=shield;previous.critical=critical;previous.life=previous.max=.9;
      }else{
        const height=88/Math.max(1,this.canvas.clientHeight)/this.camera.projectionMatrix.elements[5];
        next.scale.set(height*512/96,height,1);next.position.set(e.x,e.y,e.z);this.effects.add(next);
        this.fx.push({mesh:next,life:.9,max:.9,damageText:true,critical,drift:0,shotKey:key,amount:total,shield});
      }
    }

    if(e.type==='z-cue'&&e.cue==='throw'){if(e.player===localId)this.localThrowStart=this.clock;const actor=this.models.get(e.player);if(actor)actor.userData.throwStart=this.clock;}
    if (e.type === "shot" || e.type === "launch") {
      if (e.player === localId&&!e.echoed) this.recoil = Math.min(1.6, this.recoil + weapon(e.weapon).recoilUp*70);
      const actor = this.models.get(e.player);
      if(e.type==='launch'&&e.popper){
        if(e.player===localId)this.localThrowStart=this.clock;
        if(actor)actor.userData.throwStart=this.clock;
      }
      if (actor && !e.popper) actor.userData.armRecoil = 1;
      if (!e.popper&&(e.player===localId||visibleShot(e,this.camera.position,this.scopeActive?750:160)))
        this.pendingShots.push({ event: e, local: e.player === localId });
    }
    if(e.type==='impact')this.combatParticles.impact(e,this.camera.position,this.scopeActive?750:160);
    if(e.type==='elimination'&&(state?.royale||this.isRoyale)){
      const me=state?.players.find(p=>p.id===localId)||this.localPlayer,listener=me?.spectating&&e.target!==localId?state?.players.find(p=>p.id===this.spectateTarget)||me:me;
      const target=state?.players.find(p=>p.id===e.target);
      this.eliminations.spawn({...e,yaw:target?.yaw},this.models.get(e.target)||(e.target===localId?this.menuEgg:null),listener,this.settings.reducedMotion);
    }
    if (e.type==='explosion'||e.type==='elimination'&&!(state?.royale||this.isRoyale))
      this.combatParticles.burst(e,this.camera.position,this.scopeActive?750:180);
  }

  fadeLocalActor(model,opacity){
    if(model.userData.cameraFade===opacity)return;model.userData.cameraFade=opacity;
    model.traverse(m=>{if(!m.isMesh||!m.material)return;
      if(!m.userData.cameraFadeMaterials){m.material=Array.isArray(m.material)?m.material.map(x=>x.clone()):m.material.clone();m.userData.ownedMaterial=true;m.userData.cameraFadeMaterials=true;}
      for(const material of Array.isArray(m.material)?m.material:[m.material]){material.userData.baseOpacity??=material.opacity;material.userData.baseDepthWrite??=material.depthWrite;const transparent=opacity<1||material.userData.baseOpacity<1;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=material.userData.baseOpacity*opacity;material.depthWrite=opacity>.98&&material.userData.baseDepthWrite;}
    });
  }
  muzzleEffects() {
    if(!this.pendingShots.length)return;
    this.camera.updateMatrixWorld(true);
    this.actors.updateMatrixWorld(true);
    for (const { event: e, local } of this.pendingShots) {
      const model = local && !this.thirdPersonEnabled
        ? this.localModel
        : this.models.get(e.player)?.userData.blaster;
      const pos =
        model?.userData.muzzle?.getWorldPosition(new THREE.Vector3()) ||
        new THREE.Vector3(e.origin?.x || 0, e.origin?.y || 0, e.origin?.z || 0);
      if (local) this.lastMuzzleFlash = pos.clone();
      if(!e.echoed){const flash = this.renderPool.acquire('muzzle-flash',()=>new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.045, 0),
        new THREE.MeshBasicMaterial({
          color: 0xffe3a0,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      ));
      flash.material.opacity=1;flash.position.copy(pos);
      flash.scale.set(1, 1, 2.2);
      if (model)
        flash.quaternion.copy(model.getWorldQuaternion(new THREE.Quaternion()));
      if(local&&!this.thirdPersonEnabled&&model?.userData.muzzle){model.userData.muzzle.add(flash);flash.position.set(0,0,0);flash.quaternion.identity();flash.scale.multiplyScalar(1/(this.gunGroup.scale.x||.5));}else this.effects.add(flash);
      this.fx.push({
        mesh: flash,
        fresh: true,
        life: 0.055,
        max: 0.055,
        ownedMaterial: true,
        ownedGeometry: true,
      });}
      const w=weapon(e.weapon);
      for (const [index,shot] of (e.shots||[]).entries()) {
        if(!shot.end||w.pellets>1&&index%4!==0)continue;
        const origin=new THREE.Vector3(e.origin.x,e.origin.y,e.origin.z),end=new THREE.Vector3(shot.end.x,shot.end.y,shot.end.z),length=origin.distanceTo(end);
        if(length<.4)continue;
        const dir=end.clone().sub(origin).normalize(),trace=this.renderPool.acquire('trace',()=>new THREE.Mesh(new THREE.CylinderGeometry(.004,.006,1,5),new THREE.MeshBasicMaterial({transparent:true,opacity:.52,depthWrite:false,toneMapped:false})));trace.material.color.setHex(w.id==='comet'?0xb7e4df:0xe5e0cd);trace.material.opacity=.52;
        trace.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);trace.position.copy(origin);trace.scale.y=Math.min(.8,length);this.effects.add(trace);
        const duration=Math.max(.035,Math.min(.14,length/900));
        this.fx.push({mesh:trace,fresh:true,life:duration,max:duration,trace:true,origin,end,dir,length,ownedMaterial:true,ownedGeometry:true});
      }
    }
    this.pendingShots.length = 0;
  }
  update(state, local, predicted, dt, playing, aim, profile) {
    this.isRoyale=!!state?.royale;this.localPlayer=local;this.thirdPersonEnabled=false;this.coverBlocked=false;this.renderLocalActor=null;
    if(!playing&&this.eliminations.active.length)this.eliminations.clear();
    // Reduce GPU work when rendering itself delays input and socket processing.
    const updateStarted=performance.now();
    const resized=this.renderBudget.sample(updateStarted,{quality:this.settings.quality,limit:this.settings.fpsLimit,active:!document.hidden});
    this.renderScale=this.renderBudget.scale;this.detailPressure=this.renderBudget.pressure;
    if(resized)this.resize();
    const shadows=this.settings.quality!=='low'&&this.renderBudget.shadows;
    if(this.renderer.shadowMap.enabled!==shadows){this.renderer.shadowMap.enabled=shadows;this.lastShadowAt=-Infinity;}
    this.clock += dt;
    this.recoil = Math.max(0, this.recoil - dt * (local?gun(local).recoilRecovery:7));
    if(playing)this.loadMap(state?.options.map || "yard");
    if(playing&&state?.royale?.practice&&!state.options.training)this.prepareBattleMap();
    this.world.visible=playing;const dark=playing&&!!state?.zombies;this.hemi.intensity=dark?1.65:2.25;this.hemi.color.setHex(dark?0x9ecbd3:0xe5f4ff);this.hemi.groundColor.setHex(dark?0x304c54:0x88a16a);this.sun.intensity=dark?1.5:2.2;this.sun.color.setHex(dark?0xaacbd8:0xfff3de);
    updateEnvironmentSurfaces(this.clock);
    if(playing){const detailQuality=this.detailPressure?'low':this.settings.quality;updateTerrainEnvironment(this.world,this.clock,detailQuality);this.world.userData.groundCover?.update(predicted||local,{quality:detailQuality,time:this.clock});}
    if(this.lobbyVisible!==!playing){this.lobbyVisible=!playing;const map=getMap(state?.options.map||'yard'),sky=playing?map.sky:0x6f9295;this.scene.background=new THREE.Color(sky);this.scene.fog=new THREE.Fog(playing&&map.theme==='royale'?0xc1e6f0:sky,playing?(map.theme==='royale'?280:72):35,playing?(map.theme==='royale'?1050:175):125);}
    if (this.menuEgg) this.menuEgg.visible = !playing;
    if(this.lobbyStage)this.lobbyStage.visible=!playing;
    for(const egg of this.partyEggs||[])egg.visible=!playing;
    this.actors.visible = playing;
    this.effects.visible = playing;
    this.gunGroup.visible = playing && weaponCameraAllowed(local) && !this.cinematic?.victory && !this.celebrationTarget && !local?.emote && canFight(local) && (!local.inventory || local.flight==='ground');
    if (!playing) {
      this.clearOutgoing(this);
      this.preview(profile);
      if(this.lobbyEmote?.until&&this.clock>=this.lobbyEmote.until)this.lobbyEmote=null;
      if(this.lobbyEmote){this.menuEgg.rotation.y=Math.atan2(this.menuEgg.position.x-this.camera.position.x,this.menuEgg.position.z-this.camera.position.z);if(this.menuEgg.userData.held)this.menuEgg.userData.held.visible=false;const p={health:100,grounded:true,emote:this.lobbyEmote,crownWins:this.lobbyCrownWins||0,crown:!!this.lobbyCrown};animateHumanoid(this.menuEgg,p,dt,this.clock,{menu:true});updateCelebration(this.menuEgg,p,this.clock,g=>this.disposeGroup(g));}
      else {this.animateLobbyCharacter(this.menuEgg,this.lobbyMotion,dt);updateCelebration(this.menuEgg,{health:100,crown:!!this.lobbyCrown},this.clock,g=>this.disposeGroup(g));}
      this.lobbyStage.userData.update?.(dt);
      for(const teammate of this.partyEggs||[])this.animateLobbyCharacter(teammate,teammate.userData.lobbyMotion,dt,.17);
      const partyCount=this.partyEggs?.length||0,partyOffset=partyCount===1?1.4:partyCount===3?1.5:0,narrow=this.camera.aspect<.85;
      const shortLobby=!narrow&&innerHeight<760;
      this.camera.position.set(narrow&&partyCount>1?partyOffset:5.8+partyOffset,4.3,narrow?(partyCount===3?34:partyCount>1?29:partyCount?22.5:19):partyCount>1?19:shortLobby?15.5:12.5);
      this.camera.lookAt(partyOffset, narrow?(partyOffset?1.7:1):shortLobby?2.6:1.8, 0);
      this.camera.fov = narrow?47:48;
      this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
      // The anchor sits above the highest crown, then the label grows upward.
      for(const label of this.lobbyLabels||[]){const index=Number(label.dataset.lobbyPlayer),model=index===0?this.menuEgg:this.partyEggs?.[index-1];if(!model)continue;const point=new THREE.Vector3(model.position.x,model.position.y+5.45,model.position.z).project(this.camera);label.style.left=((point.x+1)*50)+'%';label.style.top=((1-point.y)*50)+'%';}
    } else if (local) {
      const hold=!!this.cinematic?.hold,victory=!!this.cinematic?.victory||!!this.celebrationTarget;
      const killer = this.celebrationTarget&&state.players.find(p=>p.id===this.celebrationTarget)||!hold&&local.health <= 0 && state.players.find(p => p.id === (local.spectating ? this.spectateTarget : local.killerId) && canSpectate(p,local.id));
      const p = {...(killer || (local.health <= 0 ? local : predicted || local))};
      if(!killer)p.perspective=this.settings.perspective;
      this.renderLocalActor=p.id===local.id?p:null;
      this.predictedVehicle=p.predictedVehicle||null;
      this.stairEye=stairCamera(this.stairEye,p,dt,`${state.round}:${p.id}:${local.health>0}`);
      const desiredEye=eyeHeight(p);this.stanceEye=this.stanceEye===undefined?desiredEye:THREE.MathUtils.lerp(this.stanceEye,desiredEye,1-Math.exp(-dt*17));
      const leanedEye=eyePosition(p,this.stanceEye);
      this.camera.position.set(
        leanedEye.x,
        this.stairEye.y + leanedEye.y-p.y + (local.health <= 0 ? 0.8 : 0),
        leanedEye.z,
      );
      this.camera.rotation.set(p.pitch+(p.recoilPitch||0), p.yaw+(p.recoilYaw||0), -leanAmount(p)*LEAN.angle, "YXZ");
      let cameraBoom=false;
      if (killer || local.downed || local.emote || hold || victory || !weaponCameraAllowed(p)) {
        const cameraYaw=victory?p.yaw+Math.PI+.35:local.emote?(this.emoteLook?.yaw??p.yaw):p.yaw;
        const back = this.cameraBack??=new THREE.Vector3();back.set(Math.sin(cameraYaw)*Math.cos((p.vehicleId||p.zVehicle)?p.pitch*.55:0),(p.vehicleId||p.zVehicle)?.4-Math.sin(p.pitch*.55):local.emote?.2:.35,Math.cos(cameraYaw)*Math.cos((p.vehicleId||p.zVehicle)?p.pitch*.55:0)).normalize();
        const origin = this.cameraOrigin??=new THREE.Vector3();origin.set(p.x,p.y+Math.min(1.6,eyeHeight(p)),p.z);
        this.placeCameraBehind(state,p,origin,back,p.vehicleType==='helicopter'?16:(p.vehicleId||p.zVehicle)?6.2:victory?5.2:hold?4.8:local.emote?4.2:3.5,dt,(p.vehicleId||p.zVehicle)?'vehicle':victory?'victory':hold?'elimination':local.emote?'emote':'spectator');cameraBoom=true;
        if(p.vehicleId||p.zVehicle){const aim=direction(p.yaw,p.pitch);this.camera.lookAt(p.x+aim.x*30,p.y+eyeHeight(p)+aim.y*30-(p.vehicleType==='helicopter'?2:0),p.z+aim.z*30);}else this.camera.lookAt(p.x, p.y+(p.downed?.5:1.05), p.z);
      }
      const draw=equipPose(local,state.time);
      this.drawPresentation=draw;
      this.setWeapon(local,draw);if(local.zombieKit)setResonance(this.localModel,gun(local).tier,gun(local).grade,gun(local).attachments);
      this.lowerOutgoing(this,draw,local.health>0);
      this.gunGroup.visible=this.gunGroup.visible&&draw.visible;
      const w = gun(local),
        scoped = w.optic === "scope" || w.optic === "prism";
      const aiming = !!(canFight(local) && !p.sprinting && !p.use && !p.reviving && !p.traversal && !local.building && !local.editing && !p.building && !p.editing && weaponCameraAllowed(local) && !local.emote && aim && (!local.inventory||local.flight==='ground'&&local.inventory[local.slot]?.weapon) && local.health > 0 && local.reloadEnd <= state.time && !draw.active);
      if(!Number.isFinite(this.aimBlend))this.aimBlend=0;
      this.aimBlend += (Number(aiming) - this.aimBlend) * (1-Math.exp(-Math.log(20)*dt/w.adsTime));
      p.aim=aiming;
      this.thirdPersonEnabled=!killer&&!hold&&!victory&&!p.zVehicle&&thirdPersonActive(p);
      const key=`${state.round}:${state.options.map}:${p.id}:${this.thirdPersonEnabled}`;
      if(this.thirdPersonEnabled){
        this.camera.rotation.z=0;
        const previous=this.thirdPersonState,same=previous?.key===key&&Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z)<8;
        const blend=same?previous.blend+(Number(aiming)-previous.blend)*(1-Math.exp(-THIRD_PERSON.transition*dt)):Number(aiming);
        p.viewBlend=blend;const map=this.buildMap?.id===state.options.map?this.buildMap:getMap(state.options.map),raw=cameraPose(map,p,{unclampedBoom:true});
        const fraction=same&&raw.fraction>previous.fraction?previous.fraction+(raw.fraction-previous.fraction)*(1-Math.exp(-8*dt)):raw.fraction;
        p.viewBoom=fraction;const pose=cameraPose(map,p);this.camera.position.copy(pose.origin);cameraBoom=true;
        this.thirdPersonState={key,blend,fraction,x:p.x,y:p.y,z:p.z};this.thirdPersonDistance=pose.length*fraction;
        this.gunGroup.visible=false;
        this.clearOutgoing(this);
        // One local reticle solve also drives the visible weapon/arm IK.
        // Match rendered recoil and converge on players as well as geometry.
        const {point,ray}=reticleTarget(map,p,200,{origin:pose.origin,d:direction(this.camera.rotation.y,this.camera.rotation.x)});
        let targetDistance=Math.hypot(point.x-ray.origin.x,point.y-ray.origin.y,point.z-ray.origin.z);
        for(const target of state.players)if(target.id!==p.id&&target.health>0&&!target.spectating&&!teammates(state.options,p,target))targetDistance=Math.min(targetDistance,rayEgg(ray.origin,ray.d,target));
        this.thirdPersonTarget={x:ray.origin.x+ray.d.x*targetDistance,y:ray.origin.y+ray.d.y*targetDistance,z:ray.origin.z+ray.d.z*targetDistance};
        if(this.clock>=(this.coverCheckAt||0)){this.coverCheckAt=this.clock+.08;const point=this.thirdPersonTarget,dx=point.x-ray.eye.x,dy=point.y-ray.eye.y,dz=point.z-ray.eye.z,len=Math.hypot(dx,dy,dz)||1;this.coverCheck=wallDistance(map,ray.eye,{x:dx/len,y:dy/len,z:dz/len},len)<len-.12;}
        this.coverBlocked=!!this.coverCheck;
      }else {this.thirdPersonState=null;this.thirdPersonTarget=null;}
      const baseFov=perspectiveFov(this.settings,this.thirdPersonEnabled,this.camera.aspect);
      const fov=victory?65:aiming?(this.thirdPersonEnabled?Math.min(baseFov,2*Math.atan(Math.tan(baseFov*Math.PI/360)/1.18)*180/Math.PI):adsFov(w,baseFov)):baseFov;
      this.camera.fov+=(fov-this.camera.fov)*(1-Math.exp(-Math.log(20)*dt/w.adsTime));
      this.camera.updateProjectionMatrix();
      const motion=weaponMotion(this.weaponMotionState??={},p,dt,this.clock,this.aimBlend,this.settings,`${state.round}:${p.id}`);
      const reload = reloadProgress(local, state.time);
      const hands = updateArms(this.localArms, draw.active?-1:reload, this.localModel, this.recoil,draw.progress,null,!!local.reloadEmpty);
      const throwT=(this.clock-this.localThrowStart)/.78;
      if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1)throwArms(this.localArms,throwT);
      const vm=viewmodelProfile(w.id,this.camera.aspect);this.gunGroup.scale.setScalar(vm.scale);
      this.viewmodelCamera.fov=vm.fov;this.viewmodelCamera.updateProjectionMatrix();
      const front = -VIEWMODEL.z + w.muzzle * VIEWMODEL.scale;
      const wall = wallDistance(
        getMap(state.options.map),
        eyePosition(p),
        direction(p.yaw, p.pitch),
        front,
      );
      this.gunGroup.position.set(
        vm.x * (1 - this.aimBlend) + draw.position[0] + motion.x,
        THREE.MathUtils.lerp(
          vm.y,
          -w.sightY * vm.scale,
          this.aimBlend,
        ) +
          motion.y -
          hands.dip + draw.position[1],
        vm.z + this.recoil * 0.025 * (this.settings.reducedMotion?0:(this.settings.weaponMotion??1)) + draw.position[2] + motion.z,
      );
      this.gunGroup.rotation.set(
        this.recoil * 0.045 * (this.settings.reducedMotion?0:(this.settings.weaponMotion??1)) * (1 - this.aimBlend * 0.65) + hands.rotation[0] + draw.rotation[0] + motion.pitch,
        hands.rotation[1] + draw.rotation[1],
        hands.rotation[2] + draw.rotation[2] + motion.roll,
      );
      if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1){
        const gesture=Math.sin(Math.PI*throwT);
        this.gunGroup.position.y-=.19*gesture;
        this.gunGroup.rotation.x+=.2*gesture;
      }
      if(local.zombieKit&&state.time-(local.swingAt??-100)<.55){const swing=Math.sin(Math.PI*Math.max(0,(state.time-local.swingAt)/.55));this.gunGroup.position.z-=.24*swing;this.gunGroup.rotation.z-=.45*swing;this.gunGroup.position.x-=.12*swing;}
      const sprint=local.sprintBlend||0;this.gunGroup.position.y-=sprint*.28;this.gunGroup.position.x+=sprint*.12;this.gunGroup.rotation.x+=sprint*.55;this.gunGroup.rotation.z+=sprint*.28;
      if(local.traversal||local.mantle)this.gunGroup.position.y-=.8;
      this.scopeActive = !!aiming && scoped && this.aimBlend > 0.1 && (!local.inventory||!!local.inventory[local.slot]?.weapon);
      if(local.inventory){
        const heldItem=local.building?{id:'blueprint'}:local.inventory[local.slot];
        this.localModel.visible=!!heldItem?.weapon;
        const itemKey=heldItem&&!heldItem.weapon?heldItem.id+':'+(heldItem.pickaxe?local.pickaxe:''):null;
        if(this.heldItemKey!==itemKey){
          if(this.heldItem){this.heldItem.removeFromParent();this.disposeGroup(this.heldItem);}
          this.heldItem=null;this.heldItemKey=itemKey;
          if(itemKey){this.heldItem=heldItem.pickaxe&&shopItem(local.pickaxe)?makeShopPickaxe(local.pickaxe):this.royaleView.itemModel(heldItem,false);this.heldItem.userData.firstPerson=true;if(heldItem.id==='shadowstep')this.heldItem.rotation.y=Math.PI;this.heldItem.scale.setScalar(heldItem.id==='anchorWinch'?.85:.4);this.heldItem.position.set(-.05,-.08,-.28);this.gunGroup.add(this.heldItem);}
        }
        if(!heldItem?.weapon&&this.localArms)utilityArms(this.localArms,heldItem?.id,local.use?(state.time-local.use.start)/(local.use.end-local.use.start):-1,this.clock);
        if(this.heldItem&&heldItem?.pickaxe)animatePickaxe(this.heldItem,this.localArms,local.pickaxe,state.time-(local.swingAt??-100));
        else if(this.heldItem){this.heldItem.rotation.z=local.use?Math.sin(this.clock*8)*.15:0;if(heldItem?.id==='anchorWinch'){this.heldItem.position.z=-.28+Math.max(0,.15-(state.time-(local.grapple?.start??-100)))*.45;const cup=this.heldItem.getObjectByName('grappler-plunger');if(cup)cup.visible=!local.grapple;}}
        if(this.localArms){this.localArms.rotation.x=local.use ? -.35+Math.sin(this.clock*6)*.06 : 0;}

        if(local.use){this.gunGroup.position.y+=.08+Math.sin(this.clock*8)*.015;this.gunGroup.rotation.x=-.3;}
        if(p.flight==='transport'){
          this.camera.position.set(p.x+Math.sin(p.yaw)*Math.cos(p.pitch||0)*24,p.y+8-Math.sin(p.pitch||0)*20,p.z+Math.cos(p.yaw)*Math.cos(p.pitch||0)*24);this.camera.lookAt(p.x,p.y+3,p.z);this.camera.fov=80;this.camera.updateProjectionMatrix();
        }else if(p.health>0&&p.flight!=='ground'){
          const back=this.cameraBack??=new THREE.Vector3();back.set(Math.sin(p.yaw)*6,1.9,Math.cos(p.yaw)*6);const length=back.length();back.normalize();
          const origin=this.cameraOrigin??=new THREE.Vector3();origin.set(p.x,p.y+1.6,p.z);
          this.placeCameraBehind(state,p,origin,back,length,dt,'flight');cameraBoom=true;this.camera.rotation.set(Math.min(p.pitch,-.18),p.yaw,0,'YXZ');
        }
      }
      const near=cameraBoom?cameraNearPlane(this.camera.fov,this.camera.aspect):(getMap(state.options.map).theme==='royale'?.15:.12);
      if(this.camera.near!==near){this.camera.near=near;this.camera.updateProjectionMatrix();}
      if(!cameraBoom)this.cameraBoom=null;
    }
    if (state) {
      const seen = new Set();
      this.camera.updateMatrixWorld();
      this.actorFrustum ||= new THREE.Frustum();
      this.actorMatrix ||= new THREE.Matrix4();
      this.actorBounds ||= new THREE.Sphere(new THREE.Vector3(),2.5);
      this.actorFrustum.setFromProjectionMatrix(this.actorMatrix.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse));
      for (const source of state.players) {
        let p=source.id===local?.id&&this.renderLocalActor?this.renderLocalActor:source;
        if((p.emote||p.id===this.celebrationTarget)&&(state.phase==='results'||state.boxfight?.stage==='intermission'||p.zExtracted))p={...p,health:100,spectating:false,flight:'ground',grounded:true,downed:false};
        // Transport passengers share one simulation position; the airship
        // represents them until exit instead of rendering sixteen overlapping operators.
        if(state.royale&&p.flight==='transport')continue;
        if ((p.spectating && (!p.eliminatedAt || state.time-p.eliminatedAt>.16)) || p.awaitingEntry)continue;
        if(p.id===local?.id&&p.health>0&&!this.thirdPersonEnabled&&weaponCameraAllowed(p)&&!this.cinematic?.victory&&!this.celebrationTarget&&!p.emote&&!p.downed&&(!p.inventory||p.flight==='ground'||p.flight==='transport')){const cached=this.models.get(p.id);if(cached){seen.add(p.id);cached.visible=false;}continue;}
        seen.add(p.id);
        this.actorBounds.center.set(p.x,p.y+.9,p.z);
        if(playing&&!this.actorFrustum.intersectsSphere(this.actorBounds)){const hidden=this.models.get(p.id);if(hidden)hidden.visible=false;continue;}
        const sig =
          p.name + (!!state.zonewars) + p.color +
          p.hat + JSON.stringify([p.pattern,p.finish,p.eyewear,p.accent,p.outfit,p.wrap,p.backbling,p.pickaxe,p.royaleRank]) +
          (p.team+":"+p.teamSlot) +
          mode(state.options.mode).teams;
        let model = this.models.get(p.id);
        if (!model || model.userData.signature !== sig) {
          if (model) {
            this.disposeGroup(model);
            this.actors.remove(model);
          }
          model = makeEgg(
            { ...p, weapon: gun(p).id },
            mode(state.options.mode).teams ? p.team : -1,
          );
          const aura = new THREE.Mesh(new THREE.CapsuleGeometry(.37,1.1,5,10),new THREE.MeshBasicMaterial({color:0x83e6ff,transparent:true,opacity:.18,depthWrite:false,wireframe:true}));
          aura.position.y=.95;model.add(aura);model.userData.bonusAura=aura;
          model.userData.signature = sig;if(p.boss)decorateBoss(model,p);
          const name = label(
            p.name,
            teammates(state.options,p,local)
              ? teamStyle(state.players,p).color
              : p.boss?"#ffda82":"#ffffff",
            !!state.zonewars,
          );
          name.position.y = 2.15;model.userData.nameplate=name;
          name.visible = p.id!==local?.id&&(!!p.boss||!!state.zonewars||!state.royale||teammates(state.options,p,local));
          if(state.zonewars){name.material.depthTest=false;name.material.depthWrite=false;name.material.sizeAttenuation=false;name.renderOrder=1000;}
          model.add(name);
          this.actors.add(model);
          this.models.set(p.id, model);
          model.position.set(p.x, p.y, p.z);
        }
        const distance=this.camera.position.distanceTo(model.position),poseInterval=distance>120?.1:distance>60?.05:0;
        const poseDue=this.clock>=(model.userData.poseAt||0)||model.userData.poseSlot!==p.slot||p.health<=0;
        const poseDt=poseDue?Math.min(.15,this.clock-(model.userData.poseClock??this.clock-dt)):dt;
        if(poseDue){model.userData.poseAt=this.clock+poseInterval;model.userData.poseClock=this.clock;model.userData.poseSlot=p.slot;}
        const draw=equipPose(p,state.time);
        if(model.userData.arms?.userData.id!==gun(p).id){
          this.clearOutgoing(model.userData);
          const old=model.userData.held;
          if(draw.holster<1){
            updateArms(model.userData.arms,-1,model.userData.blaster);
            model.userData.outgoing={group:old,position:old.position.clone(),rotation:old.rotation.clone(),profile:model.userData.drawProfile||itemDrawProfile({id:model.userData.arms.userData.id,weapon:true}),thirdPerson:true};
          }else{old.removeFromParent();this.disposeGroup(old);}
          const held=new THREE.Group(),blaster=makeBlaster(gun(p).id,p.wrap),arms=makeArms(gun(p).id,p,false);
          held.scale.setScalar(VIEWMODEL.scale);arms.visible=false;held.add(blaster,arms);model.add(held);
          Object.assign(model.userData,{held,blaster,arms,armRecoil:0});
          model.userData.shopTool=null;
        }
        this.lowerOutgoing(model.userData,draw,p.health>0);
        const harvesting=!!p.inventory?.[p.slot]?.pickaxe;
        if(harvesting&&!model.userData.shopTool){const tool=shopItem(p.pickaxe)?makeShopPickaxe(p.pickaxe):this.royaleView.itemModel({id:'pickaxe',pickaxe:true},false);tool.scale.setScalar(.5);tool.position.set(-.05,-.12,-.2);model.userData.held.add(tool);model.userData.shopTool=tool;}
        if(model.userData.shopTool)model.userData.shopTool.visible=harvesting;
        model.userData.blaster.visible=!harvesting;if(p.zombieKit)setResonance(model.userData.blaster,gun(p).tier,gun(p).grade,gun(p).attachments);
        model.userData.draw=draw;
        model.userData.drawProfile=itemDrawProfile(p.inventory?.[p.slot]||{id:gun(p).id,weapon:true});
        const deathAge=p.health<=0?state.time-(p.eliminatedAt??p.respawnAt-3):0;
        model.visible=p.health>0||deathAge<(state.royale ? .16 : 1.3);
        if (model.userData.arms&&poseDue) {
          const recoil = model.userData.armRecoil = Math.max(0, (model.userData.armRecoil || 0) - dt * 7);
          const hands = updateArms(model.userData.arms, draw.active?-1:reloadProgress(p, state.time), model.userData.blaster, recoil,draw.progress,null,!!p.reloadEmpty);
          if(harvesting&&model.userData.shopTool)animatePickaxe(model.userData.shopTool,model.userData.arms,p.pickaxe,state.time-(p.swingAt??-100));
          const throwT=(this.clock-(model.userData.throwStart??-Infinity))/.78;
          if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1)throwArms(model.userData.arms,throwT);
          model.userData.held.visible=draw.visible&&canFight(p)&&!p.emote&&(!p.vehicleId||p.vehicleSeat>0)&&(!p.zVehicle||p.zVehicleSeat>0);
          model.userData.held.rotation.set(p.pitch + hands.rotation[0] + recoil * .045 + draw.rotation[0], hands.rotation[1]+draw.rotation[1], hands.rotation[2]+draw.rotation[2]);
          model.userData.held.position.set(VIEWMODEL.x+draw.position[0],eyeHeight(p)+VIEWMODEL.y-hands.dip+draw.position[1]*.5,VIEWMODEL.z+draw.position[2]);
          const heldLean=leanPoint(p,model.userData.held.position.x,model.userData.held.position.y);model.userData.held.position.x=heldLean.x;model.userData.held.position.y=heldLean.y;model.userData.held.rotation.z-=leanAmount(p)*LEAN.angle;
          if(p.id===local?.id&&this.thirdPersonEnabled&&this.thirdPersonTarget&&!harvesting&&!draw.active&&!p.use&&!p.building&&!p.editing&&!p.sprinting&&p.reloadEnd<=state.time){
            const aim=weaponAimAt(p,this.thirdPersonTarget,model.userData.held.position);
            model.userData.held.rotation.order='YXZ';model.userData.held.rotation.x=aim.pitch;model.userData.held.rotation.y=aim.yaw;
          }
          const sprint=p.sprintBlend||0;model.userData.held.position.y-=sprint*.3;model.userData.held.position.x+=sprint*.08;model.userData.held.rotation.x+=sprint*.65;model.userData.held.rotation.z+=sprint*.2;
          if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1){
            const gesture=Math.sin(Math.PI*throwT);
            model.userData.held.position.y-=.16*gesture;
            model.userData.held.rotation.x+=.16*gesture;
          }
        }
        // Do not let cosmetic smoothing leave a moving character behind its hit regions.
        const base = model.userData.basePosition ||= new THREE.Vector3(p.x, p.y, p.z);
        const targetPosition = (this.actorTarget ||=new THREE.Vector3()).set(p.x,p.y,p.z);
        base.lerp(targetPosition, Math.min(1, dt * 18));
        const lag = (this.actorLag ||=new THREE.Vector3()).copy(base).sub(targetPosition).clampLength(0, 0.04);
        base.copy(targetPosition).add(lag);
        model.position.copy(p.id===local?.id?targetPosition:base);
        const bodyYaw=p.zVehicle?(state.zombies?.vehicles.find(v=>v.id===p.zVehicle)?.yaw??p.yaw):p.vehicleId&&p.vehicleSeat===0?(state.royale.vehicles.find(v=>v.id===p.vehicleId)?.yaw??p.yaw):p.yaw;let delta = bodyYaw - model.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        model.rotation.y = p.id===local?.id ? bodyYaw : model.rotation.y + delta * Math.min(1, dt * 18);
        model.scale.setScalar(1);model.rotation.x=model.rotation.z=0;
        const aura=model.userData.bonusAura;
        aura.visible=p.id!==local?.id&&p.health>0&&(p.streakArmor>0||p.damageUntil>state.time||state.time<p.shieldUntil);
        aura.material.color.setHex(p.damageUntil>state.time?0xff625f:0x83e6ff);
        aura.material.opacity=.13+Math.sin(this.clock*5)*.025;
        if(p.inventory&&poseDue)this.royaleView.animateActor(model,p,this.clock,poseDt);
        if(model.userData.nameplate){
          const name=model.userData.nameplate;name.position.y=bodyHeight(p)+.3;
          name.visible=nameplateVisible(state,p,local);
          // Constant readable text size throughout the district, including
          // behind walls and while aiming. No extra DOM or per-frame textures.
          if(state.zonewars){const h=56*Math.tan(this.camera.fov*Math.PI/360)/Math.max(1,this.canvas.clientHeight);name.scale.set(h*512/96,h,1);}
        }
        if(p.boss||p.henchman)updateBossAlert(model,p,state.time,bodyHeight(p),distance);
        updateCelebration(model,p,state.time,g=>this.disposeGroup(g));
        if(poseDue)animateHumanoid(model,{...p,...(state.phase==='results'?{vx:0,vz:0,moving:false}:{}),throwProgress:(this.clock-(model.userData.throwStart??-100))/.78,shotRecoil:model.userData.armRecoil||0},poseDt,state.phase==='results'&&!p.emote?this.clock:state.time,{distance:0,map:this.buildMap});
        if(p.id===local?.id&&this.thirdPersonEnabled)this.fadeLocalActor(model,Math.max(0,Math.min(1,(this.thirdPersonDistance-.35)/.5)));
        else if(model.userData.cameraFade!==undefined)this.fadeLocalActor(model,1);

      }
      for (const [id, model] of this.models)
        if (!seen.has(id)) {
          this.disposeGroup(model);
          this.actors.remove(model);
          this.models.delete(id);
        }
      this.viewmodelCamera.position.copy(this.camera.position);this.viewmodelCamera.quaternion.copy(this.camera.quaternion);this.viewmodelCamera.updateMatrixWorld(true);
      this.muzzleEffects();
      const active = new Set();
      if (this.lastSnapshotTime !== (state.snapshotTime??state.time)) {
        this.lastSnapshotTime = state.snapshotTime??state.time;
        this.snapshotAge = 0;
      } else this.snapshotAge = Math.min(0.075, (this.snapshotAge || 0) + dt);
      for (const b of state.projectiles) {
        active.add(b.id);
        let mesh = this.projectiles.get(b.id);
        if (!mesh) {
          const bolt = b.kind === "bolt";
          // Compact weapon-specific rounds; tails are brief motion cues, not giant cones.
          const profiles = {
            sprinter: [.005,.055,.22], scatter: [.005,.018,.06],
            needle: [.006,.09,.35], zipper: [.004,.04,.14],
            anchor: [.006,.065,.28], duet: [.005,.06,.23],
            pip: [.005,.03,.12],comet:[.007,.065,.26],stormspike:[.028,.40,.9],
          };
          const [radius, length, trail] = profiles[b.weapon] || profiles.sprinter;
          if(bolt)mesh = this.renderPool.acquire('bolt:'+b.weapon,()=>new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,3,6),new THREE.MeshStandardMaterial({color:b.weapon==='stormspike'?0x96eaff:0xe4bc78,emissive:b.weapon==='stormspike'?0x1682c4:0,emissiveIntensity:1.8,roughness:.4,metalness:.55})));
          else if(b.popper){mesh=this.royaleView.itemModel({id:b.throwable==='smoke'?'smoke':'popper',count:1},false);mesh.scale.setScalar(.65);}
          else mesh=this.rocketModel();
          this.effects.add(mesh);
          this.projectiles.set(b.id, mesh);
          if (bolt&&!mesh.children.length) {
            const tail = new THREE.Mesh(
              new THREE.CylinderGeometry(radius * 0.35, 0, trail, 5),
              new THREE.MeshBasicMaterial({
                color: b.weapon==='stormspike'?0x65dfff:0xdddcd2, transparent: true, opacity: b.weapon==='stormspike'?.65:.20,
                depthWrite: false, toneMapped: false,
              }),
            );
            tail.position.y = -(length + trail) / 2;
            mesh.add(tail);
          }
        }
        mesh.position.set(
          b.x + b.vx * this.snapshotAge,
          b.y + b.vy * this.snapshotAge-.5*(b.gravity||0)*this.snapshotAge**2,
          b.z + b.vz * this.snapshotAge,
        );
        if(!b.popper&&b.kind!=='bolt'){
          if(mesh.userData.flame)mesh.userData.flame.scale.y=.75+Math.sin(this.clock*45)*.25;
          if(state.phase==='playing'&&this.clock>(mesh.userData.smokeAt||0)){
            mesh.userData.smokeAt=this.clock+.07;
            const smoke=this.renderPool.acquire('rocket-smoke',()=>new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),new THREE.MeshBasicMaterial({color:0xc7cbd3,transparent:true,opacity:.4,depthWrite:false})));smoke.material.opacity=.4;
            smoke.position.copy(mesh.position);this.effects.add(smoke);this.fx.push({mesh:smoke,life:.6,max:.6,smoke:true,ownedMaterial:true,ownedGeometry:true});
          }
        }
        const offset = this.shotOffsets.get(b.id);
        if (offset) {
          const blend = Math.max(0, 1 - (this.clock - offset.born) / 0.08);
          mesh.position.addScaledVector(offset.delta, blend);
          if (blend === 0) this.shotOffsets.delete(b.id);
        }
        const velocity = new THREE.Vector3(b.vx,b.vy-(b.gravity||0)*this.snapshotAge,b.vz);
        if (velocity.lengthSq() > 0.01)
          mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            velocity.normalize(),
          );
      }
      for (const [id, mesh] of this.projectiles)
        if (!active.has(id)) {
          this.effects.remove(mesh);
          if(!this.renderPool.release(mesh))mesh.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose();
          });
          this.projectiles.delete(id);
          this.shotOffsets.delete(id);
        }
      for (const item of state.pickups) {
        const mesh = this.pickupMeshes.get(item.id);
        if (mesh) {
          mesh.visible = item.availableAt <= state.time;
          mesh.rotation.y = this.clock;
          mesh.position.y =
            mesh.userData.baseY + Math.sin(this.clock * 2) * 0.1;
        }
      }
    }
    for (const [id, offset] of this.shotOffsets)
      if (this.clock - offset.born > 0.12) this.shotOffsets.delete(id);
    const effectDt=this.cinematic?.slowMotion&&!this.settings.reducedMotion?dt*.35:dt;
    this.eliminations.update(effectDt);
    this.combatParticles.update(effectDt);
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      if (f.fresh) {
        f.fresh = false;
        continue;
      }
      f.life -= dt;
      if (f.life <= 0) {
        f.mesh.removeFromParent();
        if(this.renderPool.release(f.mesh)){this.fx.splice(i,1);continue;}
        if (f.mesh.isSprite) { f.mesh.material.map?.dispose(); f.mesh.material.dispose(); }
        if (f.ownedMaterial) f.mesh.material.dispose();
        if (f.ownedGeometry) f.mesh.geometry.dispose();
        if (f.mesh.isLine) {
          f.mesh.geometry.dispose();
          f.mesh.material.dispose();
        }
        this.fx.splice(i, 1);
      } else if (f.smoke) {
        f.mesh.scale.multiplyScalar(1+dt*1.8);f.mesh.position.y+=dt*.3;f.mesh.material.opacity=.4*f.life/f.max;
      } else if (f.damageText) {
        const age = f.max - f.life;
        const pop = (f.critical ? 1.18 : 1) * (1 + 0.4 * Math.sin(Math.min(1, age / 0.18) * Math.PI));
        const height = 88 / Math.max(1, this.canvas.clientHeight) / this.camera.projectionMatrix.elements[5];
        f.mesh.scale.set(height * 512 / 96 * pop, height * pop, 1);
        f.mesh.position.y += dt * (0.85 - age * 0.45);
        f.mesh.position.x += dt * f.drift;
        f.mesh.material.opacity = Math.min(1, f.life / 0.3);
      } else if(f.trace){
        const travel=Math.min(f.length,(1-f.life/f.max)*f.length),length=Math.min(.85,f.length-travel);
        f.mesh.position.copy(f.origin).addScaledVector(f.dir,travel+length/2);f.mesh.scale.y=Math.max(.01,length);f.mesh.material.opacity=.5*Math.min(1,f.life/.02);
      } else if (f.v) {
        if (!f.noGravity) f.v.y -= 12 * dt;
        f.mesh.position.addScaledVector(f.v, dt);
        f.mesh.rotation.x += dt * 3;
        f.mesh.scale.multiplyScalar(Math.pow(0.98, dt * 60));
      } else f.mesh.material.opacity = f.life / f.max;
    }
    if (this.opticLens) {
      const texture =
        playing && this.scopeActive && !gun(local).ads?.overlay ? this.scopeTarget.texture : null;
      if (this.opticLens.material.map !== texture) {
        this.opticLens.material.map = texture;
        this.opticLens.material.color.setHex(texture ? 0xffffff : 0x427c86);
        this.opticLens.material.needsUpdate = true;
      }
    }
    if(playing&&this.scopeActive&&gun(local).ads?.overlay&&this.aimBlend>.8)this.gunGroup.visible=false;
    this.royaleView.update(state,this.renderLocalActor||local,dt,playing);updateBoxArena(this.world,state);updateZoneDistrict(this.world,state);this.zombiesView.update(state,dt,this.camera,playing);if(playing&&state?.zombies){this.scene.fog.near=65;this.scene.fog.far=245;}
    this.throwablePreview.update(state,this.renderLocalActor||predicted||local,this.buildMap||this.map,playing,this.clock);
    this.atmosphere.update(this.camera,getMap(state?.options.map||'yard'),playing,this.clock);
    // A departed match must never block rendering the lobby. Rewarm on reentry.
    if(!playing)this.cancelMapPreparation();
    if(playing&&this.needsMapCompile){
      this.needsMapCompile=false;
      this.mapPreparation.start(()=>this.renderer.compileAsync(this.scene,this.camera));
    }
    if(this.mapCompile)return;
    // Update the shadow once for all views, including the scope, at a bounded
    // cadence. Near actors keep smooth shadows without duplicate scope passes.
    const shadowKey=`${playing}:${this.mapId}:${state?.round}`;
    if(shadowKey!==this.shadowKey||updateStarted-(this.lastShadowAt??-Infinity)>=(this.detailPressure?100:1000/30)){
      const anchor=shadowAnchor(playing?this.camera.position:{x:0,y:0,z:0});
      this.sun.target.position.set(anchor.x,anchor.y,anchor.z);this.sun.position.set(anchor.x-15,anchor.y+38,anchor.z+18);
      this.renderer.shadowMap.needsUpdate=this.renderer.shadowMap.enabled;this.lastShadowAt=updateStarted;this.shadowKey=shadowKey;
    }
    this.renderer.info.autoReset=false;this.renderer.info.reset();
    if (playing && this.scopeActive && this.opticLens && !gun(local).ads?.overlay && this.clock-(this.lastScopeRender||-1) >= 1/30) {
      this.lastScopeRender=this.clock;
      this.scopeCamera.position.copy(this.camera.position);
      this.scopeCamera.quaternion.copy(this.camera.quaternion);
      const aperture = gun(local).id === "needle" ? 0.125 : 0.103;
      const lensWorld = this.opticLens.getWorldPosition(new THREE.Vector3());
      const depth = Math.max(0.1, this.camera.worldToLocal(lensWorld).z * -1);
      this.scopeCamera.fov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            (aperture * VIEWMODEL.scale) / depth / (gun(local).magnification||2.5),
          ),
      );
      this.scopeCamera.updateProjectionMatrix();
      this.gunGroup.visible = false;
      this.renderer.setRenderTarget(this.scopeTarget);
      this.renderer.render(this.scene, this.scopeCamera);
      this.renderer.setRenderTarget(null);
      this.gunGroup.visible = true;
    }

    this.renderer.render(this.scene, this.camera);
    if(playing&&!this.thirdPersonEnabled&&(this.gunGroup.visible||this.outgoing?.group.visible)){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.viewmodelScene,this.viewmodelCamera);this.renderer.autoClear=true;}
    this.updateMilliseconds=performance.now()-updateStarted;
  }
}
import {teammates,teamStyle} from './teams.js';
import {nameplateVisible} from './combat-hud-policy.js';
