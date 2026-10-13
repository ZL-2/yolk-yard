import * as T from 'three';
// Each collection has its own silhouette. All rigid pieces are merged by the
// caller, so a premium cosmetic still needs one draw call.
export function collectionGear(i,slot,g,{box,tube,part}){
 const c=i.color,a=i.accent,steel='#b3bdc0',dark='#182633',k=i.model;
 const plate=(color,x,y,z,w,h,d,rz=0,ry=0)=>{const m=box(g,color,x,y,z,w,h,d);m.rotation.z=rz;m.rotation.y=ry;return m;};
 const ring=(color,x,y,z,r,t=.025,rx=0)=>{const m=part(g,new T.TorusGeometry(r,t,5,16),color,x,y,z);m.rotation.x=rx;return m;};
 const blade=(color,points,depth=.035)=>{const shape=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y))),geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geo.translate(0,0,-depth/2);return part(g,geo,color);};
 if(slot==='pickaxe'){
  tube(g,k==='morrow'?'#72583b':dark,[0,-.65,0],[0,.68,0],.04);for(let j=0;j<5;j++)plate(c,0,-.4+j*.065,0,.09,.027,.09);plate(a,0,.46,0,.105,.06,.10);
  if(k==='voss'){blade(a,[[-.055,.52],[-.055,.99],[0,1.13],[.055,.99],[.055,.55],[.26,.45],[.4,.59],[.42,.86],[.25,.79],[.12,.79],[.08,.52]]);plate(c,-.13,.7,0,.2,.13,.10);}
  if(k==='rook'){ring(a,0,.92,0,.11);tube(g,steel,[0,.5,0],[0,.83,0],.055);for(const s of [-1,1]){tube(g,steel,[0,.46,0],[s*.26,.62,0],.055);blade(steel,[[s*.16,.61],[s*.34,.81],[s*.36,.49],[s*.26,.56]]);}plate(c,0,.72,0,.5,.07,.09);}
  if(k==='nyx'){blade(a,[[-.03,.48],[.11,.58],[.28,.72],[.43,.91],[.32,.69],[.16,.51],[-.1,.4],[-.32,.49],[-.43,.68],[-.22,.57]]);plate(c,0,.58,0,.12,.26,.09,-.18);}
  if(k==='pulse'){plate(c,0,.7,0,.51,.22,.19);for(const s of [-1,1]){plate(a,s*.25,.7,0,.075,.28,.23);plate('#70e8df',s*.13,.7,-.11,.055,.12,.016);}plate(dark,0,.84,0,.29,.06,.17);}
  if(k==='wren'){ring(steel,0,.69,0,.09);for(const s of [-1,1])plate(c,s*.21,.69+s*.05,0,.36,.13,.06,s*.2);plate(a,0,.69,-.065,.09,.09,.04);}
  if(k==='morrow'){blade(steel,[[-.04,.47],[-.07,.88],[.15,1.01],[.34,.97],[.39,.58],[.21,.6],[.08,.5]]);plate(c,.16,.78,-.03,.19,.18,.022,.12);for(let j=0;j<3;j++)tube(g,a,[-.1,.63+j*.05,0],[.1,.62+j*.05,0],.012);}
 }else if(slot==='backbling'){
  if(k==='voss'){for(const s of [-1,1]){const m=plate(c,s*.115,-.15,.03,.21,.75,.027,-s*.07);plate(a,s*.21,-.16,.042,.018,.68,.015,-s*.07);plate(a,s*.09,.17,.047,.11,.075,.019,s*.16);}plate(a,0,.18,.06,.12,.12,.025,Math.PI/4);}
  if(k==='rook'){for(const s of [-1,1]){part(g,new T.CylinderGeometry(.095,.095,.53,10),steel,s*.105,0,.06);plate(c,s*.105,0,.07,.198,.07,.205);plate(dark,s*.105,.29,.06,.085,.08,.09);tube(g,dark,[s*.105,.33,.06],[s*.22,.22,-.04],.024);}plate(c,0,-.21,.12,.46,.07,.12);}
  if(k==='nyx'){plate(c,0,0,0,.18,.32,.10);for(const s of [-1,1])for(let j=0;j<3;j++){const geo=new T.ConeGeometry(.052,.34-j*.04,4),m=part(g,geo,j===1?a:c,s*(.11+j*.068),.10-j*.10,.08);m.rotation.z=-s*(.55+j*.18);}}
  if(k==='pulse'){plate(c,0,0,.04,.24,.25,.15);plate('#73e9df',0,0,.13,.14,.1,.013);for(const s of [-1,1]){tube(g,dark,[0,.02,.03],[s*.27,.10,.03],.022);ring(a,s*.28,.1,.03,.09,.017,Math.PI/2);plate(dark,s*.28,.1,.03,.16,.012,.022);}tube(g,steel,[0,.12,0],[0,.37,0],.011);}
  if(k==='wren'){plate(c,0,0,0,.36,.44,.22);plate(steel,0,.2,.13,.26,.048,.023);for(const s of [-1,1])plate(dark,s*.125,0,.13,.044,.43,.028);plate(a,0,0,.145,.17,.105,.02);plate(dark,0,.015,.159,.11,.023,.01);}
  if(k==='morrow'){plate('#634a32',0,-.01,0,.32,.43,.20);for(const s of [-1,1]){part(g,new T.CylinderGeometry(.071,.07,.40,8),a,s*.18,0,.09);plate(c,s*.18,.02,.13,.145,.055,.1);}for(let j=0;j<3;j++)plate(c,(j-1)*.07,.14+j*.01,.14,.065,.17,.035,(j-1)*.5);}
 }else if(slot==='glider'){
  if(k==='voss'){plate(dark,0,2.96,0,.3,.18,1.4);for(const s of [-1,1]){plate(c,s*.84,2.91,.02,1.58,.065,1.32,-s*.05,s*.3);for(let j=0;j<3;j++)plate(a,s*(.6+j*.43),2.99,-.40+j*.13,.11,.09,.82,-s*.05,s*.3);}plate(a,0,3.05,-.25,.31,.075,.42);}
  if(k==='rook'){const geo=new T.SphereGeometry(1,12,8),m=part(g,geo,c,0,2.93,0);m.scale.set(1.9,.1,.95);plate(dark,0,2.9,.75,.2,.14,1.28);for(const s of [-1,1]){plate(a,s*1.3,2.95,-.38,.4,.05,.21);part(g,new T.CylinderGeometry(.16,.16,.3,8),steel,s*.57,2.83,.1);}}
  if(k==='nyx'){for(const s of [-1,1])for(let j=0;j<4;j++){plate(j===3?a:c,s*(.45+j*.4),3.01-j*.045,j*.22,1.02,.06,.51,-s*.07,s*(.16+j*.13));}plate(dark,0,2.99,0,.24,.16,1.2);}
  if(k==='pulse'){for(const s of [-1,1]){plate(c,s*.8,2.94,0,1.65,.06,1.3,-s*.12,s*.26);tube(g,a,[s*.1,3.02,-.65],[s*1.65,2.74,-.15],.04);plate(a,s*1.35,2.84,.1,.14,.06,.9);}plate('#73e9df',0,2.97,0,.17,.08,.52);}
  if(k==='wren'){plate(c,0,2.95,0,3.5,.085,.83);plate(a,0,3.35,0,3.45,.065,.79);plate(c,0,2.98,.2,.27,.19,1.68);for(const s of [-1,1])tube(g,dark,[s*1.24,2.95,-.25],[s*1.24,3.35,-.25],.02);ring(steel,0,3,-.66,.14,.025);plate(dark,0,3,-.69,.59,.05,.02);}
  if(k==='morrow'){for(const s of [-1,1])for(let j=0;j<4;j++){const m=part(g,new T.SphereGeometry(1,8,6),j%2?c:a,s*(.3+j*.38),2.96-j*.06,j*.12);m.scale.set(.62,.045,.43);m.rotation.y=s*.4;}tube(g,'#72583b',[-1.7,2.79,0],[1.7,2.79,0],.035);}
  for(const s of [-1,1]){tube(g,'#ccd1c3',[s*1.1,2.86,-.25],[s*.33,1.93,-.06],.011);tube(g,'#ccd1c3',[s*.8,2.87,.4],[s*.33,1.93,-.06],.011);plate(dark,s*.33,1.93,-.06,.12,.08,.15);}
 }
 return g;
}
