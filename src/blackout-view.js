import * as THREE from 'three';

// Static detail is baked with the island. Only the small indicator lights update.
export function* buildBlackoutDetails(world, map, kit, bakeSteps) {
  const site=map.blackout;
  if(!site)return;
  const details=new THREE.Group();
  details.name='Blackout Wreck details';
  const {block,cylinder}=kit;
  const deck=site.deck;
  for(const c of site.containers){
    for(let z=c.z-c.d/2+.24;z<c.z+c.d/2;z+=.48){
      for(const side of [-1,1])block(details,c.x+side*c.w/2,deck+c.h/2,z,.06,c.h-.14,.09,c.color);
    }
    for(const x of [-1,1])for(const z of [-1,1])block(details,c.x+x*c.w/2,deck+c.h/2,c.z+z*c.d/2,.13,c.h,.13,0x273739);
    const tornRoof=block(details,c.x,deck+c.h+.18,c.z,c.w*.98,.12,c.d*.8,c.color);
    tornRoof.rotation.z=.12;
  }
  // Marine details are baked together into the same local batch as the
  // container corrugation. No additional per-frame meshes for the hull.
  const trim=0xc79b62,steel=0x394951,glass=0x253e4a,oxide=0x824b3a;
  for(let i=0;i<7;i++){
    const x=151.85+i*.98;
    block(details,x,deck+2.52,242.0,.75,.64,.08,glass);
    block(details,x,deck+2.12,241.94,.85,.13,.14,steel);
  }
  for(const x of [150.55,159.05])for(let i=0;i<4;i++){
    const z=243.65+i*1.58;
    block(details,x,deck+2.48,z,.09,.7,1.15,glass);
    block(details,x,deck+2.06,z,.12,.115,1.30,steel);
  }
  for(const x of [152.3,157.6]){
    cylinder(details,x,deck+4.41,249.25,.5,1.28,steel,12);
    cylinder(details,x,deck+5.05,249.25,.58,.17,oxide,12);
    cylinder(details,x,deck+5.18,249.25,.42,.1,0x222a2d,12);
  }
  cylinder(details,155,deck+5.9,246,.11,4.18,steel,10);
  for(const [dy,w,z] of [[5.4,2.62,246],[6.72,3.45,246],[7.65,1.8,246]]){
    block(details,155,deck+dy,z,w,.12,.18,steel);
    for(const side of [-1,1])cylinder(details,155+side*w*.44,deck+dy+.24,z,.032,.52,trim,6);
  }
  for(const [side,x] of [[-1,140.03],[1,162.02]]){
    block(details,x,1.67,231,.07,.4,41.6,oxide);
    for(let i=0;i<11;i++){
      const z=211.8+i*3.72;
      if(side>0&&z>214.5&&z<222)continue;
      block(details,x,4.18,z,.13,3.92,.24,i%3===0?0x5a4440:0x453c3c);
      block(details,x+side*.06,6.22,z+.72,.12,.31,1.12,trim);
    }
  }
  for(const x of [141.62,160.35]){
    for(const z of [209.6,228.2,236.6,250.6]){
      cylinder(details,x,deck+.38,z,.21,.72,steel,10);
      cylinder(details,x,deck+.75,z,.27,.13,trim,10);
    }
    for(let i=0;i<15;i++)block(details,x,deck+.016,210+i*2.82,.095,.03,1.96,0xd0af66);
  }
  // Compact rescue capsules hung below the deck edge, stern winch and cables.
  for(const z of [234.9,240.0]){
    const pod=cylinder(details,139.6,7.55,z,.56,3.25,0xcf7543,12);pod.rotation.x=Math.PI/2;
    for(const dz of [-1.13,1.13]){
      const strap=cylinder(details,139.6,7.55,z+dz,.595,.13,steel,12);strap.rotation.x=Math.PI/2;
      block(details,139.9,8.28,z+dz,1.1,.14,.16,steel);
    }
  }
  for(const z of [213,220,227,234,241])block(details,156,8.23,z,4.4,.07,.12,0x9aab9a);
  for(let i=0;i<8;i++){
    block(details,143.55,deck+.35+i*.343,239.35+i*.66,2.18,.03,.13,i%2?trim:steel);
  }
  for(const side of [-1,1]){
    block(details,146.25+side*.78,deck+4.14,248.2,.14,.17,1.5,oxide);
    const pulley=cylinder(details,146.25+side*.72,deck+4.06,248.2,.30,.13,trim,10);pulley.rotation.z=Math.PI/2;
  }
  for(const p of site.breakers){
    block(details,p.x,p.y+.64,p.z-.34,.74,.72,.08,0xb6975c);
    for(let i=0;i<4;i++)block(details,p.x-.25+i*.16,p.y+.44,p.z-.291,.07,.15,.035,0x273234);
    block(details,p.x,p.y+.88,p.z-.28,.11,.24,.14,0x242c29);
  }
  for(const p of site.radios){
    block(details,p.x,p.y+.24,p.z-.36,.72,.42,.38,0x3c4b3e);
    block(details,p.x,p.y+.30,p.z-.155,.42,.14,.025,0xacc690);
    cylinder(details,p.x+.27,p.y+.68,p.z-.44,.017,.51,0x333f42,6);
  }
  yield* bakeSteps(details,false,true);
  world.add(details);
  const geometry=new THREE.BoxGeometry(.36,.15,.13);
  const indicators=new THREE.Group();
  indicators.name='Blackout power indicators';
  world.add(indicators);
  world.userData.blackoutLights=indicators;
  const lamp=(x,y,z,color)=>{
    const light=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color}));
    light.userData.ownedMaterial=true;
    light.position.set(x,y,z);
    indicators.add(light);
    return light;
  };
  indicators.userData.breakers=site.breakers.map(p=>lamp(p.x,p.y+1.17,p.z-.54,0xf29441));
  indicators.userData.hold=[213,219,225,232,237].map(z=>lamp(156,8.12,z,0x3a3530));
}

export function updateBlackoutLights(world,state) {
  const lights=world?.userData.blackoutLights;
  if(!lights || lights.userData.power===state?.power)return;
  const power=state?.power||0;
  lights.userData.power=power;
  lights.userData.breakers.forEach((light,index)=>light.material.color.setHex(power&(1<<index)?0x76f6a4:0xf29441));
  for(const light of lights.userData.hold)light.material.color.setHex(power===3?0xffd490:0x3a3530);
}
