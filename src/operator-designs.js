import * as T from 'three';
// Everything below is baked into the same anatomical skinned mesh. Cloth,
// glass, leather and metal select surface-atlas regions, never extra draw calls.
export function addOperatorDesign(item,c,{add,panel,ellipsoid,rings}){
 const model=item.model,trim=c.trim,armor=c.armor,dark=c.dark;
 const plate=(x,y,z,w,h,d,color,bone,rz=0,rx=0,finish='metal')=>{const g=new T.BoxGeometry(w,h,d);g.rotateZ(rz);g.rotateX(rx);g.translate(x,y,z);add(g,color,bone,null,null,finish);};
 const facet=(x,y,z,w,h,depth,color,bone,outline=[[-.45,.35],[-.28,.5],[.28,.5],[.45,.35],[.38,-.33],[0,-.5],[-.38,-.33]],finish='metal')=>{
  const p=[],uv=[],index=[],n=outline.length;
  for(const [a,b]of outline){p.push(x+a*w,y+b*h,z);uv.push(a+.5,b+.5);}p.push(x,y,z-depth);uv.push(.5,.5);
  for(const [a,b]of outline){p.push(x+a*w,y+b*h,z+depth*.4);uv.push(a+.5,b+.5);}
  for(let i=0;i<n;i++){const j=(i+1)%n;index.push(i,j,n,i,n+1+i,j,j,n+1+i,n+1+j);}for(let i=1;i<n-1;i++)index.push(n+1,n+2+i,n+1+i);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();add(g,color,bone,null,null,finish);
 };
 const cord=(pts,r,color,bone,finish='rubber')=>{const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));add(new T.TubeGeometry(curve,Math.max(6,pts.length*2),r,5,false),color,bone,null,null,finish);};
 const ring=(x,y,z,r,width,color,bone,finish='metal')=>{const g=new T.TorusGeometry(r,width,4,12);g.translate(x,y,z);add(g,color,bone,null,null,finish);};
 const rivet=(x,y,z,bone,color='#b4b1a4')=>{const g=new T.CylinderGeometry(.004,.004,.005,6);g.rotateX(Math.PI/2);g.translate(x,y,z);add(g,color,bone,null,null,'metal');};
 const helmet=(color,rx=.137,ry=.173,rz=.129,finish='metal')=>ellipsoid(0,1.675,.003,rx,ry,rz,color,'head',16,finish);
 const mask=(color,width=.20,height=.23)=>{
  for(const side of [-1,1])facet(side*width*.24,1.656,-.133,width*.58,height,.037,color,'head',[[-.42,.40],[-.12,.54],[.48,.43],[.40,-.22],[-.31,-.54],[-.48,-.30]]);
  plate(0,1.66,-.181,.010,height*.72,.012,dark,'head');
 };
 const visor=(color,w=.19,h=.06,z=-.15)=>{
  panel(0,1.698,z,w+.013,h+.015,.018,dark,'head','rubber');
  const p=[],uv=[],ind=[],nx=12,ny=5;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/ny,a=(u-.5)*Math.PI*.72,b=(v-.5)*Math.PI*.62;p.push(Math.sin(a)*w*.55,1.698+Math.sin(b)*h*.56,z-.027-Math.cos(a)*Math.cos(b)*.025);uv.push(u,v);if(i<nx&&j<ny){const k=j*(nx+1)+i;ind.push(k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();add(g,color,'head',null,null,'glass');
  plate(0,1.698+h*.55,z-.023,w*.87,.009,.010,'#b5b8af','head');
 };
 const hood=(color=c.cloth)=>{
  const p=[],uv=[],index=[],rows=[[1.53,.125,.128,.008],[1.66,.158,.151,.016],[1.78,.149,.135,.019],[1.88,.090,.08,.010],[1.951,.007,.01,-.012]],sides=16;
  for(let j=0;j<rows.length;j++){const[y,rx,rz,cz]=rows[j];for(let i=0;i<=sides;i++){const a=(i/sides-.5)*Math.PI*1.45;p.push(Math.sin(a)*rx,y,cz+Math.cos(a)*rz);uv.push(i/sides,j/(rows.length-1));if(j<rows.length-1&&i<sides){const k=j*(sides+1)+i;index.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();add(g,color,'head',null,null,'cloth');
  for(const s of [-1,1])cord([[s*.122,1.54,-.083],[s*.148,1.67,-.083],[s*.142,1.77,-.061],[s*.08,1.87,-.041],[0,1.948,-.014]],.004,new T.Color(color).multiplyScalar(.72),'head','cloth');
 };
 const cape=(color,length=.60,width=.22,back=.172,side=0)=>{
  const p=[],uv=[],ind=[],nx=8,ny=7;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/ny,x=side+(u-.5)*width*(.85+.36*v),y=1.43-v*length+(j===ny?Math.sin(u*Math.PI*4)*.013:0),z=back+(back<0?-.045:.045)*v+Math.sin(u*Math.PI*6)*(.008+v*.012);p.push(x,y,z);uv.push(u,v);if(i<nx&&j<ny){const k=j*(nx+1)+i;ind.push(...(back<0?[k,k+1,k+nx+1,k+1,k+nx+2,k+nx+1]:[k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2]));}}
  const vertexCount=p.length/3,frontCount=ind.length;p.push(...p);uv.push(...uv);for(let i=0;i<frontCount;i+=3)ind.push(ind[i]+vertexCount,ind[i+2]+vertexCount,ind[i+1]+vertexCount);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();add(g,color,'chest','hips',(p,i)=>T.MathUtils.smoothstep(1.43-p.getY(i),.2,length)*.68,'cloth');
 };
 const shoulders=(color,width=.14)=>{for(const s of [-1,1]){const bone=s<0?'armL':'armR';facet(s*.272,1.414,-.064,width,.126,.027,color,bone);plate(s*.272,1.43,.015,width*.93,.05,.13,color,bone,s*.22);rivet(s*.272,1.452,-.081,bone);}};
 const bracers=(color,finish='metal')=>{for(const s of [-1,1]){const bone=s<0?'forearmL':'forearmR';facet(s*.408,1.045,-.071,.098,.182,.027,color,bone,undefined,finish);for(const y of [1.003,1.092])plate(s*.415,y,.012,.084,.018,.066,dark,bone,s*.16,0,'leather');}};
 const fur=(color='#d5ceba')=>{for(const s of [-1,1])for(let j=0;j<8;j++){const x=s*(.068+j*.020),y=1.48-j*.014,z=.026-Math.sin(j/7*Math.PI)*.08;ellipsoid(x,y,z,.023,.028,.036,j%3===0?'#b9b19e':color,'chest',6,'cloth');}};
 const knee=(color,s,heavy=false)=>{const bone=s<0?'shinL':'shinR';facet(s*.12,.497,-.092,heavy?.14:.12,heavy?.16:.12,.024,color,bone);for(const x of [-.038,.038])rivet(s*.12+x,.533,-.10,bone);};
 const buckle=(x,y,z,bone,color=trim)=>{plate(x,y,z,.031,.034,.01,color,bone,0,0,'metal');plate(x,y,z-.007,.018,.020,.012,dark,bone,0,0,'leather');};
 if(model?.startsWith('guard-')){
  if(model==='guard-nyx'){helmet(dark,.127,.17,.12,'polymer');hood();mask(dark);for(const s of [-1,1])plate(s*.035,1.705,-.177,.067,.010,.009,trim,'head',s*.60,0,'glass');}
  else{helmet(armor,.137,.173,.129,'polymer');visor(trim,.20,.063);facet(0,1.611,-.133,.10,.069,.027,dark,'head',undefined,'polymer');for(const s of [-1,1])ellipsoid(s*.133,1.682,.001,.024,.039,.029,dark,'head',8,'rubber');}
  rings([[1.45,.092,.08],[1.525,.084,.08]],dark,'neck',null,'rubber');shoulders(armor,.13);bracers(c.cloth,'polymer');
  panel(0,1.385,-.187,.072,.025,.013,trim,'chest','paint');for(const s of [-1,1]){knee(armor,s);plate(s*.12,.51,-.113,.08,.012,.009,trim,s<0?'shinL':'shinR',0,0,'paint');buckle(s*.14,1.06,-.159,'spine','#a2a7a3');}
 }else if(model==='voss'){
  helmet(armor);mask(trim,.22,.235);
  for(const s of [-1,1]){plate(s*.043,1.713,-.169,.066,.012,.015,'#83e1e2','head',s*.13,0,'glass');facet(s*.068,1.594,-.137,.083,.076,.028,armor,'head');}
  rings([[1.786,.139,.128],[1.821,.14,.128]],trim,'head',null,'metal');
  for(let i=0;i<5;i++){const a=(i-2)*.45,x=Math.sin(a)*.14,z=-Math.cos(a)*.13;facet(x,1.857+(i===2?.016:0),z,.052,i===2?.139:.102,.012,trim,'head',[[-.5,-.5],[0,.5],[.5,-.5]]);}
  shoulders(trim,.20);for(const s of [-1,1]){
   for(let j=0;j<3;j++)facet(s*(.285+j*.002),1.362-j*.04,-.065,.178,.078,.020,armor,s<0?'armL':'armR');
   facet(s*.098,1.323,-.164,.197,.229,.047,trim,'chest',[[-.48,.32],[-.27,.5],[.44,.46],[.43,-.25],[0,-.5],[-.48,-.31]]);
   facet(s*.077,1.169,-.163,.155,.129,.021,armor,'spine');knee(trim,s,true);
   facet(s*.12,.27,-.052,.121,.30,.028,armor,s<0?'shinL':'shinR');
   cape(c.cloth,.61,.235,.18,s*.105);cord([[s*.204,1.42,.19],[s*.238,1.10,.224],[s*.225,.83,.25]],.005,trim,'chest','cloth');
  }
  bracers(trim);fur();facet(0,1.006,-.142,.070,.070,.013,trim,'hips',[[-.5,0],[0,.5],[.5,0],[0,-.5]]);
  plate(0,.805,-.123,.18,.30,.018,c.cloth,'hips',0,0,'cloth');for(const s of [-1,1])plate(s*.08,.807,-.137,.007,.294,.006,trim,'hips',s*.06,0,'paint');
  facet(0,1.31,-.218,.082,.092,.012,trim,'chest');
 }else if(model==='rook'){
  helmet(armor,.149,.174,.144);visor(trim,.230,.100,-.128);facet(0,1.596,-.129,.130,.083,.038,'#a7aaa4','head');
  for(let j=-2;j<=2;j++)plate(j*.018,1.605,-.172,.008,.035,.009,dark,'head',0,0,'rubber');
  for(const s of [-1,1]){ellipsoid(s*.151,1.691,.007,.030,.062,.059,dark,'head',12,'rubber');ellipsoid(s*.173,1.691,.007,.014,.039,.037,'#a3aba5','head',10,'metal');ring(s*.171,1.691,-.025,.026,.005,'#5acbdf','head','glass');}
  shoulders(armor,.207);facet(0,1.306,-.168,.362,.286,.042,armor,'chest');facet(0,1.152,-.165,.191,.112,.023,'#a3aaa5','spine');
  plate(0,1.313,-.224,.014,.13,.012,'#dcd8c3','chest');plate(0,1.34,-.225,.076,.013,.012,'#dcd8c3','chest');
  for(const s of [-1,1])plate(s*.033,1.269,-.225,.075,.018,.014,'#dcd8c3','chest',s*.46);ring(0,1.388,-.223,.021,.007,'#dcd8c3','chest');
  rings([[1.46,.092,.09],[1.492,.099,.09],[1.518,.085,.083]],dark,'neck',null,'rubber');
  for(const s of [-1,1]){cord([[s*.12,1.60,.045],[s*.21,1.51,.075],[s*.22,1.365,.070],[s*.17,1.27,.02]],.013,dark,'chest');buckle(s*.17,1.39,-.17,'chest');knee('#a3aaa5',s,true);facet(s*.12,.241,-.03,.128,.242,.018,dark,s<0?'shinL':'shinR',undefined,'leather');}
  bracers('#9ea49e');
  for(const x of [-.142,.142])for(const y of [1.23,1.385])rivet(x,y,-.181,'chest');
  for(const s of [-1,1]){plate(s*.08,1.07,-.181,.062,.045,.020,dark,'spine',0,0,'polymer');plate(s*.08,1.068,-.196,.014,.036,.007,trim,'spine',0,0,'paint');}
 }else if(model==='nyx'){
  helmet(dark,.127,.171,.122,'polymer');hood();mask(dark,.197,.23);
  for(const s of [-1,1]){cord([[s*.071,1.728,-.160],[s*.030,1.688,-.180],[s*.010,1.634,-.180]],.005,trim,'head','glass');
   facet(s*.094,1.305,-.17,.190,.20,.027,armor,'chest',undefined,'polymer');facet(s*.278,1.417,-.062,.158,.156,.030,armor,s<0?'armL':'armR',[[-.5,.2],[.03,.5],[.5,.13],[.17,-.5]],'polymer');knee(armor,s);
   cape(c.cloth,.77,.155,.155,s*.19);cord([[s*.242,1.42,.168],[s*.275,1.04,.20],[s*.26,.67,.22]],.004,trim,'chest','cloth');
   facet(s*.12,.254,-.042,.114,.255,.022,armor,s<0?'shinL':'shinR',undefined,'polymer');
  }
  rings([[1.397,.224,.17],[1.45,.162,.125],[1.506,.097,.102],[1.533,.092,.095]],c.cloth,'chest',null,'cloth');
  plate(0,1.305,-.205,.035,.29,.015,trim,'chest',-.56,0,'cloth');bracers(armor,'polymer');
  for(const s of [-1,1]){plate(s*.41,1.045,-.105,.009,.145,.004,trim,s<0?'forearmL':'forearmR',s*.10,0,'paint');buckle(s*.14,.885,-.07,'hips','#919098');}
 }else if(model==='pulse'){
  const hair=new T.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI*.46);hair.scale(.116,.164,.112);hair.translate(0,1.669,.005);add(hair,dark,'head',null,null,'cloth');
  for(let j=0;j<8;j++){const x=-.08+j*.021;cord([[x,1.758,-.053],[x-.030,1.824,-.047],[x-.050,1.863,-.026],[x-.07,1.819,.028]],.018+(j%3)*.003,c.hair,'head','cloth');}
  ellipsoid(-.13,1.68,.005,.023,.04,.04,armor,'head',10,'metal');ring(-.14,1.681,-.033,.014,.004,'#73e9e0','head','glass');
  rings([[1.08,.155,.121],[1.17,.181,.135],[1.31,.226,.157],[1.419,.219,.13],[1.447,.103,.09]],c.cloth,'spine','chest','cloth');
  plate(0,1.277,-.176,.043,.25,.014,dark,'chest',0,0,'cloth');plate(0,1.295,-.197,.042,.29,.021,trim,'chest',-.62,0,'cloth');buckle(0,1.291,-.217,'chest','#abb2ae');
  rings([[1.438,.09,.082],[1.516,.09,.077]],c.cloth,'neck',null,'cloth');for(const s of [-1,1])plate(s*.092,1.474,-.037,.023,.09,.036,trim,'neck',s*.13,0,'cloth');
  shoulders(armor,.115);for(const s of [-1,1]){buckle(s*.169,1.404,-.098,'chest');knee(c.cloth,s);plate(s*.12,.22,-.053,.012,.055,.007,trim,s<0?'shinL':'shinR',0,0,'paint');}
  panel(-.407,1.075,-.080,.096,.108,.037,trim,'forearmL','paint');panel(-.407,1.077,-.106,.068,.072,.01,'#387f9b','forearmL','glass');
  for(let j=0;j<3;j++)panel(-.407,1.055+j*.015,-.114,.046,.004,.002,'#73e9e0','forearmL','glass');
 }else if(model==='wren'){
  const hair=new T.SphereGeometry(1,18,12,0,Math.PI*2,0,Math.PI*.53);hair.scale(.121,.172,.119);hair.translate(0,1.669,.015);add(hair,c.hair,'head',null,null,'cloth');
  for(const s of [-1,1])cord([[s*.065,1.814,-.021],[s*.103,1.772,-.067],[s*.115,1.704,-.071],[s*.13,1.65,-.035]],.012,c.hair,'head','cloth');
  cord([[.035,1.752,.113],[.058,1.72,.175],[.050,1.639,.182],[.08,1.598,.17]],.034,c.hair,'head','cloth');
  for(const s of [-1,1]){ellipsoid(s*.055,1.784,-.088,.047,.037,.025,dark,'head',12,'leather');ellipsoid(s*.055,1.784,-.113,.036,.026,.009,'#dda54d','head',12,'glass');ring(s*.055,1.784,-.121,.032,.004,'#babbae','head');}
  rings([[1.10,.155,.12],[1.18,.181,.134],[1.31,.227,.15],[1.405,.222,.126],[1.434,.104,.083]],c.cloth,'spine','chest','leather');
  plate(0,1.277,-.17,.078,.282,.014,armor,'chest',0,0,'cloth');
  for(const s of [-1,1]){cord([[s*.10,1.455,-.070],[s*.124,1.39,-.124],[s*.070,1.185,-.143]],.012,'#d6cdb6','chest','cloth');for(let j=0;j<5;j++)ellipsoid(s*(.105-j*.007),1.443-j*.041,-.10-j*.011,.021,.027,.019,'#d6cdb6','chest',6,'cloth');knee('#d6cdb6',s);buckle(s*.153,1.39,-.131,'chest','#afa693');}
  rings([[1.452,.091,.083],[1.49,.085,.077]],trim,'neck',null,'cloth');plate(-.1,1.291,-.202,.070,.27,.015,trim,'chest',-.24,0,'cloth');
  facet(-.274,1.424,-.068,.16,.12,.024,'#d6cdb6','armL');
  for(const s of [-1,1]){plate(s*.371,1.195,-.003,.084,.046,.086,'#d6cdb6',s<0?'forearmL':'forearmR',s*.25,0,'cloth');plate(s*.12,.158,-.042,.089,.035,.014,armor,s<0?'footL':'footR',0,0,'leather');}
 }else if(model==='morrow'){
  helmet(dark,.127,.171,.122,'polymer');hood();mask('#d4cbb1',.20,.23);for(const s of [-1,1]){plate(s*.038,1.699,-.171,.047,.012,.012,trim,'head',s*.13,0,'glass');facet(s*.047,1.615,-.157,.053,.075,.021,'#bab29e','head');}
  cape(c.cloth,.77,.365,.186,-.01);cape(c.cloth,.55,.335,-.174,-.06);rings([[1.414,.218,.174],[1.473,.135,.117],[1.517,.095,.104]],c.cloth,'chest',null,'cloth');
  for(let j=0;j<3;j++){const x=-.253-j*.012,y=1.436-j*.042;facet(x,y,-.059,.145,.109,.025,armor,'armL',[[-.47,.5],[.5,.2],[.35,-.5],[-.40,-.22]]);}
  plate(0,1.271,-.205,.033,.28,.012,armor,'chest',-.52,0,'leather');buckle(.012,1.277,-.222,'chest');bracers(trim);
  for(const s of [-1,1]){knee(c.cloth,s);for(let j=0;j<4;j++)plate(s*.12,.22+j*.06,-.041,.105,.020,.084,c.cloth,s<0?'shinL':'shinR',s*.04,0,'cloth');facet(s*.12,.16,-.073,.097,.099,.013,trim,s<0?'footL':'footR');}
  // Raised stitched leaf chevrons follow the asymmetric poncho.
  for(let j=0;j<4;j++)for(const s of [-1,1])plate(-.035+s*.031,1.264-j*.065,-.184,.072,.011,.006,trim,'chest',s*.65,0,'cloth');
 }
}
