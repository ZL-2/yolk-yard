import * as T from 'three';
import {ELIMINATION_HOLD} from './match-presentation.js';
export const ELIMINATION_EFFECT_LIMIT=4;

// Reuse each operator's existing merged bind-pose body as a dissolving hologram.
// No mesh copying, skeleton cloning, CPU skinning, or new world queries on death.
export class EliminationEffects{
 constructor(parent){this.parent=parent;this.active=[];this.geometry={ghost:new T.CapsuleGeometry(.29,1.14,3,8).translate(0,.94,0),beam:new T.CylinderGeometry(.13,.75,5.3,10,1,true),ring:new T.RingGeometry(.63,.74,24),drone:new T.BoxGeometry(.52,.16,.40),shards:new T.BufferGeometry()};
  const points=[];for(let i=0;i<30;i++)points.push(Math.sin(i*2.4)*.55,(i%10)*.18,Math.cos(i*2.4)*.4);this.geometry.shards.setAttribute('position',new T.Float32BufferAttribute(points,3));}
 spawn(e,model,listener,reducedMotion=false){
  if(!listener||Math.hypot(e.x-listener.x,e.z-listener.z)>65||this.active.length>=ELIMINATION_EFFECT_LIMIT)return false;
  const group=new T.Group();group.position.set(e.x,e.y,e.z);group.rotation.y=e.yaw??model?.rotation.y??0;
  const material=(opacity)=>new T.MeshBasicMaterial({color:0x8de6ff,transparent:true,opacity,depthWrite:false,side:T.DoubleSide});
  const ghost=new T.Mesh(model?.userData.human?.mesh.geometry||this.geometry.ghost,material(.78));
  const beam=new T.Mesh(this.geometry.beam,material(.16));beam.position.y=2.65;
  const ring=new T.Mesh(this.geometry.ring,material(.65));ring.rotation.x=-Math.PI/2;ring.position.y=.025;
  const drone=new T.Mesh(this.geometry.drone,material(.95));drone.position.y=5.4;
  const points=new T.Points(this.geometry.shards,new T.PointsMaterial({color:0xc8f7ff,size:.055,transparent:true,opacity:.8,depthWrite:false}));
  group.add(ghost,beam,ring,drone,points);this.parent.add(group);
  this.active.push({group,ghost,beam,ring,drone,points,age:0,reducedMotion});return true;
 }
 release(f){f.group.removeFromParent();for(const mesh of f.group.children)mesh.material.dispose();}
 clear(){for(const f of this.active)this.release(f);this.active=[];}
 update(dt){for(let i=this.active.length-1;i>=0;i--){const f=this.active[i];f.age+=dt;const t=f.age/1.75;if(t>=1){this.release(f);this.active.splice(i,1);continue;}
  const dissolve=Math.max(0,(f.age-.16)/(ELIMINATION_HOLD-.16));f.ghost.material.opacity=.78*Math.max(0,1-dissolve);f.ghost.scale.y=Math.max(.01,1-dissolve*.92);f.ghost.position.y=f.reducedMotion?0:dissolve*1.35;
  f.beam.material.opacity=.16*Math.sin(t*Math.PI);f.ring.material.opacity=.65*(1-t);f.drone.position.y=5.4+(f.reducedMotion?0:t*t*2);f.drone.material.opacity=1-t;
  f.points.position.y=f.reducedMotion?0:t*3.4;f.points.material.opacity=.8*Math.sin(t*Math.PI);f.points.rotation.y=f.reducedMotion?0:t*1.2;
 }}
 diagnostics(){return {active:this.active.length,limit:ELIMINATION_EFFECT_LIMIT};}
}
