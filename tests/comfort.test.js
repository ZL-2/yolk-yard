import test from 'node:test';
import assert from 'node:assert/strict';
import {COMFORT_DEFAULTS,COMFORT_SLIDERS,ActionToggles,applyComfort,sensitivityFor,visualSoundCategoryEnabled,comfortHTML} from '../src/comfort-settings.js';
import {resetSliders} from '../src/settings.js';

test('comfort settings clamp corrupt storage and do not modify accuracy or recoil',()=>{
 const values={},classes=new Set(),root={style:{setProperty:(k,v)=>values[k]=v},classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k)}};
 const settings={...COMFORT_DEFAULTS,hudScale:100,textScale:NaN,headBob:-1,weaponMotion:Infinity,reducedMotion:true,highContrast:true,mapSide:'left',showMinimap:false,showCompass:false};
 applyComfort(root,settings);assert.equal(values['--hud-scale'],1.2);assert.equal(values['--prompt-scale'],1);assert.equal(settings.headBob,0);assert.equal(settings.weaponMotion,1);
 assert.deepEqual([...classes],['reduced-motion','high-contrast-hud','hide-minimap','hide-compass','left-minimap']);assert.equal(settings.recoil,undefined);
 resetSliders(settings);for(const [key,,,,,value]of COMFORT_SLIDERS)assert.equal(settings[key],value);
});
test('hold/toggle inputs are independent, remain held after keyup and clear together',()=>{
 const t=new ActionToggles(),s={...COMFORT_DEFAULTS,sprintMode:'toggle',aimMode:'toggle'};
 t.press('sprint',s);assert.equal(t.value('sprint',false,s),true);assert.equal(t.value('aim',false,s),false);t.press('aim',s);assert.equal(t.value('aim',false,s),true);
 t.press('sprint',s);assert.equal(t.value('sprint',true,s),false);assert.equal(t.value('crouch',true,s),true);t.press('crouch',s);assert.equal(t.value('crouch',false,s),false);
 t.reset();assert.equal(t.value('aim',false,s),false);t.press('forward',s);assert.equal(t.active.size,0);
});
test('building, editing, third person, unscoped aiming and scopes have separate sensitivity',()=>{
 const s={...COMFORT_DEFAULTS,editSensitivity:.2,buildSensitivity:.3,thirdPersonSensitivity:.4,adsSensitivity:.5,scopeSensitivity:.6};
 assert.equal(sensitivityFor(s),1);assert.equal(sensitivityFor(s,{editing:true,building:true,aiming:true}),.2);assert.equal(sensitivityFor(s,{building:true,aiming:true}),.3);assert.equal(sensitivityFor(s,{thirdPerson:true,aiming:true}),.4);assert.equal(sensitivityFor(s,{aiming:true}),.5);assert.equal(sensitivityFor(s,{aiming:true,scoped:true,scopeScale:.8}),.48);
});
test('visual sound categories can be disabled separately without muting other threats',()=>{
 for(const [key,kinds]of [['visualFootsteps',['footsteps']],['visualGunfire',['gunfire','explosion']],['visualBosses',['boss']],['visualOther',['glider','chest','activity','rareChest']]]){
  const s={...COMFORT_DEFAULTS,[key]:false};for(const kind of kinds)assert.equal(visualSoundCategoryEnabled(kind,s),false);assert.equal(visualSoundCategoryEnabled(key==='visualBosses'?'gunfire':'boss',s),true);
 }
 const html=comfortHTML(COMFORT_DEFAULTS);assert.equal((html.match(/data-setting=/g)||[]).length,13);assert.ok(html.includes('for="sprintMode"'));assert.ok(html.includes('Show minimap'));
});
