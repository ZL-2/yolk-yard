import * as THREE from 'three';
import {bossAlertVisual} from './boss-awareness.js';
export function updateBossAlert(model,p,time,height,distance){
 const style=bossAlertVisual(p,time);let sprite=model.userData.bossAlert;
 if(!style||distance>85){if(sprite)sprite.visible=false;return;}
 const key=style.symbol+':'+style.fill;
 if(!sprite){sprite=new THREE.Sprite();sprite.userData.ownedMaterial=true;model.add(sprite);model.userData.bossAlert=sprite;}
 if(sprite.userData.key!==key){
  if(sprite.userData.key){sprite.material.map?.dispose();sprite.material.dispose();}
  else sprite.material.dispose();
  const c=document.createElement('canvas');c.width=128;c.height=192;const ctx=c.getContext('2d');
  ctx.font='900 154px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.strokeStyle='#17212a';ctx.lineWidth=13;
  ctx.strokeText(style.symbol,64,96);ctx.fillStyle=style.symbol==='?'&&style.fill<1?'#fff4c3':style.color;ctx.fillText(style.symbol,64,96);
  if(style.symbol==='?'&&style.fill<1){ctx.save();ctx.beginPath();ctx.rect(0,192*(1-style.fill),128,192);ctx.clip();ctx.fillStyle=style.color;ctx.fillText(style.symbol,64,96);ctx.restore();}
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  sprite.material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false});sprite.userData.key=key;sprite.userData.symbol=style.symbol;sprite.userData.color=style.color;
 }
 sprite.visible=true;sprite.position.y=height+.94;sprite.scale.set(.43*style.scale,.65*style.scale,1);
}
