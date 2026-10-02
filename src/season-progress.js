import {WEAPONS,ROYALE_WEAPONS} from './data.js';
const roster=[...WEAPONS,...ROYALE_WEAPONS];
const KEY='ravelfront-season-one-progress',week=()=>Math.floor((Date.now()-Date.UTC(2026,9,1))/604800000);
let cached,saveTimer;
export function seasonProgress(){if(!cached){try{cached=JSON.parse(localStorage.getItem(KEY));}catch{}cached??={weapons:{},bosses:0,relays:0,boosts:0,week:week(),weekly:{elims:0,relays:0,boosts:0},claims:[]};}if(cached.week!==week()){cached.week=week();cached.weekly={elims:0,relays:0,boosts:0};}return cached;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(cached));}catch{}saveTimer=null;}
export function recordSeasonEvent(e,state,id){if(state.options.training||state.royale?.practice||e.player!==id)return;const p=seasonProgress(),weapon=roster.find(w=>w.id===e.weapon||w.name===e.weapon);let changed=false;
 if(e.type==='hit'&&weapon){const w=p.weapons[weapon.id]??={damage:0,elims:0,critical:0};w.damage+=Math.max(0,e.amount||0);w.critical+=e.precision?1:0;changed=true;}
 if(e.type==='elimination'){p.weekly.elims++;if(weapon){const w=p.weapons[weapon.id]??={damage:0,elims:0,critical:0};w.elims++;}changed=true;}
 if(e.type==='boss-defeated'){p.bosses++;changed=true;}
 if(e.type==='relay-captured'){p.relays++;p.weekly.relays++;changed=true;}
 if(e.type==='rig-used'){p.boosts++;p.weekly.boosts++;changed=true;}
 if(changed&&!saveTimer)saveTimer=setTimeout(save,1500);}
export function masteryRewards(){const p=seasonProgress(),list=[];if(Object.values(p.weapons).some(w=>w.damage>=2000))list.push('wrap-starbound');if(p.bosses)list.push('backbling-ember');if(p.relays>=5)list.push('trail-retro');if(p.weekly.elims>=10&&p.weekly.relays>=2&&p.weekly.boosts>=6)list.push('glider-reef');return list;}
export function seasonCareer(){const p=seasonProgress();return `<section class="season-career"><span class="eyebrow">SEASON 1 · OPERATION BREAKWATER</span><h2>Field mastery & assignments</h2><p>Personal browser record. Combat rewards are cosmetic only. Spawn Island and training are excluded.</p><div class="season-masteries">${roster.map(w=>{const v=p.weapons[w.id]||{damage:0,elims:0,critical:0},level=Math.min(5,Math.floor(v.damage/2000));return `<article><strong>${w.name}</strong><small>MASTERY ${level}/5 · ${v.elims} eliminations</small><progress max="2000" value="${level===5?2000:v.damage%2000}"></progress><small>${Math.round(v.damage)} damage · ${v.critical} critical hits</small></article>`;}).join('')}</div><h3>Weekly field assignments</h3><p>10 eliminations: ${Math.min(10,p.weekly.elims)}/10 · Activate 2 relays: ${Math.min(2,p.weekly.relays)}/2 · Use 6 boosts: ${Math.min(6,p.weekly.boosts)}/6</p><p>Rewards: first mastery level → Aster Recon Wrap; defeat Voss → Heat Exchanger; five relay activations → Relay Trail; complete all three weekly assignments → Hydrofoil glider.</p><p>Voss defeated ${p.bosses} · Relays captured ${p.relays} · Rig boosts ${p.boosts}</p></section>`;}
if(typeof window!=='undefined')window.addEventListener('pagehide',()=>{if(cached)save();});
