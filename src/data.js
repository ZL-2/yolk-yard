import { safeName } from './moderation.js';
import {OPTICS} from './weapon-presentation.js';
import {combatProfile,rarityVariant} from './combat.js';
import {cosmeticProfile} from './shop-catalog.js';
// The rebuilt island and movement model must not mix with older clients.
export const VERSION = 19;
export const WEAPONS = [
  {
    "id": "sprinter",
    "ammoPickup": 30,
    "muzzle": 0.9,
    "sightY": 0.285,
    "optic": "reflex",
    "name": "Sprinter",
    "role": "ASSAULT",
    "desc": "A steady all-rounder. Fast, accurate, dependable.",
    "speed": 7.4,
    "color": 16300073,
    "size": 1,
    "zoom": 65
  },
  {
    "id": "scatter",
    "ammoPickup": 8,
    "muzzle": 0.9,
    "sightY": 0.22,
    "optic": "iron",
    "name": "Scatter",
    "role": "SCATTER",
    "desc": "Get close. One wide burst, plenty of punch.",
    "speed": 7.4,
    "color": 16022359,
    "size": 1.1,
    "zoom": 70
  },
  {
    "id": "needle",
    "ammoPickup": 4,
    "muzzle": 1.1,
    "sightY": 0.33499999999999996,
    "optic": "scope",
    "magnification": 4.5,
    "name": "Needle",
    "role": "PRECISION",
    "desc": "One powerful scoped shot, then reload.",
    "speed": 7.4,
    "color": 5753311,
    "size": 1.35,
    "zoom": 27,
    "stableScope": true
  },
  {
    "id": "zipper",
    "ammoPickup": 40,
    "muzzle": 0.68,
    "sightY": 0.285,
    "optic": "reflex",
    "name": "Zipper",
    "role": "RAPID",
    "desc": "Move quickly and keep a stream of shots flying.",
    "speed": 7.4,
    "color": 11983702,
    "size": 0.78,
    "zoom": 68
  },
  {
    "id": "thumper",
    "ammoPickup": 1,
    "muzzle": 0.74,
    "sightY": 0.285,
    "optic": "reflex",
    "name": "Thumper",
    "role": "LAUNCHER",
    "desc": "A straight rocket that arms after three units of flight.",
    "speed": 7.4,
    "color": 13339884,
    "size": 1.3,
    "zoom": 65
  },
  {
    "id": "anchor",
    "ammoPickup": 15,
    "muzzle": 0.94,
    "sightY": 0.316,
    "optic": "scope",
    "magnification": 3.25,
    "name": "Anchor",
    "role": "MARKSMAN",
    "desc": "A scoped semi-automatic rifle for deliberate follow-up shots.",
    "speed": 7.4,
    "color": 7188431,
    "size": 1.3,
    "zoom": 35,
    "stableScope": true
  },
  {
    "id": "duet",
    "ammoPickup": 24,
    "muzzle": 0.92,
    "sightY": 0.275,
    "optic": "prism",
    "magnification": 1.8,
    "name": "Duet",
    "role": "BURST",
    "desc": "Three precise shots with each trigger press.",
    "speed": 7.4,
    "color": 15848296,
    "size": 0.95,
    "zoom": 58
  },
  {
    "id": "pip",
    "ammoPickup": 15,
    "muzzle": 0.45,
    "sightY": 0.22,
    "optic": "iron",
    "name": "Pip",
    "role": "SIDEARM",
    "desc": "A dependable backup for every loadout.",
    "speed": 7.4,
    "color": 15918522,
    "size": 0.6,
    "zoom": 65,
    "secondary": true
  }
];
export const ROYALE_WEAPONS = [
  {
    "id": "peeper",
    "ammoPickup": 4,
    "muzzle": 1.1,
    "sightY": 0.32399999999999995,
    "optic": "scope",
    "magnification": 3.5,
    "name": "Peeper",
    "role": "MARKSMAN",
    "desc": "A repeating long-range shell scout.",
    "speed": 7.4,
    "color": 9756314,
    "size": 1.35,
    "zoom": 27,
    "stableScope": true
  },
  {
    "id": "doubleyolk",
    "ammoPickup": 8,
    "muzzle": 0.9,
    "sightY": 0.22,
    "optic": "iron",
    "name": "Double Yolk",
    "role": "TACTICAL",
    "desc": "A quick cycling tactical scatter blaster.",
    "speed": 7.4,
    "color": 15505861,
    "size": 1.1,
    "zoom": 70
  },
  {
    "id": "comet",
    "ammoPickup": 30,
    "muzzle": 0.9,
    "sightY": 0.285,
    "optic": "reflex",
    "name": "Comet",
    "role": "ENERGY",
    "desc": "A precise energy carbine with luminous rounds.",
    "speed": 7.4,
    "color": 9154559,
    "size": 1,
    "zoom": 65
  }
];
for(const w of [...WEAPONS,...ROYALE_WEAPONS])if(OPTICS[w.id]){w.ads={...OPTICS[w.id]};w.magnification=w.ads.magnification;w.sightY=w.ads.radius+.15;}
for(const w of [...WEAPONS,...ROYALE_WEAPONS])Object.assign(w,combatProfile(w.id));
const royaleStats = new Map();
export const MODES = [
 {id:"royale",name:"Yolk Royale",short:"ROYALE",description:"Drop in, loot up, outrun the storm. Last egg standing.",limit:1,teams:false},
  {
    id: "ffa",
    name: "Free for all",
    short: "FFA",
    description: "Every egg for itself. First to 20 eliminations.",
    limit: 20,
    teams: false,
  },
  {
    id: "teams",
    name: "Team scramble",
    short: "TEAMS",
    description: "Coral versus blue. First team to 35 eliminations.",
    limit: 35,
    teams: true,
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
export const weapon = (id) => WEAPONS.find((w) => w.id === id) || ROYALE_WEAPONS.find(w => w.id === id) || WEAPONS[0];
export const gun = (p) => {
 if (!p.inventory) return weapon(p.slot === 1 ? "pip" : p.weapon);
 const item=p.inventory[p.slot], base=weapon(item?.weapon ? item.id : 'pip');
 const rarity=Math.max(0,Math.min(4,item?.rarity||0)),key=base.id+rarity;
 if(!royaleStats.has(key)) royaleStats.set(key,rarityVariant(base,rarity));
 return royaleStats.get(key);
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
 return {color:pick(COLORS),accent:pick(COLORS),hat:Math.floor(random()*HATS.length),pattern:Math.floor(random()*PATTERNS.length),finish:Math.floor(random()*FINISHES.length),eyewear:Math.floor(random()*EYEWEAR.length)};
}
export const BOT_DIFFICULTIES = ['Casual','Intermediate','Advanced','Impossible'];
