import {loadOperatorAsset} from './operator-assets.js';
import {makeHumanoid,animateHumanoid} from './humanoid.js';

// The review and live game instantiate the exact same production asset.
export async function loadWrenStudy(){await loadOperatorAsset('wren');return makeHumanoid({outfit:'outfit-wren'});}
export function animateWrenStudy(model,p,dt,time){animateHumanoid(model,p,dt,time,{menu:false});model.updateMatrixWorld(true);}
