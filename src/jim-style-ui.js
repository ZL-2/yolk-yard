import {shopItem} from './shop-catalog.js';
import {JIM_NORMAL,JIM_GOLF} from './jim-catalog.js';

// Server ownership is permanent; only the celebration is acknowledged.
export class JimStyleReward {
 constructor(options){Object.assign(this,options);this.record=null;this.dismissed='';this.saving=false;
  this.dialog=document.createElement('dialog');this.dialog.className='prestige-dialog jim-reward-dialog';this.dialog.setAttribute('aria-labelledby','jim-reward-title');document.body.append(this.dialog);
  this.dialog.addEventListener('keydown',e=>e.stopPropagation());this.dialog.addEventListener('cancel',e=>{e.preventDefault();void this.close();});
  this.dialog.addEventListener('click',e=>{const button=e.target.closest('button');if(!button||button.disabled)return;if(button.hasAttribute('data-jim-equip'))this.equip();if(button.hasAttribute('data-jim-close')||button.hasAttribute('data-jim-equip'))void this.close();});
 }
 async receive(record){if(!record?.identity)return;try{
  await this.wallet.change(w=>({...w,owned:[...new Set([...w.owned.filter(id=>id!==JIM_GOLF),...(record.unlocked?[JIM_NORMAL,JIM_GOLF]:[])])]}));
  this.record=record;this.onChange?.();
 }catch(error){this.onError?.(error);}}
 update(){if(this.record?.pending&&this.dismissed!==this.record.identity&&!this.dialog.open&&this.ready())this.show();}
 show(){const item=shopItem(JIM_GOLF),portrait=this.getView().shopPortrait({...item,characterInspection:true,showWeapon:false,previewKey:'jim-golf-unlocked'});
  this.dialog.innerHTML=`<header class="prestige-header"><span class="prestige-kicker">VICTORY REWARD · ICON SERIES</span><h2 id="jim-reward-title">GOLF STYLE UNLOCKED.</h2><p>You won wearing Jim. This style is permanently yours.</p></header><div class="jim-reward-preview"><img src="${portrait}" alt="Jim’s unlocked Golf style: white polo, navy shorts and cream-and-green shoes" width="600" height="600"></div><footer class="prestige-footer"><p>JIM McLAUGHLIN · GOLF<br><small>Available now in your Locker.</small></p><div><button data-jim-close>CONTINUE</button><button class="prestige-equip" data-jim-equip>EQUIP GOLF STYLE</button></div></footer>`;
  document.exitPointerLock?.();this.dialog.showModal();
 }
 async close(){if(this.saving)return;this.saving=true;this.dismissed=this.record?.identity;this.dialog.close();try{await this.ack();}catch(error){this.onError?.(Error('Golf is unlocked. Reward acknowledgement will retry when you reconnect.'));}finally{this.saving=false;}}
}
