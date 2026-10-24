// One public policy for ranking, eligibility, previews and the in-game explainer.
const count=n=>Number.isFinite(n)?Math.max(0,Math.min(1e9,Math.floor(n))):0;
export const ROYALE_RATING_VERSION=2;
export const royaleRating=({wins=0,kills=0}={})=>1000*count(wins)+10*count(kills);
export const ROYALE_PICKAXES=Object.freeze([
 {id:'pickaxe-rank-25',name:'Tempest Talon',rank:25,label:'TOP 25',color:'#123b53',accent:'#58edff',metal:'#bddeeb',model:'rank-tempest',swingStyle:'hook',glyph:'XXV',story:'A hooked stormglass blade, machined silver armor and an electric cyan heart. Reserved for the coast’s Top 25.'},
 {id:'pickaxe-rank-10',name:'Rift Reaver',rank:10,label:'TOP 10',color:'#302045',accent:'#d19aff',metal:'#c7b6ef',model:'rank-rift',swingStyle:'crescent',glyph:'X',story:'Twin crescent edges surround a suspended violet singularity. A trophy for the ten who break the field.'},
 {id:'pickaxe-rank-5',name:'Solar Dominion',rank:5,label:'TOP 5',color:'#462b1b',accent:'#ffad40',metal:'#f8d68c',model:'rank-solar',swingStyle:'hammer',glyph:'V',story:'A sun-forged executioner’s blade, layered gold vanes and a molten star core. Five places. No substitutes.'},
 {id:'pickaxe-rank-1',name:'Apex Sovereign',rank:1,label:'#1',color:'#172838',accent:'#e8fbff',metal:'#ffe2a1',model:'rank-apex',swingStyle:'crystal',glyph:'I',story:'Ivory edge wings, black titanium, a levitating crown and a brilliant sovereign core. Only the reigning number one may wield it.'},
].map(i=>Object.freeze({...i,slot:'pickaxe',set:'royale-prestige',tier:'legendary',price:0,exclusive:true,rankReward:true,description:i.story+' Cosmetic only; standard harvesting reach, speed and damage.'})));
export const rankPickaxe=id=>ROYALE_PICKAXES.find(i=>i.id===id);
export const eligibleRankPickaxes=(rank,score)=>Number.isInteger(rank)&&rank>0&&score>0?ROYALE_PICKAXES.filter(i=>rank<=i.rank).map(i=>i.id):[];
export const PRESTIGE_SLOTS=Object.freeze(['outfit','wrap','backbling','glider','trail','pickaxe']);
const names={
 25:['Tempest Sentinel','Stormglass Circuit','Tempest Standard','Thunderwing','Ion Wake'],
 10:['Rift Revenant','Event Horizon','Rift Standard','Void Crescent','Dimensional Fracture'],
 5:['Solar Imperator','Sunforged Filigree','Solar Standard','Helios Ascendant','Corona Fall'],
 1:['Apex Sovereign','Sovereign Radiance','Reigning Standard','Crown of the Skies','Royal Constellation'],
};
const stories={25:'Stormglass armor, silver flight vanes and electric cyan circuitry.',10:'Violet singularities, fractured crescents and dark iridescent armor.',5:'Sun-forged gold, sculpted radiant armor and a molten stellar heart.',1:'Ivory feathers, black titanium, champagne gold and a suspended sovereign crown.'};
export const ROYALE_SETS=Object.freeze(ROYALE_PICKAXES.map((pickaxe,index)=>Object.freeze({rank:pickaxe.rank,label:pickaxe.label,name:pickaxe.name,model:pickaxe.model,color:pickaxe.color,accent:pickaxe.accent,metal:pickaxe.metal,glyph:pickaxe.glyph,story:stories[pickaxe.rank],items:Object.freeze([...PRESTIGE_SLOTS.slice(0,-1).map((slot,n)=>Object.freeze({...pickaxe,id:slot+'-rank-'+pickaxe.rank,slot,art:slot==='outfit'?`shop/rank-${pickaxe.rank}.webp`:null,name:names[pickaxe.rank][n],shape:24+index,armor:pickaxe.rank===1?'#e5edf0':pickaxe.color,skin:'#121c23',hair:'#121c23',story:stories[pickaxe.rank]+(slot==='backbling'?' A tailored cape displays your current Royale rank.':''),description:stories[pickaxe.rank]+' Cosmetic only; no combat advantage.'})),pickaxe])})));
export const ROYALE_REWARDS=Object.freeze(ROYALE_SETS.flatMap(s=>s.items));
const byId=new Map(ROYALE_REWARDS.map(i=>[i.id,i]));
export const rankItem=id=>byId.get(id);
export const eligibleRankItems=(rank,score)=>Number.isInteger(rank)&&rank>0&&score>0?ROYALE_REWARDS.filter(i=>rank<=i.rank).map(i=>i.id):[];
export const rankSet=rank=>ROYALE_SETS.find(s=>s.rank===Number(rank));
export const rankingMetrics=mode=>mode==='royale'?['rating','wins','kills']:['kills','wins'];
export function rankLoadout(profile,access=[]){let next=profile;for(const slot of PRESTIGE_SLOTS)if(rankItem(profile?.[slot])&&!access.includes(profile[slot])){if(next===profile)next={...profile};next[slot]='';}return next;}
