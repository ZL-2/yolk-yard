import {canStand,boxTop} from './physics.js';
import {groundAt} from './terrain.js';
// Static topology is shared between rooms. Navigation rebuilds are staggered,
// with one bounded breadth-first field per tick, not one search per enemy.
const topology=new WeakMap();
export class ZombieNavigation{
 constructor(map,zones){
  this.map=map;this.zones=zones;this.cell=2;this.n=Math.ceil(map.size*2/this.cell);this.origin=-map.size+this.cell/2;this.fields=new Map();this.cursor=0;
  let cached=topology.get(map);if(!cached){const length=this.n*this.n,walk=new Uint8Array(length),height=new Float32Array(length),neighbors=new Int32Array(length*4).fill(-1);
   for(let i=0;i<length;i++){const x=i%this.n*this.cell+this.origin,z=Math.floor(i/this.n)*this.cell+this.origin;let y=groundAt(map,x,z);
    for(const b of map.boxes)if(b.h+b.y<=2.7&&Math.abs(x-b.x)<b.w/2+.36&&Math.abs(z-b.z)<b.d/2+.36)y=Math.max(y,boxTop(b,x,z,.36));
    height[i]=y;if(canStand(map,{x,y:y+.04,z},.36))walk[i]=1;
   }
   for(let i=0;i<length;i++)if(walk[i]){let j=0;for(const k of [i-1,i+1,i-this.n,i+this.n]){if(k>=0&&k<length&&walk[k]&&Math.abs(k%this.n-i%this.n)<=1&&Math.abs(height[k]-height[i])<=2.5)neighbors[i*4+j]=k;j++;}}
   cached={walk,height,neighbors};topology.set(map,cached);
  }Object.assign(this,cached);this.queue=new Int32Array(this.walk.length);
 }
 index(x,z){const ix=Math.max(0,Math.min(this.n-1,Math.round((x-this.origin)/this.cell))),iz=Math.max(0,Math.min(this.n-1,Math.round((z-this.origin)/this.cell)));return iz*this.n+ix;}
 nearest(p){const at=this.index(p.x,p.z);if(this.walk[at]&&Math.abs(this.height[at]-(p.y||0))<1.4)return at;let best=-1,score=Infinity,cx=at%this.n,cz=Math.floor(at/this.n);for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const x=cx+dx,z=cz+dz,i=z*this.n+x;if(x<0||x>=this.n||z<0||z>=this.n||!this.walk[i])continue;const d=dx*dx+dz*dz+4*(this.height[i]-(p.y||0))**2;if(d<score){score=d;best=i;}}return best;}
 update(players,time){const ids=new Set(players.map(p=>p.id));for(const id of this.fields.keys())if(!ids.has(id))this.fields.delete(id);if(!players.length)return;
  for(let attempt=0;attempt<players.length;attempt++){const p=players[(this.cursor++)%players.length],target=this.nearest(p);let f=this.fields.get(p.id);if(f&&(f.target===target&&time-f.at<2||time-f.at<.75))continue;
   f??={distance:new Int16Array(this.walk.length),next:new Int32Array(this.walk.length)};f.distance.fill(-1);f.next.fill(-1);f.target=target;f.at=time;this.fields.set(p.id,f);if(target<0)return;let head=0,tail=1;this.queue[0]=target;f.distance[target]=0;
   while(head<tail){const i=this.queue[head++];if(f.distance[i]>=60)continue;for(let j=0;j<4;j++){const k=this.neighbors[i*4+j];if(k>=0&&f.distance[k]<0){f.distance[k]=f.distance[i]+1;f.next[k]=i;this.queue[tail++]=k;}}}return;
  }
 }
 steer(enemy,target){const field=this.fields.get(target.id),at=this.nearest(enemy);if(!field||at<0||field.distance[at]<0)return null;const next=field.next[at];if(next<0)return {x:target.x,y:target.y,z:target.z,distance:0};return {x:next%this.n*this.cell+this.origin,y:this.height[next],z:Math.floor(next/this.n)*this.cell+this.origin,distance:field.distance[at]};}
}
