import {authoredBoxes} from './building.js';
import {makeHumanoid,animateHumanoid,humanoidDiagnostics} from './humanoid.js';
import {lobbyScene} from './lobby-scene.js';
import {lootModel,gliderModel} from './royale-art.js';
import {inventoryPreview} from './inventory-previews.js';
import {adsFov,viewmodelProfile} from './weapon-presentation.js';
import {animatePickaxe} from './pickaxe-animation.js';
import {buildIsland,buildIslandSteps,RoyaleView} from './royale-view.js';
import {shopItem} from './shop-catalog.js';
import {makeShopBack,makeShopPickaxe,makeShopGlider,makeShopTrail} from './shop-models.js';
import {stairCamera} from './stair-camera.js';
import {LobbyMotion} from './lobby-motion.js';
import {eyeHeight,bodyHeight,canFight} from './stance.js';
import * as THREE from "three";
import {equipPose} from "./equip.js";
import { makeArms, updateArms, reloadProgress, utilityArms, throwArms, armAppearance } from "./arms.js";
import { patternedShell, addHeadwear, addEyewear, optionProfile } from "./cosmetics.js";
import { getMap } from "./maps.js";
import { gun, weapon, TEAM_COLORS, mode, clamp, NO_EYEWEAR } from "./data.js";
import { EYE, VIEWMODEL, direction, wallDistance } from "./physics.js";
import { makeBlaster, weaponPortrait } from "./weapons.js";
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
  if(shopItem(profile.backbling)){const back=makeShopBack(profile.backbling);back.position.set(0,-.09,.18);group.userData.human.bones.chest.add(back);group.userData.back=back;}
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
export class View {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = makeRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      settings.fov || 85,
      1,
      0.025,
      260,
    );
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xe9faff, 0x918777, 2.25));
    const sun = new THREE.DirectionalLight(0xfff3de, 2.2);
    sun.position.set(-15, 38, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -58,
      right: 58,
      top: 58,
      bottom: -58,
      near: 1,
      far: 140,
    });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.actors = new THREE.Group();
    this.scene.add(this.actors);
    this.effects = new THREE.Group();
    this.scene.add(this.effects);
    this.models = new Map();
    this.projectiles = new Map();
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
    this.royaleView = new RoyaleView(this, {block,ball,cylinder,mat,palette});

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("graphics-lost"));
    });
  }
  resize() {
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio || 1,
        this.settings.quality === "low" ? 1 : 1.25,
        Math.sqrt(1500000 / Math.max(1, innerWidth * innerHeight)),
      ) * (this.renderScale || 1),
    );
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    if(this.viewmodelCamera){this.viewmodelCamera.aspect=this.camera.aspect;this.viewmodelCamera.updateProjectionMatrix();}
  }
  setQuality() {
    this.renderScale=1;this.frameAverage=1/60;
    this.renderer.shadowMap.enabled = this.settings.quality !== "low";
    this.resize();
  }
  disposeGroup(group) {
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
        if (
          o.material.map &&
          o.material.map !== this.scopeTarget.texture &&
          o.material.map !== this.reticleTexture
        )
          o.material.map.dispose();
        o.material.dispose();
      }
    });
    group.clear();
  }
  prepareBattleMap(){
    if(this.mapId==='sunnybreak'||this.preparedBattle?.done)return;
    if(!this.preparedBattle){
      const map=getMap('sunnybreak'),group=new THREE.Group();
      // Use the same IDs as prediction/destruction when the first battle packet arrives.
      map.authored??=authoredBoxes(map);
      this.preparedBattle={group,steps:buildIslandSteps(group,map.authored?{...map,boxes:map.authored}:map,{block,ball,cylinder,mat,palette}),done:false};
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
    if (id === this.mapId) return;
    this.mapId = id;
    this.needsMapCompile=true;
    const map = getMap(id);
    this.disposeGroup(this.world);
    this.scene.background = new THREE.Color(map.sky);
    this.scene.fog = new THREE.Fog(map.sky, map.theme==='royale'?330:72, map.theme==='royale'?1000:175);
    this.camera.far=this.scopeCamera.far=map.theme==='royale'?1400:260;
    this.camera.near=map.theme==='royale'?.15:.025;
    this.camera.updateProjectionMatrix();this.scopeCamera.updateProjectionMatrix();
    if(id==='sunnybreak'&&this.preparedBattle){
      const pending=this.preparedBattle;
      // A full-human early departure may arrive before preparation finishes.
      if(!pending.done)for(const _ of pending.steps){}
      this.world.add(...pending.group.children.slice());this.preparedBattle=null;
    }else (map.theme==='royale'?buildIsland:buildArena)(this.world, map.authored?{...map,boxes:map.authored}:map, { block, ball, cylinder, mat, palette });
    for (let i = 0; i < 2; i++) {
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
    held.position.set(.10+pose.weaponSide,1.36+pose.breath+pose.grip+pose.weaponBob,-.22+pose.weaponDepth);
    held.rotation.set(pose.pitch,pose.weaponYaw,pose.roll,'YXZ');
    updateArms(model.userData.arms,-1,model.userData.blaster);
    animateHumanoid(model,{health:100,grounded:true,yaw:model.rotation.y,pitch:pose.pitch,
      scan:pose.scan,lobbyPatrol:pose,vx:-Math.sin(model.rotation.y)*pose.speed,vz:-Math.cos(model.rotation.y)*pose.speed},dt,motion.time,{menu:true});
  }
  diagnostics() {
    return {
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
    this.portraitRenderer.setSize(320,320);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x768697,3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,5,-4);scene.add(light);
    let model;
    if(item.starter){const kit={block,ball,cylinder,mat,palette};model=item.slot==='pickaxe'?lootModel({id:'pickaxe',pickaxe:true},kit,{ground:false}):item.slot==='glider'?gliderModel(kit):item.slot==='wrap'?makeBlaster('sprinter'):makeEgg({...item.profile,outfit:''},-1,!!item.characterInspection);}
    else if(item.slot==='outfit')model=makeEgg({...item.profile,outfit:item.id},-1,!!item.characterInspection);
    else if(item.slot==='wrap')model=makeBlaster('sprinter',item.id);
    else if(item.slot==='pickaxe')model=makeShopPickaxe(item.id);
    else if(item.slot==='backbling')model=makeShopBack(item.id);
    else if(item.slot==='glider')model=makeShopGlider(item.id);
    else if(item.slot==='trail'){model=makeEgg({color:item.color,eyewear:6},-1,false);model.add(makeShopTrail(item.id));}
    else model=makeEgg({color:'#fff6da',accent:'#3d8ce8',eyewear:6,...item.profile},-1,false);
    model.rotation.y=angle+(item.slot==='wrap'?1.15:item.slot==='backbling'?Math.PI:-.35);scene.add(model);
    const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());model.position.sub(center);
    const d=Math.max(size.x,size.y,size.z)*.65,camera=new THREE.OrthographicCamera(-d,d,d,-d,.01,30);camera.position.set(-2,1,-6);camera.lookAt(0,0,0);this.portraitRenderer.render(scene,camera);
    const result=this.portraitRenderer.domElement.toDataURL();this.disposeGroup(model);this.shopPortraits.set(key,result);return result;
  }
  rocketModel(){
    const g=new THREE.Group(),body=new THREE.MeshStandardMaterial({color:0x587c6d,metalness:.55,roughness:.35}),trim=new THREE.MeshStandardMaterial({color:0xf3c45b,metalness:.45,roughness:.3});
    const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.5,12),body);g.add(cylinder);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.11,.23,12),trim);nose.position.y=.365;g.add(nose);
    const collar=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.075,12),trim);collar.position.y=-.16;g.add(collar);
    for(let i=0;i<4;i++){const fin=new THREE.Mesh(new THREE.BoxGeometry(.035,.2,.26),body.clone());fin.rotation.y=i*Math.PI/2;fin.position.set(Math.sin(i*Math.PI/2)*.09,-.23,Math.cos(i*Math.PI/2)*.09);g.add(fin);}
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
    const model=this.royaleView.itemModel(item,false);model.rotation.y=-.35;scene.add(model);
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
    old.group.position.y-=pose.holster*.9;
    old.group.position.x+=pose.holster*.12;
    old.group.rotation.copy(old.rotation);
    old.group.rotation.x-=pose.holster*.5;
    old.group.rotation.z-=pose.holster*.35;
    old.group.visible=true;
  }
  setWeapon(p,draw) {
    const id = gun(p).id;
    const appearance=JSON.stringify([armAppearance(p),p.wrap,p.outfit]);
    if (id === this.localWeapon && appearance === this.armStyle) return;
    this.clearOutgoing(this);
    if(this.localModel && this.localWeapon!==id && draw.holster<1 && this.gunGroup.visible){
      updateArms(this.localArms,-1,this.localModel);
      const old=new THREE.Group();old.scale.copy(this.gunGroup.scale);
      old.position.copy(this.gunGroup.position);old.rotation.copy(this.gunGroup.rotation);
      while(this.gunGroup.children.length)old.add(this.gunGroup.children[0]);
      this.viewmodelCamera.add(old);
      this.outgoing={group:old,position:old.position.clone(),rotation:old.rotation.clone()};
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
  event(e, localId) {
    this.royaleView.event(e);
    if (e.type === "hit" && e.player === localId && Number.isFinite(e.x)) {
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

    if (e.type === "shot" || e.type === "launch") {
      if (e.player === localId&&!e.echoed) this.recoil = Math.min(1.6, this.recoil + weapon(e.weapon).recoilUp*70);
      const actor = this.models.get(e.player);
      if(e.type==='launch'&&e.popper){
        if(e.player===localId)this.localThrowStart=this.clock;
        if(actor)actor.userData.throwStart=this.clock;
      }
      if (actor && !e.popper) actor.userData.armRecoil = 1;
      if (!e.popper)
        this.pendingShots.push({ event: e, local: e.player === localId });
    }
    if (e.type === "impact") {
      const n = new THREE.Vector3(
        e.normal?.x || 0,
        e.normal?.y || 0,
        e.normal?.z || 0,
      );
      for (let i = 0; i < (e.tag ? 4 : 6); i++) {
        const m = new THREE.Mesh(
          sphereGeo,
          new THREE.MeshBasicMaterial({
            color:e.tag?0xb9b7ad:e.surface==='metal'?(i%2?0xf5d59c:0x9ea7aa):e.surface==='wood'?0xa58b67:0xb2ada1,
            transparent: true,
          }),
        );
        m.position.set(e.x, e.y, e.z);
        m.position.addScaledVector(n, 0.025);
        m.scale.setScalar((e.surface==='metal'?.009:.017) + Math.random() * .017);
        this.effects.add(m);
        this.fx.push({
          mesh: m,
          life: 0.22,
          max: 0.22,
          v: n
            .clone()
            .multiplyScalar(1.4)
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.7,
                (Math.random() - 0.5) * 2,
              ),
            ),
          ownedMaterial: true,
        });
      }
      if (!e.tag) {
        const mark = new THREE.Mesh(
          new THREE.CircleGeometry(0.027, 10),
          new THREE.MeshBasicMaterial({
            color: 0x445258,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        mark.position.set(e.x, e.y, e.z);
        mark.position.addScaledVector(n, 0.012);
        mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        this.effects.add(mark);
        this.fx.push({
          mesh: mark,
          life: 2.4,
          max: 2.4,
          ownedMaterial: true,
          ownedGeometry: true,
        });
      }
    }
    if (e.type === "elimination" || e.type === "explosion") {
      for (let i = 0; i < (e.type === "elimination" ? 18 : 26); i++) {
        const c =
          e.type === "elimination"
            ? [0xfff3c9, 0xffc843, 0x5dc7d5][i % 3]
            : [0xffc642, 0xf5ede0, 0xfb9564][i % 3];
        const m = new THREE.Mesh(boxGeo, mat(c));
        m.position.set(e.x, e.y + 0.6, e.z);
        m.scale.setScalar(0.08 + Math.random() * 0.14);
        this.effects.add(m);
        this.fx.push({
          mesh: m,
          life: 0.8,
          max: 0.8,
          v: new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            Math.random() * 6,
            (Math.random() - 0.5) * 8,
          ),
        });
      }
    }
  }
  muzzleEffects() {
    this.camera.updateMatrixWorld(true);
    this.actors.updateMatrixWorld(true);
    for (const { event: e, local } of this.pendingShots) {
      const model = local
        ? this.localModel
        : this.models.get(e.player)?.userData.blaster;
      const pos =
        model?.userData.muzzle?.getWorldPosition(new THREE.Vector3()) ||
        new THREE.Vector3(e.origin?.x || 0, e.origin?.y || 0, e.origin?.z || 0);
      if (local) this.lastMuzzleFlash = pos.clone();
      if(!e.echoed){const flash = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.045, 0),
        new THREE.MeshBasicMaterial({
          color: 0xffe3a0,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      flash.position.copy(pos);
      flash.scale.set(1, 1, 2.2);
      if (model)
        flash.quaternion.copy(model.getWorldQuaternion(new THREE.Quaternion()));
      if(local&&model?.userData.muzzle){model.userData.muzzle.add(flash);flash.position.set(0,0,0);flash.quaternion.identity();flash.scale.multiplyScalar(1/(this.gunGroup.scale.x||.5));}else this.effects.add(flash);
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
        const dir=end.clone().sub(origin).normalize(),trace=new THREE.Mesh(new THREE.CylinderGeometry(.004,.006,1,5),new THREE.MeshBasicMaterial({color:w.id==='comet'?0xb7e4df:0xe5e0cd,transparent:true,opacity:.52,depthWrite:false,toneMapped:false}));
        trace.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);trace.position.copy(origin);trace.scale.y=Math.min(.8,length);this.effects.add(trace);
        const duration=Math.max(.035,Math.min(.14,length/900));
        this.fx.push({mesh:trace,fresh:true,life:duration,max:duration,trace:true,origin,end,dir,length,ownedMaterial:true,ownedGeometry:true});
      }
    }
    this.pendingShots.length = 0;
  }
  update(state, local, predicted, dt, playing, aim, profile) {
    // Reduce GPU work when rendering itself delays input and socket processing.
    this.frameAverage=(this.frameAverage||1/60)*.9+dt*.1;
    this.budgetClock=(this.budgetClock||0)+dt;
    if(this.budgetClock>.75){
      this.budgetClock=0;const previous=this.renderScale||1;
      if(this.frameAverage>1/32){this.renderScale=Math.max(.5,previous-.15);this.renderer.shadowMap.enabled=false;}
      else if(this.frameAverage<1/55)this.renderScale=Math.min(1,previous+.05);
      if(this.renderScale!==previous)this.resize();
    }
    this.clock += dt;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    if(playing)this.loadMap(state?.options.map || "yard");
    if(playing&&state?.royale?.practice)this.prepareBattleMap();
    this.world.visible=playing;
    if(this.lobbyVisible!==!playing){this.lobbyVisible=!playing;const map=getMap(state?.options.map||'yard'),sky=playing?map.sky:0x6f9295;this.scene.background=new THREE.Color(sky);this.scene.fog=new THREE.Fog(sky,playing?(map.theme==='royale'?330:72):35,playing?(map.theme==='royale'?1000:175):125);}
    if (this.menuEgg) this.menuEgg.visible = !playing;
    if(this.lobbyStage)this.lobbyStage.visible=!playing;
    for(const egg of this.partyEggs||[])egg.visible=!playing;
    this.actors.visible = playing;
    this.effects.visible = playing;
    this.gunGroup.visible = playing && canFight(local) && (!local.inventory || local.flight==='ground');
    if (!playing) {
      this.clearOutgoing(this);
      this.preview(profile);
      this.animateLobbyCharacter(this.menuEgg,this.lobbyMotion,dt);
      this.lobbyStage.userData.update?.(dt);
      for(const teammate of this.partyEggs||[])this.animateLobbyCharacter(teammate,teammate.userData.lobbyMotion,dt,.17);
      const partyCount=this.partyEggs?.length||0,partyOffset=partyCount===1?1.4:partyCount===3?1.5:0,narrow=this.camera.aspect<.85;
      this.camera.position.set(narrow&&partyCount>1?partyOffset:5.8+partyOffset,4.3,narrow?(partyCount===3?34:partyCount>1?29:partyCount?22.5:19):partyCount>1?19:12.5);
      this.camera.lookAt(partyOffset, narrow?(partyOffset?1.7:1):1.8, 0);
      this.camera.fov = narrow?47:48;
      this.camera.updateProjectionMatrix();
    } else if (local) {
      const killer = local.health <= 0 && state.players.find(p => p.id === (local.spectating ? this.spectateTarget : local.killerId) && p.health > 0);
      const p = killer || (local.health <= 0 ? local : predicted || local);
      this.stairEye=stairCamera(this.stairEye,p,dt,`${state.round}:${p.id}:${local.health>0}`);
      const desiredEye=eyeHeight(p);this.stanceEye=this.stanceEye===undefined?desiredEye:THREE.MathUtils.lerp(this.stanceEye,desiredEye,1-Math.exp(-dt*17));
      this.camera.position.set(
        p.x,
        this.stairEye.y + this.stanceEye + (local.health <= 0 ? 0.8 : 0),
        p.z,
      );
      this.camera.rotation.set(p.pitch+(p.recoilPitch||0), p.yaw+(p.recoilYaw||0), 0, "YXZ");
      if (killer || local.downed) {
        const back = new THREE.Vector3(Math.sin(p.yaw), 0.35, Math.cos(p.yaw)).normalize();
        const origin = {x:p.x, y:p.y+(p.downed?.8:1.6), z:p.z};
        const distance = Math.max(0.1, wallDistance(getMap(state.options.map), origin, back, 3.5)-0.2);
        this.camera.position.set(origin.x+back.x*distance, origin.y+back.y*distance, origin.z+back.z*distance);
        this.camera.lookAt(p.x, p.y+(p.downed?.5:1.05), p.z);
      }
      const draw=equipPose(local,state.time);
      this.drawPresentation=draw;
      this.setWeapon(local,draw);
      this.lowerOutgoing(this,draw,local.health>0);
      this.gunGroup.visible=this.gunGroup.visible&&draw.visible;
      const w = gun(local),
        scoped = w.optic === "scope" || w.optic === "prism";
      const aiming = !!(canFight(local) && aim && (!local.inventory||local.flight==='ground'&&local.inventory[local.slot]?.weapon) && local.health > 0 && local.reloadEnd <= state.time && !draw.active);
      if(!Number.isFinite(this.aimBlend))this.aimBlend=0;
      this.aimBlend += (Number(aiming) - this.aimBlend) * Math.min(1, dt * (w.ads?.transition||14));
      const fov=aiming?adsFov(w,this.settings.fov):this.settings.fov;
      this.camera.fov+=(fov-this.camera.fov)*Math.min(1,dt*(w.ads?.transition||13));
      this.camera.updateProjectionMatrix();
      const bob =
        Math.sin(this.clock * 11) *
        0.012 *
        (p.moving ? 1 : 0) *
        (1 - this.aimBlend);
      const reload = reloadProgress(local, state.time);
      const hands = updateArms(this.localArms, draw.active?-1:reload, this.localModel, this.recoil,draw.progress);
      const throwT=(this.clock-this.localThrowStart)/.78;
      if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1)throwArms(this.localArms,throwT);
      const vm=viewmodelProfile(w.id,this.camera.aspect);this.gunGroup.scale.setScalar(vm.scale);
      this.viewmodelCamera.fov=vm.fov;this.viewmodelCamera.updateProjectionMatrix();
      const front = -VIEWMODEL.z + w.muzzle * VIEWMODEL.scale;
      const wall = wallDistance(
        getMap(state.options.map),
        { x: p.x, y: p.y + eyeHeight(p), z: p.z },
        direction(p.yaw, p.pitch),
        front,
      );
      this.gunGroup.position.set(
        vm.x * (1 - this.aimBlend) + draw.position[0],
        THREE.MathUtils.lerp(
          vm.y,
          -w.sightY * vm.scale,
          this.aimBlend,
        ) +
          bob -
          hands.dip + draw.position[1],
        vm.z + this.recoil * 0.025 + draw.position[2],
      );
      this.gunGroup.rotation.set(
        this.recoil * 0.045 * (1 - this.aimBlend * 0.65) + hands.rotation[0] + draw.rotation[0],
        hands.rotation[1] + draw.rotation[1],
        hands.rotation[2] + draw.rotation[2],
      );
      if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1){
        const gesture=Math.sin(Math.PI*throwT);
        this.gunGroup.position.y-=.19*gesture;
        this.gunGroup.rotation.x+=.2*gesture;
      }
      this.scopeActive = !!aiming && scoped && this.aimBlend > 0.1 && (!local.inventory||!!local.inventory[local.slot]?.weapon);
      if(local.inventory){
        const heldItem=local.building?{id:'blueprint'}:local.inventory[local.slot];
        this.localModel.visible=!!heldItem?.weapon;
        const itemKey=heldItem&&!heldItem.weapon?heldItem.id+':'+(heldItem.pickaxe?local.pickaxe:''):null;
        if(this.heldItemKey!==itemKey){
          if(this.heldItem){this.heldItem.removeFromParent();this.disposeGroup(this.heldItem);}
          this.heldItem=null;this.heldItemKey=itemKey;
          if(itemKey){this.heldItem=heldItem.pickaxe&&shopItem(local.pickaxe)?makeShopPickaxe(local.pickaxe):this.royaleView.itemModel(heldItem,false);this.heldItem.userData.firstPerson=true;this.heldItem.scale.setScalar(.4);this.heldItem.position.set(-.05,-.08,-.28);this.gunGroup.add(this.heldItem);}
        }
        if(!heldItem?.weapon&&this.localArms)utilityArms(this.localArms,heldItem?.id,local.use?(state.time-local.use.start)/(local.use.end-local.use.start):-1,this.clock);
        if(this.heldItem&&heldItem?.pickaxe)animatePickaxe(this.heldItem,this.localArms,local.pickaxe,state.time-(local.swingAt??-100));
        else if(this.heldItem)this.heldItem.rotation.z=local.use?Math.sin(this.clock*8)*.15:0;
        if(this.localArms){this.localArms.rotation.x=local.use ? -.35+Math.sin(this.clock*6)*.06 : 0;}
        this.gunGroup.rotation.z+=local.sprinting?.35:0;
        if(local.use){this.gunGroup.position.y+=.08+Math.sin(this.clock*8)*.015;this.gunGroup.rotation.x=-.3;}
        if(p.flight==='transport'){
          this.camera.position.set(p.x+Math.sin(p.yaw)*24,p.y+16,p.z+Math.cos(p.yaw)*24);this.camera.lookAt(p.x,p.y+3,p.z);this.camera.fov=80;this.camera.updateProjectionMatrix();
        }else if(p.health>0&&p.flight!=='ground'){
          this.camera.position.set(p.x+Math.sin(p.yaw)*6,p.y+3.5,p.z+Math.cos(p.yaw)*6);this.camera.rotation.set(Math.min(p.pitch,-.18),p.yaw,0,'YXZ');
        }
      }
    }
    if (state) {
      const seen = new Set();
      this.camera.updateMatrixWorld();
      this.actorFrustum ||= new THREE.Frustum();
      this.actorMatrix ||= new THREE.Matrix4();
      this.actorBounds ||= new THREE.Sphere(new THREE.Vector3(),2.5);
      this.actorFrustum.setFromProjectionMatrix(this.actorMatrix.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse));
      for (const p of state.players) {
        // Transport passengers share one simulation position; the airship
        // represents them until exit instead of rendering sixteen overlapping operators.
        if(state.royale&&p.flight==='transport')continue;
        if ((p.spectating && (!p.eliminatedAt || state.time-p.eliminatedAt>.75)) || p.awaitingEntry || (p.id === local?.id && p.health > 0 && !p.downed && (!p.inventory || p.flight==='ground'||p.flight==='transport'))) continue;
        seen.add(p.id);
        this.actorBounds.center.set(p.x,p.y+.9,p.z);
        if(playing&&!this.actorFrustum.intersectsSphere(this.actorBounds)){const hidden=this.models.get(p.id);if(hidden)hidden.visible=false;continue;}
        const sig =
          p.color +
          p.hat + JSON.stringify([p.pattern,p.finish,p.eyewear,p.accent,p.outfit,p.wrap,p.backbling,p.pickaxe]) +
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
          model.userData.signature = sig;
          const name = label(
            p.name,
            teammates(state.options,p,local)
              ? teamStyle(state.players,p).color
              : "#ffffff",
          );
          name.position.y = 2.15;model.userData.nameplate=name;
          name.visible = !state.royale||teammates(state.options,p,local);
          model.add(name);
          this.actors.add(model);
          this.models.set(p.id, model);
          model.position.set(p.x, p.y, p.z);
        }
        const draw=equipPose(p,state.time);
        if(model.userData.arms?.userData.id!==gun(p).id){
          this.clearOutgoing(model.userData);
          const old=model.userData.held;
          if(draw.holster<1){
            updateArms(model.userData.arms,-1,model.userData.blaster);
            model.userData.outgoing={group:old,position:old.position.clone(),rotation:old.rotation.clone()};
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
        model.userData.blaster.visible=!harvesting;
        model.userData.draw=draw;
        const deathAge=p.health<=0?state.time-(p.eliminatedAt??p.respawnAt-3):0;
        model.visible=p.health>0||deathAge<1.3;
        if (model.userData.arms) {
          const recoil = model.userData.armRecoil = Math.max(0, (model.userData.armRecoil || 0) - dt * 7);
          const hands = updateArms(model.userData.arms, draw.active?-1:reloadProgress(p, state.time), model.userData.blaster, recoil,draw.progress);
          if(harvesting&&model.userData.shopTool)animatePickaxe(model.userData.shopTool,model.userData.arms,p.pickaxe,state.time-(p.swingAt??-100));
          const throwT=(this.clock-(model.userData.throwStart??-Infinity))/.78;
          if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1)throwArms(model.userData.arms,throwT);
          model.userData.held.visible=draw.visible&&canFight(p);
          model.userData.held.rotation.set(p.pitch + hands.rotation[0] + recoil * .045 + draw.rotation[0], hands.rotation[1]+draw.rotation[1], hands.rotation[2]+draw.rotation[2]);
          model.userData.held.position.set(VIEWMODEL.x+draw.position[0],eyeHeight(p)+VIEWMODEL.y-hands.dip+draw.position[1]*.5,VIEWMODEL.z+draw.position[2]);
          if(state.options.mode!=='royale'&&throwT>=0&&throwT<=1){
            const gesture=Math.sin(Math.PI*throwT);
            model.userData.held.position.y-=.16*gesture;
            model.userData.held.rotation.x+=.16*gesture;
          }
        }
        // Do not let cosmetic smoothing leave a moving character behind its hit regions.
        const base = model.userData.basePosition ||= new THREE.Vector3(p.x, p.y, p.z);
        const targetPosition = new THREE.Vector3(p.x, p.y, p.z);
        base.lerp(targetPosition, Math.min(1, dt * 18));
        const lag = base.clone().sub(targetPosition).clampLength(0, 0.04);
        base.copy(targetPosition).add(lag);
        model.position.copy(base);
        let delta = p.yaw - model.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        model.rotation.y = p.id===local?.id ? p.yaw : model.rotation.y + delta * Math.min(1, dt * 18);
        model.scale.setScalar(1);model.rotation.x=model.rotation.z=0;
        const aura=model.userData.bonusAura;
        aura.visible=p.health>0&&(p.streakArmor>0||p.damageUntil>state.time||state.time<p.shieldUntil);
        aura.material.color.setHex(p.damageUntil>state.time?0xff625f:0x83e6ff);
        aura.material.opacity=.13+Math.sin(this.clock*5)*.025;
        if(p.inventory)this.royaleView.animateActor(model,p,this.clock,dt);
        if(model.userData.nameplate)model.userData.nameplate.position.y=bodyHeight(p)+.3;
        animateHumanoid(model,{...p,shotRecoil:model.userData.armRecoil||0},dt,state.time,{distance:this.camera.position.distanceTo(model.position)});

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
            pip: [.005,.03,.12],comet:[.007,.065,.26],
          };
          const [radius, length, trail] = profiles[b.weapon] || profiles.sprinter;
          if(bolt)mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,3,6),new THREE.MeshStandardMaterial({color:0xe4bc78,roughness:.4,metalness:.55}));
          else if(b.popper){mesh=this.royaleView.itemModel({id:'popper',count:1},false);mesh.scale.setScalar(.65);}
          else mesh=this.rocketModel();
          this.effects.add(mesh);
          this.projectiles.set(b.id, mesh);
          if (bolt) {
            const tail = new THREE.Mesh(
              new THREE.CylinderGeometry(radius * 0.35, 0, trail, 5),
              new THREE.MeshBasicMaterial({
                color: 0xdddcd2, transparent: true, opacity: 0.20,
                depthWrite: false, toneMapped: false,
              }),
            );
            tail.position.y = -(length + trail) / 2;
            mesh.add(tail);
          }
        }
        mesh.position.set(
          b.x + b.vx * this.snapshotAge,
          b.y + b.vy * this.snapshotAge,
          b.z + b.vz * this.snapshotAge,
        );
        if(!b.popper&&b.kind!=='bolt'){
          if(mesh.userData.flame)mesh.userData.flame.scale.y=.75+Math.sin(this.clock*45)*.25;
          if(state.phase==='playing'&&this.clock>(mesh.userData.smokeAt||0)){
            mesh.userData.smokeAt=this.clock+.07;
            const smoke=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),new THREE.MeshBasicMaterial({color:0xc7cbd3,transparent:true,opacity:.4,depthWrite:false}));
            smoke.position.copy(mesh.position);this.effects.add(smoke);this.fx.push({mesh:smoke,life:.6,max:.6,smoke:true,ownedMaterial:true,ownedGeometry:true});
          }
        }
        const offset = this.shotOffsets.get(b.id);
        if (offset) {
          const blend = Math.max(0, 1 - (this.clock - offset.born) / 0.08);
          mesh.position.addScaledVector(offset.delta, blend);
          if (blend === 0) this.shotOffsets.delete(b.id);
        }
        const velocity = new THREE.Vector3(b.vx, b.vy, b.vz);
        if (velocity.lengthSq() > 0.01)
          mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            velocity.normalize(),
          );
      }
      for (const [id, mesh] of this.projectiles)
        if (!active.has(id)) {
          this.effects.remove(mesh);
          mesh.traverse((o) => {
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
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      if (f.fresh) {
        f.fresh = false;
        continue;
      }
      f.life -= dt;
      if (f.life <= 0) {
        f.mesh.removeFromParent();
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
    if(playing&&this.scopeActive&&gun(local).ads?.overlay&&this.aimBlend>.8)this.gunGroup.visible=false;
    this.royaleView.update(state,local,dt,playing);
    if(this.needsMapCompile){
      this.needsMapCompile=false;
      const job=this.renderer.compileAsync(this.scene,this.camera);this.mapCompile=job;
      job.catch(error=>console.error('Map shader preparation failed',error)).finally(()=>{if(this.mapCompile===job)this.mapCompile=null;});
    }
    if(this.mapCompile)return;
    this.renderer.info.autoReset=false;this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    if(playing&&(this.gunGroup.visible||this.outgoing?.group.visible)){this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.viewmodelScene,this.viewmodelCamera);this.renderer.autoClear=true;}
  }
}
import {teammates,teamStyle} from './teams.js';
