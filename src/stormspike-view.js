import * as T from 'three';
import {STORMSPIKE,stormspikePose} from './stormspike.js';
import {supplyTarget} from './supply-drops.js';
const up=new T.Vector3(0,1,0),normal=new T.Vector3();
export function updateStormspikeView(rv,state){
 rv.spikeMeshes??=new Map();const active=new Set();
 for(const s of (state.royale.stormSpikes||[]).slice(-STORMSPIKE.maxVisible)){active.add(s.id);let m=rv.spikeMeshes.get(s.id);
  if(!m){m=new T.Group();const core=new T.Mesh(new T.CylinderGeometry(.026,.055,.48,6),new T.MeshBasicMaterial({color:0xb9faff}));m.add(core);const ring=new T.Mesh(new T.TorusGeometry(.18,.014,4,16),new T.MeshBasicMaterial({color:0x54d7ff,transparent:true,opacity:.75}));ring.rotation.x=Math.PI/2;m.add(ring);rv.root.add(m);rv.spikeMeshes.set(s.id,m);}
  const p=s.playerId&&(rv.view.renderLocalActor?.id===s.playerId?rv.view.renderLocalActor:state.players.find(p=>p.id===s.playerId)),v=s.vehicleId&&(rv.view.predictedVehicle?.id===s.vehicleId?rv.view.predictedVehicle:state.royale.vehicles?.find(v=>v.id===s.vehicleId)),c=s.supplyId&&state.royale.chests?.find(c=>c.id===s.supplyId);
  const pose=stormspikePose(s,p&&p.health>0&&!p.spectating&&(p.deaths||0)===s.playerDeaths?p:v&&!v.wrecked?v:c?supplyTarget(c,state.time):null);
  m.position.set(pose.x+pose.nx*.18,pose.y+pose.ny*.18,pose.z+pose.nz*.18);m.quaternion.setFromUnitVectors(up,normal.set(pose.nx,pose.ny,pose.nz).normalize());const pulse=1+Math.sin(state.time*32)*.25;m.children[1].scale.setScalar(pulse*(1+(state.time-s.born)*.6));
 }
 for(const [id,m]of rv.spikeMeshes)if(!active.has(id)){m.removeFromParent();rv.view.disposeGroup(m);rv.spikeMeshes.delete(id);}
}
