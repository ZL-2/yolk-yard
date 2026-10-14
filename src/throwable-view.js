import * as T from 'three';
import {throwPath} from './throwables.js';
import {vehicleHit} from './vehicles.js';
export class ThrowablePreview{
 constructor(scene){
  this.root=new T.Group();this.root.visible=false;scene.add(this.root);
  this.line=new T.Line(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(256*3),3)),new T.LineBasicMaterial({color:0x9bf4ec,transparent:true,opacity:.85,depthTest:true}));this.line.frustumCulled=false;
  this.marker=new T.Mesh(new T.SphereGeometry(.18,12,8),new T.MeshBasicMaterial({color:0xdffff7,transparent:true,opacity:.85}));this.root.add(this.line,this.marker);this.at=0;
 }
 update(state,p,map,enabled,now){
  const kind=p?.inventory?.[p.slot]?.id;this.root.visible=!!(enabled&&state?.phase==='playing'&&p?.health>0&&!p.spectating&&!p.downed&&!p.vehicleId&&p.flight==='ground'&&['popper','smoke'].includes(kind)&&!p.building);
  if(!this.root.visible||now<this.at)return;this.at=now+1/20;
  const points=throwPath(p,map,kind,(o,d,r)=>vehicleHit({vehicles:state.royale?.vehicles||[]},o,d,r,p)),a=this.line.geometry.attributes.position;
  points.slice(0,256).forEach((q,i)=>a.setXYZ(i,q.x,q.y,q.z));a.needsUpdate=true;this.line.geometry.setDrawRange(0,Math.min(256,points.length));this.marker.position.copy(points.at(-1));
 }
}
