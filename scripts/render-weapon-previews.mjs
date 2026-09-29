// Deterministic software projection of the exact gameplay geometry. No browser,
// hand-drawn replacement gun or external asset dependency is needed to refresh art.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import * as T from 'three';
import {WEAPONS,ROYALE_WEAPONS} from '../src/data.js';
import {makeBlaster} from '../src/weapons.js';
import {WEAPON_ART_REVISION} from '../src/weapon-presentation.js';
class Element{constructor(name){this.name=name;this.attrs={};this.childNodes=[];this.style={};}setAttribute(k,v){this.attrs[k]=String(v);}appendChild(n){this.childNodes.push(n);}removeChild(n){this.childNodes.splice(this.childNodes.indexOf(n),1);}get outerHTML(){return '<'+this.name+' '+Object.entries(this.attrs).map(([k,v])=>k+'="'+v.replaceAll('"','&quot;')+'"').join(' ')+'>'+this.childNodes.map(n=>n.outerHTML).join('')+'</'+this.name+'>';}}
globalThis.document={createElementNS:(_ns,name)=>new Element(name)};
const {SVGRenderer}=await import('three/addons/renderers/SVGRenderer.js');
const require=createRequire(import.meta.url);
const sharp=(()=>{try{return require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp':'sharp');}catch{return null;}})();
await mkdir('public/inventory-previews',{recursive:true});const manifest={revision:WEAPON_ART_REVISION,source:createHash('sha256').update(await readFile('src/weapons.js')).digest('hex'),weapons:{}};
for(const w of [...WEAPONS,...ROYALE_WEAPONS]){
 const renderer=new SVGRenderer();renderer.setSize(600,334);renderer.setPrecision(2);renderer.overdraw=.25;
 const scene=new T.Scene(),model=makeBlaster(w.id);scene.add(model);scene.add(new T.AmbientLight(0xffffff,.65));
 const key=new T.DirectionalLight(0xfff0dc,1.6);key.position.set(2,4,3);scene.add(key);const rim=new T.DirectionalLight(0xc7e5ed,.7);rim.position.set(-3,2,-4);scene.add(rim);
 const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3());model.position.sub(box.getCenter(new T.Vector3()));const d=Math.max(size.z/2.75,size.y)*.9;
 const camera=new T.OrthographicCamera(-d*1.8,d*1.8,d,-d,.01,20);camera.position.set(3.5,1.55,1.6);camera.lookAt(0,0,0);renderer.render(scene,camera);
 renderer.domElement.setAttribute('xmlns','http://www.w3.org/2000/svg');renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',w.name);renderer.domElement.setAttribute('data-model-revision',WEAPON_ART_REVISION);
 let svg=renderer.domElement.outerHTML;
 if(sharp){const png=await sharp(Buffer.from(svg)).png().toBuffer();svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="334" viewBox="0 0 600 334" aria-label="${w.name}" data-model-revision="${WEAPON_ART_REVISION}"><image width="600" height="334" href="data:image/png;base64,${png.toString('base64')}"/></svg>`;}
 await writeFile('public/inventory-previews/'+w.id+'.svg',svg+'\n');manifest.weapons[w.id]={name:w.name,sha256:createHash('sha256').update(svg+'\n').digest('hex')};console.log('Rendered',w.name,renderer.info.render.faces,'faces');
}
await writeFile('public/inventory-previews/manifest.json',JSON.stringify(manifest,null,2)+'\n');
