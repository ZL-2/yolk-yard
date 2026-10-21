// A reversible release switch: keep the mode, its assets and saved progression.
export const PAUSED_MODES=Object.freeze({zombies:'Zombies is not currently available. Development is paused.'});
export const modeAvailable=mode=>!Object.hasOwn(PAUSED_MODES,mode);
export function assertModeAvailable(mode){if(!modeAvailable(mode))throw Error(PAUSED_MODES[mode]);}
