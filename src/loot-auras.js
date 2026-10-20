import * as THREE from 'three';
import {ITEMS,RARITIES} from './royale-data.js';

const colors=RARITIES.map(r=>new THREE.Color(r.color));
export function lootAuraTier(item){
 if(!item||item.ammoType||item.resource||item.pickaxe)return -1;
 return Math.max(0,Math.min(RARITIES.length-1,Math.floor(item.rarity??ITEMS[item.id]?.rarity??0)));
}
// Every visible pickup shares one instanced draw: a soft floor ring and a
// camera-facing colored haze. No per-item lights, textures or scene nodes.
export class LootAuras {
 constructor(parent,capacity=128){
  this.geometry=new THREE.InstancedBufferGeometry();
  this.geometry.setAttribute('position',new THREE.Float32BufferAttribute([
   -1,-1,0, 1,-1,0, 1,1,0, -1,1,0,
   -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,
  ],3));
  this.geometry.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);
  this.material=new THREE.ShaderMaterial({
   transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false,
   uniforms:{time:{value:0}},
   vertexShader:`attribute vec4 auraOffset;attribute vec3 auraColor;varying vec2 point;varying vec3 tint;varying float upright;
    void main(){point=position.xy;tint=auraColor;upright=position.z;
     vec4 center=modelViewMatrix*vec4(auraOffset.xyz,1.0);
     if(position.z>0.5){center.xy+=vec2(position.x*.82,position.y*.64+.2)*auraOffset.w;}
     else{center=modelViewMatrix*vec4(auraOffset.xyz+vec3(position.x*.88,-.04,position.y*.88)*auraOffset.w,1.0);}
     gl_Position=projectionMatrix*center;}`,
   fragmentShader:`uniform float time;varying vec2 point;varying vec3 tint;varying float upright;
    void main(){float r=length(point);if(r>1.0)discard;
     float soft=pow(max(0.0,1.0-r),2.0);
     float ring=exp(-pow((r-.64)*14.0,2.0))*.16;
     float pulse=.94+.06*sin(time*1.7);
     float alpha=(upright>.5?soft*.34:(soft*.68+ring))*pulse;
     gl_FragColor=vec4(tint,alpha);
     #include <colorspace_fragment>
    }`,
  });
  this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.name='loot-rarity-auras';this.mesh.frustumCulled=false;this.mesh.renderOrder=2;parent.add(this.mesh);
  this.resize(capacity);this.begin(0);this.end();
 }
 resize(capacity){
  const offsets=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage),tints=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
  if(this.offsets){offsets.array.set(this.offsets.array);tints.array.set(this.tints.array);this.geometry.dispose();}
  this.capacity=capacity;this.offsets=offsets;this.tints=tints;this.geometry.setAttribute('auraOffset',offsets);this.geometry.setAttribute('auraColor',tints);
 }
 begin(time){this.count=0;this.material.uniforms.time.value=time;}
 add(item,position){
  const tier=lootAuraTier(item);if(tier<0)return;
  if(this.count===this.capacity)this.resize(this.capacity*2);
  const i=this.count++,color=colors[tier];this.offsets.setXYZW(i,position.x,position.y,position.z,item.zoneSlot?.7:1);this.tints.setXYZ(i,color.r,color.g,color.b);
 }
 end(){
  this.geometry.instanceCount=this.count;this.mesh.visible=this.count>0;
  if(!this.count)return;
  for(const [attr,size]of [[this.offsets,4],[this.tints,3]]){attr.clearUpdateRanges();attr.addUpdateRange(0,this.count*size);attr.needsUpdate=true;}
 }
 dispose(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
