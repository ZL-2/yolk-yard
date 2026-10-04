import {RADIUS,HEIGHT,canStand} from './physics.js';
import {SPAWN_ISLAND} from './spawn-island.js';
import {ROYALE_MAP} from './royale-map.js';
import {groundAt} from './terrain.js';
import {createRavelArenas} from './ravel-arenas.js';
import {compileLayout,validateLayout,layoutKey,MAP_LIMITS} from './map-layout.js';
export const MAPS=createRavelArenas();
export const BASE_MAPS=[ROYALE_MAP,SPAWN_ISLAND,...MAPS];
export const baseMap=id=>BASE_MAPS.find(m=>m.id===id)||MAPS[0];
const emptyBundle=Object.freeze({});
let publishedLayouts=emptyBundle,matchLayouts=null,matchKey='';
const compiledMaps=new WeakMap(),bundleKeys=new WeakMap();
export function validateLayoutBundle(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>BASE_MAPS.length)throw Error('Invalid map collection.');
 if(JSON.stringify(value).length>MAP_LIMITS.bundleBytes)throw Error('Published maps exceed the shared layout size limit. Export a backup and reduce unused objects.');
 const bundle={};for(const [id,doc]of Object.entries(value)){if(!BASE_MAPS.some(m=>m.id===id))throw Error('Unknown map.');bundle[id]=validateLayout(doc,id);compileLayout(baseMap(id),bundle[id]);}
 return bundle;
}
export function mapBundleKey(bundle){if(!bundleKeys.has(bundle))bundleKeys.set(bundle,layoutKey(bundle));return bundleKeys.get(bundle);}
export function installPublishedLayouts(bundle){publishedLayouts=validateLayoutBundle(bundle);return publishedLayouts;}
export const captureMapLayouts=()=>publishedLayouts;
export function useMatchLayouts(bundle,key){
 if(!bundle){matchLayouts=null;matchKey='';return;}
 if(key&&key===matchKey)return;
 const checked=validateLayoutBundle(bundle);matchLayouts=checked;matchKey=key||mapBundleKey(checked);
}
export function getMap(id,bundle=matchLayouts||publishedLayouts){
 const base=baseMap(id);if(!bundle[base.id]?.objects?.length)return base;
 if(!compiledMaps.has(bundle))compiledMaps.set(bundle,new Map());const cache=compiledMaps.get(bundle);
 if(!cache.has(base.id))cache.set(base.id,compileLayout(base,bundle[base.id]));return cache.get(base.id);
}
export function surfaceAt(map, x, z) {
  let y = groundAt(map,x,z);
  for (const b of map.boxes)
    if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2)
      y = Math.max(y, b.y + b.h);
  return y;
}

// Layered navigation preserves both the street and the walkable deck above it.
const navCache = new WeakMap();
export function navigation(map) {
  if(navCache.has(map)) return navCache.get(map);
  const cell = map.navCell || 1.5,
    n = Math.ceil((map.size * 2) / cell),
    origin = -map.size + cell / 2;
  const cells = Array.from({ length: n * n }, () => []),
    nodes = [];
  const navBoxes=(map.authored||map.boxes).filter(b=>!b.doorId||b.indestructible),navMap=map.doors?.length?{...map,boxes:navBoxes}:map;
  const buckets=new Map(),bucketSize=8;
  for(const b of navBoxes){for(let x=Math.floor((b.x-b.w/2-.5)/bucketSize);x<=Math.floor((b.x+b.w/2+.5)/bucketSize);x++)for(let z=Math.floor((b.z-b.d/2-.5)/bucketSize);z<=Math.floor((b.z+b.d/2+.5)/bucketSize);z++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(b);}}
  const nearby=(x,z)=>buckets.get(Math.floor(x/bucketSize)+','+Math.floor(z/bucketSize))||[];
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const px = origin + x * cell,
        pz = origin + z * cell;
      const overlapping = nearby(px,pz).filter(
        (b) =>
          Math.abs(px - b.x) < b.w / 2 + RADIUS + .02 &&
          Math.abs(pz - b.z) < b.d / 2 + RADIUS + .02,
      );
      const ground=groundAt(map,px,pz), levels = new Set([ground]);
      for (const b of overlapping)
        if (Math.abs(px - b.x) < b.w / 2 + (map.theme==='royale'?RADIUS-.02:0) && Math.abs(pz - b.z) < b.d / 2 + (map.theme==='royale'?RADIUS-.02:0))
          levels.add(b.y + b.h);
      for (const y of levels) {
        if (
          y > (map.navMax||8) ||
          overlapping.some((b) => y + 0.04 < b.y + b.h && y + HEIGHT + .02 > b.y + 0.01)
        )
          continue;
        const node = {
          id: nodes.length,
          x: px,
          y,
          terrain: y===ground,
          z: pz,
          cx: x,
          cz: z,
          edges: [],
        };
        nodes.push(node);
        cells[z * n + x].push(node);
      }
    }
  for (const a of nodes)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = a.cx + dx,
        z = a.cz + dz;
      if (x < 0 || z < 0 || x >= n || z >= n) continue;
      for (const b of cells[z * n + x])
        if(map.theme!=='royale'){if(b.y-a.y<=.43&&a.y-b.y<=3.7)a.edges.push(b.id);}
        else if (b.y-a.y<=(a.terrain&&b.terrain?cell*.8:cell*.55)&&a.y-b.y<=3.7){
          let valid=true,previous=a.y;
          for(let i=1;i<=4;i++){const t=i/4,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,expected=a.y+(b.y-a.y)*t,over=nearby(x,z);let y=groundAt(map,x,z);
           for(const o of over)if(Math.abs(x-o.x)<o.w/2+RADIUS-.02&&Math.abs(z-o.z)<o.d/2+RADIUS-.02&&o.y+o.h<=expected+.38)y=Math.max(y,o.y+o.h);
           if((!a.terrain||!b.terrain)&&y-previous>.431||over.some(o=>Math.abs(x-o.x)<o.w/2+RADIUS-.02&&Math.abs(z-o.z)<o.d/2+RADIUS-.02&&y+.04<o.y+o.h&&y+HEIGHT+.01>o.y+.02)){valid=false;break;}previous=y;
          }
          if(valid)a.edges.push(b.id);
        }
    }
  // Explicit stair lanes bridge coarse terrain cells. Their waypoints follow
  // the authored treads, so a narrower human capsule cannot cut across two risers.
  for(const link of map.navLinks||[]){
    const dx=link.to.x-link.from.x,dz=link.to.z-link.from.z,dy=link.to.y-link.from.y,length=Math.hypot(dx,dz);if(length<1||dy<.4)continue;
    const b=map.buildings?.[link.building],steps=b?12:Math.ceil(dy/.35),run=b?b.d-4:Math.max(1,length-1.4),sign=dz>=0?1:-1;
    const points=[...(b?[{...link.from,x:b.x}]:[]),link.from,...Array.from({length:steps},(_,i)=>({x:link.from.x+(dx?dx*(i+.5)/steps:0),z:b?b.z+sign*(-run/2+(i+.5)*run/steps):link.from.z+dz*(i+1)/steps,y:link.from.y+dy*(i+1)/steps})),link.to,...(b?[{...link.to,x:b.x}]:[])];
    const lane=points.map(p=>{const cx=Math.max(0,Math.min(n-1,Math.round((p.x-origin)/cell))),cz=Math.max(0,Math.min(n-1,Math.round((p.z-origin)/cell))),node={...p,cx,cz,id:nodes.length,edges:[]};nodes.push(node);cells[cz*n+cx].push(node);return node;});
    for(let i=1;i<lane.length;i++){lane[i-1].edges.push(lane[i].id);lane[i].edges.push(lane[i-1].id);}
    for(const end of [lane[0],lane.at(-1)])for(let x=Math.max(0,end.cx-2);x<=Math.min(n-1,end.cx+2);x++)for(let z=Math.max(0,end.cz-2);z<=Math.min(n-1,end.cz+2);z++)for(const node of cells[z*n+x]){
      if(node===end||Math.abs(node.y-end.y)>.08||Math.hypot(node.x-end.x,node.z-end.z)>cell*2.1)continue;
      let clear=true;for(let j=1;j<=6;j++){const t=j/6;if(!canStand(navMap,{x:end.x+(node.x-end.x)*t,z:end.z+(node.z-end.z)*t,y:end.y},RADIUS)){clear=false;break;}}
      if(clear){end.edges.push(node.id);node.edges.push(end.id);}
    }
  }
  const nearest=(p)=>{
   let best=null,distance=Infinity;const cx=Math.floor((p.x-origin)/cell),cz=Math.floor((p.z-origin)/cell);
   for(let radius=0;radius<12;radius++){
    for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){if(radius&&Math.abs(dx)!==radius&&Math.abs(dz)!==radius)continue;const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=n||z>=n)continue;
     for(const node of cells[z*n+x]){const d=(node.x-p.x)**2+(node.z-p.z)**2+4*(node.y-(p.y??groundAt(map,p.x,p.z)))**2;if(d<distance){best=node;distance=d;}}
    }if(best&&distance<(radius*cell)**2)return best;
   }return best||nodes[0];
  };
  const parent=new Int32Array(nodes.length),cost=new Float32Array(nodes.length),seen=new Uint32Array(nodes.length),closed=new Uint32Array(nodes.length),q=[];let search=0;
  const nav = {
    path(from, to, limit=4000) {
      const start = nearest(from),
        end = nearest(to);
      if (!start || !end) return [];
      if(++search===0xffffffff){seen.fill(0);closed.fill(0);search=1;}q.length=0;
      const heuristic=a=>Math.hypot(a.x-end.x,a.z-end.z)+Math.abs(a.y-end.y)*1.5;
      const push=(id,score)=>{let i=q.length;q.push({id,score});while(i){const p=(i-1)>>1;if(q[p].score<=score)break;[q[p],q[i]]=[q[i],q[p]];i=p;}};
      const pop=()=>{const first=q[0],last=q.pop();if(q.length){q[0]=last;let i=0;while(true){let k=i*2+1;if(k>=q.length)break;if(k+1<q.length&&q[k+1].score<q[k].score)k++;if(q[i].score<=q[k].score)break;[q[i],q[k]]=[q[k],q[i]];i=k;}}return first.id;};
      seen[start.id]=search;parent[start.id]=start.id;cost[start.id]=0;push(start.id,heuristic(start));let best=start.id,bestD=Infinity,visited=0;
      // A partial route is useful immediately and will be extended on the next
      // scheduled search. Unreachable indoor targets cannot stall a host frame.
      while(q.length&&visited++<limit){const id=pop();if(closed[id]===search)continue;closed[id]=search;const a=nodes[id],d=heuristic(a);if(d<bestD){bestD=d;best=id;}if(id===end.id)break;
       for(const k of a.edges){const b=nodes[k],next=cost[id]+Math.hypot(b.x-a.x,b.z-a.z)+Math.abs(b.y-a.y)*.8;if(seen[k]!==search||next<cost[k]){seen[k]=search;cost[k]=next;parent[k]=id;push(k,next+heuristic(b));}}
      }
      const path = [];
      for (let k = best; k !== start.id && seen[k]===search; k = parent[k]) {
        const a = nodes[k];
        path.push({ x: a.x, y: a.y, z: a.z });
      }
      return path.reverse();
    },
  };
  navCache.set(map,nav);
  return nav;
}
