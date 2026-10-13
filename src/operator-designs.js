import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
// These pieces merge into the existing skinned mesh. Cosmetic silhouettes use
// the same bones, motion, collision and hit regions as every other operator.
export function addOperatorDesign(item,c,{add,panel,ellipsoid,rings}){
 const model=item.model,trim=c.trim,armor=c.armor,dark=c.dark;
 const plate=(x,y,z,w,h,d,color,bone,rz=0,rx=0)=>{const g=new T.BoxGeometry(w,h,d);g.rotateZ(rz);g.rotateX(rx);g.translate(x,y,z);add(g,color,bone);};
 const helmet=(color,rx=.137,ry=.173,rz=.129)=>ellipsoid(0,1.675,.003,rx,ry,rz,color,'head',16);
 const faceMask=color=>{const shape=new T.Shape();shape.moveTo(-.093,.074);for(const [x,y]of [[-.101,.02],[-.074,-.09],[0,-.12],[.074,-.09],[.101,.02],[.093,.074]])shape.lineTo(x,y);shape.closePath();const source=new T.ExtrudeGeometry(shape,{depth:.03,bevelEnabled:false,steps:1}),g=mergeVertices(source);source.dispose();g.translate(0,1.68,-.17);add(g,color,'head');};
 const visor=(color,w=.19,h=.053,z=-.13)=>{panel(0,1.698,z,w,h,.025,dark,'head');panel(0,1.7,z-.017,w*.9,h*.7,.012,color,'head');};
 const mantle=(color,length=.48,width=.23)=>{for(const s of [-1,1])plate(s*width*.48,1.34-length*.5,.177,width*.88,length,.027,color,'chest',-s*.08,-.12);};
 const shoulders=(color,width=.14)=>{for(const s of [-1,1])plate(s*.27,1.414,0,width,.084,.17,color,s<0?'armL':'armR',s*.22);};
 const hood=()=>{const g=new T.SphereGeometry(1,16,10,0,Math.PI,0,Math.PI*.74);g.scale(.153,.188,.156);g.translate(0,1.68,0);add(g,c.cloth,'head');for(const s of [-1,1])plate(s*.123,1.675,-.046,.055,.25,.14,c.cloth,'head',-s*.18);plate(0,1.819,-.057,.17,.038,.15,c.cloth,'head');};
 const bracers=color=>{for(const s of [-1,1])plate(s*.405,1.04,-.034,.085,.18,.085,color,s<0?'forearmL':'forearmR',s*.16);};
 if(model?.startsWith('guard-')){
  if(model==='guard-nyx'){helmet(dark);hood();faceMask(dark);for(const s of [-1,1])plate(s*.035,1.702,-.183,.075,.012,.012,trim,'head',s*.62);}
  else{helmet(armor);visor(trim,.20,.06,-.145);panel(0,1.611,-.13,.10,.054,.035,dark,'head');}
  rings([[1.45,.092,.08],[1.525,.084,.08]],dark,'neck');shoulders(armor,.13);bracers(c.cloth);panel(0,1.385,-.187,.072,.025,.013,trim,'chest');for(const s of [-1,1])plate(s*.12,.51,-.095,.08,.05,.012,trim,s<0?'shinL':'shinR');
 }else if(model==='voss'){
  helmet(armor);faceMask(trim);plate(0,1.655,-.182,.018,.18,.014,dark,'head');
  for(const s of [-1,1]){plate(s*.048,1.713,-.183,.062,.014,.014,'#83e1e2','head',s*.12);plate(s*.055,1.588,-.152,.072,.036,.045,armor,'head',s*.35);}
  rings([[1.786,.139,.128],[1.827,.14,.128]],trim,'head');
  for(let i=0;i<5;i++){const a=(i-2)*.45,x=Math.sin(a)*.14,z=-Math.cos(a)*.13,g=new T.ConeGeometry(.029,i===2?.105:.075,4);g.translate(x,1.84+(i===2?.025:.01),z);add(g,trim,'head');}
  shoulders(armor,.18);for(const s of [-1,1]){plate(s*.095,1.318,-.172,.177,.22,.036,armor,'chest',-s*.10);for(let j=0;j<5;j++)ellipsoid(s*(.065+j*.044),1.455,.025,.039,.037,.08,'#cfc3a3','chest',6);}
  plate(0,1.265,-.203,.082,.082,.012,trim,'chest',Math.PI/4);bracers(armor);mantle(c.cloth,.48);for(const s of [-1,1])plate(s*.12,.5,-.104,.108,.13,.036,armor,s<0?'shinL':'shinR');
 }else if(model==='rook'){
  helmet(armor,.147,.171,.143);visor(trim,.227,.094,-.13);panel(0,1.602,-.128,.121,.07,.045,armor,'head');for(let j=-2;j<=2;j++)panel(j*.018,1.61,-.156,.009,.035,.009,dark,'head');
  for(const s of [-1,1]){ellipsoid(s*.151,1.691,.007,.025,.061,.058,dark,'head');ellipsoid(s*.173,1.691,.007,.01,.036,.034,'#5acbdf','head');}
  shoulders(armor,.185);panel(0,1.3,-.176,.33,.245,.049,armor,'chest');panel(0,1.31,-.206,.014,.13,.012,'#dcd8c3','chest');panel(0,1.34,-.207,.076,.013,.012,'#dcd8c3','chest');
  for(const s of [-1,1])plate(s*.032,1.267,-.206,.075,.018,.015,'#dcd8c3','chest',s*.46);
  const anchor=new T.TorusGeometry(.021,.007,4,10);anchor.rotateX(Math.PI/2);anchor.translate(0,1.387,-.207);add(anchor,'#dcd8c3','chest');
  rings([[1.46,.09,.083],[1.485,.094,.083],[1.504,.085,.08]],dark,'neck');bracers(armor);for(const s of [-1,1])plate(s*.12,.22,-.032,.115,.2,.11,armor,s<0?'shinL':'shinR');
 }else if(model==='nyx'){
  helmet(dark,.127,.171,.122);hood();faceMask(dark);for(const s of [-1,1])plate(s*.035,1.702,-.183,.08,.014,.015,trim,'head',s*.62);
  rings([[1.397,.22,.164],[1.49,.105,.10],[1.529,.09,.094]],c.cloth,'chest');plate(0,1.29,-.191,.04,.28,.024,trim,'chest',-.56);shoulders(armor,.13);bracers(c.cloth);mantle(c.cloth,.55,.19);
  for(const s of [-1,1])plate(s*.12,.57,-.08,.039,.21,.016,trim,s<0?'shinL':'shinR');
 }else if(model==='pulse'){
  const hair=new T.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.46);hair.scale(.12,.164,.112);hair.translate(0,1.669,.005);add(hair,dark,'head');
  for(let j=0;j<5;j++){const g=new T.ConeGeometry(.043,.095-j*.008,4);g.rotateX(-.28);g.translate(0,1.828-j*.009,-.06+j*.032);add(g,c.hair,'head');}
  ellipsoid(-.13,1.68,.005,.022,.039,.04,armor,'head');panel(-.15,1.68,.002,.012,.019,.03,'#73e9e0','head');
  plate(0,1.295,-.197,.04,.29,.021,trim,'chest',-.62);rings([[1.438,.09,.082],[1.489,.087,.075]],trim,'neck');
  panel(-.407,1.075,-.08,.091,.1,.037,trim,'forearmL');panel(-.407,1.077,-.103,.066,.065,.01,'#73e9e0','forearmL');shoulders(c.cloth,.115);
 }else if(model==='wren'){
  const hair=new T.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI*.53);hair.scale(.124,.172,.119);hair.translate(0,1.669,.015);add(hair,c.hair,'head');
  ellipsoid(.04,1.703,.141,.05,.055,.072,c.hair,'head');ellipsoid(.04,1.648,.182,.041,.097,.034,c.hair,'head');
  for(const s of [-1,1]){ellipsoid(s*.055,1.778,-.096,.044,.035,.022,dark,'head');ellipsoid(s*.055,1.778,-.114,.034,.025,.008,'#dda54d','head');plate(s*.085,1.371,-.172,.035,.19,.033,'#d6cdb6','chest',-s*.32);}
  rings([[1.448,.096,.084],[1.489,.09,.08]],trim,'neck');plate(-.1,1.281,-.21,.073,.3,.022,trim,'chest',-.24);
  plate(-.274,1.436,0,.14,.069,.16,'#d6cdb6','armL',-.18);for(const s of [-1,1])plate(s*.12,.497,-.102,.11,.1,.019,'#d6cdb6',s<0?'shinL':'shinR');
 }else if(model==='morrow'){
  helmet(dark,.127,.171,.122);hood();faceMask('#d4cbb1');for(const s of [-1,1])plate(s*.04,1.697,-.183,.049,.012,.012,trim,'head',s*.1);
  panel(0,1.618,-.183,.055,.035,.012,armor,'head');plate(-.12,1.238,-.205,.30,.36,.021,c.cloth,'chest',-.14);plate(-.12,1.238,.195,.30,.36,.021,c.cloth,'chest',-.14);
  for(let j=0;j<3;j++)plate(-.24+j*.025,1.42-j*.027,-.02,.075,.10,.06,armor,'armL',-.45);bracers(trim);for(const s of [-1,1])for(let j=0;j<3;j++)plate(s*.12,.25+j*.07,-.05,.104,.025,.087,c.cloth,s<0?'shinL':'shinR');
 }
}
