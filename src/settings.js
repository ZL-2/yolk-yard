import {COMFORT_SLIDERS} from './comfort-settings.js';
export const SLIDERS = [
  ...COMFORT_SLIDERS,
  ['sensitivity', 'Mouse sensitivity', .2, 3, .1, 1],
  ['scopeSensitivity', 'Scope sensitivity', .1, 2, .05, .65],
  ['fov', 'First-person field of view', 65, 110, 1, 85],
  ['thirdPersonFov', 'Third-person field of view', 65, 110, 1, 80],
  ['volume', 'Master volume', 0, 1, .05, .45],
  ['effectsVolume', 'Effects & gameplay', 0, 1, .05, .85],
  ['ambienceVolume', 'Ambience & wind', 0, 1, .05, .5],
  ['musicVolume', 'Music & fanfares', 0, 1, .05, .3],
];
export const SLIDER_DEFAULTS = Object.fromEntries(SLIDERS.map(([id,,,,,value]) => [id,value]));
export function perspectiveFov(settings,third=false,aspect=16/9){
  const value=Number(third?settings.thirdPersonFov:settings.fov),fallback=third?80:85;
  const degrees=Math.max(65,Math.min(110,Number.isFinite(value)&&value>0?value:fallback));
  // Three.js takes vertical FOV. Third-person settings describe horizontal
  // framing, so 80 degrees is not accidentally rendered as a 112-degree lens.
  return third?2*Math.atan(Math.tan(degrees*Math.PI/360)/Math.max(.5,aspect))*180/Math.PI:degrees;
}
export function migrateThirdPersonFov(settings,saved={}){
  if(settings.thirdPersonLensVersion===2)return settings;
  const old=Number(saved.thirdPersonFov);
  settings.thirdPersonFov=Number.isFinite(old)&&old>65?Math.min(110,2*Math.atan(Math.tan(old*Math.PI/360)*16/9)*180/Math.PI):80;
  settings.thirdPersonLensVersion=2;
  return settings;
}
export function resetSliders(settings, id = 'all') {
  for (const [key,value] of Object.entries(SLIDER_DEFAULTS))
    if (id === 'all' || id === key) settings[key] = value;
  return settings;
}
export function royalePanelAction(code, bindings, current = '') {
  if (current && !['royale-map','royale-inventory'].includes(current)) return null;
  const panel = bindings.map.includes(code) ? 'royale-map' : bindings.inventory.includes(code) ? 'royale-inventory' : null;
  return panel && (panel === current ? 'close' : panel);
}
