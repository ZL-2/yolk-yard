import * as T from 'three';

// A single glyph atlas and draw call for combat damage. Hits only update bounded
// instance data; they never allocate/upload a new canvas, texture or material.
const CHARS='0123456789!◆',CELL=64,HEIGHT=96,MAX_GLYPHS=24;
export class DamageNumbers {
 constructor(parent,capacity=64){
  this.capacity=capacity;this.rows=[];this.keys=new Map();this.free=[];this.serial=0;
  const canvas=document.createElement('canvas');canvas.width=CELL*CHARS.length;canvas.height=HEIGHT*2;
  const ctx=canvas.getContext('2d');this.widths=[];
  for(let style=0;style<2;style++){ctx.font=style?'italic 900 64px Arial':'900 54px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=style?7:6;ctx.strokeStyle='#172b39';ctx.fillStyle='#ffffff';const widths=[];
   for(let i=0;i<CHARS.length;i++){const c=CHARS[i];ctx.strokeText(c,(i+.5)*CELL,style*HEIGHT+49);ctx.fillText(c,(i+.5)*CELL,style*HEIGHT+49);widths.push(ctx.measureText(c).width);}widths.push(ctx.measureText(' ').width);this.widths.push(widths);
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
  const geometry=new T.InstancedBufferGeometry(),plane=new T.PlaneGeometry(1,1);geometry.index=plane.index;geometry.attributes.position=plane.attributes.position;geometry.attributes.uv=plane.attributes.uv;
  this.attributes={};for(const [name,size]of [['center',3],['glyph',4],['tint',4]]){const a=new T.InstancedBufferAttribute(new Float32Array(capacity*MAX_GLYPHS*size),size);a.setUsage(T.DynamicDrawUsage);geometry.setAttribute(name,a);this.attributes[name]=a;}
  const material=new T.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,toneMapped:false,uniforms:{atlas:{value:texture},viewport:{value:new T.Vector2(1,1)}},vertexShader:`
   attribute vec3 center;attribute vec4 glyph;attribute vec4 tint;uniform vec2 viewport;varying vec2 vUv;varying vec4 vTint;
   void main(){vec4 clip=projectionMatrix*modelViewMatrix*vec4(center,1.0);vec2 pixels=position.xy*vec2(64.0,96.0)*(44.0/96.0)+vec2(glyph.z,0.0);clip.xy+=pixels*glyph.w*2.0/viewport*clip.w;gl_Position=clip;vUv=vec2((uv.x+glyph.x)/12.0,(uv.y+1.0-glyph.y)/2.0);vTint=tint;}
  `,fragmentShader:`uniform sampler2D atlas;varying vec2 vUv;varying vec4 vTint;void main(){vec4 c=texture2D(atlas,vUv);gl_FragColor=vec4(c.rgb*vTint.rgb,c.a*vTint.a);if(gl_FragColor.a<.01)discard;\n#include <colorspace_fragment>\n}`});
  this.mesh=new T.Mesh(geometry,material);this.mesh.name='Batched damage numbers';this.mesh.frustumCulled=false;geometry.instanceCount=0;this.mesh.visible=false;parent.add(this.mesh);
 }
 hit(e){
  if(!Number.isFinite(e.amount)||e.amount<=0||![e.x,e.y,e.z].every(Number.isFinite))return;
  const key=e.shotId!=null?e.player+':'+e.shotId+':'+e.target:null;let row=key&&this.keys.get(key);
  if(!row){if(this.rows.length===this.capacity){row=this.rows.shift();if(row.key)this.keys.delete(row.key);}else row=this.free.pop()||{};Object.assign(row,{key,amount:0,shield:0,critical:false,x:e.x,y:e.y,z:e.z});this.rows.push(row);if(key)this.keys.set(key,row);}
  row.amount+=e.amount;if(e.shield)row.shield+=e.amount;row.critical||=!!e.precision;row.life=.9;row.fresh=true;
  const health=row.amount-row.shield,runs=[];
  if(health>0)runs.push([String(Math.max(1,Math.round(health)))+(row.critical?'!':''),row.critical?[1,.62,.085]:[1,1,1]]);
  if(row.shield>0)runs.push([(health>0?'  ':'')+'◆'+Math.max(1,Math.round(row.shield))+(row.critical?'!':''),[.19,.694,1]]);
  const style=Number(row.critical),widths=this.widths[style],glyphs=[];let width=0;
  for(const [text,color]of runs)for(const c of text){const index=CHARS.indexOf(c),advance=widths[index<0?CHARS.length:index]*44/96;if(index>=0&&glyphs.length<MAX_GLYPHS)glyphs.push({index,offset:width+advance/2,color});width+=advance;}
  for(const glyph of glyphs)glyph.offset-=width/2;row.glyphs=glyphs;
 }
 update(dt,width,height){
  this.mesh.material.uniforms.viewport.value.set(Math.max(1,width),Math.max(1,height));let count=0;
  for(let i=0;i<this.rows.length;i++){const row=this.rows[i];if(row.fresh)row.fresh=false;else row.life-=dt;
   if(row.life<=0){if(row.key)this.keys.delete(row.key);this.rows.splice(i--,1);this.free.push(row);continue;}
   const age=.9-row.life,alpha=Math.min(1,row.life/.3),y=row.y+age*.85-age*age*.225,pop=(row.critical?1.18:1)*(1+.4*Math.sin(Math.min(1,age/.18)*Math.PI));
   for(const g of row.glyphs){this.attributes.center.setXYZ(count,row.x,y,row.z);this.attributes.glyph.setXYZW(count,g.index,Number(row.critical),g.offset,pop);this.attributes.tint.setXYZW(count,...g.color,alpha);count++;}
  }
  this.mesh.geometry.instanceCount=count;this.mesh.visible=count>0;if(count)for(const a of Object.values(this.attributes))a.needsUpdate=true;
 }
 clear(){this.free.push(...this.rows);this.rows=[];this.keys.clear();this.mesh.geometry.instanceCount=0;this.mesh.visible=false;}
 diagnostics(){return {numbers:this.rows.length,glyphs:this.mesh.geometry.instanceCount,draws:Number(this.mesh.visible),capacity:this.capacity};}
}
