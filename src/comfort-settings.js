export const COMFORT_DEFAULTS=Object.freeze({adsSensitivity:.65,buildSensitivity:1,editSensitivity:1,thirdPersonSensitivity:1,headBob:1,weaponMotion:1,hudScale:1,textScale:1,reducedMotion:false,highContrast:false,showMinimap:true,showCompass:true,mapSide:'right',sprintMode:'hold',crouchMode:'hold',aimMode:'hold',interactMode:'hold',visualFootsteps:true,visualGunfire:true,visualBosses:true,visualOther:true});
export const COMFORT_SLIDERS=[['adsSensitivity','Aim-down-sights sensitivity',.1,2,.05,.65],['buildSensitivity','Building sensitivity',.2,3,.1,1],['editSensitivity','Editing sensitivity',.2,3,.1,1],['thirdPersonSensitivity','Third-person sensitivity',.2,3,.1,1],['headBob','Weapon bob',0,1,.1,1],['weaponMotion','Decorative weapon motion',0,1,.1,1],['hudScale','Inventory & minimap size',.8,1.2,.05,1],['textScale','HUD prompt text size',1,1.3,.05,1]];
const TOGGLES=['sprint','crouch','aim','interact'];
export class ActionToggles{
 constructor(){this.active=new Set();}
 press(action,settings){if(TOGGLES.includes(action)&&settings[action+'Mode']==='toggle'){if(this.active.has(action))this.active.delete(action);else this.active.add(action);}}
 value(action,held,settings){return settings[action+'Mode']==='toggle'?this.active.has(action):!!held;}
 reset(){this.active.clear();}
}
export function comfortHTML(settings){
 const toggles=[['reducedMotion','Reduced motion & flashes'],['highContrast','High-contrast HUD'],['showMinimap','Show minimap'],['showCompass','Show compass'],['visualFootsteps','Visual enemy footsteps'],['visualGunfire','Visual gunfire'],['visualBosses','Visual boss sounds'],['visualOther','Other visual sounds']].map(([id,label])=>`<div class="setting-row"><label class="setting-label" for="${id}">${label}</label><input id="${id}" data-setting="${id}" type="checkbox" ${settings[id]?'checked':''}></div>`).join('');
 const modes=TOGGLES.map(action=>`<div class="setting-row"><label class="setting-label" for="${action}Mode">${action[0].toUpperCase()+action.slice(1)} input</label><select id="${action}Mode" data-setting="${action}Mode">${['hold','toggle'].map(mode=>`<option value="${mode}" ${settings[action+'Mode']===mode?'selected':''}>${mode==='hold'?'Hold':'Press to toggle'}</option>`).join('')}</select></div>`).join('');
 return toggles+modes+`<div class="setting-row"><label class="setting-label" for="mapSide">Minimap position</label><select id="mapSide" data-setting="mapSide"><option value="right" ${settings.mapSide==='right'?'selected':''}>Right</option><option value="left" ${settings.mapSide==='left'?'selected':''}>Left</option></select></div>`;
}
export function applyComfort(root,settings){
 for(const [key,,min,max]of COMFORT_SLIDERS)settings[key]=Math.max(min,Math.min(max,Number.isFinite(Number(settings[key]))?Number(settings[key]):COMFORT_DEFAULTS[key]));
 root.style.setProperty('--hud-scale',settings.hudScale);root.style.setProperty('--prompt-scale',settings.textScale);
 root.classList.toggle('reduced-motion',!!settings.reducedMotion);root.classList.toggle('high-contrast-hud',!!settings.highContrast);root.classList.toggle('hide-minimap',settings.showMinimap===false);root.classList.toggle('hide-compass',settings.showCompass===false);root.classList.toggle('left-minimap',settings.mapSide==='left');
}
export function sensitivityFor(settings,{editing=false,building=false,thirdPerson=false,aiming=false,scoped=false,scopeScale=1}={}){
 if(editing)return settings.editSensitivity??1;if(building)return settings.buildSensitivity??1;if(thirdPerson&&!aiming)return settings.thirdPersonSensitivity??1;return aiming?(scoped?(settings.scopeSensitivity??.65):(settings.adsSensitivity??.65))*scopeScale:1;
}
export function visualSoundCategoryEnabled(kind,settings){
 const key=kind==='footsteps'?'visualFootsteps':kind==='gunfire'||kind==='explosion'?'visualGunfire':kind==='boss'?'visualBosses':'visualOther';return settings[key]!==false;
}
