import {createAnatomyRetarget,retargetAnatomy} from './anatomy-retarget.js';
import {leanAmount,LEAN} from './stance.js';
import {emotePose} from './emotes.js';
import {groundAt} from './terrain.js';
import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {shopItem} from './shop-catalog.js';
import {addOperatorDesign} from './operator-designs.js';
import {surfaceUV,surfaceAtlasMaterial} from './model-surfaces.js';
import {strideProfile,strideFoot,pelvisTurn} from './operator-motion.js';
import {equipPose} from './equip.js';
import {animateCharacterMotion} from './character-motion.js';
import {operatorAsset,loadOperatorLod} from './operator-assets.js';

// One anatomical bind pose and skeleton contract for every cosmetic. Distances
// are metres. Rigid gear and clothing are cosmetic; physics never reads this mesh.
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const defs=[['root',null,[0,0,0]],['hips','root',[0,.93,0]],['spine','hips',[0,1.09,0]],['chest','spine',[0,1.32,0]],['neck','chest',[0,1.52,0]],['head','neck',[0,1.64,0]]];
for(const side of [-1,1]){const s=side<0?'L':'R';defs.push(
 [`shoulder${s}`,'chest',[side*.235,1.43,0]],[`arm${s}`,`shoulder${s}`,[side*.285,1.42,0]],
 [`forearm${s}`,`arm${s}`,[side*.39,1.14,.012]],[`hand${s}`,`forearm${s}`,[side*.44,.88,0]],
 [`thigh${s}`,'hips',[side*.115,.9,0]],[`shin${s}`,`thigh${s}`,[side*.12,.49,-.015]],
 [`foot${s}`,`shin${s}`,[side*.12,.09,0]],[`toe${s}`,`foot${s}`,[side*.12,.055,-.13]]);
 for(let i=0;i<5;i++)defs.push([`finger${s}${i}`,`hand${s}`,[side*(.435+(i===4?-.041:(i-1.5)*.016)),.833, i===4?-.025:0]]);
}
export const HUMANOID_BONES=Object.freeze(defs.map(d=>d[0]));
const ids=Object.fromEntries(defs.map((d,i)=>[d[0],i])),points=Object.fromEntries(defs.map(d=>[d[0],V(...d[2])]));
const geometries=new Map();
function template(profile){
 const outfit=shopItem(profile.outfit),item=profile.henchman&&outfit?{...outfit,model:'guard-'+outfit.model}:outfit,style=item?.shape??0,baseSkin=(item?.model?.startsWith('guard-')||['voss','rook','nyx','morrow'].includes(item?.model))?'#121c23':item?.skin||['#c58a65','#754b37','#d7a47f','#a86d4f','#dfb696','#543728'][style%6];
 const skin=profile.infectedSkin||baseSkin;
 const colors={cloth:item?.color||profile.color||'#334952',trim:item?.accent||profile.accent||'#e8ae4c',skin:profile.infectedSkin||skin,armor:item?.armor||'#243039',dark:'#121c23',sole:'#11171b',hair:item?.hair||['#241b19','#161619','#302620','#3e2b21'][style%4]};
 if(profile.teamColor){colors.cloth=profile.teamColor;colors.trim=profile.teamColor;}
 const trouser=new T.Color(item?.model?colors.armor:colors.cloth).multiplyScalar(.84),seam=new T.Color(colors.cloth).multiplyScalar(.68);
 colors.cloth=new T.Color(colors.cloth).lerp(new T.Color('#43504b'),item?.model?0:item?.12:.58).getStyle();colors.trim=new T.Color(colors.trim).lerp(new T.Color('#b7b099'),item?.model?0:.25).getStyle();
 const key=JSON.stringify([colors,style,item?.model,profile.infectedType]);if(geometries.has(key))return geometries.get(key);
 let harvestHead=false;
 const parts=[],finishes=new Set(),light=['wren','pulse'].includes(item?.model),signature=item?.rankReward||['hollow-jack','voss','rook','nyx','wren','pulse','morrow'].includes(item?.model),leather=item?.model==='wren'?'#604331':colors.dark;
 function finishFor(color,bone){const value=color?.isColor?color.getHexString():new T.Color(color).getHexString();if(value===new T.Color(colors.dark).getHexString())return bone.startsWith('hand')||bone.startsWith('finger')||bone.startsWith('foot')?'leather':'polymer';if(value===new T.Color(skin).getHexString())return 'skin';if(value===new T.Color(colors.hair).getHexString())return 'cloth';if(value===new T.Color(colors.sole).getHexString())return 'rubber';if(value===new T.Color(colors.armor).getHexString())return 'polymer';return 'cloth';}
 function add(g,color,bone,next=null,blend=null,finish=null){
  if(item?.model==='hollow-jack'&&bone==='head'&&!harvestHead){g.dispose();return;}
  if(bone==='head'){g.translate(0,-1.666,0);g.scale(1,1,1);g.translate(0,1.666,0);}
  finish??=finishFor(color,bone);surfaceUV(g,finish);finishes.add(finish);
  const n=g.attributes.position.count,c=new T.Color(color),rgb=new Float32Array(n*3),index=new Uint16Array(n*4),weights=new Float32Array(n*4);
  for(let i=0;i<n;i++){const p=g.attributes.position,shade=finish==='skin'?1-.045*Math.max(0,-g.attributes.normal.getY(i)):finish==='cloth'?1-.025*Math.sin(p.getY(i)*155+p.getX(i)*48):1;rgb.set([c.r*shade,c.g*shade,c.b*shade],i*3);const t=blend?blend(p,i):0;index[i*4]=ids[bone];index[i*4+1]=ids[next||bone];weights[i*4]=1-t;weights[i*4+1]=t;}
  g.setAttribute('color',new T.BufferAttribute(rgb,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(index,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));parts.push(g);
 }
 function ellipsoid(x,y,z,rx,ry,rz,color,bone,detail=10,finish=null){const g=new T.SphereGeometry(1,detail,Math.max(6,detail-4));g.scale(rx,ry,rz);g.translate(x,y,z);add(g,color,bone,null,null,finish);}
 function panel(x,y,z,w,h,d,color,bone,finish=null){const g=Math.min(w,h,d)<.035?new T.BoxGeometry(w,h,d):mergeVertices(new RoundedBoxGeometry(w,h,d,1,Math.min(w,h,d)*.22));g.translate(x,y,z);add(g,color,bone,null,null,finish);}
 function rings(rows,color,bone,next=null,finish=null){const pos=[],uv=[],ind=[],sides=16;
  for(let j=0;j<rows.length;j++){const [y,rx,rz,cx=0,cz=0]=rows[j];for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;pos.push(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);uv.push(i/sides,j/(rows.length-1));if(j<rows.length-1&&i<sides){const k=j*(sides+1)+i;ind.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();add(g,color,bone,next,next?(p,i)=>T.MathUtils.smoothstep(p.getY(i),rows[0][0],rows.at(-1)[0])*.8:null,finish);
 }
 function limb(a,b,radii,color,bone,next){const A=points[a],B=points[b],delta=B.clone().sub(A),length=delta.length();
  const g=new T.LatheGeometry(radii.map(([t,r])=>new T.Vector2(r,t*length)),12);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),delta.clone().normalize()));g.translate(A.x,A.y,A.z);add(g,color,bone,next,(p,i)=>{const t=V(p.getX(i),p.getY(i),p.getZ(i)).sub(A).dot(delta)/(length*length);return next?T.MathUtils.smoothstep(t,.72,1)*.48:0;});
 }
 // Shaped hips, abdomen, ribcage and clavicles, underneath fitted outerwear.
 rings([[.84,.13,.10],[.88,.18,.12],[.98,.178,.115],[1.04,light?.137:.15,.10],[1.1,light?.137:.153,.105],[1.18,light?.171:.18,.12],[1.3,light?.22:.241,.145],[1.39,light?.232:.25,.13],[1.46,.195,.09],[1.49,.10,.07]],light?colors.armor:colors.cloth,'hips','chest','cloth');
 if(!signature)rings([[1.02,.161,.105],[1.06,.174,.12],[1.19,.203,.144],[1.34,.23,.15],[1.41,.22,.125],[1.435,.17,.095]],style%3===2?colors.cloth:colors.armor,'spine','chest');
 // Shoulder straps, segmented carrier panels and fitted collar.
 for(const s of [-1,1]){
  if(!signature){
  panel(s*.098,1.30,-.145,.158,.188,.030,colors.armor,'chest');
  panel(s*.099,1.365,-.166,.125,.012,.008,colors.cloth,'chest');
  panel(s*.080,1.12,-.145,.127,.108,.043,colors.cloth,'spine');
  panel(s*.08,1.16,-.170,.109,.023,.008,colors.armor,'spine');
  ellipsoid(s*.18,1.397,-.095,.037,.073,.033,colors.trim,'chest');
  ellipsoid(s*.265,1.42,.0,.068,.067,.071,colors.cloth,`arm${s<0?'L':'R'}`);
  panel(s*.074,1.255,-.163,.116,.011,.008,colors.dark,'chest');
  panel(s*.074,1.232,-.163,.116,.011,.008,colors.dark,'chest');
  }else ellipsoid(s*(light?.26:.265),1.42,0,light?.06:.068,.065,.069,colors.cloth,`arm${s<0?'L':'R'}`);
 }
 panel(0,.997,-.11,.29,.038,.015,colors.dark,'hips','leather');panel(0,.997,-.125,.042,.032,.012,colors.trim,'hips','metal');
 for(const x of [-.125,-.06,.06,.125])panel(x,1.002,-.12,.013,.046,.012,colors.cloth,'hips');
 rings([[1.425,.088,.073],[1.465,.088,.073],[1.48,.07,.064]],colors.dark,'neck');
 ellipsoid(0,1.515,0,.064,.082,.062,colors.skin,'neck');
 // Sculpted cranium: jaw narrows below cheeks, recessed temples, defined brow.
 const head=new T.SphereGeometry(1,28,20),hp=head.attributes.position;
 for(let i=0;i<hp.count;i++){let x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i);const jaw=y<-.18?(light?.74:.80)+.18*(y+1)/.82:1;const front=Math.max(0,-z),cheek=(y>-.2&&y<.15?Math.sin((y+.2)/.35*Math.PI)*.006:0);hp.setXYZ(i,x*(light?.111:.118)*jaw+Math.sign(x)*cheek*front,1.666+y*.162,z*.109-(y>-.1&&y<.25?.008*front:0));}head.computeVertexNormals();add(head,skin,'head',null,null,'skin');
 ellipsoid(0,1.553,-.035,.066,.026,.057,skin,'head');
 for(const side of [-1,1]){
  ellipsoid(side*.118,1.667,.0,.019,.038,.023,skin,'head');
  ellipsoid(side*.044,1.692,-.101,.029,.012,.012,skin,'head');
  ellipsoid(side*.044,1.695,-.111,.019,.005,.004,'#d6cec4','head',10,'glass');
  ellipsoid(side*.044,1.695,-.115,.006,.005,.003,'#354c4b','head',10,'glass');
  ellipsoid(side*.044,1.695,-.118,.0027,.0037,.0015,'#101c20','head',8,'glass');
  ellipsoid(side*.042,1.697,-.119,.0013,.0012,.001,'#edf3e6','head',8,'glass');
  ellipsoid(side*.125,1.667,-.011,.008,.025,.012,new T.Color(skin).multiplyScalar(.79),'head',8,'skin');
  ellipsoid(side*.045,1.716,-.099,.035,.006,.01,colors.hair,'head');
 }
 ellipsoid(0,1.668,-.115,.016,.037,.021,skin,'head');ellipsoid(0,1.646,-.132,.02,.012,.016,skin,'head');
 ellipsoid(0,1.61,-.098,.035,.005,.006,'#875447','head');ellipsoid(0,1.599,-.094,.03,.004,.005,skin,'head');
 // Cheek planes, lower eyelids, lips and nasolabial folds retain a readable face.
 for(const side of [-1,1]){
  ellipsoid(side*.071,1.65,-.078,.037,.029,.022,skin,'head',14);
  ellipsoid(side*.043,1.682,-.107,.024,.003,.004,new T.Color(skin).multiplyScalar(.84),'head');
  ellipsoid(side*.017,1.639,-.121,.01,.005,.009,new T.Color(skin).multiplyScalar(.72),'head');
  if(!signature){panel(side*.142,1.32,-.165,.043,.22,.03,'#4b5350','chest','cloth');
  for(let row=0;row<4;row++)panel(side*.09,1.235+row*.031,-.19,.126,.012,.012,'#3b4847','chest');
  panel(side*.085,1.125,-.178,.117,.16,.053,colors.armor,'spine');
  panel(side*.083,1.195,-.205,.093,.027,.014,colors.cloth,'spine');
  panel(side*.205,1.38,.02,.044,.155,.07,colors.armor,'chest');
  }
  panel(side*.22,.91,-.02,.077,.125,.076,colors.armor,'hips');
  panel(side*.117,.63,-.066,.012,.23,.012,seam,side<0?'thighL':'thighR');
 }
 if(!signature){panel(.143,1.4,-.123,.038,.068,.035,'#1b2b33','chest','polymer');
 panel(.15,1.455,-.114,.008,.09,.008,'#18272b','chest','polymer');
 panel(-.07,1.39,-.172,.068,.027,.008,colors.trim,'chest','paint');}
 // Close-cropped hair or fitted field helmet, all following the same head bone.
 if(!item?.model){
 const helmet=style%4!==2;
 const hair=new T.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI*(helmet?.60:.49));hair.scale(helmet?.13:.12,helmet?.171:.166,.116);hair.translate(0,1.669,.005);add(hair,helmet?colors.armor:colors.hair,'head');
 if(helmet){for(const side of [-1,1]){panel(side*.129,1.74,.012,.021,.07,.09,colors.cloth,'head');panel(side*.095,1.606,-.025,.013,.092,.018,colors.armor,'head');ellipsoid(side*.133,1.674,.008,.025,.042,.03,colors.armor,'head');}panel(0,1.799,-.09,.041,.04,.02,colors.dark,'head');if(style===6){panel(0,1.687,-.119,.192,.033,.022,'#b98147','head');panel(0,1.611,-.091,.156,.08,.05,colors.dark,'head');}
 ellipsoid(0,1.745,-.093,.088,.014,.038,colors.trim,'head');for(const s of [-1,1])ellipsoid(s*.12,1.67,.007,.024,.035,.025,colors.dark,'head');}
 if(style===6){const hood=new T.SphereGeometry(1,16,12,5.4,4.9,0,Math.PI*.72);hood.scale(.157,.189,.153);hood.translate(0,1.676,.027);add(hood,colors.dark,'head');rings([[1.34,.22,.17],[1.4,.235,.16],[1.48,.14,.13],[1.53,.105,.105]],colors.dark,'chest');}
 if(style%6===4)ellipsoid(0,1.617,-.093,.08,.04,.035,colors.cloth,'head');
 }else addOperatorDesign(item,colors,{add,panel,ellipsoid,rings});
 for(const side of [-1,1]){const s=side<0?'L':'R';
  limb('arm'+s,'forearm'+s,[[0,.062],[.12,.074],[.28,.07],[.32,.073],[.38,.068],[.6,.061],[.66,.064],[.75,.049],[.85,.052],[.93,.044],[1,.045]],colors.cloth,'arm'+s,'forearm'+s);
  ellipsoid(side*.39,1.14,.012,.047,.048,.048,colors.cloth,'forearm'+s);
  const bare=light||(!item?.model&&style%3===0);limb('forearm'+s,'hand'+s,bare?[[0,.046],[.2,.055],[.5,.047],[.8,.033],[1,.031]]:[[0,.046],[.2,.055],[.3,.052],[.34,.054],[.5,.05],[.62,.044],[.68,.047],[.8,.037],[.87,.039],[1,.031]],bare?skin:colors.cloth,'forearm'+s,'hand'+s);
  ellipsoid(side*.405,1.065,-.028,.043,.058,.025,item?.model==='wren'?leather:colors.armor,'forearm'+s,10,item?.model==='wren'?'leather':null);
  ellipsoid(side*.44,.86,0,.042,.057,.027,leather,'hand'+s,10,'leather');
  for(let i=0;i<5;i++){const b='finger'+s+i,P=points[b];const curve=new T.CatmullRomCurve3([P.clone(),P.clone().add(V(side*.002,-.026,-.008)),P.clone().add(V(side*.002,-.042,-.025)),P.clone().add(V(0,-.032,-.033))]);add(new T.TubeGeometry(curve,5,i===4?.01:.008,5,false),leather,b,null,null,'leather');}
  limb('thigh'+s,'shin'+s,[[0,.094],[.13,.103],[.35,.095],[.4,.098],[.45,.092],[.60,.081],[.66,.084],[.72,.076],[.79,.074],[.82,.077],[.86,.069],[.94,.068],[1,.062]],trouser,'thigh'+s,'shin'+s);
  limb('shin'+s,'foot'+s,[[0,.062],[.14,.071],[.2,.068],[.26,.071],[.45,.063],[.54,.055],[.59,.061],[.65,.053],[.70,.055],[.76,.052],[.81,.045],[.88,.048],[1,.042]],trouser,'shin'+s,'foot'+s);
  panel(side*.12,.495,-.068,.105,.122,.037,colors.armor,'shin'+s);
  panel(side*.12,.51,-.09,.074,.054,.009,seam,'shin'+s);
  panel(side*.202,.78,.006,.044,.146,.127,trouser,'thigh'+s);
  panel(side*.226,.824,.006,.012,.03,.117,seam,'thigh'+s);
  ellipsoid(side*.12,.145,.004,.05,.099,.059,leather,'foot'+s,10,'leather');
  ellipsoid(side*.12,.055,-.065,.055,.054,.125,leather,'foot'+s,10,'leather');
  ellipsoid(side*.12,.024,-.065,.059,.022,.13,colors.sole,'foot'+s);
  for(let j=0;j<3;j++)ellipsoid(side*.12,.099-j*.011,-.063-j*.018,.04,.006,.006,item?.model==='wren'?'#947555':colors.trim,'foot'+s,8,'leather');
  // Boot construction, reinforced glove knuckles and sewn cargo closures are
  // real geometry, not extra scene objects or additional character draw calls.
  panel(side*.12,.177,-.048,.086,.047,.008,item?.model==='wren'?leather:colors.armor,'foot'+s,'leather');
  for(let j=0;j<3;j++)panel(side*.12,.129+j*.025,.06,.080,.009,.012,leather,'foot'+s,'leather');
  for(let j=0;j<4;j++)for(const edge of [-1,1])panel(side*.12+edge*.047,.022,-.14+j*.052,.014,.025,.025,colors.sole,'foot'+s,'rubber');
  panel(side*.44,.87,-.026,.055,.025,.008,item?.model==='wren'?leather:colors.armor,'hand'+s,item?.model==='wren'?'leather':'polymer');
  for(let j=0;j<3;j++)panel(side*.44+(j-1)*.016,.838,-.016,.011,.014,.009,item?.model==='wren'?leather:colors.armor,'hand'+s,item?.model==='wren'?'leather':'polymer');
  panel(side*.226,.79,-.038,.009,.09,.014,colors.dark,'thigh'+s,'leather');
  panel(side*.226,.813,-.050,.013,.025,.008,colors.trim,'thigh'+s,'metal');
  // Tailored elbow darts, knee-pad edging and articulated ankle cuffs.
  // These join the existing skinned mesh and share its surface atlas.
  panel(side*.12,.545,-.084,.084,.012,.009,colors.cloth,'shin'+s,'cloth');
  panel(side*.12,.447,-.083,.078,.010,.008,colors.dark,'shin'+s,'rubber');
  for(const edge of [-1,1])panel(side*.12+edge*.043,.49,-.083,.006,.08,.007,colors.cloth,'shin'+s,'cloth');
  panel(side*.12,.223,-.037,.076,.014,.012,seam,'shin'+s,'cloth');
  panel(side*.373,1.192,-.04,.043,.009,.006,seam,'forearm'+s,'cloth');
  panel(side*.378,1.173,-.04,.041,.007,.006,colors.cloth,'forearm'+s,'cloth');
 }
 if(!signature){for(const side of [-1,1]){
  panel(side*.105,1.32,.132,.148,.19,.025,colors.armor,'chest','polymer');
  panel(side*.11,1.305,.149,.118,.009,.006,colors.cloth,'chest','cloth');
  panel(side*.147,1.398,.083,.036,.07,.018,colors.cloth,'chest','cloth');
 }}
 // Tailored seams/zipper stay inexpensive even in the 48-combatant match.
 for(const side of [-1,1])for(let row=0;row<6;row++)panel(side*.155,1.075+row*.025,-.112,.003,.015,.003,seam,'spine','cloth');
 if(!item?.model){panel(0,1.19,-.169,.009,.27,.005,colors.dark,'spine','metal');panel(0,1.324,-.175,.016,.025,.006,colors.trim,'chest','metal');}
 if(profile.infectedType){for(const x of [-.044,.044])ellipsoid(x,1.695,-.121,.012,.005,.002,'#dec992','head',8,'glass');for(let n=0;n<4;n++)panel(-.073+n*.009,1.64+n*.014,-.106,.006,.033,.007,'#66483e','head','skin');for(let n=0;n<6;n++)panel(.1,1.19+n*.025,-.203,.08,.01,.01,'#514c39','chest','cloth');if(['armored','heavy','elite','boss','colossus'].includes(profile.infectedType)){panel(0,1.3,-.2,.39,.3,.09,'#52615a','chest','metal');for(const side of [-1,1])panel(side*.27,1.43,0,.18,.1,.23,'#616b5d','arm'+(side<0?'L':'R'),'metal');}if(['disruptor','boss','mimic'].includes(profile.infectedType))for(const side of [-1,1])ellipsoid(side*.19,1.44,.1,.07,.15,.07,'#677f78','chest',8,'skin');}
 if(profile.infectedType){
  const type=profile.infectedType;
  if(type==='armored'){panel(0,1.39,-.25,.42,.46,.08,'#526f6a','chest','metal');panel(0,1.7,-.135,.21,.1,.08,'#65766a','head','metal');}
  if(type==='runner'){for(const side of [-1,1])panel(side*.18,1.32,-.18,.045,.23,.02,'#d6a365','chest','cloth');}
  if(type==='heavy'||type==='colossus'){for(const side of [-1,1]){ellipsoid(side*.31,1.43,0,.15,.16,.17,'#657367','arm'+(side<0?'L':'R'),10,'skin');panel(side*.43,.97,0,.17,.2,.18,'#475956','forearm'+(side<0?'L':'R'),'metal');}panel(0,1.62,.17,.3,.46,.14,'#586d60','chest','metal');}
  if(type==='leaper'){for(const side of [-1,1]){panel(side*.12,.55,-.06,.11,.15,.07,'#59655e','shin'+(side<0?'L':'R'),'cloth');for(let n=0;n<3;n++)panel(side*(.425+n*.018),.79,-.015,.012,.09,.02,'#b7baa0','hand'+(side<0?'L':'R'),'metal');}}
  if(type==='disruptor'||type==='boss'){for(let n=0;n<5;n++)ellipsoid(-.14+n*.07,1.45,.19,.035,.11+n%2*.06,.055,'#80b2ac','chest',8,'glass');}
  if(type==='elite'){panel(0,1.72,-.13,.25,.2,.06,'#6d4041','head','metal');panel(0,1.46,.18,.32,.45,.1,'#743d43','chest','cloth');}
  if(type==='mimic'){ellipsoid(0,1.36,.19,.21,.24,.13,'#866866','chest',10,'skin');for(const side of [-1,1])panel(side*.44,.88,-.06,.1,.2,.09,'#6f655b','hand'+(side<0?'L':'R'),'skin');}
  if(type==='boss'){for(const side of [-1,1])panel(side*.32,1.48,0,.2,.25,.3,'#3e5960','arm'+(side<0?'L':'R'),'metal');panel(0,1.76,.01,.25,.1,.24,'#a2aa86','head','metal');}
 }
 if(item?.model==='hollow-jack'){
  harvestHead=true;
  for(let j=0;j<10;j++){const a=j*Math.PI/5;ellipsoid(Math.cos(a)*.105,1.70,Math.sin(a)*.105,.115,.205,.115,j%2?'#c25a17':'#e7781f','head',14,'paint');}
  ellipsoid(0,1.70,0,.20,.19,.20,'#d86a1d','head',16,'paint');
  panel(0,1.915,0,.052,.12,.05,'#514331','head','wood');
  const face=(pts)=>{const shape=new T.Shape(pts.map(p=>new T.Vector2(...p))),g=new T.ShapeGeometry(shape);g.rotateY(Math.PI);g.translate(0,0,-.211);add(g,'#ffdd72','head',null,null,'paint');};
  for(const s of [-1,1])face([[s*.045,1.73],[s*.145,1.76],[s*.12,1.665]]);
  face([[-.035,1.65],[.035,1.65],[0,1.70]]);
  face([[-.145,1.615],[-.075,1.59],[-.05,1.615],[0,1.585],[.04,1.61],[.075,1.59],[.145,1.62],[.105,1.55],[.035,1.53],[-.055,1.535],[-.12,1.56]]);
  rings([[.72,.25,.16],[.87,.21,.14],[1.02,.18,.13],[1.18,.20,.15],[1.39,.26,.15]],'#33263f','hips','chest','cloth');
  for(const s of [-1,1]){panel(s*.13,1.29,-.153,.10,.30,.027,'#51384c','chest');panel(s*.14,1.22,-.178,.035,.042,.015,'#b28a50','chest','metal');panel(s*.21,.78,-.09,.065,.20,.04,'#51384c','hips');}
  for(const y of [1.08,1.16,1.25,1.34])ellipsoid(0,y,-.17,.015,.015,.008,'#bb8d4b','chest',8,'metal');
  rings([[1.44,.12,.10],[1.49,.105,.085],[1.52,.09,.075]],'#bd7d32','neck',null,'cloth');
 }
 const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());geo.computeBoundingSphere();geo.userData.shared=true;geo.userData.artRevision=166;geo.userData.surfaceKinds=[...finishes];geometries.set(key,geo);return geo;
}
export function makeHumanoid(profile={}){
 const root=new T.Group();root.name='Ravelfront operator';const bones={},list=[];
 for(const [name,parent,xyz]of defs){const b=new T.Bone();b.name=name;const rest=V(...xyz).sub(parent?points[parent]:V());b.position.copy(rest);b.userData.rest=rest.clone();bones[name]=b;list.push(b);if(parent)bones[parent].add(b);}
 const asset=operatorAsset(profile);
 if(asset)for(const [name,parent]of defs){if(!asset.joints[name])throw Error(`Missing ${asset.id} joint ${name}`);const b=bones[name];b.position.copy(asset.joints[name]).sub(parent?asset.joints[parent]:V());b.userData.rest.copy(b.position);}
 const geometry=asset?asset.geometry:template(profile);
 if(asset&&!geometry.userData.remapped){const skin=geometry.attributes.skinIndex;for(let i=0;i<skin.array.length;i++)skin.array[i]=ids[asset.names[skin.array[i]]];geometry.userData.remapped=true;}
 const mesh=new T.SkinnedMesh(geometry,asset?asset.materials:surfaceAtlasMaterial());mesh.name=asset?`${asset.id} · authored Blender model`:'Skinned operator';mesh.add(bones.root);mesh.updateMatrixWorld(true);mesh.bind(new T.Skeleton(list));mesh.boundingSphere=new T.Sphere(new T.Vector3(0,.9,0),2);mesh.frustumCulled=true;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);root.userData.artRevision=asset?216:166;
 root.userData.human={mesh,bones,clock:0,phase:0,speed:0,previous:null,grounded:true,land:0,air:0,death:0,lastYaw:null,pose:'idle',nextUpdate:0};root.userData.cracks=[];
 if(asset){const h=root.userData.human;h.asset=asset;h.retarget=createAnatomyRetarget(defs,points,asset.joints);h.soleHeight=asset.joints.footL.y;h.motionRootOffset=bones.hips.userData.rest.y-.93;h.motionLegLength=bones.shinL.userData.rest.length()+bones.footL.userData.rest.length()-.02;root.userData.asset=asset.id;loadOperatorLod(asset.id);}
 return root;
}
// Analytic two-bone IK. Targets are in character coordinates. Elbow/knee poles
// remain on the anatomical side; fixed limb lengths prevent stretching.
// Pose evaluation is synchronous. Reuse scratch math across chains; no pose
// retains these objects, so this also bounds garbage collection during combat.
const ik={inverse:new T.Matrix4(),start:V(),dir:V(),normal:V(),elbow:V(),dest:V(),rest:V(),parentQ:new T.Quaternion(),modelQ:new T.Quaternion(),q:new T.Quaternion()};
function solveChain(h,upper,lower,end,target,pole,blend=1){
 const a=h.bones[upper],b=h.bones[lower],c=h.bones[end];h.mesh.updateWorldMatrix(true,false);
 const inverse=ik.inverse.copy(h.mesh.matrixWorld).invert(),start=a.getWorldPosition(ik.start).applyMatrix4(inverse),L1=b.userData.rest.length(),L2=c.userData.rest.length();
 const dir=ik.dir.copy(target).sub(start),len=T.MathUtils.clamp(dir.length(),.02,L1+L2-.002);dir.normalize();
 const normal=ik.normal.copy(pole).sub(start);normal.addScaledVector(dir,-normal.dot(dir)).normalize();
 const along=(L1*L1-L2*L2+len*len)/(2*len),height=Math.sqrt(Math.max(0,L1*L1-along*along)),elbow=ik.elbow.copy(start).addScaledVector(dir,along).addScaledVector(normal,height);
 h.mesh.getWorldQuaternion(ik.modelQ);
 const aim=(bone,rest,dest)=>{bone.parent.getWorldQuaternion(ik.parentQ);dest.applyQuaternion(ik.modelQ).applyQuaternion(ik.parentQ.invert()).normalize();ik.q.setFromUnitVectors(ik.rest.copy(rest).normalize(),dest);bone.quaternion.slerp(ik.q,blend);};
 aim(a,b.userData.rest,ik.dest.copy(elbow).sub(start));aim(b,c.userData.rest,ik.dest.copy(start).addScaledVector(dir,len).sub(elbow));
}
export function animateHumanoid(model,p={},dt=1/60,time=0,{menu=false,distance=0,scheduled=false,map=null}={}){
 const h=model.userData.human;if(!h)return;const soleY=h.soleHeight??.09;h.clock+=dt;
 if(h.asset){const a=!menu&&distance>36&&h.asset.lod?h.asset.lod:h.asset;if(!a.geometry.userData.remapped){const skin=a.geometry.attributes.skinIndex;for(let i=0;i<skin.array.length;i++)skin.array[i]=ids[a.names[skin.array[i]]];a.geometry.userData.remapped=true;}h.mesh.geometry=a.geometry;}
 // 60 Hz nearby, 20 Hz at distance, 10 Hz far away. Animation clocks continue.
 const interval=scheduled?0:distance>90?.1:distance>40?.05:0;if(h.clock<h.nextUpdate){h.skipped=(h.skipped||0)+dt;return;}dt=Math.min(.12,dt+(h.skipped||0));h.skipped=0;h.nextUpdate=h.clock+interval;
 // Layer from the bind pose each frame. Adding yaw onto last frame's residual
 // quaternion accumulated a permanent sideways twist (especially at low FPS).
 const b=h.bones;for(const bone of Object.values(b)){bone.position.copy(bone.userData.rest);bone.quaternion.identity();}
 const vx=p.vx||0,vz=p.vz||0,speed=Math.min(16,Math.hypot(vx,vz)),grounded=p.grounded!==false;
 // Models are first posed at the origin, then placed in the lobby or world.
 // A foot from that old location must never become an IK target at spawn.
 const lastRoot=h.contactTransform,scale=model.scale.x;
 if(!lastRoot||lastRoot.menu!==menu||lastRoot.scale!==scale||Math.hypot(model.position.x-lastRoot.x,model.position.y-lastRoot.y,model.position.z-lastRoot.z)>Math.max(.8,speed*dt*2+.25)){
  h.plantL=h.plantR=h.releaseL=h.releaseR=h.lastMotionFootL=h.lastMotionFootR=h.footTargetL=h.footTargetR=null;h.releasedL=h.releasedR=false;h.contactHeight=undefined;
 }
 const contactTransform=h.contactTransform??={};contactTransform.x=model.position.x;contactTransform.y=model.position.y;contactTransform.z=model.position.z;contactTransform.scale=scale;contactTransform.menu=menu;
 const terrainContact=!menu&&grounded&&!(p.vehicleId||p.zVehicle)&&map?.terrain&&Math.abs(p.y-groundAt(map,p.x,p.z))<.16;
 const placeFoot=foot=>{if(!terrainContact)return;const cs=Math.cos(model.rotation.y),sn=Math.sin(model.rotation.y),x=model.position.x+cs*foot.x+sn*foot.z,z=model.position.z-sn*foot.x+cs*foot.z;
  // Sample the sole, not just the capsule center: uphill toes otherwise cut
  // through elevated ground even when the physical player is above the mesh.
  const floor=Math.max(groundAt(map,x,z),groundAt(map,x-sn*.15,z-cs*.15),groundAt(map,x+sn*.1,z+cs*.1));foot.y+=T.MathUtils.clamp(floor-model.position.y+.015,-.3,.45);
 };
 h.speed+=(speed-h.speed)*(1-Math.exp(-dt*10));const gait=strideProfile(h.speed,p),cycleDistance=p.lobbyPatrol?.cycleDistance||gait.distance;h.phase+=speed*dt/cycleDistance*Math.PI*2;
 if(grounded&&!h.grounded)h.land=T.MathUtils.clamp(-(h.lastVy||0)/10,.15,1.5);h.lastVy=p.vy||0;h.grounded=grounded;h.land*=Math.exp(-dt*9);
 const airborne=['dive','glide','launch'].includes(p.flight),dead=p.health!==undefined&&p.health<=0;
 h.air+=(Number(airborne)-h.air)*(1-Math.exp(-dt*7));h.death+=(Number(dead)-h.death)*(1-Math.exp(-dt*6));
 const emote=p.emote?{id:p.emote.id,t:Math.max(0,time-p.emote.start)}:null;
 const throwing=p.throwProgress>=0&&p.throwProgress<=1;
 const previousPose=h.pose;h.lowerState=dead?'elimination':p.downed?(speed>.1?'crawling':'downed'):p.reviving?'reviving':p.sliding?'sliding':p.crouching?(speed>.1?'crouch-moving':'crouch-idle'):!grounded?(p.vy>0?'jump':'fall'):p.sprinting?'sprint':speed>.1?'walking':'standing';
 h.upperState=throwing?'throwing':p.downed?(p.reviverId?'being-revived':'downed'):p.reviving?'reviving':p.reloadEnd>time?'reloading':p.shotRecoil>.02?'firing':p.building?(p.editing?'editing':'building'):p.aim?'ads':'ready';
 h.pose=dead?'elimination':throwing?'throw':p.mantle?p.mantle.kind:emote?'emote-'+emote.id:p.downed?(p.reviverId?'being-revived':speed>.1?'crawling':'downed'):p.reviving?'reviving':p.sliding?'sliding':p.crouching?(speed>.1?'crouch-moving':'crouch-idle'):p.flight==='dive'?'skydive':p.flight==='glide'?'glide':!grounded?(p.vy>0?'jump':'fall'):p.building?(p.editing?'edit':'build'):p.use?'use':p.swingAt&&time-p.swingAt<.55?'melee':p.reloadEnd>time?'reload':p.equipUntil>time?(p.equipHolster&&time-p.equipStarted<p.equipHolster?'holster':'draw'):p.aim?'aim':p.sprinting?'sprint':h.speed>5.5?'run':h.speed>.2?'locomotion':'idle';
 if(previousPose!==h.pose){h.fromPose=previousPose;h.transition=0;}h.transition=Math.min(1,(h.transition||0)+dt*7);
 const forward=-vx*Math.sin(p.yaw||0)-vz*Math.cos(p.yaw||0),side=vx*Math.cos(p.yaw||0)-vz*Math.sin(p.yaw||0),moving=gait.moving;
 const blend=1-Math.exp(-dt*14);for(const [key,on]of [['crouch',p.crouching&&!p.sliding],['compact',p.lowCrouch],['slide',p.sliding],['down',p.downed],['revive',p.reviving]])h[key]=(h[key]||0)+(Number(!!on)-(h[key]||0))*blend;
 h.forward=(h.forward||0)+(forward-(h.forward||0))*blend;h.side=(h.side||0)+(side-(h.side||0))*blend;
 const motion=animateCharacterMotion(h,p,dt,time,{menu});
 if(motion&&h.retarget)retargetAnatomy(h.retarget,b);
 const acceleration=T.MathUtils.clamp((forward-h.forward)*.017,-.045,.045);
 const lower=Math.max(h.crouch*.53+h.compact*.29,h.slide*.87,h.down*.65,h.revive*.53);
 if(!motion){
 b.hips.position.y-=lower+.025*moving*(1-Math.max(h.slide,h.down,h.crouch))+h.land*.075+h.death*.58;
 b.hips.rotation.x=-.06*moving-acceleration-(p.tacticalSprint?.18:p.sprinting?.08:0)-h.crouch*.12+h.slide*.27-h.down*1.14-h.revive*.12+h.death*.85;
 const turn=Math.atan2(Math.sin((p.yaw||0)-(h.lastYaw??p.yaw??0)),Math.cos((p.yaw||0)-(h.lastYaw??p.yaw??0)))/Math.max(.016,dt);h.lastYaw=p.yaw||0;h.turn=(h.turn||0)+(turn-(h.turn||0))*blend;b.spine.rotation.z=T.MathUtils.clamp(-h.side*.008-h.turn*.005,-.07,.07);b.hips.rotation.y=T.MathUtils.clamp(h.turn*.008,-.07,.07);b.chest.rotation.y=Math.sin(h.phase)*.025*moving;b.chest.rotation.x=Math.sin(time*1.8)*.008+(p.lastDamage&&time-p.lastDamage<.18?-.09*(1-(time-p.lastDamage)/.18):0)+(p.shotRecoil||0)*.018;
 b.head.rotation.x=(menu?Math.sin(time*.7)*.025:(p.pitch||0)*.3)+h.down*1.04+h.revive*.14;
 if(menu){b.head.rotation.y=p.scan||0;b.chest.rotation.y+=(p.scan||0)*.3;}
 // Turn the pelvis into the stride while the shoulders retain aim. Feet are
 // still solved against their planted world targets; no cosmetic root motion.
 if(!menu&&!airborne&&!dead&&!emote&&!p.downed&&!p.sliding&&!p.vehicleId){
  const strideYaw=pelvisTurn(h.forward,h.side,moving);h.strideYaw=(h.strideYaw||0)+(strideYaw-(h.strideYaw||0))*blend;
  b.hips.rotation.y+=h.strideYaw;b.spine.rotation.y-=h.strideYaw*.7;b.chest.rotation.y-=h.strideYaw*.3;
  b.chest.rotation.x+=(p.pitch||0)*.12;
 }
 const patrol=menu?p.lobbyPatrol:null;
 if(patrol){
  h.phase=patrol.phase;h.speed=patrol.speed;
  b.hips.position.x+=patrol.bodySway;b.hips.position.y=b.hips.userData.rest.y-.025+patrol.bodyBob;
  b.hips.rotation.x=-.025;b.hips.rotation.y=patrol.hipYaw;
  b.hips.rotation.z=patrol.lean;b.spine.rotation.z=-patrol.lean*.65;
  b.spine.rotation.y=patrol.spineYaw;b.spine.rotation.x=-patrol.ready*.025;
  b.chest.rotation.y=patrol.chestYaw;
  b.chest.rotation.x=patrol.breath*1.8-patrol.ready*.045;
  b.head.rotation.y=patrol.headYaw;b.head.rotation.z=patrol.headRoll;
  b.head.position.x+=patrol.ready*.018;
  b.head.rotation.x=patrol.headPitch;
 }
 const directionalSpeed=Math.hypot(h.forward,h.side)||1,f=h.forward/directionalSpeed,s=h.side/directionalSpeed,legs=[];
 const walking=grounded&&!airborne&&!dead&&!emote&&!p.sliding&&!p.downed&&!p.reviving&&!p.vehicleId&&!p.mantle&&!p.traversal;
 for(const sideSign of [-1,1]){const S=sideSign<0?'L':'R',phase=h.phase+(sideSign<0?Math.PI:0),pose=strideFoot(h.phase,sideSign,patrol?{...gait,distance:patrol.cycleDistance,stance:.58,lift:.085,moving:1}:gait),{contact:stance,lift,roll}=pose;
  let foot=V(sideSign*.112+s*pose.stride,soleY+lift,-f*pose.stride);
  if(patrol){
   const travelZ=-pose.stride,heading=(p.yaw||Math.PI)-Math.PI;
   // Counter the root turn so the planted boot keeps following the straight road.
   foot=V(Math.cos(heading)*sideSign*.112-Math.sin(heading)*travelZ,
    soleY+lift,Math.sin(heading)*sideSign*.112+Math.cos(heading)*travelZ);
  }
  if(!grounded&&!airborne)foot=V(sideSign*.14,.17+(sideSign>0?.10:0),.10);
  if(airborne)foot=V(sideSign*(p.flight==='glide'?.18:.29),p.flight==='glide'?.14:.18+Math.sin(time*2.3+sideSign)*.018,p.flight==='glide'?.10:.34+sideSign*.035);
  if(h.slide>.01)foot.lerp(V(sideSign*.17,.12,-.67),h.slide);
  if(h.down>.01)foot.lerp(V(sideSign*.2,.12,.43+Math.sin(phase)*.10*moving),h.down);
  if(h.revive>.01)foot.lerp(V(sideSign*.15,sideSign<0?.10:.13,sideSign<0?-.32:.25),h.revive);
  if(p.vehicleId&&!(p.vehicleType==='helicopter'&&p.vehicleSeat>0)||p.zVehicle)foot=V(sideSign*.4,.43,-.35);
  if(dead)foot=V(sideSign*.23,.12,-.12);
  if(emote)foot=V(...emotePose(emote.id,emote.t,sideSign).foot);
  // Contact locks in world space through aim turns and velocity changes.
  // Lobby actors walk in place, so their contact uses the moving-road clock.
  const planted=walking&&!patrol&&stance&&speed>.3,old=h['plant'+S],yaw=model.rotation.y,cs=Math.cos(yaw),sn=Math.sin(yaw);
  if(planted){
   if(old){const dx=old.x-model.position.x,dz=old.z-model.position.z;if(Math.hypot(dx,dz)<.72){foot.x=cs*dx-sn*dz;foot.z=sn*dx+cs*dz;}}
   h['plant'+S]={x:model.position.x+cs*foot.x+sn*foot.z,z:model.position.z-sn*foot.x+cs*foot.z};
  }else h['plant'+S]=null;
  const bootRoll=walking?roll*.65:0;foot.y+=bootRoll>0?Math.sin(bootRoll)*.065:-Math.sin(bootRoll)*.195;
  h['footTarget'+S]??=foot.clone();if(walking&&(speed>.3||patrol))h['footTarget'+S].copy(foot);else h['footTarget'+S].lerp(foot,1-Math.exp(-dt*18));
  legs.push({S,sideSign,stance,bootRoll,foot:h['footTarget'+S]});
 }
 // Raise the pelvis on passing steps and lower only enough to reach the
 // planted ankle. The old permanent squat kept both knees deeply bent.
 if(walking&&!p.crouching){let height=b.hips.position.y;for(const leg of legs){const reach=Math.hypot(leg.foot.x-leg.sideSign*.115,leg.foot.z);height=Math.min(height,leg.foot.y+.03+Math.sqrt(Math.max(.40,.802**2-reach**2)));}b.hips.position.y=Math.max(.75,height);}
 for(const {S,sideSign,bootRoll,foot} of legs){placeFoot(foot);const yaw=b.hips.rotation.y,pole=V(sideSign*.115-Math.sin(yaw)*.7,.5,-Math.cos(yaw)*.7);
  solveChain(h,'thigh'+S,'shin'+S,'foot'+S,foot,pole);const footBone=b['foot'+S];footBone.quaternion.copy(footBone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(h.mesh.getWorldQuaternion(new T.Quaternion())));footBone.rotateY(patrol?Math.PI-(p.yaw||Math.PI):yaw*.8);footBone.rotateX(bootRoll);
 }
 if(emote){const pose=emotePose(emote.id,emote.t,1);b.hips.position.x+=pose.sway;b.hips.position.y+=pose.bob;b.chest.rotation.z=pose.sway*.5;}
 }
 const lean=menu?0:leanAmount(p);b.spine.position.x+=lean*LEAN.shift;b.spine.rotation.z-=lean*LEAN.angle;
 if(motion&&['locomotion','land'].includes(motion.id)){
  h.mesh.updateWorldMatrix(true,true);const inverse=h.mesh.matrixWorld.clone().invert();
  const ankles=['L','R'].map(S=>b['foot'+S].getWorldPosition(V()).applyMatrix4(inverse));
  const minimum=Math.min(...ankles.map(v=>v.y));
  const walking=motion.gait==='walk'&&speed>.3&&!p.crouching;
  const strideScale=walking?.7:1;
  for(const foot of ankles){foot.x=b.hips.position.x+(foot.x-b.hips.position.x)*strideScale;foot.z=b.hips.position.z+(foot.z-b.hips.position.z)*strideScale;foot.y=soleY+Math.max(0,foot.y-minimum)*(walking?.7:1);}
  let height=b.hips.position.y+T.MathUtils.clamp(soleY-minimum,-.10,.10);
  if(walking){height=.89+(h.motionRootOffset||0);for(let i=0;i<2;i++){const foot=ankles[i],dx=foot.x-b['thigh'+(i?'R':'L')].userData.rest.x-b.hips.position.x,dz=foot.z-b.hips.position.z,reach=h.motionLegLength||.785;height=Math.min(height,foot.y+.03+Math.sqrt(Math.max(.1,reach**2-dx*dx-dz*dz)));}}
  h.contactHeight??=height;h.contactHeight+=(height-h.contactHeight)*(1-Math.exp(-dt*22));
  b.hips.position.y=h.contactHeight;
  for(let i=0;i<2;i++){
   const S=i?'R':'L',foot=ankles[i];
   let contact=foot.y<soleY+.03&&speed>.3&&!h['release'+S];
   if(menu){const heading=(p.yaw||Math.PI)-Math.PI,x=foot.x,z=foot.z;foot.x=Math.cos(heading)*x-Math.sin(heading)*z;foot.z=Math.sin(heading)*x+Math.cos(heading)*z;}
   const originalFoot=foot.clone(),yaw=model.rotation.y,cs=Math.cos(yaw),sn=Math.sin(yaw),old=h['plant'+S];
   if(contact&&old){if(menu)old.z-=(p.lobbyPatrol?.speed||speed)*dt;const dx=old.x-model.position.x,dz=old.z-model.position.z,x=cs*dx-sn*dz,z=sn*dx+cs*dz;if(Math.hypot(x-foot.x,z-foot.z)<.16){foot.x=x;foot.z=z;}else contact=false;}
   if(contact){const hip=b['thigh'+S].getWorldPosition(V()).applyMatrix4(inverse),reach=b['shin'+S].userData.rest.length()+b['foot'+S].userData.rest.length()-.004;if(hip.distanceTo(foot)>reach){contact=false;foot.copy(originalFoot);}}
   if(!contact&&old){h['release'+S]={...old,age:0};h['released'+S]=true;}
   const release=h['release'+S];
   if(contact)h['release'+S]=null;
   else if(release){release.age+=dt;const t=T.MathUtils.smoothstep(release.age,0,.10),dx=release.x-model.position.x,dz=release.z-model.position.z;foot.x=T.MathUtils.lerp(cs*dx-sn*dz,foot.x,t);foot.z=T.MathUtils.lerp(sn*dx+cs*dz,foot.z,t);if(t===1)h['release'+S]=null;}
   const worldFoot=V(model.position.x+cs*foot.x+sn*foot.z,foot.y,model.position.z-sn*foot.x+cs*foot.z),last=h['lastMotionFoot'+S];
   // Bound transition/release velocity, not physical player movement. A newly
   // chosen support foot must finish reaching the ground before it can lock.
   if(last&&!(contact&&old)){const delta=worldFoot.clone().sub(last),limit=(6+speed)*dt;if(delta.length()>limit){worldFoot.copy(last).add(delta.setLength(limit));const dx=worldFoot.x-model.position.x,dz=worldFoot.z-model.position.z;foot.set(cs*dx-sn*dz,worldFoot.y,sn*dx+cs*dz);contact=false;}}
   h['lastMotionFoot'+S]=worldFoot;
   h['plant'+S]=contact?{x:model.position.x+cs*foot.x+sn*foot.z,z:model.position.z-sn*foot.x+cs*foot.z}:null;
   placeFoot(foot);
   const pole=b['shin'+S].getWorldPosition(V()).applyMatrix4(inverse),footQ=b['foot'+S].getWorldQuaternion(new T.Quaternion());
   solveChain(h,'thigh'+S,'shin'+S,'foot'+S,foot,pole);
   b['foot'+S].quaternion.copy(b['foot'+S].parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(footQ));
   // Flatten the support sole, preserving heading. Ankle contact alone let
   // rotated source boots skate through the road.
   if(foot.y<soleY+.09){const localQ=h.mesh.getWorldQuaternion(new T.Quaternion()).invert().multiply(footQ),yaw=new T.Euler().setFromQuaternion(localQ,'YXZ').y;
    const flat=h.mesh.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(V(0,1,0),yaw));
    flat.slerp(footQ,T.MathUtils.smoothstep(foot.y,soleY+.03,soleY+.09));
    b['foot'+S].quaternion.copy(b['foot'+S].parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(flat));}
  }
 }else if(motion){h.plantL=h.plantR=h.releaseL=h.releaseR=h.lastMotionFootL=h.lastMotionFootR=null;h.releasedL=h.releasedR=false;h.contactHeight=undefined;}
 if(motion?.id==='crawl'){h.mesh.updateWorldMatrix(true,true);const inverse=h.mesh.matrixWorld.clone().invert(),minimum=Math.min(...['L','R'].map(S=>b['foot'+S].getWorldPosition(V()).applyMatrix4(inverse).y));b.hips.position.y+=Math.max(0,soleY-minimum);}
 const held=model.userData.held,arms=model.userData.arms,draw=model.userData.draw;
 if(held&&arms){held.updateWorldMatrix(true,false);h.mesh.updateWorldMatrix(true,false);}
 for(const sideSign of [-1,1]){const S=sideSign<0?'L':'R';let target;
  if(motion?.id==='crawl'){h.mesh.updateWorldMatrix(true,true);const inverse=h.mesh.matrixWorld.clone().invert(),hand=b['hand'+S].getWorldPosition(V()).applyMatrix4(inverse),pole=b['forearm'+S].getWorldPosition(V()).applyMatrix4(inverse),orientation=b['hand'+S].getWorldQuaternion(new T.Quaternion());hand.y=Math.max(.065,hand.y);solveChain(h,'arm'+S,'forearm'+S,'hand'+S,hand,pole);b['hand'+S].quaternion.copy(b['forearm'+S].getWorldQuaternion(new T.Quaternion()).invert().multiply(orientation));}
  if(motion?.id==='salute'&&S==='R'){
   h.mesh.updateWorldMatrix(true,true);const inverse=h.mesh.matrixWorld.clone().invert(),head=b.head.getWorldPosition(V()).applyMatrix4(inverse),hand=b.handR.getWorldPosition(V()).applyMatrix4(inverse),pole=b.forearmR.getWorldPosition(V()).applyMatrix4(inverse),orientation=b.handR.getWorldQuaternion(new T.Quaternion());
   const weight=T.MathUtils.smoothstep(hand.y-head.y,-.35,-.15);hand.lerp(head.add(V(.115,.045,-.08)),weight);
   solveChain(h,'armR','forearmR','handR',hand,pole);b.handR.quaternion.copy(b.forearmR.getWorldQuaternion(new T.Quaternion()).invert().multiply(orientation));
  }
  if(motion?.freeHands||motion&&!held?.visible&&!model.userData.utility&&!airborne&&!p.traversal&&!p.mantle&&!p.vehicleId&&!p.building&&!p.use&&!throwing)continue;
  if(emote)target=V(...emotePose(emote.id,emote.t,sideSign).hand);
  else if(throwing){const t=p.throwProgress,wind=Math.sin(Math.min(1,t/.4)*Math.PI*.5),release=Math.min(1,Math.max(0,(t-.35)/.3));target=sideSign>0?V(.28,1.35+wind*.35-lower,.25*wind-release*.9):V(-.3,1.05-lower,-.25);}
  else if(p.vehicleId&&p.vehicleSeat===0||p.zVehicle&&p.zVehicleSeat===0)target=V(sideSign*.36,1.2,-.58);
  else if(p.mantle)target=V(sideSign*.28,1.68,-.38);
  else if(p.traversal)target=V(sideSign*.24,1.95,-.08);
  else if(airborne)target=p.flight==='glide'?V(sideSign*.33,1.93,-.06):V(sideSign*.70,1.47+Math.sin(time*2.1+sideSign)*.012,-.10);
  else if(p.building)target=V(sideSign*.25,1.22-lower+(sideSign>0?Math.sin(time*8)*.035:0),-.38);
  else if(p.use){const t=T.MathUtils.clamp((time-(p.use.start??time))/Math.max(.1,(p.use.end??time+1)-(p.use.start??time)),0,1),lift=Math.min(1,t/.18)*Math.min(1,(1-t)/.14),drink=['mini','flask'].includes(p.use.id);target=drink?V(sideSign*.16,(sideSign>0?1.2+lift*.36:1.15)-lower,-.24):V(sideSign*.17+Math.sin(t*Math.PI*10)*.02,1.08-lower,-.36);}
  else if(sideSign<0&&held?.visible&&draw?.active&&draw.route==='back'&&draw.progress<.52)target=V(-.24,1.12-lower,-.18);
  else if(held?.visible&&arms){const limb=arms.userData.limbs.find(l=>l.side===sideSign);target=limb.hand.getWorldPosition(V());target.applyMatrix4(h.mesh.matrixWorld.clone().invert());target.y+=.035;}
  else if(model.userData.utility){const draw=equipPose(p,time);target=V(sideSign*.26,1.08-lower+(sideSign>0?draw.position[1]*.65:0),-.25+(sideSign>0?draw.position[2]:0));if(sideSign>0)target.x+=draw.position[0];}
  else target=V(sideSign*.27,1.02-lower,-Math.sin(h.phase+(sideSign<0?Math.PI:0))*.20*moving);
  if(p.downed)target=V(sideSign*.29,.14+Math.max(0,Math.sin(h.phase+(sideSign<0?Math.PI:0)))*.045*moving,-.46-Math.sin(h.phase+(sideSign<0?Math.PI:0))*.13*moving);
  if(p.reviving)target=V(sideSign*.18,.58+Math.sin(time*3+sideSign)*.025,-.49);
  if(dead)target=V(sideSign*.40,.6,-.10);
  h['handTarget'+S]??=target.clone();h['handTarget'+S].lerp(target,1-Math.exp(-dt*(h.transition<1?16:40)));
  solveChain(h,'arm'+S,'forearm'+S,'hand'+S,h['handTarget'+S],V(sideSign*.46,1.08,.15));
  const hand=b['hand'+S];let handQ=h.mesh.getWorldQuaternion(new T.Quaternion());
  if(held?.visible&&arms&&!emote&&!airborne&&!p.traversal&&!p.mantle&&!p.use&&!p.building&&!throwing){handQ=arms.userData.limbs.find(l=>l.side===sideSign).hand.getWorldQuaternion(new T.Quaternion());}
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(handQ));hand.rotateX(-.12);

 }
 // Gentle resting curl; a firmer grip when holding equipment. These cosmetic
 // finger rotations do not move the weapon, aim direction or hit geometry.
 if(h.asset)for(const S of ['L','R'])for(let i=0;i<5;i++){const grip=held?.visible&&!motion?.freeHands?1:.25;b['finger'+S+i].rotation.x=i===4?-.15*grip:-.48*grip;}
 if(model.userData.utility){h.mesh.updateWorldMatrix(true,false);const position=b.handR.getWorldPosition(V());model.worldToLocal(position);model.userData.utility.position.copy(position);model.userData.utility.rotation.set(p.use?-.35:0,0,0);}
 model.userData.animationState=h.pose;
}
export function humanoidDiagnostics(model){const h=model.userData.human;return h?{revision:model.userData.artRevision,bones:h.mesh.skeleton.bones.length,vertices:h.mesh.geometry.attributes.position.count,triangles:h.mesh.geometry.index.count/3,surfaces:h.mesh.geometry.userData.surfaceKinds,state:h.pose,transition:h.transition,lower:h.lowerState,upper:h.upperState}:null;}
