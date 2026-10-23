export const SETTINGS_CATEGORIES=[
 ['player','◉','Player',[['Identity',['playerName']]]],
 ['video','▣','Video',[['Graphics & performance',['quality','fpsLimit']],['Camera',['perspective','fov','thirdPersonFov']]]],
 ['audio','♫','Audio',[['Volume',['volume','effectsVolume','ambienceVolume','musicVolume']]]],
 ['mouse','↗','Mouse',[['Look & aim',['sensitivity','adsSensitivity','scopeSensitivity','thirdPersonSensitivity','invert']],['Build & edit',['buildSensitivity','editSensitivity']]]],
 ['hud','⊕','HUD',[['Combat',['centerDot','hitMarkers']],['Navigation',['showMinimap','showCompass','mapSide']],['Performance & connection',['showFps','netDebugStats','connectionWarnings']]]],
 ['comfort','◌','Accessibility',[['Readability',['hudScale','textScale','highContrast']],['Motion',['reducedMotion','headBob','weaponMotion']],['Visual sound indicators',['visualSoundEffects','visualFootsteps','visualGunfire','visualBosses','visualOther']]]],
 ['gameplay','⚙','Gameplay',[['Input behavior',['sprintMode','crouchMode','aimMode','interactMode']],['Building',['confirmEditOnRelease']],['Preferred inventory slots',['slot_shotgun','slot_rifle','slot_healing','slot_mobility']]]],
 ['social','◎','Social',[['Chat & microphone',['chatMode','voiceSettings']]]],
 ['bindings','⌨','Keybinds',[]]
];
const descriptions={
 voiceSettings:'Choose voice channels, microphone and output devices, push to talk or open mic, voice volume, player volume, mute and deafen. Voice preferences save on this browser.',
 playerName:'Change the name shown in matches, your party, chat and rankings. Your progress and friend code stay with your identity.',
 perspective:'First person is the default. Third person adds a right-shoulder camera for combat, harvesting, building and editing. Scoped weapons still use their optic. Vehicles, flight and spectating use their dedicated cameras. Takes effect immediately and saves on this browser.',
 headBob:'Adjust walking bob of your held weapon. This never changes movement or accuracy.',weaponMotion:'Reduce decorative weapon kick and motion. Actual weapon recoil and aiming remain unchanged.',reducedMotion:'Reduce damage flashes, weapon bob and decorative interface animation without changing combat rules.',hudScale:'Resize the inventory and minimap, within screen-safe limits.',textScale:'Increase interaction, recap and HUD help text size.',highContrast:'Use darker HUD panels and stronger text contrast.',mapSide:'Move the minimap to the opposite side of the screen.',showMinimap:'Hide only the small map. Your full island map remains available.',showCompass:'Show or hide the compass.',buildSensitivity:'Mouse sensitivity multiplier while placing builds.',editSensitivity:'Mouse sensitivity multiplier while editing tiles.',thirdPersonSensitivity:'Mouse sensitivity multiplier during third-person gameplay.',sprintMode:'Hold the binding or press once to toggle. Menus, focus loss and death clear toggles.',crouchMode:'Hold or toggle crouching and sliding. Collision and speed requirements are unchanged.',aimMode:'Hold or toggle aiming. Actual aiming and recoil rules are unchanged.',interactMode:'Hold or toggle searching and reviving. Press again to stop; normal range and damage restrictions still apply.',visualFootsteps:'Show enemy footstep indicators. Teammate footsteps remain hidden.',visualGunfire:'Show gunfire and explosion indicators.',visualBosses:'Show nearby boss sound indicators.',visualOther:'Show chests, traversal and other environmental sound indicators.',
 slot_shotgun:'Places newly collected shotguns into this slot when empty. Existing equipment is never rearranged.',slot_rifle:'Preferred empty slot for rifles and precision weapons. Your manual arrangements are preserved.',slot_healing:'Partial stacks merge first, then use the preferred empty healing slot.',slot_mobility:'Preferred empty slot for Grappler, Shadowstep, Jump Rig, Impulse Charges and Launch Pads.',
 visualSoundEffects:'Show directional footsteps, gunfire, explosives, gliders and nearby chest sounds around the crosshair. Quiet crouching is excluded. Saved on this browser.',
 showFps:'Show your measured frames per second during gameplay.',
 netDebugStats:'Show ping, incoming and outgoing traffic, message rates and a latency graph. Packet loss is unavailable in this browser transport.',
 connectionWarnings:'Show a yellow connection arrow when updates are delayed and a red X when the connection is interrupted or severely delayed.',
 quality:'High enables sun shadows and richer surfaces. Resolution adapts to sustained frame load; menus and HUD text stay sharp. Low favors frame rate.',
 fpsLimit:'Choose 30, 60, 90, 120, 144 FPS or Unlimited. Defaults to 60. Higher limits need a capable computer and display. Simulation, controls and multiplayer timing stay consistent.',
 fov:'First-person field of view. Your existing setting is preserved. Scoped optics use this value for their zoom.',
 thirdPersonFov:'Horizontal field of view for the shoulder camera. Defaults to 80°. Adjust independently from first person; changes apply immediately.',
 volume:'Controls the overall game volume. Individual sound channels are multiplied by this level.',
 effectsVolume:'Weapon effects, impacts and gameplay cues.',ambienceVolume:'Environmental sound, wind and vehicle engines.',musicVolume:'Menu music and match fanfares.',
 sensitivity:'How quickly the camera turns when you move the mouse.',adsSensitivity:'Adjust unscoped aiming independently from magnified optics.',scopeSensitivity:'Adjust aiming sensitivity while looking through a scope.',invert:'Reverse the direction of vertical mouse movement.',
 centerDot:'Show a dot in the center of your crosshair.',hitMarkers:'Show visual feedback when your shots hit.',
 confirmEditOnRelease:'Confirm a valid manual build edit when you release the selection input. Turn off to confirm with your Edit binding.',
 chatMode:'Choose filtered messages, quick messages only, or no chat. The safety filter always remains enabled. Mute or report players through Pause → Player controls.'
};
export function arrangeSettings(dialog){
 const body=dialog.querySelector('.dialog-body'),rows=new Map([...body.querySelectorAll('[data-setting],[data-settings-row]')].map(el=>[el.dataset.setting||el.dataset.settingsRow,el.closest('.setting-row')]));
 const bindings=body.querySelector('.keybind-list'),reset=body.querySelector('[data-reset-slider="all"]'),done=body.querySelector('[data-action="close"]');
 body.replaceChildren();
 body.innerHTML='<nav class="settings-tabs" role="tablist" aria-label="Settings categories"></nav><div class="settings-workspace"><div class="settings-options"></div><aside class="settings-description"><span class="eyebrow">SETTING DETAILS</span><h3></h3><p></p><div class="settings-tip">Make it yours.<br>Saved on this browser.</div></aside></div><footer class="settings-footer"><span>Options save automatically · Keybinds use Apply</span></footer>';
 const nav=body.querySelector('nav'),options=body.querySelector('.settings-options'),detail=body.querySelector('.settings-description');
 nav.setAttribute('aria-orientation',matchMedia('(min-width:1000px)').matches?'vertical':'horizontal');
 function describe(title,text,row){detail.querySelector('h3').textContent=title;detail.querySelector('p').textContent=text;body.querySelectorAll('.setting-row.active').forEach(r=>r.classList.remove('active'));row?.classList.add('active');}
 function activate(id){
  for(const tab of nav.children){const active=tab.dataset.settingsTab===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
  for(const panel of options.children)panel.hidden=panel.id!=='settings-panel-'+id;
  options.scrollTop=0;
  const first=options.querySelector('[role="tabpanel"]:not([hidden]) .setting-row');
  if(first)first.dispatchEvent(new Event('pointerenter'));else describe('Keyboard & mouse bindings','Choose an action and press a key, mouse button or scroll direction. Changes remain a draft until you Apply. Discard restores saved bindings. Edit and Reset edit can share a scroll direction.');
 }
 const assigned=new Set();
 const attach=(panel,key)=>{const row=rows.get(key);if(!row||assigned.has(key))return;assigned.add(key);panel.append(row);const title=row.querySelector('label')?.childNodes[0]?.textContent.trim()||key;const show=()=>describe(title,descriptions[key]||'This preference saves automatically on this browser.',row);row.addEventListener('pointerenter',show);row.addEventListener('focusin',show);};
 for(const [id,icon,label,groups] of SETTINGS_CATEGORIES){
  const tab=document.createElement('button');tab.type='button';tab.id='settings-tab-'+id;tab.dataset.settingsTab=id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','settings-panel-'+id);tab.innerHTML=`<span aria-hidden="true">${icon}</span>${label}`;tab.onclick=()=>activate(id);nav.append(tab);
  const panel=document.createElement('section');panel.id='settings-panel-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.innerHTML=`<h3 class="settings-category-heading">${label}</h3>`;
  for(const [heading,ids]of groups){if(!ids.some(key=>rows.has(key)))continue;const h=document.createElement('h4');h.className='settings-group-heading';h.textContent=heading;panel.append(h);for(const key of ids)attach(panel,key);}
  if(id==='bindings'&&bindings)panel.append(bindings);
  options.append(panel);
 }
 // A newly introduced preference stays reachable until its explicit category is added.
 const unassigned=[...rows.keys()].filter(key=>!assigned.has(key));if(unassigned.length){const panel=options.querySelector('#settings-panel-gameplay'),h=document.createElement('h4');h.className='settings-group-heading';h.textContent='Additional preferences';panel.append(h);for(const key of unassigned)attach(panel,key);}
 nav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...nav.children],at=tabs.indexOf(document.activeElement);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(at+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();});
 const footer=body.querySelector('.settings-footer');done.textContent='Back';done.style.marginTop='0';footer.append(reset,done);
 activate('video');
 // Closing with an unapplied draft must reveal its Apply / Discard controls.
 body.addEventListener('settings-show-bindings',()=>activate('bindings'));
}
