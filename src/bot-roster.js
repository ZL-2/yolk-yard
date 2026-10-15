import {nameKey} from './data.js';

// Original Ravel Coast callsigns. Seat IDs select a starting name, so filling a
// seat never consumes gameplay RNG and host migration keeps the same identity.
export const BOT_ROSTER=Object.freeze([
  'RelayRanger','BoroughBlink','RooflineRook','AlleySignal',
  'NorthfieldFox','OrchardAce','HarvestHaze','HaywireHeron',
  'AsterOrbit','ScopeDrifter','StarlineScout','ZenithZero',
  'BreakwaterBlue','DocksideDash','TideglassTern','AnchorAsh',
  'SableGhost','PinepathProwler','MossRunner','HushHollow',
  'IronwakeIbis','QuarryQuartz','CopperComet','FoundryFlint',
  'SunwardSol','TerraceTalon','PoolsidePulse','CoralCourier',
  'SignalSparrow','HighlineHawk','WatchlineWren','BeaconBriar',
  'CraterClover','FernFrequency','CanopyCipher','NightglassNova',
  'KestrelKick','WinchWanderer','ShadowstepSage','VaultVelvet',
  'DriftwoodDuke','MillwaterMoth','DrydockDart','LastStopLynx',
  'StormlineSable','GliderGlimmer','UplinkUrchin','CoastlineCoda',
]);

const suffixes=['','Echo','Dusk','Dawn','Tide','Ash','Star'];
function rosterOffset(identity){
  const id=String(identity??''),seat=/^bot-(?:teammate-|fill-)?(\d+)$/.exec(id);
  if(seat)return Number(seat[1])%BOT_ROSTER.length;
  let hash=0;for(const letter of id)hash=(Math.imul(hash,31)+letter.charCodeAt(0))>>>0;
  return hash%BOT_ROSTER.length;
}

export function availableBotName(identity,players,reserved=[]){
  const used=new Set([...players].map(p=>nameKey(p.name)));
  for(const name of reserved)used.add(nameKey(name));
  const start=rosterOffset(identity);
  // A full 48-bot match can still admit spectators using a roster name. Rare
  // aliases keep that human name available without introducing numbered bots.
  for(const suffix of suffixes)for(let step=0;step<BOT_ROSTER.length;step++){
    const base=BOT_ROSTER[(start+step)%BOT_ROSTER.length];
    const candidate=base.slice(0,18-suffix.length)+suffix;
    if(!used.has(nameKey(candidate)))return candidate;
  }
  throw new Error('Bot callsign capacity exceeded');
}
