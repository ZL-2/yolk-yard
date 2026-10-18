import * as T from 'three';
import {groundAt} from './terrain.js';
import {ZOMBIES_MAP} from './zombies-map.js';
export class BlacktideAtmosphere {
 constructor(parent){
  this.positions=new Float32Array(220*3);this.seeds=Array.from({length:220},(_,i)=>({x:((i*73)%221)/221,z:((i*137)%223)/223,y:((i*57)%227)/227}));
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));
  this.dust=new T.Points(geometry,new T.PointsMaterial({color:0xc4d2be,size:.045,transparent:true,opacity:.48,depthWrite:false}));this.dust.frustumCulled=false;parent.add(this.dust);this.at=0;
 }
 update(time,camera){if(time<this.at)return;this.at=time+1/15;for(let i=0;i<this.seeds.length;i++){const s=this.seeds[i],x=camera.position.x+(s.x-.5)*50+Math.sin(time*.1+i)*.3,z=camera.position.z+(s.z-.5)*50;this.positions[i*3]=x;this.positions[i*3+1]=groundAt(ZOMBIES_MAP,x,z)+.2+((s.y*9+time*.08)%9);this.positions[i*3+2]=z;}this.dust.geometry.attributes.position.needsUpdate=true;}
}
