const categories=[
 ['video','▣','Video',['quality','fov','showFps']],
 ['audio','♫','Audio',['volume','effectsVolume','ambienceVolume','musicVolume']],
 ['mouse','↗','Mouse',['sensitivity','scopeSensitivity','invert']],
 ['hud','⊕','HUD',['centerDot','hitMarkers','netDebugStats','connectionWarnings']],
 ['gameplay','⚙','Gameplay',['confirmEditOnRelease','chatMode']],
 ['bindings','⌨','Keybinds',[]]
];
const descriptions={
 showFps:'Show your measured frames per second during gameplay.',
 netDebugStats:'Show ping, incoming and outgoing traffic, message rates and a latency graph. Packet loss is unavailable in this browser transport.',
 connectionWarnings:'Show a yellow connection arrow when updates are delayed and a red X when the connection is interrupted or severely delayed.',
 quality:'High enables shadows and richer graphics. Low reduces rendering work for smoother play on slower devices.',
 fov:'Adjust how much of the world is visible. A wider field of view shows more of your surroundings.',
 volume:'Controls the overall game volume. Individual sound channels are multiplied by this level.',
 effectsVolume:'Weapon effects, impacts and gameplay cues.',ambienceVolume:'Environmental sound and wind.',musicVolume:'Menu music and match fanfares.',
 sensitivity:'How quickly the camera turns when you move the mouse.',scopeSensitivity:'Adjust aiming sensitivity while looking through a scope.',invert:'Reverse the direction of vertical mouse movement.',
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
