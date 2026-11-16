import * as THREE from 'three';
// Two draw calls: a gradient sky and instanced cloud lobes. No volumetrics,
// post-processing passes, shadow maps or per-frame geometry allocations.
export class FrontierAtmosphere{
 constructor(scene){
  this.root=new THREE.Group();scene.add(this.root);
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color(0x3b80db)},horizon:{value:new THREE.Color(0xc1e6f0)},sun:{value:new THREE.Vector3(-.34,.85,.4).normalize()}},vertexShader:'varying vec3 skyColor; uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; void main(){vec3 d=normalize(position);float h=pow(max(0.0,d.y),0.5);vec3 color=mix(horizon,top,h);float s=max(0.0,dot(d,sun));color+=vec3(1.0,0.73,0.36)*pow(s,64.0)*0.12;skyColor=mix(color,vec3(1.0,0.96,0.76),smoothstep(0.9993,0.9998,s));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 skyColor; void main(){gl_FragColor=vec4(skyColor,1.0);#include <colorspace_fragment>\n}' });
  // The shader include must start on its own line for the GLSL preprocessor.
  material.fragmentShader=material.fragmentShader.replace(';#include',';\n#include');
  this.dome=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),material);this.dome.scale.setScalar(850);this.dome.frustumCulled=false;this.dome.renderOrder=-10;this.root.add(this.dome);
  const geometry=new THREE.IcosahedronGeometry(1,2),cloudMaterial=new THREE.MeshLambertMaterial({color:0xf6f9ff,fog:false});
  this.clouds=new THREE.InstancedMesh(geometry,cloudMaterial,60);this.clouds.frustumCulled=false;this.clouds.castShadow=false;this.clouds.receiveShadow=false;this.root.add(this.clouds);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3();
  for(let group=0;group<12;group++){const a=group*Math.PI/6+.28,r=390+group%3*80;for(let lobe=0;lobe<5;lobe++){const i=group*5+lobe;position.set(Math.cos(a)*r+(lobe-2)*12,225+(group%3)*15+(lobe%2)*6,Math.sin(a)*r+Math.sin(lobe*1.7)*8);scale.set(21+(group%2)*5,6+(lobe%3)*3,14+lobe%2*5);matrix.compose(position,q,scale);this.clouds.setMatrixAt(i,matrix);}}
  this.clouds.instanceMatrix.needsUpdate=true;
  const flakes=new Float32Array(360*3);
  for(let i=0;i<flakes.length;i++)flakes[i]=((i*1619+i*i*37)%3547)/3547;
  const snowGeo=new THREE.BufferGeometry();
  snowGeo.setAttribute('position',new THREE.BufferAttribute(flakes,3));
  const snowMaterial=new THREE.ShaderMaterial({
   transparent:true,depthWrite:false,uniforms:{clock:{value:0}},
   vertexShader:`uniform float clock;
    void main(){
     vec3 p=fract(position+vec3(clock*.025,-clock*.063,clock*.013))-.5;
     vec4 view=modelViewMatrix*vec4(p*vec3(46.,24.,46.),1.);
     gl_Position=projectionMatrix*view;
     gl_PointSize=clamp(27./max(1.,-view.z),1.3,3.8);
    }`,
   fragmentShader:`void main(){
    float edge=1.-smoothstep(.18,.5,length(gl_PointCoord-.5));
    gl_FragColor=vec4(.88,.95,1.,edge*.68);
   }`,
  });
  this.snow=new THREE.Points(snowGeo,snowMaterial);
  this.snow.frustumCulled=false;this.root.add(this.snow);
  this.root.visible=false;
 }
 update(camera,map,playing,clock,lobbyWinter=false){
  this.root.visible=lobbyWinter||!!playing&&map?.theme==='royale';
  if(!this.root.visible)return;
  const winter=lobbyWinter||!!map.winterSignal,sky=this.dome.material.uniforms;
  sky.top.value.setHex(winter?0x426493:0x3b80db);
  sky.horizon.value.setHex(winter?0xc4d5e8:0xc1e6f0);
  this.dome.position.copy(camera.position);
  this.clouds.rotation.y=clock*.00065;
  this.snow.visible=winter;
  if(winter){
   this.snow.position.copy(camera.position);
   this.snow.material.uniforms.clock.value=clock;
  }
 }
}
