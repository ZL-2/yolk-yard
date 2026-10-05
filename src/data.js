import {MYTHIC_WEAPONS} from './bosses.js';
import { safeName } from './moderation.js';
import {OPTICS,RETICLES} from './weapon-presentation.js';
import {combatProfile,rarityVariant} from './combat.js';
import {cosmeticProfile,SHOP_SETS} from './shop-catalog.js';
// Immediate pickups and revised Royale combat require matching clients.
export const VERSION = 40;
export const WEAPONS = [
  {
    "id": "sprinter",
    "muzzle": 0.9,
    "sightY": 0.285,
    "optic": "reflex",
    "name": "R-41 Service Rifle",
    "role": "ASSAULT",
    "desc": "A steady all-rounder. Fast, accurate, dependable.",
    "color": 16300073,
    "size": 1,
  },
  {
    "id": "scatter",
    "muzzle": 0.9,
    "sightY": 0.22,
    "optic": "iron",
    "name": "M12 Combat Shotgun",
    "role": "SCATTER",
    "desc": "Get close. One wide burst, plenty of punch.",
    "color": 16022359,
    "size": 1.1,
  },
  {
    "id": "needle",
    "muzzle": 1.1,
    "sightY": 0.33499999999999996,
    "optic": "scope",
    "name": "LR-9 Longshot",
    "role": "PRECISION",
    "desc": "One powerful scoped shot, then reload.",
    "color": 5753311,
    "size": 1.35,
  },
  {
    "id": "zipper",
    "muzzle": 0.68,
    "sightY": 0.285,
    "optic": "reflex",
    "name": "VX-7 SMG",
    "role": "RAPID",
    "desc": "Move quickly and keep a stream of shots flying.",
    "color": 11983702,
    "size": 0.78,
  },
  {
    "id": "thumper",
    "muzzle": 0.74,
    "sightY": 0.285,
    "optic": "reflex",
    "name": "AT-6 Rocket Launcher",
    "role": "LAUNCHER",
    "desc": "A straight rocket that arms after three units of flight.",
    "color": 13339884,
    "size": 1.3,
  },
  {
    "id": "anchor",
    "muzzle": 0.94,
    "sightY": 0.316,
    "optic": "scope",
    "name": "DMR-18 Sentinel",
    "role": "MARKSMAN",
    "desc": "A scoped semi-automatic rifle for deliberate follow-up shots.",
    "color": 7188431,
    "size": 1.3,
  },
  {
    "id": "duet",
    "muzzle": 0.92,
    "sightY": 0.275,
    "optic": "prism",
    "name": "BR-3 Burst Rifle",
    "role": "BURST",
    "desc": "Three precise shots with each trigger press.",
    "color": 15848296,
    "size": 0.95,
  },
  {
    "id": "pip",
    "muzzle": 0.45,
    "sightY": 0.22,
    "optic": "iron",
    "name": "P-9 Sidearm",
    "role": "SIDEARM",
    "desc": "A dependable backup for every loadout.",
    "color": 15918522,
    "size": 0.6,
    "secondary": true
  }
];
export const ROYALE_WEAPONS = [
  {
    "id": "peeper",
    "muzzle": 1.1,
    "sightY": 0.32399999999999995,
    "optic": "scope",
    "name": "SR-25 Scout",
    "role": "MARKSMAN",
    "desc": "A repeating rifle for long-range reconnaissance.",
    "color": 9756314,
    "size": 1.35,
  },
  {
    "id": "doubleyolk",
    "muzzle": 0.9,
    "sightY": 0.22,
    "optic": "iron",
    "name": "SG-2 Breacher",
    "role": "TACTICAL",
    "desc": "A pump-action tactical shotgun built for close-range control.",
    "color": 15505861,
    "size": 1.1,
  },
  {
    "id": "comet",
    "muzzle": 0.9,
    "sightY": 0.285,
    "optic": "reflex",
    "name": "ARC-5 Pulse Rifle",
    "role": "ENERGY",
    "desc": "A precise energy carbine with luminous rounds.",
    "color": 9154559,
    "size": 1,
  }
];
for(const w of [...WEAPONS,...ROYALE_WEAPONS]){
 Object.assign(w,combatProfile(w.id),{reticle:RETICLES[w.id],artRevision:4});
 w.desc=w.purpose+'. '+w.weakness+'.';
 if(OPTICS[w.id]){w.ads={...OPTICS[w.id],magnification:w.scopeMagnification,sensitivity:w.scopeSensitivity};w.magnification=w.scopeMagnification;w.sightY=w.ads.radius+.15;}
}
const royaleStats = new Map();
export const MODES = [
 {id:"royale",name:"Frontier Royale",short:"ROYALE",description:"Drop in, loot up, outrun the storm. Last operator standing.",limit:1,teams:false},
  {
    id: "ffa",
    name: "Free for all",
    short: "FFA",
    description: "Every operator for themselves. First to 20 eliminations.",
    limit: 20,
    teams: false,
  },

];
export const COLORS = [
  "#fff6da",
  "#f9b74a",
  "#72cfdd",
  "#ee897b",
  "#a5d76e",
  "#b7a1ec",
  "#8492a6",
  "#fae8b6",
  "#ffffff", "#273345", "#ff637e", "#d94949", "#f78336", "#ffe45e",
  "#45b979", "#21796d", "#80eacb", "#3d8ce8", "#464eb3", "#8c54c9",
  "#efb4df", "#bd728b", "#946344", "#b9ccd4",
];
export const HATS = ["No headwear", "Headphones", "Cap", "Crown", "Sprout", "Top hat", "Beanie", "Wizard", "Cowboy", "Party hat", "Halo", "Bunny ears", "Cat ears", "Chef", "Beret", "Antenna", "Flower", "Viking", "Pirate", "Propeller"];
export const PATTERNS = ["No pattern", "Stripes", "Polka dots", "Checkerboard", "Confetti", "Lightning", "Stars", "Two tone", "Waves", "Diamond"];
export const FINISHES = ["Classic", "Matte", "Gloss", "Metallic"];
export const EYEWEAR = ["Classic visor", "Round goggles", "Sunglasses", "Cyclops", "Square glasses", "Star shades", "No eyewear"];
// Append the plain option so existing saved eyewear IDs keep their meaning.
export const NO_EYEWEAR = 6;
const cosmeticIndex = (value, options) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < options.length ? Number(value) : 0;
export const TEAM_COLORS = [0x3d8ce8, 0xd94949];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const weaponIndex=new Map([...ROYALE_WEAPONS,...WEAPONS].map(w=>[w.id,w])),itemStats=new WeakMap();
export const weapon = (id) => weaponIndex.get(id)||WEAPONS[0];
export const gun = (p, slot=p.slot) => {
 if (!p.inventory) return weapon(slot === 1 ? "pip" : p.weapon);
 const item=p.inventory[slot],cached=item&&itemStats.get(item);if(cached&&cached.id===item.id&&cached.rarity===item.rarity&&cached.bossId===item.bossId&&cached.weapon===item.weapon)return cached.stats;
 const base=weapon(item?.weapon ? item.id : 'pip');
 const mythic=item?.rarity===5?MYTHIC_WEAPONS[item.bossId]:null;
 const rarity=Math.max(0,Math.min(5,item?.rarity||0)),key=base.id+rarity+':'+(mythic?item.bossId:'');
 if(!royaleStats.has(key)){
  const v=rarityVariant(base,rarity);
  if(mythic&&mythic.id===base.id)Object.assign(v,{name:mythic.name,rarity:5});
  royaleStats.set(key,v);
 }
 const stats=royaleStats.get(key);if(item)itemStats.set(item,{id:item.id,rarity:item.rarity,bossId:item.bossId,weapon:item.weapon,stats});return stats;
};
export const mode = (id) => MODES.find((m) => m.id === id) || MODES.find(m => m.id === "ffa");
export const cleanName = safeName;
export function safeProfile(p = {}) {
  if (!p || typeof p !== 'object') p = {};
  return {
    name: cleanName(p.name),
    weapon: WEAPONS.some(w => w.id === p.weapon && !w.secondary) ? p.weapon : "sprinter",
    color: COLORS.includes(p.color) ? p.color : COLORS[0],
    hat: cosmeticIndex(p.hat, HATS),
    pattern: cosmeticIndex(p.pattern, PATTERNS),
    finish: cosmeticIndex(p.finish, FINISHES),
    eyewear: p.eyewear == null ? NO_EYEWEAR : cosmeticIndex(p.eyewear, EYEWEAR),
    accent: COLORS.includes(p.accent) ? p.accent : COLORS[1],
    ...cosmeticProfile(p),
  };
}
export function rng(seed) {
  let s = seed >>> 0;
  const random = () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  random.state = () => s;
  random.restore = value => { s = value >>> 0; };
  return random;
}

export const nameKey = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function randomAppearance(random = Math.random) {
 const pick = list => list[Math.floor(random() * list.length)];
 return {color:pick(COLORS),accent:pick(COLORS),outfit:'outfit-'+SHOP_SETS[Math.floor(random()*SHOP_SETS.length)].id,hat:0,pattern:0,finish:0,eyewear:NO_EYEWEAR};
}
export const BOT_DIFFICULTIES = ['Casual','Intermediate','Advanced','Impossible'];
