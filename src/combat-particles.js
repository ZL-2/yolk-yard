import * as T from 'three';

// Persistent batches replace a new mesh/material for every spark and mark.
// These are cosmetic only: overload replaces the oldest decoration, never a hit.
class ParticleBatch {
 constructor(parent,geometry,capacity,mark=false,burst=false){
  this.mark=mark;this.burst=burst;this.capacity=capacity;this.count=0;this.cursor=0;
  const Material=burst?T.MeshLambertMaterial:T.MeshBasicMaterial;
  const material=new Material({transparent:true,depthWrite:false,side:mark?T.DoubleSide:T.FrontSide,toneMapped:mark||burst});
  material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float particleAlpha; varying float vParticleAlpha;').replace('#include <begin_vertex>','#include <begin_vertex>\nvParticleAlpha=particleAlpha;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vParticleAlpha;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vParticleAlpha;');
  };
  material.customProgramCacheKey=()=> 'combat-particles-204';
  this.alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1);this.alpha.setUsage(T.DynamicDrawUsage);geometry.setAttribute('particleAlpha',this.alpha);
  this.mesh=new T.InstancedMesh(geometry,material,capacity);this.mesh.name=burst?'Explosion debris':mark?'Impact marks':'Impact sparks';this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.count=0;this.mesh.frustumCulled=false;parent.add(this.mesh);
  this.slots=Array.from({length:capacity},()=>({q:new T.Quaternion(),color:new T.Color()}));this.position=new T.Vector3();this.scale=new T.Vector3();this.matrix=new T.Matrix4();
 }
 add(e,n,color,size,life){
  const i=this.count<this.capacity?this.count++:this.cursor++%this.capacity,p=this.slots[i];
  p.x=e.x+n.x*(this.mark?.012:.025);p.y=e.y+n.y*(this.mark?.012:.025);p.z=e.z+n.z*(this.mark?.012:.025);
  p.vx=n.x*1.4+(Math.random()-.5)*2;p.vy=n.y*1.4+Math.random()*1.7;p.vz=n.z*1.4+(Math.random()-.5)*2;
  p.size=size;p.life=p.max=life;p.fresh=true;p.color.setHex(color);p.q.identity();if(this.mark)p.q.setFromUnitVectors(ParticleBatch.front,n);return p;
 }
 update(dt){
  for(let i=0;i<this.count;i++){
   const p=this.slots[i];if(p.fresh)p.fresh=false;else p.life-=dt;
   if(p.life<=0){const last=--this.count;this.slots[i]=this.slots[last];this.slots[last]=p;i--;continue;}
   if(!this.mark){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=(this.burst?12:5)*dt;}
   if(this.burst){p.size*=Math.pow(.98,dt*60);p.q.setFromAxisAngle(ParticleBatch.right,(p.max-p.life)*3);}
   this.position.set(p.x,p.y,p.z);this.scale.setScalar(p.size);this.matrix.compose(this.position,p.q,this.scale);this.mesh.setMatrixAt(i,this.matrix);this.mesh.setColorAt(i,p.color);this.alpha.setX(i,p.life/p.max*(this.mark?.6:1));
  }
  this.mesh.count=this.count;this.mesh.visible=this.count>0;
  if(this.count){this.mesh.instanceMatrix.needsUpdate=true;this.mesh.instanceColor.needsUpdate=true;this.alpha.needsUpdate=true;}
 }
 clear(){this.count=this.cursor=0;this.mesh.count=0;this.mesh.visible=false;}
}
ParticleBatch.front=new T.Vector3(0,0,1);
ParticleBatch.right=new T.Vector3(1,0,0);
export class CombatParticles {
 constructor(parent){this.sparks=new ParticleBatch(parent,new T.SphereGeometry(1,6,4),384);this.marks=new ParticleBatch(parent,new T.CircleGeometry(1,10),256,true);this.bursts=new ParticleBatch(parent,new T.BoxGeometry(1,1,1),384,false,true);this.normal=new T.Vector3();this.accepted=0;this.culled=0;}
 impact(e,eye,radius=160){
  if(!Number.isFinite(e.x+e.y+e.z))return;
  if(eye&&(e.x-eye.x)**2+(e.y-eye.y)**2+(e.z-eye.z)**2>radius**2){this.culled++;return;}
  this.accepted++;const n=this.normal.set(e.normal?.x||0,e.normal?.y||0,e.normal?.z||0);if(n.lengthSq()<.01)n.set(0,1,0);else n.normalize();
  for(let i=0;i<(e.tag?4:6);i++)this.sparks.add(e,n,e.tag?0xb9b7ad:e.surface==='metal'?(i%2?0xf5d59c:0x9ea7aa):e.surface==='wood'?0xa58b67:0xb2ada1,(e.surface==='metal'?.009:.017)+Math.random()*.017,.22);
  if(!e.tag)this.marks.add(e,n,0x445258,.027,2.4);
 }
 burst(e,eye,radius=180){
  if(!Number.isFinite(e.x+e.y+e.z)||eye&&(e.x-eye.x)**2+(e.y-eye.y)**2+(e.z-eye.z)**2>radius**2)return;
  const elimination=e.type==='elimination',colors=elimination?[0xfff3c9,0xffc843,0x5dc7d5]:[0xffc642,0xf5ede0,0xfb9564],n=this.normal.set(0,0,0);
  for(let i=0;i<(elimination?18:26);i++){const p=this.bursts.add(e,n,colors[i%3],.08+Math.random()*.14,.8);p.y+=.6;p.vx=(Math.random()-.5)*8;p.vy=Math.random()*6;p.vz=(Math.random()-.5)*8;}
 }
 update(dt){this.sparks.update(dt);this.marks.update(dt);this.bursts.update(dt);}
 clear(){this.sparks.clear();this.marks.clear();this.bursts.clear();}
 diagnostics(){return {sparks:this.sparks.count,marks:this.marks.count,bursts:this.bursts.count,draws:Number(!!this.sparks.count)+Number(!!this.marks.count)+Number(!!this.bursts.count),accepted:this.accepted,culled:this.culled};}
}

export function visibleShot(event,eye,radius=160){
 const a=event.origin;if(!a||!eye)return true;
 if((a.x-eye.x)**2+(a.y-eye.y)**2+(a.z-eye.z)**2<=radius**2)return true;
 for(const shot of event.shots||[]){const b=shot.end;if(!b)continue;const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,length=x*x+y*y+z*z,t=Math.max(0,Math.min(1,((eye.x-a.x)*x+(eye.y-a.y)*y+(eye.z-a.z)*z)/(length||1)));
  if((a.x+x*t-eye.x)**2+(a.y+y*t-eye.y)**2+(a.z+z*t-eye.z)**2<=radius**2)return true;
 }
 return false;
}
