import {canFight} from './stance.js';
import {weaponCameraAllowed} from './perspective.js';
import {teammates} from './teams.js';
export function combatReticle(state,p,view,paused=false){
 const active=canFight(p)&&!paused&&!p.emote&&weaponCameraAllowed(p)&&(!state.royale||p.flight==='ground');
 // Use the scope actually rendered by the camera, not raw aim input. Keep a
 // reticle through ADS, equip/reload interruptions, and vehicle seat changes.
 const scope=!!(active&&view.scopeActive&&view.aimBlend>.8);
 return {scope,crosshair:!!active&&!scope};
}
export function nameplateVisible(state,p,local){
 return !!(p.id!==local?.id&&p.health>0&&!p.spectating&&(p.boss||state.zonewars||!state.royale&&!state.boxfight||teammates(state.options,p,local)));
}
