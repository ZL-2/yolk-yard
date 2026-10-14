import * as T from 'three';
// Twenty soft turbulent billboards in one draw call per canister.
export function createSmokeCloud(s){
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},fade:{value:1},growth:{value:1}},vertexShader:`
 uniform float time;uniform float growth;varying vec2 vUv;varying float seed;
 void main(){vUv=uv;vec3 center=instanceMatrix[3].xyz;seed=center.x*3.1+center.z*4.7;center.x+=sin(time*.27+seed)*.23;center.y+=sin(time*.22+seed)*.18;center.z+=cos(time*.2+seed)*.23;vec4 p=modelViewMatrix*vec4(center*growth,1.);float size=length(instanceMatrix[0].xyz);p.xy+=position.xy*size*growth;gl_Position=projectionMatrix*p;}`,
 fragmentShader:`uniform float time;uniform float fade;varying vec2 vUv;varying float seed;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 void main(){vec2 uv=vUv*2.-1.;float n=noise(uv*3.+vec2(time*.11,seed))+noise(uv*7.-time*.06)*.3;float edge=1.-smoothstep(.28,1.,length(uv)+(n-.5)*.18);float density=edge*(.48+n*.26)*fade;if(density<.015)discard;vec3 tint=mix(vec3(.24,.29,.30),vec3(.70,.74,.72),clamp(vUv.y*.65+n*.35,0.,1.));gl_FragColor=vec4(tint,density*.74);}`});
 const mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),material,20),dummy=new T.Object3D();mesh.frustumCulled=false;mesh.userData.ownedMaterial=true;mesh.renderOrder=4;
 for(let i=0;i<20;i++){const a=i*2.39996,r=i<5?.35:Math.sqrt((i-4)/16)*s.radius*.62;dummy.position.set(Math.cos(a)*r,Math.sin(i*1.7)*s.radius*.36,Math.sin(a)*r);dummy.scale.setScalar(s.radius*(i<5?1.18:.94));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;return mesh;
}
export function updateSmokeCloud(mesh,s,time){const age=Math.max(0,time-(s.born??time-2));mesh.material.uniforms.time.value=time;mesh.material.uniforms.fade.value=Math.min(1,age/1.1,Math.max(0,(s.until-time)/2.5));mesh.material.uniforms.growth.value=.45+.55*Math.min(1,age/1.5);}
