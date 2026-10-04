import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {BASE_MAPS,baseMap,installPublishedLayouts} from '../../src/maps.js';
import {validateLayout,compileLayout,emptyLayout} from '../../src/map-layout.js';
import {canStand} from '../../src/physics.js';
import {groundAt} from '../../src/terrain.js';
import {DATA_MOUNT,persistentMount} from './data-path.js';

export function mapDataPath(){return process.env.RAVEL_MAP_DATA_PATH||(persistentMount(DATA_MOUNT)?DATA_MOUNT+'/map-layouts.json':process.env.YOLK_OWNER_DATA_PATH?join(dirname(process.env.YOLK_OWNER_DATA_PATH),'map-layouts.json'):'/tmp/ravelfront-map-layouts.json');}
const failure=(message,status=400)=>Object.assign(Error(message),{status});
export function validateGlb(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<20||bytes.length>8*1024*1024||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw failure('Use a self-contained GLB 2.0 model up to 8 MB.');
 let json,binLength=0;
 for(let offset=12;offset<bytes.length;){if(offset+8>bytes.length)throw failure('Damaged GLB file.');const len=bytes.readUInt32LE(offset),kind=bytes.readUInt32LE(offset+4);offset+=8;if(len%4||offset+len>bytes.length)throw failure('Damaged GLB chunk.');if(kind===0x4e4f534a){if(json||len>600000)throw failure('Model metadata exceeds the limit.');try{json=JSON.parse(bytes.subarray(offset,offset+len).toString('utf8'));}catch{throw failure('Invalid GLB metadata.');}}else if(kind===0x004e4942)binLength+=len;offset+=len;}
 if(!json||json.asset?.version!=='2.0'||(json.buffers||[]).some(b=>b.uri||!Number.isSafeInteger(b.byteLength)||b.byteLength>binLength)||(json.images||[]).some(i=>i.uri||!Number.isSafeInteger(i.bufferView)||!['image/png','image/jpeg','image/webp'].includes(i.mimeType)))throw failure('Export as GLB with all geometry and textures embedded.');
 if((json.extensionsUsed||[]).some(e=>/draco|meshopt|basisu/i.test(e)))throw failure('Export without Draco, meshopt or KTX texture compression.');
 if((json.meshes||[]).length>64||(json.nodes||[]).length>300||(json.textures||[]).length>8)throw failure('Simplify this model before importing it (64 meshes, 300 nodes, 8 textures maximum).');
 let triangles=0;for(const m of json.meshes||[])for(const p of m.primitives||[]){const a=json.accessors?.[p.indices??p.attributes?.POSITION],n=a?.count;if(!Number.isSafeInteger(n)||n<0)throw failure('Invalid model geometry.');if(p.mode!=null&&![4,5,6].includes(p.mode))throw failure('Use a triangle mesh model.');triangles+=(p.mode===5||p.mode===6)?Math.max(0,n-2):n/3;}
 if(!triangles||triangles>60000)throw failure('Models must contain at most 60,000 triangles.');
 for(const b of json.bufferViews||[])if(!Number.isSafeInteger(b.byteLength)||b.byteLength<0||(b.byteOffset||0)+b.byteLength>binLength)throw failure('Invalid model buffer.');
 return {triangles:Math.ceil(triangles)};
}
export class MapStore{
 constructor({path=mapDataPath()}={}){this.path=path;this.assetDir=join(dirname(path),'map-assets');this.state={format:1,maps:{},assets:[]};this.available=true;this.queue=Promise.resolve();this.ready=this.restore();}
 async restore(){try{const data=JSON.parse(await readFile(this.path,'utf8'));if(data.format!==1||!data.maps||!Array.isArray(data.assets))throw Error('Unsupported map store');for(const [id,m]of Object.entries(data.maps)){if(!BASE_MAPS.some(b=>b.id===id))throw Error('Unknown map');m.draft=validateLayout(m.draft,id);m.published=validateLayout(m.published,id);compileLayout(baseMap(id),m.published);}this.state=data;}catch(e){if(e.code!=='ENOENT'){this.available=false;console.error('Map store could not be restored. Existing file preserved.');}}if(this.available)installPublishedLayouts(this.layouts());}
 layouts(){return Object.fromEntries(Object.entries(this.state.maps).filter(([,m])=>m.published?.objects?.length).map(([id,m])=>[id,m.published]));}
 storage(){return {available:this.available,persistent:persistentMount(this.path)};}
 record(id){if(!BASE_MAPS.some(m=>m.id===id))throw failure('Unknown map.');return this.state.maps[id]||{draftVersion:0,revision:0,draft:emptyLayout(id),published:emptyLayout(id),updated:0};}
 overview(){return {maps:BASE_MAPS.map(m=>{const r=this.record(m.id);return {id:m.id,name:m.name,revision:r.revision,draftVersion:r.draftVersion,objects:r.draft.objects.length,updated:r.updated};}),assets:this.state.assets.map(a=>({...a})),storage:this.storage()};}
 get(id){return {...this.record(id),assets:this.state.assets,storage:this.storage()};}
 validate(id,layout){const checked=validateLayout(layout,id);const compiled=compileLayout(baseMap(id),checked);if(compiled.spawns.filter(([x,z])=>canStand(compiled,{x,y:groundAt(compiled,x,z),z})).length<2)throw failure('Keep at least two clear spawn points.');let triangles=0;for(const o of checked.objects){if(o.kind==='model'&&!this.state.assets.some(a=>a.id===o.asset))throw failure('An imported model is missing. Import the model before this map.');if(o.kind==='model')triangles+=this.state.assets.find(a=>a.id===o.asset).triangles;if(Math.abs(o.position[0])>baseMap(id).size+12||Math.abs(o.position[2])>baseMap(id).size+12)throw failure('Keep objects inside the map boundary.');}if(triangles>200000)throw failure('Reduce imported models to at most 200,000 triangles per map.');return checked;}
 async persist(state){if(!this.available)throw failure('Map storage needs recovery before it can be changed.',503);await mkdir(dirname(this.path),{recursive:true});const temp=this.path+'.'+randomUUID()+'.tmp';try{await writeFile(temp,JSON.stringify(state),{mode:0o600});await rename(temp,this.path);}catch{throw failure('Map could not be saved. Your previous map is still available.',503);}this.state=state;}
 serial(action){const next=this.queue.then(action);this.queue=next.catch(()=>{});return next;}
 update(id,layout,expectedVersion,publish=false){return this.serial(async()=>{await this.ready;const current=this.record(id);if(expectedVersion!==current.draftVersion)throw failure('This draft changed in another editor. Export your work, then reload the server draft.',409);const checked=this.validate(id,layout),next={...this.state,maps:{...this.state.maps,[id]:{...current,draft:checked,draftVersion:current.draftVersion+1,updated:Date.now(),...(publish?{published:checked,revision:current.revision+1}: {})}}};await this.persist(next);if(publish)installPublishedLayouts(this.layouts());return this.get(id);});}
 upload(bytes,{name,dimensions}){return this.serial(async()=>{await this.ready;const info=validateGlb(bytes);if(!Array.isArray(dimensions)||dimensions.length!==3||!dimensions.every(n=>Number.isFinite(n)&&n>=.02&&n<=20))throw failure('Invalid model dimensions.');const id=createHash('sha256').update(bytes).digest('hex'),old=this.state.assets.find(a=>a.id===id);if(old)return old;if(this.state.assets.length>=64)throw failure('The model library is full (64 models).');await mkdir(this.assetDir,{recursive:true});await writeFile(join(this.assetDir,id+'.glb'),bytes,{mode:0o600});const asset={id,name:String(name||'Imported model').replace(/[<>\u0000-\u001f]/g,'').slice(0,60),bytes:bytes.length,dimensions,...info};await this.persist({...this.state,assets:[...this.state.assets,asset]});return asset;});}
 async asset(id){if(!/^[a-f0-9]{64}$/.test(id)||!this.state.assets.some(a=>a.id===id))return null;try{return await readFile(join(this.assetDir,id+'.glb'));}catch{return null;}}
 async close(){await this.queue;}
}
