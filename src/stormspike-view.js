import * as T from 'three';
export function updateStormspikeView(rv,state){
 rv.spikeMeshes??=new Map();const active=new Set();
 for(const s of state.royale.stormSpikes||[]){active.add(s.id);let m=rv.spikeMeshes.get(s.id);
  if(!m){m=new T.Group();const core=new T.Mesh(new T.CylinderGeometry(.026,.055,.48,6),new T.MeshBasicMaterial({color:0xb9faff}));m.add(core);const ring=new T.Mesh(new T.TorusGeometry(.18,.014,4,16),new T.MeshBasicMaterial({color:0x54d7ff,transparent:true,opacity:.75}));ring.rotation.x=Math.PI/2;m.add(ring);rv.root.add(m);rv.spikeMeshes.set(s.id,m);}
  m.position.set(s.x+s.nx*.18,s.y+s.ny*.18,s.z+s.nz*.18);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(s.nx,s.ny,s.nz).normalize());const pulse=1+Math.sin(state.time*32)*.25;m.children[1].scale.setScalar(pulse*(1+(state.time-s.born)*.6));
 }
 for(const [id,m]of rv.spikeMeshes)if(!active.has(id)){m.removeFromParent();rv.view.disposeGroup(m);rv.spikeMeshes.delete(id);}
}
