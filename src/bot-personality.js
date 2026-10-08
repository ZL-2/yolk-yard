// Stable preferences, not random difficulty. All personalities share aim/damage.
export const BOT_PERSONALITIES=Object.freeze([
 Object.freeze({name:'vanguard',range:.88,commit:1.7,peek:.38,cover:.35,flank:4.5}),
 Object.freeze({name:'sentinel',range:1.12,commit:2.1,peek:.48,cover:.8,flank:3.5}),
 Object.freeze({name:'pathfinder',range:1,commit:2.3,peek:.32,cover:.5,flank:7}),
 Object.freeze({name:'support',range:1.06,commit:1.9,peek:.42,cover:.65,flank:5}),
]);
export function botIdentity(p){
 let hash=2166136261;for(const c of String(p.id??p.joinedOrder??p.botSeed??0))hash=Math.imul(hash^c.charCodeAt(0),16777619);
 hash=Math.imul(hash^(hash>>>16),0x7feb352d);hash=Math.imul(hash^(hash>>>15),0x846ca68b);hash^=hash>>>16;
 return (hash>>>0)/4294967296;
}
export function personality(p,brain){
 if(!Number.isInteger(brain.personality))brain.personality=Math.floor(botIdentity(p)*BOT_PERSONALITIES.length);
 return BOT_PERSONALITIES[brain.personality%BOT_PERSONALITIES.length];
}
