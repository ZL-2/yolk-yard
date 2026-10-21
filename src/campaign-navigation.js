import {surfaceHeight,floorAt,CollisionIndex} from './campaign-layout.js';
// A layered navigation graph supports real stair/ramp travel and stacked floors.
export class FacilityNavigator{
 constructor(world,step=2){this.world=world;this.step=step;this.nodes=[];this.cells=new Map();this.index=world.index||new CollisionIndex(world.boxes);this.rebuild();}
 key(x,z){return Math.round(x/this.step)+':'+Math.round(z/this.step);}
 rebuild(){
  const {surfaces,boxes}=this.world,s=this.step;this.nodes=[];this.cells.clear();
  for(const floor of surfaces)for(let x=Math.ceil((floor.x-floor.sx/2)/s)*s;x<=floor.x+floor.sx/2;x+=s)for(let z=Math.ceil((floor.z-floor.sz/2)/s)*s;z<=floor.z+floor.sz/2;z+=s){
   const y=surfaceHeight(floor,x,z);if(y===null)continue;
   if([[.34,0],[-.34,0],[0,.34],[0,-.34]].some(([dx,dz])=>Math.abs(floorAt(surfaces,x+dx,z+dz,y+.5)-y)>.52))continue;const key=this.key(x,z),list=this.cells.get(key)||[];
   if(list.some(n=>Math.abs(n.y-y)<.12))continue;
   if(this.index.near(x,z).some(b=>b.active!==false&&y+1.7>b.y-b.sy/2+.03&&y<b.y+b.sy/2-.03&&x>b.x-b.sx/2-.34&&x<b.x+b.sx/2+.34&&z>b.z-b.sz/2-.34&&z<b.z+b.sz/2+.34))continue;
   const n={id:this.nodes.length,x,y,z,edges:[]};this.nodes.push(n);list.push(n);this.cells.set(key,list);
  }
  for(const n of this.nodes)for(const [dx,dz]of [[s,0],[-s,0],[0,s],[0,-s]])for(const other of this.cells.get(this.key(n.x+dx,n.z+dz))||[]){
   if(Math.abs(other.y-n.y)>1.05)continue;
   let height=n.y,continuous=true;for(let i=1;i<=10;i++){const t=i/10,y=floorAt(surfaces,n.x+(other.x-n.x)*t,n.z+(other.z-n.z)*t,height+.25);if(!Number.isFinite(y)||Math.abs(y-height)>.26){continuous=false;break;}height=y;}if(!continuous||Math.abs(height-other.y)>.15)continue;
   const midY=(n.y+other.y)/2,mx=(n.x+other.x)/2,mz=(n.z+other.z)/2;
   if(this.index.near(mx,mz).some(b=>b.active!==false&&midY+1.65>b.y-b.sy/2+.03&&midY<b.y+b.sy/2-.03&&mx>b.x-b.sx/2-.32&&mx<b.x+b.sx/2+.32&&mz>b.z-b.sz/2-.32&&mz<b.z+b.sz/2+.32))continue;
   n.edges.push(other.id);
  }
  this.revision=(this.revision||0)+1;
 }
 nearest(point){let best=null,d=Infinity;for(let r=0;r<=3;r++){for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)for(const n of this.cells.get(this.key(point.x+x*this.step,point.z+z*this.step))||[]){const dy=Math.abs(n.y-(point.y||0));if(dy>1.6)continue;const v=(n.x-point.x)**2+(n.z-point.z)**2+dy*dy*12;if(v<d){d=v;best=n;}}if(best)return best;}return null;}
 path(from,to){
  const a=this.nearest(from),b=this.nearest(to);if(!a||!b)return [];if(a.id===b.id)return [b];
  const count=this.nodes.length,cost=new Float32Array(count),came=new Int32Array(count),closed=new Uint8Array(count),heap=[];cost.fill(Infinity);came.fill(-1);cost[a.id]=0;
  const heuristic=n=>Math.abs(n.x-b.x)+Math.abs(n.z-b.z)+Math.abs(n.y-b.y);
  const push=(id,f)=>{const node={id,f};heap.push(node);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]=node;};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;heap[0]=last;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
  push(a.id,heuristic(a));let budget=count;
  while(heap.length&&budget--){const {id}=pop();if(closed[id])continue;if(id===b.id){const path=[];for(let n=id;n!==a.id&&n>=0;n=came[n])path.push(this.nodes[n]);return path.reverse();}closed[id]=1;
   for(const next of this.nodes[id].edges){if(closed[next])continue;const n=this.nodes[next],v=cost[id]+this.step+Math.abs(n.y-this.nodes[id].y)*.4;if(v>=cost[next])continue;cost[next]=v;came[next]=id;push(next,v+heuristic(n));}
  }return [];
 }
}
