// Bounded render-only reuse. Never owns simulation projectiles or collision.
export class RenderPool {
 constructor(limit=16){this.limit=limit;this.free=new Map();this.created=0;this.reused=0;}
 acquire(key,create){let mesh=this.free.get(key)?.pop();if(mesh)this.reused++;else{mesh=create();this.created++;}mesh.userData.poolKey=key;mesh.visible=true;mesh.scale.set(1,1,1);mesh.rotation.set(0,0,0);return mesh;}
 release(mesh){mesh.removeFromParent();const key=mesh.userData.poolKey;if(!key)return false;let list=this.free.get(key);if(!list){list=[];this.free.set(key,list);}if(list.length<this.limit){mesh.visible=false;list.push(mesh);}else this.dispose(mesh);return true;}
 dispose(mesh){mesh.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.material&& !Array.isArray(o.material))o.material.dispose();});}
 diagnostics(){return {created:this.created,reused:this.reused,free:[...this.free.values()].reduce((n,a)=>n+a.length,0)};}
}
