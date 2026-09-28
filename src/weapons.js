import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { weapon } from "./data.js";
import {OPTICS} from './weapon-presentation.js';
import {applyWrap} from './shop-models.js';

// The same authored model is used in the player's hands, on other operators, and in previews.
const materials = new Map();
const geometries = new Map();
const color = (hex, metal = false) => {
  const key = `${hex}:${metal}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: metal ? 0.32 : 0.58,
        metalness: metal ? 0.68 : 0.12,
      }),
    );
  return materials.get(key);
};
const cached = (key, create) => {
  if (!geometries.has(key)) {
    const g = create();
    g.userData.shared = true;
    geometries.set(key, g);
  }
  return geometries.get(key);
};
function part(parent, geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function box(g, x, y, z, w, h, d, c, bevel = 0.025, metal = false) {
  const key = `box:${w}:${h}:${d}:${bevel}`;
  return part(
    g,
    cached(
      key,
      () =>
        new RoundedBoxGeometry(
          w,
          h,
          d,
          2,
          Math.min(bevel, w / 3, h / 3, d / 3),
        ),
    ),
    color(c, metal),
    [x, y, z],
  );
}
function tube(g, x, y, z, r, length, c, open = false) {
  const m = part(
    g,
    cached(
      `tube:${r}:${length}:${open}`,
      () => new THREE.CylinderGeometry(r, r, length, 12, 1, open),
    ),
    color(c, true),
    [x, y, z],
  );
  m.rotation.x = Math.PI / 2;
  return m;
}
function taper(g,x,y,z,back,front,length,c){
 const m=part(g,cached(`taper:${back}:${front}:${length}`,()=>new THREE.CylinderGeometry(back,front,length,12)),color(c,true),[x,y,z]);m.rotation.x=Math.PI/2;return m;
}
function ring(g, x, y, z, r, t, c) {
  return part(
    g,
    cached(`ring:${r}:${t}`, () => new THREE.TorusGeometry(r, t, 5, 16)),
    color(c, true),
    [x, y, z],
  );
}
function plate(g, points, thickness, c, x = 0) {
  const key = `plate:${JSON.stringify(points)}:${thickness}`;
  const geo = cached(key, () => {
    const s = new THREE.Shape();
    points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: thickness,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    });
    // Shape X is length; extrusion becomes width. Forward is -Z.
    geo.rotateY(-Math.PI / 2);
    geo.translate(thickness / 2, 0, 0);
    return geo;
  });
  return part(g, geo, color(c), [x, 0, 0]);
}
const dark = 0x253444,
  black = 0x132331,
  steel = 0x667c88,
  cream = 0xf5edd5;
function grip(g, z = 0.12) {
  const m = box(g, 0, -0.24, z, 0.14, 0.3, 0.18, dark);
  m.rotation.x = -0.18;
  for (let i = 0; i < 4; i++)
    box(g, 0, -0.14 - i * 0.052, z + 0.055, 0.15, 0.014, 0.08, black, 0.004);
  box(g, 0, -0.2, z - 0.145, 0.14, 0.032, 0.18, steel, 0.01, true);
  box(g, 0, -0.1, z - 0.23, 0.11, 0.18, 0.028, dark, 0.01);
}
function stock(g, c, z = 0.35) {
  plate(
    g,
    [
      [z, -0.06],
      [z + 0.4, -0.12],
      [z + 0.45, 0.1],
      [z + 0.14, 0.13],
      [z, 0.07],
    ],
    0.16,
    c,
  );
  box(g, 0, -0.04, z + 0.43, 0.19, 0.27, 0.07, dark);
  box(g, 0, 0.13, z + 0.22, 0.14, 0.08, 0.25, dark);
}
function vents(g, z, count, width = 0.25, spacing = 0.07) {
  for (let i = 0; i < count; i++)
    for (const x of [-width / 2, width / 2])
      box(g, x, 0.018, z - i * spacing, 0.008, 0.065, 0.028, black, 0.003);
}
function optic(g, kind, frontZ = -0.7) {
  const config=OPTICS[g.userData.weaponId];
  const sightY = config?config.radius+.15:0.285;
  if (kind === "iron") {
    box(g, 0, 0.109, 0.15, 0.18, 0.035, 0.09, dark, 0.007);
    for (const x of [-0.066, 0.066])
      box(g, x, 0.17, 0.15, 0.032, 0.12, 0.045, steel, 0.006, true);
    box(g, 0, 0.1, frontZ, 0.14, 0.1, 0.09, steel, 0.009, true);
    box(g, 0, 0.185, frontZ, 0.022, 0.07, 0.04, cream, 0.005);
    g.userData.sightY = 0.22;
    return;
  }
  if (kind === "scope" || kind === "prism") {
    const radius = config?.radius || .125;
    const length=config?.length||.54,objective=config?.objective||radius;
    for (const z of [-0.1, 0.15]) {
      box(g, 0, 0.17, z, 0.12, 0.14, 0.075, dark);
      ring(g, 0, sightY, z, radius + 0.009, 0.018, steel);
    }
    tube(g, 0, sightY, .02, radius, length, dark, true);
    taper(g,0,sightY,-length/2, radius,objective,.14,dark);
    ring(g,0,sightY,-length/2-.075,objective,.018,steel);
    tube(g,0,sightY,-length/2-.08,objective-.016,.01,0x3d8997);
    ring(g,0,sightY,.26,radius+.016,.028,black);
    ring(g, 0, sightY, 0.302, radius, 0.026, black);
    ring(g, 0, sightY, 0.328, radius + 0.012, 0.015, steel);
    ring(g, 0, sightY, -0.27, radius, 0.027, dark);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      box(
        g,
        Math.sin(a) * (radius + 0.018),
        sightY + Math.cos(a) * (radius + 0.018),
        0.2,
        0.023,
        0.023,
        0.08,
        dark,
        0.004,
      );
    }
    const dial = part(
      g,
      cached("dial", () => new THREE.CylinderGeometry(0.055, 0.055, 0.07, 16)),
      color(dark, true),
      [0, sightY + radius + 0.035, 0.03],
    );
    box(g, 0.16, sightY, 0.02, 0.07, 0.08, 0.08, steel, 0.015, true);
    const lens = part(
      g,
      cached(
        `lens:${radius}`,
        () => new THREE.CircleGeometry(radius - 0.012, 48),
      ),
      new THREE.MeshBasicMaterial({ color: 0x3c8290 }),
      [0, sightY, 0.333],
    );
    lens.userData.ownedMaterial = true;
    g.userData.lens = lens;
    g.userData.optic = kind;
    g.userData.sightY = sightY;
  } else {
    box(g, 0, 0.17, 0.02, 0.23, 0.035, 0.25, black, 0.012);
    for (const x of [-0.115, 0.115])
      box(g, x, 0.285, 0.02, 0.035, 0.23, 0.09, dark, 0.012, true);
    box(g, 0, 0.4, 0.02, 0.24, 0.035, 0.09, steel, 0.012, true);
    const glass = part(
      g,
      cached("reflexglass", () => new THREE.PlaneGeometry(0.19, 0.2)),
      new THREE.MeshBasicMaterial({
        color: 0x7ed7dc,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      [0, 0.285, 0.068],
    );
    glass.userData.ownedMaterial = true;
    const dot = part(
      g,
      cached("dot", () => new THREE.CircleGeometry(0.006, 16)),
      new THREE.MeshBasicMaterial({ color: 0xff593c, toneMapped: false }),
      [0, 0.285, 0.071],
    );
    dot.userData.ownedMaterial = true;
    g.userData.sightY = sightY;
    g.userData.optic = "reflex";
  }
}
export function makeBlaster(id,wrap='') {
  const w = weapon(id),
    g = new THREE.Group(),
    c = w.color;
  g.name = `${w.name} blaster`;
  g.userData.weaponId=id;
  const wood=0x896044;
  const receiver=(length=.58,width=.25)=>{plate(g,[[.31,-.11],[-length+.31,-.11],[-length+.24,.03],[-length+.35,.145],[.25,.145],[.34,.06]],width,c);tube(g,0,.075,.03,.072,.4,dark);};
  const magazine=(z,h=.3,curved=false)=>{const m=curved?plate(g,[[z+.09,-.1],[z-.09,-.1],[z-.12,-.26],[z-.19,-.42],[z-.025,-.46],[z+.07,-.27]],.145,dark):box(g,0,-.13-h/2,z,.16,h,.19,dark,.025);g.userData.reloadPart=m;return m;};
  const rail=(z,length)=>{box(g,0,.164,z,.135,.035,length,dark,.008);for(let i=0;i<Math.floor(length/.055);i++)box(g,0,.19,z-length/2+i*.055,.16,.025,.024,steel,.004);};
  const muzzleModel=(z,r=.06)=>{tube(g,0,0,z+.045,r,.09,dark);ring(g,0,0,z,r,.014,steel);tube(g,0,0,z-.004,r*.68,.01,black);};
  const bolt=(x=.17,z=.14)=>{const b=new THREE.Group();b.position.set(x,.045,z);const handle=tube(b,.03,0,0,.022,.13,steel);handle.rotation.set(0,0,Math.PI/2);box(b,.08,-.025,0,.07,.08,.065,black,.027);g.add(b);g.userData.bolt=b;};
  if(id==='pip'){
    // Tapered pistol slide, separate frame, recessed ejection port and serrations.
    plate(g,[[.23,-.03],[-.33,-.03],[-.34,.065],[-.28,.13],[.19,.13],[.25,.07]],.2,c);
    plate(g,[[.22,-.08],[-.26,-.08],[-.29,-.04],[.16,.02],[.24,-.03]],.17,dark);grip(g,.12);
    box(g,.103,.07,-.08,.012,.047,.1,black,.008);
    for(const side of [-1,1])for(let i=0;i<6;i++)box(g,side*.107,.042,.065+i*.024,.008,.092,.01,steel,.003);
    tube(g,0,.015,-.345,.043,.2,steel);muzzleModel(-.445,.052);
    g.userData.reloadPart=box(g,0,-.4,.12,.13,.15,.14,steel);optic(g,'iron',-.255);
  }else if(id==='scatter'){
    // A classic side-by-side break-action silhouette with walnut fore-end.
    plate(g,[[.32,-.1],[-.24,-.12],[-.29,.05],[-.17,.135],[.26,.14]],.31,c);grip(g,.17);stock(g,wood,.31);
    for(const x of [-.085,.085]){tube(g,x,.015,-.47,.075,.84,steel);ring(g,x,.015,-.9,.078,.014,dark);tube(g,x,.015,-.905,.055,.009,black);}
    plate(g,[[-.22,-.05],[-.68,-.06],[-.7,-.13],[-.57,-.2],[-.3,-.21]],.255,wood);
    for(let j=0;j<7;j++)box(g,0,-.185,-.28-j*.047,.255,.024,.021,0x67442f,.006);
    box(g,0,.14,.16,.035,.035,.17,steel,.012);optic(g,'iron',-.78);
  }else if(id==='doubleyolk'){
    // Tubular magazine below the barrel, ribbed pump and ventilated heat shield.
    receiver(.6,.28);grip(g,.17);stock(g,dark,.31);
    tube(g,0,.018,-.48,.078,.83,steel);tube(g,0,-.105,-.46,.058,.66,dark);muzzleModel(-.9,.08);
    const pump=new THREE.Group();pump.position.set(0,-.115,-.46);box(pump,0,0,0,.255,.19,.32,c,.06);
    for(let i=0;i<7;i++)box(pump,0,0,-.14+i*.047,.268,.195,.019,black,.006);g.add(pump);g.userData.pump=pump;
    for(const side of [-1,1])for(let i=0;i<4;i++)box(g,side*.084,.062,-.23-i*.085,.02,.065,.04,black,.008);
    optic(g,'iron',-.78);
  }else if(id==='needle'||id==='peeper'||id==='anchor'){
    receiver(id==='anchor'?.65:.6,id==='anchor'?.28:.235);grip(g,id==='anchor'?.2:.13);
    if(id==='peeper'){for(const x of [-.065,.065])box(g,x,.015,.48,.04,.075,.39,steel,.009);box(g,0,-.06,.67,.21,.31,.07,c,.028);box(g,0,.15,.44,.16,.07,.26,dark);}
    else {stock(g,id==='needle'?0x55717a:c,.36);box(g,0,.18,.58,.19,.11,.25,dark,.035);}
    const end=id==='anchor'?-.94:-1.1;
    plate(g,[[-.16,-.07],[-.61,-.05],[-.66,-.14],[-.22,-.17]],.22,id==='peeper'?wood:dark);
    taper(g,0,0,(end-.29)/2,.07,.037,-end-.29,steel);muzzleModel(end,id==='needle'?.07:.065);
    if(id==='needle'){for(const x of [-.095,.095]){const leg=box(g,x,-.21,-.6,.03,.29,.04,steel,.01);leg.rotation.z=x>0?-.45:.45;}for(let i=0;i<4;i++)box(g,0,.018,-.92+i*.045,.09,.035,.019,black,.004);}
    if(id==='anchor'){tube(g,0,.067,-.54,.021,.39,dark);vents(g,-.29,5,.235,.056);rail(-.02,.49);}
    magazine(-.15,id==='anchor'?.29:.23);bolt();optic(g,'scope');
  }else if(id==='zipper'){
    // Compact roller-style rounded receiver, telescoping stock and curved stick magazine.
    tube(g,0,.055,-.07,.115,.5,c);box(g,0,-.05,.04,.23,.1,.4,dark,.03);grip(g,.13);
    for(const x of [-.1,.1])box(g,x,.045,.45,.027,.045,.44,steel,.01);box(g,0,-.055,.66,.2,.25,.055,dark,.018);
    taper(g,0,.01,-.365,.12,.075,.21,dark);tube(g,0,0,-.55,.049,.24,steel);muzzleModel(-.68,.065);
    magazine(-.14,.32,true);vents(g,-.29,4,.2,.04);rail(.025,.25);optic(g,'reflex');bolt(.14,-.19);
  }else if(id==='thumper'){
    // Shoulder-fired capsule launcher: bulbous chamber, reinforced breech and muzzle flare.
    grip(g,.17);stock(g,dark,.3);taper(g,0,0,-.23,.17,.135,.67,c);
    taper(g,0,0,-.64,.14,.21,.17,steel);ring(g,0,0,-.735,.205,.023,dark);tube(g,0,0,-.744,.17,.01,black);
    for(const z of [-.05,-.36,-.54])ring(g,0,0,z,.168,.026,black);
    box(g,0,-.2,-.3,.19,.14,.33,dark,.045);box(g,.18,.02,-.11,.06,.14,.17,steel,.026);
    for(const x of [-.175,.175])box(g,x,.025,-.33,.015,.035,.32,0xabc8ba,.01);rail(.02,.24);optic(g,'reflex');
  }else if(id==='duet'){
    // Bullpup: rear magazine and carry rail distinguish it from the assault carbine.
    plate(g,[[.61,-.12],[-.35,-.13],[-.48,.025],[-.32,.14],[.55,.15],[.65,.05]],.265,c);grip(g,-.03);magazine(.35,.27);
    box(g,0,-.005,.66,.29,.29,.06,dark,.026);box(g,0,-.08,-.42,.235,.16,.27,dark,.04);
    tube(g,0,0,-.69,.05,.43,steel);muzzleModel(-.92,.065);vents(g,-.15,5,.278,.052);rail(.05,.49);optic(g,'prism');
    box(g,.142,.025,.34,.014,.062,.15,black,.006);bolt(.155,-.12);
  }else if(id==='comet'){
    // Original induction projector, curved coil housing and visible ceramic emitter.
    plate(g,[[.28,-.12],[-.29,-.13],[-.39,0],[-.27,.16],[.24,.18],[.36,.06]],.29,c);grip(g,.13);stock(g,0x55688e,.34);
    taper(g,0,0,-.48,.15,.1,.43,steel);tube(g,0,0,-.74,.085,.3,0xb5eee7);muzzleModel(-.9,.103);
    for(const z of [-.32,-.43,-.54,-.65])ring(g,0,0,z,.158,.023,0x79d8d6);
    for(const x of [-.175,.175]){plate(g,[[-.24,-.06],[-.72,-.09],[-.82,.015],[-.63,.08],[-.26,.12]],.048,c,x);}
    g.userData.reloadPart=box(g,0,-.24,-.1,.19,.27,.22,0x91d2e1,.055);rail(.055,.28);optic(g,'reflex');
  }else{
    // Stamped assault receiver, sloped gas block and curved magazine.
    receiver(.63,.255);grip(g,.13);stock(g,wood,.35);magazine(-.1,.32,true);
    plate(g,[[-.29,-.08],[-.62,-.08],[-.65,.065],[-.31,.09]],.235,wood);
    for(const side of [-1,1])for(let i=0;i<4;i++)box(g,side*.124,-.01,-.35-i*.06,.01,.055,.034,dark,.009);
    tube(g,0,0,-.74,.044,.3,steel);tube(g,0,.078,-.55,.023,.29,dark);muzzleModel(-.9,.063);
    rail(.04,.4);bolt(.15,.12);optic(g,'reflex');
  }
  // Recessed trigger within an oval guard (visual geometry, no extra interaction).
  const trigger=box(g,0,-.13,id==='duet'?-.14:.018,.022,.1,.024,steel,.008);trigger.rotation.x=-.25;
  const guard=ring(g,0,-.17,id==='duet'?-.16:-.018,.105,.012,dark);guard.rotation.y=Math.PI/2;guard.scale.set(.78,1,1);
  if (id === "scatter" || id === "doubleyolk" || id === "thumper") {
    const token = tube(g, 0, 0, 0, id === "thumper" ? .085 : .05, id === "thumper" ? .28 : .15, c);
    token.visible = false;
    g.userData.reloadToken = token;
  }
  // Small construction details break up broad surfaces while keeping readable silhouettes.
  const detailX =
    {
      pip: 0.099,
      scatter: 0.154,
      needle: 0.12,
      zipper: 0.135,
      thumper: 0.151,
      anchor: 0.174,
      duet: 0.145,
      sprinter: 0.135,
    }[id] || 0.135;
  for (const x of [-1, 1]) {
    box(g, x * detailX, 0.03, 0.11, 0.012, 0.032, 0.09, cream, 0.004);
    for (const z of [0.04, 0.2]) {
      const bolt = part(
        g,
        cached(
          "bolt",
          () => new THREE.CylinderGeometry(0.014, 0.014, 0.008, 8),
        ),
        color(steel, true),
        [x * (detailX - 0.001), -0.06, z],
      );
      bolt.rotation.z = Math.PI / 2;
    }
  }
  // Bake static details by material: detail does not require a draw call per screw.
  g.updateMatrixWorld(true);
  const batches = new Map();
  for (const object of [...g.children])
    if (object.isMesh && !object.userData.ownedMaterial && object !== g.userData.reloadPart && object !== g.userData.reloadToken) {
      const key = object.material.uuid;
      if (!batches.has(key))
        batches.set(key, { material: object.material, parts: [] });
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      batches.get(key).parts.push(geometry);
      g.remove(object);
    }
  for (const [key, batch] of batches) {
    const geometry = cached(`model:${id}:${key}`, () =>
      mergeGeometries(batch.parts),
    );
    batch.parts.forEach((p) => p.dispose());
    part(g, geometry, batch.material, [0, 0, 0]);
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle";
  muzzle.position.set(0, 0, -w.muzzle);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.userData.sightY = w.sightY;
  return applyWrap(g,wrap);
}
export function disposeBlaster(group) {
  group.traverse((o) => {
    if (o.userData.ownedMaterial) {
      o.material.dispose();
    }
  });
}

export function weaponPortrait(renderer, id) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe5e9e4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x768697, 3));
  const key = new THREE.DirectionalLight(0xffefd6, 4);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x94d9ff, 3);
  rim.position.set(-3, 2, -4);
  scene.add(rim);
  const model = makeBlaster(id);
  scene.add(model);
  const bounds = new THREE.Box3().setFromObject(model),
    center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  model.position.sub(center);
  const distance = Math.max(size.z / 2.75, size.y) * 0.85;
  const camera = new THREE.OrthographicCamera(
    -distance * 1.8,
    distance * 1.8,
    distance,
    -distance,
    0.01,
    20,
  );
  camera.position.set(3.5, 1.55, 1.6);
  camera.lookAt(0, 0, 0);
  const width = 600,
    height = 334,
    target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  renderer.setRenderTarget(previous);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d"),
    data = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++)
    data.data.set(
      pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4),
      y * width * 4,
    );
  ctx.putImageData(data, 0, 0);
  const result = canvas.toDataURL("image/png");
  target.dispose();
  disposeBlaster(model);
  return result;
}

// Ground pickups do not need moving magazines/bolts. Merge once, reuse one draw call per gun.
const groundModels=new Map(),groundMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.35});
export function makeGroundBlaster(id){
 if(!groundModels.has(id)){
  const model=makeBlaster(id),parts=[];model.updateMatrixWorld(true);
  model.traverse(o=>{if(!o.isMesh||!o.visible||o===model.userData.reloadToken)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.deleteAttribute('uv');const c=o.material.color,colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(g);});
  const g=mergeGeometries(parts);g.userData.shared=true;g.computeBoundingSphere();parts.forEach(p=>p.dispose());disposeBlaster(model);groundModels.set(id,g);
 }
 return new THREE.Mesh(groundModels.get(id),groundMaterial);
}
