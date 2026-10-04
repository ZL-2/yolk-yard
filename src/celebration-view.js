import * as T from 'three';
const gold=0xe9b94f;
function mesh(parent,geometry,color,x=0,y=0,z=0){const m=new T.Mesh(geometry,new T.MeshLambertMaterial({color}));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
export function makeVictoryCrown(){
 const g=new T.Group();g.name='Victory Crown';
 mesh(g,new T.CylinderGeometry(.23,.21,.12,16,1,true),gold,0,.06,0);
 for(let i=0;i<7;i++){const a=i/7*Math.PI*2;mesh(g,new T.ConeGeometry(.07,.19,4),gold,Math.sin(a)*.20,.2,Math.cos(a)*.20);mesh(g,new T.SphereGeometry(.025,6,4),0xffefae,Math.sin(a)*.20,.30,Math.cos(a)*.20);}
 mesh(g,new T.OctahedronGeometry(.065),0x73dddc,0,.12,-.23);return g;
}
function counter(wins){
 const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');
 ctx.font='900 78px system-ui';ctx.textAlign='center';ctx.lineWidth=10;ctx.strokeStyle='#342515';ctx.fillStyle='#ffdf87';ctx.strokeText(String(wins),128,89);ctx.fillText(String(wins),128,89);
 const sprite=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),depthWrite:false}));sprite.scale.set(.9,.45,1);sprite.position.set(0,.72,0);return sprite;
}
export function crownRecordProp(wins){
 const g=new T.Group();g.name='Crown Record display';
 mesh(g,new T.BoxGeometry(.60,.10,.38),0x763d48);
 mesh(g,new T.BoxGeometry(.64,.035,.42),gold,0,-.045,0);
 const crown=makeVictoryCrown();crown.position.y=.07;g.add(crown);g.add(counter(wins));return g;
}
export function decorateBoss(model,p){
 const bones=model.userData.human?.bones;if(!bones)return;
 if(p.bossId==='marshal-rook'){
  const helmet=new T.Group();mesh(helmet,new T.SphereGeometry(.18,12,8),0x314658,0,.035,0);mesh(helmet,new T.BoxGeometry(.23,.11,.03),0x84d4dc,0,.02,-.175);bones.head.add(helmet);
  const shield=new T.Group();mesh(shield,new T.BoxGeometry(.42,.62,.08),0x415868);mesh(shield,new T.TorusGeometry(.15,.025,6,16),gold,0,0,-.05);shield.position.set(-.25,-.10,.17);bones.chest.add(shield);
  mesh(bones.chest,new T.BoxGeometry(.035,.35,.04),0xea973e,.14,-.12,-.17);
 }else if(p.bossId==='lieutenant-nyx'){
  mesh(bones.chest,new T.BoxGeometry(.36,.49,.035),0x455f42,0,-.13,.18);
  for(const x of [-.065,.065]){mesh(bones.head,new T.CylinderGeometry(.05,.05,.07,8),0x2d3730,x,.02,-.14).rotation.x=Math.PI/2;mesh(bones.head,new T.SphereGeometry(.027,8,6),0xf04949,x,.02,-.19);}
 }
}
export function updateCelebration(model,p,time,dispose){
 if(p.crown&&!model.userData.victoryCrown){const c=makeVictoryCrown();c.position.y=1.98;model.add(c);model.userData.victoryCrown=c;}
 const c=model.userData.victoryCrown;if(c){c.visible=!!p.crown&&p.health>0;c.position.y=1.98+Math.sin(time*3)*.018;c.rotation.y=Math.sin(time*.6)*.08;}
 const show=p.emote?.id==='crown';
 if(show&&(!model.userData.crownRecord||model.userData.crownRecordWins!==p.crownWins)){
  if(model.userData.crownRecord){model.userData.crownRecord.removeFromParent();dispose(model.userData.crownRecord);}
  const prop=crownRecordProp(p.crownWins||0);prop.position.set(0,1.2,-.46);model.add(prop);model.userData.crownRecord=prop;model.userData.crownRecordWins=p.crownWins;
 }
 if(model.userData.crownRecord)model.userData.crownRecord.visible=show;
}
