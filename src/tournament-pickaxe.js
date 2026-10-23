import * as THREE from 'three';
// Distinct trophy silhouette, merged by shop-models into the standard one-draw
// cosmetic mesh. The gameplay pickaxe collision and timing are unchanged.
export function tournamentPickaxe(g,{box,tube,part,blade}){
 const gold='#eab65a',edge='#fff0bc',dark='#172435',crystal='#87edf4';
 tube(g,dark,[0,-.66,0],[0,.72,0],.038,'metal');
 for(let i=0;i<9;i++)box(g,'#263a4b',0,-.51+i*.065,0,.09,.034,.088,'rubber');
 for(const y of [-.66,.19,.45,.62])box(g,gold,0,y,0,.115,.055,.115,'metal');
 const gem=part(g,new THREE.OctahedronGeometry(.105),crystal,0,-.73,0,'metal');gem.scale.set(.7,1.3,.65);
 for(const s of [-1,1]){
  const points=[[.04,.56],[.22,.51],[.43,.58],[.65,.82],[.70,1.03],[.47,.88],[.23,.80],[.07,.85]].map(([x,y])=>[x*s,y]);
  blade(g,gold,s<0?points.reverse():points,.085);
  const inset=[[.15,.64],[.36,.65],[.55,.84],[.36,.77],[.16,.75]].map(([x,y])=>[x*s,y]);blade(g,edge,s<0?inset.reverse():inset,.092);
  for(let n=0;n<3;n++)tube(g,dark,[s*(.22+n*.09),.63+n*.055,.048],[s*(.28+n*.10),.75+n*.055,.048],.012,'metal');
 }
 box(g,dark,0,.7,0,.24,.24,.15,'metal');
 const core=part(g,new THREE.OctahedronGeometry(.125),crystal,0,.73,.09,'metal');core.scale.set(.65,1,.5);
 blade(g,gold,[[-.17,.88],[-.19,1.09],[-.08,1.01],[0,1.21],[.08,1.01],[.19,1.09],[.17,.88]],.085);
 box(g,edge,0,.91,0,.34,.035,.11,'metal');
 return g;
}
