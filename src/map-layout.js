// The editor and both match authorities compile the same bounded layout format.
// Layouts contain data only; uploaded models never supply executable scene code.
export const MAP_LAYOUT_VERSION=1;
export const MAP_LIMITS=Object.freeze({edits:1600,additions:250,assets:24,bytes:1_000_000,scaleMin:.1,scaleMax:8});
export const MAP_PREFABS=Object.freeze([
 {id:'block',name:'Block',category:'Structure',size:[4,4,4],material:'brick',color:'#82928f'},
 {id:'wall',name:'Concrete wall',category:'Structure',size:[8,3,.4],material:'brick',color:'#82928f'},
 {id:'platform',name:'Platform',category:'Structure',size:[8,.3,8],material:'metal',color:'#475e68'},
 {id:'stairs',name:'Walkable stairs',category:'Structure',size:[4,4,8],material:'brick',color:'#82928f'},
 {id:'bunker',name:'Open bunker',category:'Structure',size:[12,4.5,10],material:'brick',color:'#64766c'},
 {id:'tower',name:'Watchtower',category:'Structure',size:[8,8,8],material:'metal',color:'#475e68'},
 {id:'container',name:'Cargo container',category:'Equipment',size:[8,2.8,3.2],material:'metal',color:'#397a7f'},
 {id:'crate',name:'Supply crate',category:'Equipment',size:[2,1.5,2],material:'wood',color:'#ad8961'},
 {id:'barrels',name:'Steel barrels',category:'Equipment',size:[1.5,1.3,1.5],material:'metal',color:'#475e68'},
 {id:'shield-barrel',name:'Shield barrel',category:'Equipment',size:[.9,1.24,.9],material:'metal'},
 {id:'generator',name:'Generator',category:'Equipment',size:[2.6,1.7,2.4],material:'metal'},
 {id:'truck',name:'Military truck',category:'Vehicles',size:[3,2.8,6],material:'metal'},
 {id:'car',name:'Parked car',category:'Vehicles',size:[2.2,1.7,4.5],material:'metal'},
 {id:'pine',name:'Pine tree',category:'Nature',size:[6,10,6],material:'wood'},
 {id:'oak',name:'Oak tree',category:'Nature',size:[6,10,6],material:'wood'},
 {id:'palm',name:'Palm tree',category:'Nature',size:[8,11,8],material:'wood'},
 {id:'rock',name:'Rock',category:'Nature',size:[4,2.8,3],material:'brick'},
 {id:'bush',name:'Bush',category:'Nature',size:[2,1.2,2],material:'wood'},
 {id:'lamp',name:'Field lamp',category:'Details',size:[.7,4.7,.7],material:'metal'},
 {id:'bench',name:'Bench',category:'Details',size:[2.6,1.3,.8],material:'wood'},
 {id:'fence',name:'Fence',category:'Details',size:[6,1.7,.3],material:'wood'},
 {id:'chest',name:'Loot chest',category:'Gameplay',size:[1.5,1.2,1],material:'wood'},
 {id:'spawn',name:'Spawn point',category:'Gameplay',size:[1,1,1],material:'metal'},
]);
export const prefab=id=>MAP_PREFABS.find(p=>p.id===id);
export const emptyLayout=mapId=>({format:MAP_LAYOUT_VERSION,mapId,objects:[]});
const word=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,90}$/.test(value);
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const vector=(v,min,max)=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n,min,max));
const cleanName=value=>String(value||'Object').replace(/[\u0000-\u001f<>]/g,'').slice(0,60);
export function validateLayout(input,mapId=input?.mapId){
 if(!input||input.format!==MAP_LAYOUT_VERSION||!word(mapId)||input.mapId!==mapId||!Array.isArray(input.objects))throw Error('This is not a supported Ravelfront map file.');
 if(input.objects.length>MAP_LIMITS.edits+MAP_LIMITS.additions||JSON.stringify(input).length>MAP_LIMITS.bytes)throw Error('Map exceeds the editor size limit.');
 const ids=new Set();let additions=0,edits=0,assets=0;
 const objects=input.objects.map(o=>{
  if(!o||!word(o.id)||ids.has(o.id))throw Error('Every map object needs a unique ID.');ids.add(o.id);
  if(o.source!=null&&!word(o.source))throw Error('Invalid source object.');
  if(o.source&&o.id===o.source?++edits>MAP_LIMITS.edits:++additions>MAP_LIMITS.additions)throw Error('Map object limit reached.');
  if(!vector(o.position,-600,600)||!finite(o.position[1],-40,180)||!vector(o.scale,MAP_LIMITS.scaleMin,MAP_LIMITS.scaleMax)||!finite(o.rotation,-36000,36000))throw Error('Object position, rotation or scale is outside the allowed range.');
  const rotation=((Math.round(o.rotation*1000)/1000%360)+360)%360,kind=o.source?'source':o.kind;
  if(!o.source&&!prefab(kind)&&kind!=='model')throw Error('Unknown object type.');
  if(kind==='model'&&(!/^[a-f0-9]{64}$/.test(o.asset||'')||!vector(o.dimensions,.02,20)||++assets>MAP_LIMITS.assets))throw Error('Invalid model or too many imported models.');
  const collision=!['spawn','chest'].includes(kind)&&o.collision!==false;
  // The shared movement engine uses axis-aligned solids. Quarter turns retain
  // exact collision rather than silently using oversized rotated hitboxes.
  if(collision&&Math.abs(rotation/90-Math.round(rotation/90))>.00001)throw Error('Solid objects rotate in 90° steps. Turn collision off for free rotation.');
  if(o.color!=null&&!/^#[a-fA-F0-9]{6}$/.test(o.color))throw Error('Choose a valid object color.');
  return {id:o.id,...(o.source?{source:o.source}:{kind}),name:cleanName(o.name),position:o.position.map(n=>Math.round(n*1000)/1000),rotation,scale:o.scale.map(n=>Math.round(n*1000)/1000),collision,...(o.removed?{removed:true}:{}),...(o.color?{color:o.color}:{}),...(kind==='model'?{asset:o.asset,dimensions:[...o.dimensions]}:{})};
 });
 return {format:MAP_LAYOUT_VERSION,mapId,objects};
}
export function layoutKey(layout){let h=2166136261;const text=JSON.stringify(layout);for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
export function transformPoint(point,origin,record){
 const a=record.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=(point.x-origin[0])*record.scale[0],z=(point.z-origin[2])*record.scale[2];
 return {x:record.position[0]+x*c+z*s,y:record.position[1]+((point.y||0)-origin[1])*record.scale[1],z:record.position[2]-x*s+z*c};
}
export function transformBox(box,origin,record){
 const p=transformPoint(box,origin,record),a=record.rotation*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
 return {...box,...p,w:Math.max(.02,box.w*record.scale[0]*c+box.d*record.scale[2]*s),d:Math.max(.02,box.w*record.scale[0]*s+box.d*record.scale[2]*c),h:Math.max(.02,box.h*record.scale[1])};
}
export function prefabBoxes(kind){
 const p=prefab(kind);if(!p||['spawn','chest'].includes(kind))return [];
 const [w,h,d]=p.size,b=(x,y,z,w,h,d)=>({x,y,z,w,h,d,kind:'editor',material:p.material,color:p.color?Number.parseInt(p.color.slice(1),16):0x647983});
 if(['pine','oak','palm'].includes(kind))return [b(0,0,0,.65,h*.65,.65)];
 if(kind==='stairs')return Array.from({length:12},(_,i)=>b(0,0,-d/2+(i+.5)*d/12,w,(i+1)*h/12,d/12+.01));
 if(kind==='bunker')return [b(0,0,-d/2,w,h,.4),b(-w/2,0,0,.4,h,d),b(w/2,0,0,.4,h,d),b(0,h,0,w+.5,.3,d+.5),b(0,0,0,w,.2,d)];
 if(kind==='tower')return [b(0,7,0,8,.35,8),...[-1,1].flatMap(x=>[-1,1].map(z=>b(x*3.5,0,z*3.5,.5,7,.5))),...Array.from({length:20},(_,i)=>b(0,i*.35,-7+(i+.5)*.6,2.5,.35,.61))];
 return [b(0,0,0,w,h,d)];
}
const baseCatalogs=new WeakMap();
export function baseObjects(map){
 if(baseCatalogs.has(map))return baseCatalogs.get(map);
 const list=[],boxes=map.authored||map.boxes;
 const add=(id,type,spec,solids,position)=>{
  const lo=solids.length?Math.min(...solids.map(b=>b.y)):position[1],hi=solids.length?Math.max(...solids.map(b=>b.y+b.h)):lo+(spec.h||1);
  const size=solids.length?[Math.max(...solids.map(b=>b.x+b.w/2))-Math.min(...solids.map(b=>b.x-b.w/2)),hi-lo,Math.max(...solids.map(b=>b.z+b.d/2))-Math.min(...solids.map(b=>b.z-b.d/2))]:[spec.w||1,spec.h||1,spec.d||1];
  list.push({id,type,spec,boxes:solids,position,size,name:spec.name||[spec.type||spec.kind||type,id.split('-').at(-1)].join(' ')});
 };
 (map.buildings||[]).forEach((b,i)=>add('building-'+i,'building',b,boxes.filter(o=>o.building===i),[b.x,b.baseY??b.y??0,b.z]));
 (map.trees||[]).forEach((t,i)=>add('tree-'+i,'tree',t,boxes.filter(o=>o.tree===i),[t.x,t.y||0,t.z]));
 (map.props||[]).forEach((p,i)=>add('prop-'+i,'prop',p,boxes.filter(o=>o.prop===i),[p.x,p.y||0,p.z]));
 boxes.forEach((b,i)=>{if(b.building===undefined&&b.tree===undefined&&b.prop===undefined&&b.kind!=='boundary')add('box-'+i,'box',b,[b],[b.x,b.y,b.z]);});
 (map.chests||[]).forEach((p,i)=>add('chest-'+i,'chest',p,[],[p.x,p.y||0,p.z]));
 (map.spawns||[]).forEach(([x,z],i)=>add('spawn-'+i,'spawn',{name:'Spawn '+(i+1)},[],[x,0,z]));
 baseCatalogs.set(map,list);return list;
}
export function sourceRecord(source){return {id:source.id,source:source.id,name:source.name,position:[...source.position],rotation:0,scale:[1,1,1],collision:!['chest','spawn'].includes(source.type)};}
export function compileLayout(base,input){
 if(!input||!input.objects?.length)return base;
 const layout=validateLayout(input,base.id),sources=new Map(baseObjects(base).map(o=>[o.id,o]));
 const map={...base,boxes:(base.authored||base.boxes).map((b,i)=>({...b,objectId:b.objectId||'world-'+i})),editorObjects:[],editorBase:base,layoutKey:layoutKey(layout)};
 for(const key of ['buildings','props','trees','chests','floorLoot','navLinks','signs','doors'])map[key]=(base[key]||[]).map(p=>({...p}));
 map.spawns=base.spawns.map(p=>[...p]);
 const removed=new Set(),replacements=new Map(),explicit=new Set(layout.objects.filter(o=>o.source).map(o=>o.source));
 let addedSolids=0;const records=[...layout.objects].sort((a,b)=>(a.source?.startsWith('building-')?-1:0)-(b.source?.startsWith('building-')?-1:0));
 for(const r of records){
  const src=r.source?sources.get(r.source):null;if(r.source&&!src)throw Error('The map contains an object that no longer exists.');
  const original=src&&r.id===r.source,origin=src?.position||[0,0,0];
  if(original){
   for(const b of src.boxes){const key=b.objectId||'world-'+(base.authored||base.boxes).indexOf(b);removed.add(key);replacements.delete(key);if(!r.removed&&r.collision)replacements.set(key,{...transformBox(b,origin,r),objectId:key,editorObject:r.id});}
   if(src.type==='building'){
    const i=Number(src.id.split('-')[1]);map.buildings[i]={...map.buildings[i],editorHidden:true,...transformPoint(src.spec,origin,r),baseY:r.position[1],w:src.spec.w*r.scale[0],d:src.spec.d*r.scale[2],h:src.spec.h*r.scale[1]};
    for(const p of map.props)if(p.building===i&&!explicit.has('prop-'+map.props.indexOf(p))){p.editorHidden=true;}
    for(const key of ['chests','floorLoot','signs'])map[key]=map[key].filter(p=>p.building!==i||!r.removed).map(p=>p.building===i?{...p,...transformPoint(p,origin,r)}:p);
    map.navLinks=map.navLinks.filter(p=>p.building!==i||!r.removed).map(p=>p.building===i?{...p,building:undefined,from:transformPoint(p.from,origin,r),to:transformPoint(p.to,origin,r)}:p);
    map.doors=map.doors.filter(p=>p.building!==i||!r.removed).map(p=>p.building===i?{...p,...transformPoint(p,origin,r)}:p);
   }else if(['prop','tree'].includes(src.type)){
    const key=src.type==='tree'?'trees':'props',i=Number(src.id.split('-')[1]);map[key][i]={...map[key][i],...transformPoint(src.spec,origin,r),editorHidden:true};
   }else if(src.type==='chest'){
    const p=base.chests[Number(src.id.split('-')[1])];map.chests=map.chests.filter(c=>c.id!==p.id);if(!r.removed)map.chests.push({...p,...transformPoint(p,origin,r)});
   }else if(src.type==='spawn'){map.spawns[Number(src.id.split('-')[1])]=r.removed?null:[r.position[0],r.position[2]];}
  }else if(!r.removed){
   const solids=src?src.boxes:r.kind==='model'?[{x:0,y:0,z:0,w:r.dimensions[0],h:r.dimensions[1],d:r.dimensions[2],kind:'editor',material:'metal'}]:prefabBoxes(r.kind);
   addedSolids+=solids.length;if(addedSolids>4000)throw Error('Reduce duplicated structures: at most 4,000 added structural pieces per map.');
   if(r.collision)for(const [i,b]of solids.entries())map.boxes.push({...transformBox(b,origin,r),objectId:'editor-'+r.id+'-'+i,editorObject:r.id,building:undefined,tree:undefined,prop:undefined,...(b.doorId?{doorId:'editor-'+r.id+'-'+b.doorId}:{}),...(r.kind==='shield-barrel'?{health:150,harvestType:'shieldBarrel'}:{})});
   if(src?.type==='building'){
    const building=Number(src.id.split('-')[1]);
    for(const key of ['chests','floorLoot','doors'])for(const [i,p]of (base[key]||[]).entries())if(p.building===building)map[key].push({...p,...transformPoint(p,origin,r),building:undefined,id:key==='doors'?'editor-'+r.id+'-'+p.id:'editor-'+r.id+'-'+key+'-'+i});
    for(const p of base.navLinks||[])if(p.building===building)map.navLinks.push({...p,building:undefined,from:transformPoint(p.from,origin,r),to:transformPoint(p.to,origin,r)});
   }
   if(r.kind==='spawn'||src?.type==='spawn')map.spawns.push([r.position[0],r.position[2]]);
   if(r.kind==='chest'||src?.type==='chest')map.chests.push({id:'editor-chest-'+r.id,x:r.position[0],y:r.position[1],z:r.position[2],poi:base.districts?.[0]?.id||'editor',chance:1,source:'chest',floor:0,room:'editor'});
  }
  if(!r.removed&&src?.type!=='spawn'&&src?.type!=='chest'&&!['spawn','chest'].includes(r.kind))map.editorObjects.push({...r,sourceObject:src,origin,...(original&&src?.type==='building'?{omitProps:[...explicit].filter(id=>id.startsWith('prop-'))}:{})});
 }
 map.boxes=map.boxes.filter(b=>!removed.has(b.objectId)).concat([...replacements.values()]);
 map.spawns=map.spawns.filter(Boolean);if(map.spawns.length<2)throw Error('Keep at least two spawn points.');
 map.authored=map.boxes;map.revision=String(base.revision||0)+':'+map.layoutKey;
 return map;
}
