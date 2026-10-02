import {WEAPON_ART_REVISION} from './weapon-presentation.js';
import {ROYALE_GUN_IDS,ITEMS,AMMO_CAPS} from './royale-data.js';
const ids=new Set([...ROYALE_GUN_IDS,...Object.keys(ITEMS),...Object.keys(AMMO_CAPS),'pickaxe']);
// Rendered from the actual models by scripts/generate-inventory-previews.mjs.
// These images never require a synchronous GPU readback during a live match.
export const inventoryPreview=id=>ids.has(id)?`${import.meta.env?.BASE_URL||'/'}inventory-previews/${id}.svg?v=${ROYALE_GUN_IDS.includes(id)?WEAPON_ART_REVISION:2}`:null;
