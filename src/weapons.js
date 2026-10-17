import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { weapon } from "./data.js";
import {OPTICS} from './weapon-presentation.js';
import {applyWrap} from './shop-models.js';
import {modelMaterial,surfaceUV,surfaceAtlasMaterial} from './model-surfaces.js';

// The same authored model is used in the player's hands, on other operators, and in previews.
const geometries = new Map();
const ART_REVISION=155;
const finishKind=(hex,metal=false)=>metal?'metal':hex===0x896044||hex===0x67442f?'wood':hex===0x151c20||hex===0x30383c?'polymer':hex===0x748087?'metal':'paint';
const color=(hex,metal=false,kind=finishKind(hex,metal))=>modelMaterial(hex,kind);
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
function box(g, x, y, z, w, h, d, c, bevel = 0.025, metal = false, kind=finishKind(c,metal)) {
  // Bevel small hardware once rather than spending 300 triangles on every rail tooth.
  const segments=Math.max(w,h,d)>.3&&Math.min(w,h,d)>.07?2:1;
  const key = `box155:${w}:${h}:${d}:${bevel}:${segments}:${kind}`;
  return part(
    g,
    cached(
      key,
      () =>
        new RoundedBoxGeometry(
          w,
          h,
          d,
          segments,
          Math.min(bevel, w / 3, h / 3, d / 3),
        ),
    ),
    color(c, metal,kind),
    [x, y, z],
  );
}
function tube(g, x, y, z, r, length, c, open = false,kind='metal') {
  const m = part(
    g,
    cached(
      `tube155:${r}:${length}:${open}:${kind}`,
      () => new THREE.CylinderGeometry(r, r, length, 16, 1, open),
    ),
    color(c,true,kind),
    [x, y, z],
  );
  m.rotation.x = Math.PI / 2;
  return m;
}
function taper(g,x,y,z,back,front,length,c,open=false,kind='metal'){
 const m=part(g,cached(`taper155:${back}:${front}:${length}:${open}:${kind}`,()=>new THREE.CylinderGeometry(back,front,length,16,1,open)),color(c,true,kind),[x,y,z]);m.rotation.x=Math.PI/2;return m;
}
function ring(g, x, y, z, r, t, c) {
  return part(
    g,
    cached(`ring155:${r}:${t}`, () => new THREE.TorusGeometry(r, t, 5, 20)),
    color(c, true),
    [x, y, z],
  );
}
function plate(g, points, thickness, c, x = 0,kind=finishKind(c)) {
  const key = `plate155:${JSON.stringify(points)}:${thickness}:${kind}`;
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
  return part(g, geo, color(c,false,kind), [x, 0, 0]);
}
const dark = 0x30383c,
  black = 0x151c20,
  steel = 0x748087,
  cream = 0xb4b6aa;
const finishes={sprinter:0x4a5558,scatter:0x555a5a,needle:0x586762,zipper:0x444d50,thumper:0x66705c,anchor:0x556064,duet:0x6b695b,pip:0x626d73,peeper:0x647168,doubleyolk:0x495459,comet:0x455b65};
function screw(g,x,y,z,r=.012){
 const head=part(g,cached(`fastener155:${r}`,()=>new THREE.CylinderGeometry(r,r,.009,6)),color(steel,true),[x,y,z]);head.rotation.z=Math.PI/2;
 box(g,x+Math.sign(x||1)*.005,y,z,.002,r*.23,r*1.2,black,.001,false,'metal');
}
function bore(g,x,y,z,r,length=.09){
 // An actual annular muzzle with an inward-facing bore, not a black disk on a capped barrel.
 const inner=r*.67,profile=[new THREE.Vector2(inner,-length/2),new THREE.Vector2(r,-length/2),new THREE.Vector2(r,length/2),new THREE.Vector2(inner,length/2),new THREE.Vector2(inner,-length/2)];
 const m=part(g,cached(`bore155:${r}:${length}`,()=>new THREE.LatheGeometry(profile,24)),color(dark,true),[x,y,z+length/2]);m.rotation.x=Math.PI/2;
 ring(g,x,y,z+.001,r-.006,.008,steel);
 const recess=part(g,cached(`bore-end155:${r}`,()=>new THREE.CircleGeometry(inner,24)),color(0x050709,false,'rubber'),[x,y,z+length-.005]);recess.rotation.y=Math.PI;
 return m;
}
function bakeAssembly(parent,key){
 parent.updateMatrix();const groups=new Map();
 for(const mesh of [...parent.children])if(mesh.isMesh&&!mesh.userData.ownedMaterial){
  const material=mesh.material,k=material.uuid;if(!groups.has(k))groups.set(k,{material,parts:[]});
  if(!geometries.has(`assembly155:${key}:${k}`)){const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();mesh.updateMatrix();geo.applyMatrix4(mesh.matrix);groups.get(k).parts.push(geo);}parent.remove(mesh);
 }
 for(const [k,b] of groups){const geo=cached(`assembly155:${key}:${k}`,()=>mergeGeometries(b.parts));b.parts.forEach(p=>p.dispose());part(parent,geo,b.material,[0,0,0]);}
}
function grip(g, z = 0.12) {
  plate(g,[[z-.08,-.07],[z+.065,-.08],[z+.115,-.18],[z+.135,-.35],[z+.08,-.405],[z-.06,-.39],[z-.09,-.33],[z-.065,-.23],[z-.10,-.15]],.135,dark);
  // Radiused backstrap and inset textured palm panels, not a rectangular handle.
  for(const side of [-1,1])plate(g,[[z-.048,-.17],[z+.065,-.17],[z+.102,-.34],[z+.06,-.369],[z-.05,-.35]],.009,black,side*.075,'rubber');
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
  box(g, 0, -0.04, z + 0.43, 0.19, 0.27, 0.07, black,.015,false,'rubber');
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
    taper(g,0,sightY,-length/2, radius,objective,.14,dark,true);
    ring(g,0,sightY,-length/2-.075,objective,.018,steel);
    tube(g,0,sightY,-length/2-.072,objective-.016,.006,0x3d8997,false,'glass');
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
    for(const z of [-.10,.15])for(const x of [-1,1])screw(g,x*(radius+.022),sightY,z,.009);
    // A rubber focus sleeve and a second elevation turret read as working optics.
    ring(g,0,sightY,.225,radius+.009,.013,black);
    const windage=part(g,cached('windage155',()=>new THREE.CylinderGeometry(.035,.035,.058,12)),color(dark,true),[-radius-.022,sightY,.03]);windage.rotation.z=Math.PI/2;
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
    if(weapon(g.userData.weaponId).reticle==='ring'){
      const reticle=part(g,cached('launcher-reticle',()=>new THREE.RingGeometry(.021,.024,20)),new THREE.MeshBasicMaterial({color:0xd8e9d4,side:THREE.DoubleSide,toneMapped:false}),[0,.285,.071]);reticle.userData.ownedMaterial=true;g.userData.reticle=reticle;
    }else if(weapon(g.userData.weaponId).reticle==='reflex-dot'){
    const dot = part(
      g,
      cached("dot", () => new THREE.CircleGeometry(0.006, 16)),
      new THREE.MeshBasicMaterial({ color: 0xff593c, toneMapped: false }),
      [0, 0.285, 0.071],
    );
    dot.userData.ownedMaterial = true;g.userData.reticle=dot;
    }
    g.userData.sightY = sightY;
    g.userData.optic = "reflex";
  }
}
export function makeBlaster(id,wrap='') {
  const w = weapon(id),
    g = new THREE.Group(),
    c = finishes[id]||finishes.sprinter;
  g.name = w.name;
  g.userData.weaponId=id;g.userData.artRevision=ART_REVISION;
  const wood=0x896044;
  const receiver=(length=.58,width=.25)=>{plate(g,[[.31,-.11],[-length+.31,-.11],[-length+.24,.03],[-length+.35,.145],[.25,.145],[.34,.06]],width,c);tube(g,0,.075,.03,.072,.4,dark);};
  const magazine=(z,h=.3,curved=false)=>{
    const m=curved?plate(g,[[z+.09,-.1],[z-.09,-.1],[z-.12,-.26],[z-.19,-.42],[z-.025,-.46],[z+.07,-.27]],.145,dark):box(g,0,-.13-h/2,z,.16,h,.19,dark,.025);
    const details=new THREE.Group();m.add(details);
    for(const side of [-1,1])for(const dz of [-.05,.035]){
      const rib=box(details,side*.079,curved?-.285:0,curved?z+dz-.035:dz,.014,curved?.25:h*.79,.015,c,.003,false,'metal');if(curved)rib.rotation.x=-.17;
    }
    box(details,0,curved?-.44:-h/2,curved?z-.08:0,.174,.027,.215,black,.008,false,'rubber');
    const top=curved?-.1:h/2,front=curved?z:0;
    for(const side of [-1,1])box(details,side*.06,top+.008,front,.022,.035,.16,steel,.004,false,'metal');
    tube(details,0,top+.012,front,.021,.13,0xb59a59);
    bakeAssembly(details,`${id}-magazine`);m.geometry.computeBoundingBox();const pivot=new THREE.Group(),center=m.geometry.boundingBox.getCenter(new THREE.Vector3()).multiply(m.scale).add(m.position);pivot.position.copy(center);m.position.sub(center);g.add(pivot);pivot.add(m);g.userData.reloadPart=pivot;return pivot;
  };
  const rail=(z,length)=>{box(g,0,.164,z,.135,.035,length,dark,.008);for(let i=0;i<Math.floor(length/.055);i++)box(g,0,.19,z-length/2+i*.055,.16,.025,.024,steel,.004);};
  const muzzleModel=(z,r=.06)=>{bore(g,0,0,z,r);for(const side of [-1,1])box(g,side*(r-.001),0,z+.047,.004,r*.30,.028,black,.002,false,'metal');};
  const bolt=(x=.17,z=.14)=>{const b=new THREE.Group();b.position.set(x,.045,z);const handle=tube(b,.03,0,0,.022,.13,steel);handle.rotation.set(0,0,Math.PI/2);box(b,.08,-.025,0,.07,.08,.065,black,.027);g.add(b);g.userData.bolt=b;};
  if(id==='pip'){
    // Tapered pistol slide, separate frame, recessed ejection port and serrations.
    plate(g,[[.23,-.03],[-.33,-.03],[-.34,.065],[-.28,.13],[.19,.13],[.25,.07]],.2,c);
    plate(g,[[.22,-.08],[-.26,-.08],[-.29,-.04],[.16,.02],[.24,-.03]],.17,dark);grip(g,.12);
    box(g,.103,.07,-.08,.012,.047,.1,black,.008);
    for(const side of [-1,1])for(let i=0;i<6;i++)box(g,side*.107,.042,.065+i*.024,.008,.092,.01,steel,.003);
    tube(g,0,.015,-.345,.043,.2,steel,true);muzzleModel(-.445,.052);
    g.userData.reloadPart=box(g,0,-.4,.12,.13,.15,.14,dark,.018,false,'metal');optic(g,'iron',-.255);
    // Distinct steel slide/frame seam, recoil-spring plug and under-barrel rail.
    for(const side of [-1,1]){box(g,side*.101,-.022,-.018,.004,.012,.47,steel,.002,true);screw(g,side*.088,-.23,.11);}
    tube(g,0,-.035,-.34,.023,.047,dark);box(g,0,-.09,-.15,.16,.027,.18,dark,.006);
    for(const z of [-.21,-.16,-.11])box(g,0,-.111,z,.17,.009,.017,steel,.002,true);
    const latch=box(g,-.112,-.065,.14,.012,.021,.06,steel,.004,true);latch.rotation.x=.16;
  }else if(id==='scatter'){
    // A classic side-by-side break-action silhouette with walnut fore-end.
    plate(g,[[.32,-.1],[-.24,-.12],[-.29,.05],[-.17,.135],[.26,.14]],.31,c);grip(g,.17);stock(g,wood,.31);
    const frontStart=g.children.length;
    for(const x of [-.085,.085]){tube(g,x,.015,-.47,.075,.84,steel,true);bore(g,x,.015,-.9,.077,.08);}
    plate(g,[[-.22,-.05],[-.68,-.06],[-.7,-.13],[-.57,-.2],[-.3,-.21]],.255,wood);
    for(let j=0;j<7;j++)box(g,0,-.185,-.28-j*.047,.255,.024,.021,0x67442f,.006);
    const front=g.children.slice(frontStart),hinge=new THREE.Group();hinge.position.set(0,-.1,-.19);g.add(hinge);for(const part of front){part.position.sub(hinge.position);hinge.add(part);}g.userData.breakAction=hinge;
    const sightStart=g.children.length;
    box(g,0,.14,.16,.035,.035,.17,steel,.012);optic(g,'iron',-.78);
    box(g,0,.091,-.53,.052,.012,.58,steel,.003,true);
    for(const part of g.children.slice(sightStart))if(part.position.z<-.2){part.position.sub(hinge.position);hinge.add(part);}
    for(const side of [-1,1]){screw(g,side*.163,-.012,-.18,.021);plate(g,[[.2,-.045],[-.17,-.04],[-.18,.06],[.22,.065]],.005,steel,side*.165,'metal');}
    const lock=box(g,.035,.163,.16,.038,.025,.11,dark,.009,true);lock.rotation.y=-.2;
    ring(g,0,.016,-.22,.045,.009,steel);
  }else if(id==='doubleyolk'){
    // Tubular magazine below the barrel, ribbed pump and ventilated heat shield.
    receiver(.6,.28);grip(g,.17);stock(g,dark,.31);
    tube(g,0,.018,-.48,.078,.83,steel,true);tube(g,0,-.105,-.46,.058,.66,dark);muzzleModel(-.9,.08);
    const pump=new THREE.Group();pump.position.set(0,-.115,-.46);box(pump,0,0,0,.255,.19,.32,c,.06);
    for(let i=0;i<7;i++)box(pump,0,0,-.14+i*.047,.268,.195,.019,black,.006);g.add(pump);g.userData.pump=pump;
    for(const side of [-1,1])for(let i=0;i<4;i++)box(g,side*.084,.062,-.23-i*.085,.02,.065,.04,black,.008);
    for(const side of [-1,1]){box(g,side*.061,-.118,-.355,.022,.035,.58,steel,.005,true);screw(g,side*.148,.04,.20);}
    box(g,0,-.036,-.71,.19,.15,.056,dark,.013,true);screw(g,.102,-.041,-.71,.016);
    tube(g,0,-.105,-.805,.041,.038,steel);ring(g,0,-.105,-.823,.043,.008,black);
    optic(g,'iron',-.78);
  }else if(id==='needle'||id==='peeper'||id==='anchor'){
    receiver(id==='anchor'?.65:.6,id==='anchor'?.28:.235);grip(g,id==='anchor'?.2:.13);
    if(id==='peeper'){for(const x of [-.065,.065])box(g,x,.015,.48,.04,.075,.39,steel,.009);box(g,0,-.06,.67,.21,.31,.07,c,.028);box(g,0,.15,.44,.16,.07,.26,dark);}
    else {stock(g,id==='needle'?0x55717a:c,.36);box(g,0,.18,.58,.19,.11,.25,dark,.035);}
    const end=id==='anchor'?-.94:-1.1;
    plate(g,[[-.16,-.07],[-.61,-.05],[-.66,-.14],[-.22,-.17]],.22,id==='peeper'?wood:dark);
    taper(g,0,0,(end-.29)/2,.07,.037,-end-.29,steel,true);muzzleModel(end,id==='needle'?.07:.065);
    if(id==='needle'){
      for(const x of [-.095,.095]){const leg=box(g,x,-.21,-.6,.03,.29,.04,steel,.01);leg.rotation.z=x>0?-.45:.45;box(g,x*1.65,-.337,-.6,.08,.025,.095,black,.008,false,'rubber');screw(g,x*1.08,-.088,-.6,.021);}
      for(let i=0;i<4;i++)box(g,0,.018,-.92+i*.045,.09,.035,.019,black,.004);
      // Fluted precision barrel, adjustment comb and bedding bolts.
      for(const side of [-1,1]){box(g,side*.032,.018,-.88,.007,.022,.29,dark,.002,true);screw(g,side*.094,.004,.43);screw(g,side*.093,.036,.65);}
      for(const z of [.46,.65])box(g,0,.11,z,.028,.12,.018,steel,.004,true);
      box(g,0,.21,.56,.205,.027,.23,black,.012,false,'rubber');
    }
    if(id==='anchor'){
      tube(g,0,.067,-.54,.021,.39,dark);vents(g,-.29,5,.235,.056);rail(-.02,.49);
      for(const side of [-1,1]){box(g,side*.12,-.118,-.38,.018,.024,.38,steel,.006,true);screw(g,side*.139,.004,-.18);screw(g,side*.139,.003,-.45);}
      box(g,0,-.19,-.51,.12,.1,.10,black,.018,false,'rubber');
      ring(g,0,0,-.78,.047,.011,dark);
    }
    if(id==='peeper'){
      for(const side of [-1,1]){screw(g,side*.122,-.064,-.25,.017);screw(g,side*.12,-.064,.21,.017);}
      box(g,0,.115,.42,.19,.08,.28,0x896044,.025,false,'wood');
      for(const z of [.32,.46,.6])box(g,0,-.06,z,.15,.011,.035,dark,.003);
      ring(g,0,0,-.43,.063,.011,steel);
    }
    magazine(-.15,id==='anchor'?.29:.23);bolt();optic(g,'scope');
  }else if(id==='zipper'){
    // Compact roller-style rounded receiver, telescoping stock and curved stick magazine.
    tube(g,0,.055,-.07,.115,.5,c);box(g,0,-.05,.04,.23,.1,.4,dark,.03);grip(g,.13);
    for(const x of [-.1,.1])box(g,x,.045,.45,.027,.045,.44,steel,.01);box(g,0,-.055,.66,.2,.25,.055,dark,.018);
    taper(g,0,.01,-.365,.12,.075,.21,dark);tube(g,0,0,-.55,.049,.24,steel,true);muzzleModel(-.68,.065);
    magazine(-.14,.32,true);vents(g,-.29,4,.2,.04);rail(.025,.25);optic(g,'reflex');bolt(.14,-.19);
    for(const side of [-1,1]){screw(g,side*.117,.047,.065,.017);screw(g,side*.105,.023,-.27,.012);box(g,side*.103,.083,-.074,.006,.021,.34,steel,.003,true);}
    const release=box(g,-.14,-.103,-.09,.018,.035,.07,steel,.006,true);release.rotation.x=.18;
    ring(g,0,.01,-.405,.082,.012,dark);
  }else if(id==='thumper'){
    // Shoulder-fired capsule launcher: bulbous chamber, reinforced breech and muzzle flare.
    grip(g,.17);stock(g,dark,.3);taper(g,0,0,-.23,.17,.135,.67,c);
    taper(g,0,0,-.64,.14,.21,.17,steel,true);bore(g,0,0,-.735,.205,.085);
    for(const z of [-.05,-.36,-.54])ring(g,0,0,z,.168,.026,black);
    box(g,0,-.2,-.3,.19,.14,.33,dark,.045);box(g,.18,.02,-.11,.06,.14,.17,steel,.026);
    for(const x of [-.175,.175])box(g,x,.025,-.33,.015,.035,.32,0xabc8ba,.01);rail(.02,.24);optic(g,'reflex');
    for(const side of [-1,1]){screw(g,side*.174,.017,-.025,.019);screw(g,side*.157,-.095,-.42,.014);}
    const catchLever=box(g,.19,.055,.061,.025,.028,.17,steel,.008,true);catchLever.rotation.x=-.13;
    box(g,0,-.122,-.06,.13,.025,.13,0xdaa754,.007,true);
    for(let i=0;i<4;i++)box(g,-.182,-.018,-.2-i*.04,.003,.012,.022,steel,.001,true);
  }else if(id==='duet'){
    // Bullpup: rear magazine and carry rail distinguish it from the assault carbine.
    plate(g,[[.61,-.12],[-.35,-.13],[-.48,.025],[-.32,.14],[.55,.15],[.65,.05]],.265,c);grip(g,-.03);magazine(.35,.27);
    box(g,0,-.005,.66,.29,.29,.06,dark,.026);box(g,0,-.08,-.42,.235,.16,.27,dark,.04);
    tube(g,0,0,-.69,.05,.43,steel,true);muzzleModel(-.92,.065);vents(g,-.15,5,.278,.052);rail(.05,.49);optic(g,'prism');
    box(g,.142,.025,.34,.014,.062,.15,black,.006);bolt(.155,-.12);
    // Rear action cover, molded cheek-pad seam and replaceable handguard panels.
    for(const side of [-1,1]){
      plate(g,[[.58,.112],[.19,.112],[.13,.058],[.14,-.045],[.59,-.045]],.006,dark,side*.139,'polymer');
      for(const z of [.22,.52,-.29])screw(g,side*.149,.014,z,.014);
      box(g,side*.138,-.095,-.27,.006,.046,.23,black,.007,false,'rubber');
    }
    box(g,0,.157,.4,.20,.027,.27,black,.013,false,'rubber');
  }else if(id==='comet'){
    // Original induction projector, curved coil housing and visible ceramic emitter.
    plate(g,[[.28,-.12],[-.29,-.13],[-.39,0],[-.27,.16],[.24,.18],[.36,.06]],.29,c);grip(g,.13);stock(g,0x55688e,.34);
    taper(g,0,0,-.48,.15,.1,.43,steel);tube(g,0,0,-.74,.085,.3,0xb5eee7,true,'paint');muzzleModel(-.9,.103);
    for(const z of [-.32,-.43,-.54,-.65])ring(g,0,0,z,.158,.023,0x79d8d6);
    for(const x of [-.175,.175]){plate(g,[[-.24,-.06],[-.72,-.09],[-.82,.015],[-.63,.08],[-.26,.12]],.048,c,x);}
    g.userData.reloadPart=box(g,0,-.24,-.1,.19,.27,.22,0x91d2e1,.055);rail(.055,.28);optic(g,'reflex');
    // Ceramic isolation rings, copper bus bars and coolant fins give the exotic a
    // coherent manufactured construction instead of an unbroken cyan tube.
    for(const z of [-.38,-.60])ring(g,0,0,z,.137,.012,cream);
    for(const side of [-1,1]){box(g,side*.128,-.055,-.49,.016,.025,.36,0xac7650,.004,true);for(const z of [-.29,-.66])screw(g,side*.207,.015,z,.014);}
    for(let i=0;i<5;i++)box(g,0,.118,-.35-i*.061,.20,.016,.022,dark,.003,true);
    box(g,.098,-.18,-.1,.006,.12,.135,black,.008,false,'glass');
    for(const y of [-.13,-.19,-.25])box(g,.103,y,-.1,.004,.014,.056,0xb9ebe4,.003,false,'paint');
  }else{
    // Stamped assault receiver, sloped gas block and curved magazine.
    receiver(.63,.255);grip(g,.13);stock(g,wood,.35);magazine(-.1,.32,true);
    plate(g,[[-.29,-.08],[-.62,-.08],[-.65,.065],[-.31,.09]],.235,wood);
    for(const side of [-1,1])for(let i=0;i<4;i++)box(g,side*.124,-.01,-.35-i*.06,.01,.055,.034,dark,.009);
    tube(g,0,0,-.74,.044,.3,steel,true);tube(g,0,.078,-.55,.023,.29,dark);muzzleModel(-.9,.063);
    rail(.04,.4);bolt(.15,.12);optic(g,'reflex');
    // Stamped receiver cover with gas-tube fittings, walnut inserts and sling hardware.
    for(const side of [-1,1]){box(g,side*.129,.108,.006,.006,.016,.48,steel,.002,true);screw(g,side*.129,-.025,-.28,.016);screw(g,side*.126,-.017,.245,.016);}
    ring(g,0,.078,-.62,.029,.006,steel);box(g,0,.07,-.70,.071,.08,.05,dark,.013,true);
    for(const z of [-.33,-.53])box(g,0,-.094,z,.246,.026,.028,dark,.008,true);
  }
  // Recessed trigger within an oval guard (visual geometry, no extra interaction).
  const trigger=box(g,0,-.13,id==='duet'?-.14:.018,.022,.1,.024,steel,.008);trigger.rotation.x=-.25;
  const guard=ring(g,0,-.17,id==='duet'?-.16:-.018,.105,.012,dark);guard.rotation.y=Math.PI/2;guard.scale.set(.78,1,1);
  if (id === "scatter" || id === "doubleyolk" || id === "thumper") {
    const token = tube(g, 0, 0, 0, id === "thumper" ? .085 : .05, id === "thumper" ? .28 : .15, c);
    token.visible = false;
    g.userData.reloadToken = token;
  }
  // Machined ejection recess, chamfered bolt face, safety lever and receiver
  // pins use the same sockets on every representation. No texture-only artwork.
  if(!['thumper','comet','scatter'].includes(id)){
    const width=id==='pip'?.108:id==='duet'?.148:id==='anchor'?.15:.137;
    box(g,width,.053,id==='duet'?.38:-.07,.008,.053,.16,black,.008);
    box(g,width+.006,.041,id==='duet'?.40:-.06,.008,.029,.105,steel,.006,true);
    const selector=box(g,-width-.008,-.044,.17,.017,.025,.065,dark,.01,true);selector.rotation.x=.35;
    for(const z of [.12,.22]){const pin=part(g,cached('receiver-pin',()=>new THREE.CylinderGeometry(.014,.014,.014,8)),color(steel,true),[-width-.005,-.04,z]);pin.rotation.z=Math.PI/2;}
  }
  if(!['pip','thumper','comet','scatter','doubleyolk'].includes(id)){
    const z=id==='duet'?.35:-.14;box(g,0,-.115,z,.207,.066,.236,dark,.024);
  }
  // Subtle finish accents and sling attachment; mass remains dark metal/polymer.
  box(g,-.137,.015,.16,.009,.025,.095,0x8c9188,.004);
  if(id!=='pip'){const sling=ring(g,-.12,-.09,.53,.031,.008,steel);sling.rotation.y=Math.PI/2;}
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
  // Preserve independently moving pump/bolt sockets, but merge their own
  // static components too; realistic hardware is not a draw-call explosion.
  if(g.userData.pump)bakeAssembly(g.userData.pump,`${id}-pump`);
  if(g.userData.bolt)bakeAssembly(g.userData.bolt,`${id}-bolt`);
  // Bake static details by material: detail does not require a draw call per screw.
  g.updateMatrixWorld(true);
  const batches = new Map();
  for (const object of [...g.children])
    if (object.isMesh && !object.userData.ownedMaterial && object !== g.userData.reloadPart && object !== g.userData.reloadToken) {
      const key = object.material.uuid;
      if (!batches.has(key))
        batches.set(key, { material: object.material, parts: [] });
      if(!geometries.has(`model155:${id}:${key}`)){
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      batches.get(key).parts.push(geometry);
      }
      g.remove(object);
    }
  for (const [key, batch] of batches) {
    const geometry = cached(`model155:${id}:${key}`, () =>
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
const groundModels=new Map();
export function makeGroundBlaster(id){
 if(!groundModels.has(id)){
  const model=makeBlaster(id),parts=[];model.updateMatrixWorld(true);
  model.traverse(o=>{if(!o.isMesh||!o.visible||o===model.userData.reloadToken)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);surfaceUV(g,o.material.userData.surfaceKind||(o.material.transparent||o===model.userData.lens?'glass':'paint'));const c=o.material.color,colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(g);});
  const g=mergeGeometries(parts);g.userData.shared=true;g.computeBoundingSphere();parts.forEach(p=>p.dispose());disposeBlaster(model);groundModels.set(id,g);
 }
 const mesh=new THREE.Mesh(groundModels.get(id),surfaceAtlasMaterial());mesh.userData.artRevision=ART_REVISION;mesh.userData.weaponId=id;mesh.name=weapon(id).name;return mesh;
}
