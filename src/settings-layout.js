const categories=[
 ['video','▣','Video',['quality','fov','showFps']],
 ['audio','♫','Audio',['volume','effectsVolume','ambienceVolume','musicVolume','visualSoundEffects','visualFootsteps','visualGunfire','visualBosses','visualOther']],
 ['mouse','↗','Mouse',['sensitivity','adsSensitivity','scopeSensitivity','buildSensitivity','editSensitivity','thirdPersonSensitivity','invert']],
 ['hud','⊕','HUD',['centerDot','hitMarkers','netDebugStats','connectionWarnings','hudScale','textScale','highContrast','showMinimap','showCompass','mapSide']],
 ['comfort','◌','Comfort',['reducedMotion','headBob','weaponMotion','sprintMode','crouchMode','aimMode','interactMode']],
 ['gameplay','⚙','Gameplay',['confirmEditOnRelease','chatMode','slot_shotgun','slot_rifle','slot_healing','slot_mobility']],
 ['bindings','⌨','Keybinds',[]]
];
const descriptions={
 headBob:'Adjust walking bob of your held weapon. This never changes movement or accuracy.',weaponMotion:'Reduce decorative weapon kick and motion. Actual weapon recoil and aiming remain unchanged.',reducedMotion:'Reduce damage flashes, weapon bob and decorative interface animation without changing combat rules.',hudScale:'Resize the inventory and minimap, within screen-safe limits.',textScale:'Increase interaction, recap and HUD help text size.',highContrast:'Use darker HUD panels and stronger text contrast.',mapSide:'Move the minimap to the opposite side of the screen.',showMinimap:'Hide only the small map. Your full island map remains available.',showCompass:'Show or hide the compass.',buildSensitivity:'Mouse sensitivity multiplier while placing builds.',editSensitivity:'Mouse sensitivity multiplier while editing tiles.',thirdPersonSensitivity:'Mouse sensitivity multiplier during third-person gameplay.',sprintMode:'Hold the binding or press once to toggle. Menus, focus loss and death clear toggles.',crouchMode:'Hold or toggle crouching and sliding. Collision and speed requirements are unchanged.',aimMode:'Hold or toggle aiming. Actual aiming and recoil rules are unchanged.',interactMode:'Hold or toggle searching and reviving. Press again to stop; normal range and damage restrictions still apply.',visualFootsteps:'Show enemy footstep indicators. Teammate footsteps remain hidden.',visualGunfire:'Show gunfire and explosion indicators.',visualBosses:'Show nearby boss sound indicators.',visualOther:'Show chests, traversal and other environmental sound indicators.',
 slot_shotgun:'Places newly collected shotguns into this slot when empty. Existing equipment is never rearranged.',slot_rifle:'Preferred empty slot for rifles and precision weapons. Your manual arrangements are preserved.',slot_healing:'Partial stacks merge first, then use the preferred empty healing slot.',slot_mobility:'Preferred empty slot for Grappler, Shadowstep, Jump Rig, Impulse Charges and Launch Pads.',
 visualSoundEffects:'Show directional footsteps, gunfire, explosives, gliders and nearby chest sounds around the crosshair. Quiet crouching is excluded. Saved on this browser.',
 showFps:'Show your measured frames per second during gameplay.',
 netDebugStats:'Show ping, incoming and outgoing traffic, message rates and a latency graph. Packet loss is unavailable in this browser transport.',
 connectionWarnings:'Show a yellow connection arrow when updates are delayed and a red X when the connection is interrupted or severely delayed.',
 quality:'High enables shadows and richer graphics. Low reduces rendering work for smoother play on slower devices.',
 fov:'Adjust how much of the world is visible. A wider field of view shows more of your surroundings.',
 volume:'Controls the overall game volume. Individual sound channels are multiplied by this level.',
 effectsVolume:'Weapon effects, impacts and gameplay cues.',ambienceVolume:'Environmental sound and wind.',musicVolume:'Menu music and match fanfares.',
 sensitivity:'How quickly the camera turns when you move the mouse.',adsSensitivity:'Adjust unscoped aiming independently from magnified optics.',scopeSensitivity:'Adjust aiming sensitivity while looking through a scope.',invert:'Reverse the direction of vertical mouse movement.',
 centerDot:'Show a dot in the center of your crosshair.',hitMarkers:'Show visual feedback when your shots hit.',
 confirmEditOnRelease:'Confirm a valid manual build edit when you release the selection input. Turn off to confirm with your Edit binding.',
 chatMode:'Choose filtered messages, quick messages only, or no chat. The safety filter always remains enabled. Mute or report players through Pause → Player controls.'
};
export function arrangeSettings(dialog){
 const body=dialog.querySelector('.dialog-body'),rows=new Map([...body.querySelectorAll('[data-setting]')].map(el=>[el.dataset.setting,el.closest('.setting-row')]));
 const bindings=body.querySelector('.keybind-list'),reset=body.querySelector('[data-reset-slider="all"]'),done=body.querySelector('[data-action="close"]');
 body.replaceChildren();
 body.innerHTML='<nav class="settings-tabs" role="tablist" aria-label="Settings categories"></nav><div class="settings-workspace"><div class="settings-options"></div><aside class="settings-description"><span class="eyebrow">SETTING DETAILS</span><h3></h3><p></p><div class="settings-tip">Make it yours.<br>Saved on this browser.</div></aside></div><footer class="settings-footer"><span>Options save automatically · Keybinds use Apply</span></footer>';
 const nav=body.querySelector('nav'),options=body.querySelector('.settings-options'),detail=body.querySelector('.settings-description');
 function describe(title,text,row){detail.querySelector('h3').textContent=title;detail.querySelector('p').textContent=text;body.querySelectorAll('.setting-row.active').forEach(r=>r.classList.remove('active'));row?.classList.add('active');}
 function activate(id){
  for(const tab of nav.children){const active=tab.dataset.settingsTab===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
  for(const panel of options.children)panel.hidden=panel.id!=='settings-panel-'+id;
  options.scrollTop=0;
  const first=options.querySelector('[role="tabpanel"]:not([hidden]) .setting-row');
  if(first)first.dispatchEvent(new Event('pointerenter'));else describe('Keyboard & mouse bindings','Choose an action and press a key, mouse button or scroll direction. Changes remain a draft until you Apply. Discard restores saved bindings. Edit and Reset edit can share a scroll direction.');
 }
 for(const [id,icon,label,ids] of categories){
  const tab=document.createElement('button');tab.type='button';tab.id='settings-tab-'+id;tab.dataset.settingsTab=id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','settings-panel-'+id);tab.innerHTML=`<span aria-hidden="true">${icon}</span>${label}`;tab.onclick=()=>activate(id);nav.append(tab);
  const panel=document.createElement('section');panel.id='settings-panel-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.innerHTML=`<h3 class="settings-category-heading">${label}</h3>`;
  for(const key of ids){const row=rows.get(key);if(!row)continue;panel.append(row);const title=row.querySelector('label').childNodes[0].textContent.trim();const show=()=>describe(title,descriptions[key],row);row.addEventListener('pointerenter',show);row.addEventListener('focusin',show);}
  if(id==='bindings')panel.append(bindings);
  options.append(panel);
 }
 nav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...nav.children],at=tabs.indexOf(document.activeElement);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(at+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();});
 const footer=body.querySelector('.settings-footer');done.textContent='Back';done.style.marginTop='0';footer.append(reset,done);
 activate('video');
 // Closing with an unapplied draft must reveal its Apply / Discard controls.
 body.addEventListener('settings-show-bindings',()=>activate('bindings'));
}
