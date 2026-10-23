// One public policy for ranking, eligibility, previews and the in-game explainer.
const count=n=>Number.isFinite(n)?Math.max(0,Math.min(1e9,Math.floor(n))):0;
export const ROYALE_RATING_VERSION=1;
export const royaleRating=({wins=0,kills=0}={})=>1000*count(wins)+Math.round(100*Math.sqrt(count(kills)));
export const ROYALE_PICKAXES=Object.freeze([
 {id:'pickaxe-rank-25',name:'Tempest Talon',rank:25,label:'TOP 25',color:'#123b53',accent:'#58edff',metal:'#bddeeb',model:'rank-tempest',swingStyle:'hook',glyph:'XXV',story:'A hooked stormglass blade, machined silver armor and an electric cyan heart. Reserved for the coast’s Top 25.'},
 {id:'pickaxe-rank-10',name:'Rift Reaver',rank:10,label:'TOP 10',color:'#302045',accent:'#d19aff',metal:'#c7b6ef',model:'rank-rift',swingStyle:'crescent',glyph:'X',story:'Twin crescent edges surround a suspended violet singularity. A trophy for the ten who break the field.'},
 {id:'pickaxe-rank-5',name:'Solar Dominion',rank:5,label:'TOP 5',color:'#462b1b',accent:'#ffad40',metal:'#f8d68c',model:'rank-solar',swingStyle:'hammer',glyph:'V',story:'A sun-forged executioner’s blade, layered gold vanes and a molten star core. Five places. No substitutes.'},
 {id:'pickaxe-rank-1',name:'Apex Sovereign',rank:1,label:'#1',color:'#172838',accent:'#e8fbff',metal:'#ffe2a1',model:'rank-apex',swingStyle:'crystal',glyph:'I',story:'Ivory edge wings, black titanium, a levitating crown and a brilliant sovereign core. Only the reigning number one may wield it.'},
].map(i=>Object.freeze({...i,slot:'pickaxe',set:'royale-prestige',tier:'legendary',price:0,exclusive:true,rankReward:true,description:i.story+' Cosmetic only; standard harvesting reach, speed and damage.'})));
export const rankPickaxe=id=>ROYALE_PICKAXES.find(i=>i.id===id);
export const eligibleRankPickaxes=(rank,score)=>Number.isInteger(rank)&&rank>0&&score>0?ROYALE_PICKAXES.filter(i=>rank<=i.rank).map(i=>i.id):[];
export const rankingMetrics=mode=>mode==='royale'?['rating','wins','kills']:['kills','wins'];
export function rankLoadout(profile,access=[]){return rankPickaxe(profile?.pickaxe)&&!access.includes(profile.pickaxe)?{...profile,pickaxe:''}:profile;}
