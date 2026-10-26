// The original nomination vote is archived when the bundle poll opens.
export const ICON_CLOSES_AT=Date.parse('2026-10-27T15:15:00-04:00');
export const ICON_POLL_ID='jim-bundle-2026-10';
export const ICON_WINNER='Jim McLaughlin';
export const ICON_CATEGORIES=Object.freeze([
 {id:'pickaxe',label:'Pickaxe',hint:'What should Jim swing?',description:'Suggest the shape, theme or fun detail of his harvesting tool.',color:'#c6fa58'},
 {id:'wrap',label:'Weapon wrap',hint:'Give his weapons a signature look.',description:'Suggest colors, a pattern or an animated finish for his weapons.',color:'#65dfff'},
 {id:'back',label:'Back accessories',hint:'What goes on his back?',description:'Suggest a backpack, prop or other wearable back accessory.',color:'#ffb1df'},
 {id:'glider',label:'Glider',hint:'Make an entrance.',description:'Suggest what Jim should glide into the island with.',color:'#b9a2ff'},
 {id:'trail',label:'Dive trail',hint:'Leave a little personality in the sky.',description:'Suggest the colors, particles or effects that follow his dive.',color:'#ffc46b'},
]);
export const ICON_TEXT_LIMIT=100;
// Deliberately lighter than chat: playful language, names, numbers and emoji are
// allowed. Reject explicit sexual content, slurs, severe profanity and threats.
const terms=['fuck','fucking','fucker','motherfucker','shit','shitty','bullshit','bitch','asshole','cunt','dick','cock','pussy','penis','vagina','porn','porno','pornography','nude','nudes','naked','rape','rapist','nigger','nigga','faggot','fag','retard','retarded','tranny','kys','kkk','nazi','hitler'];
const blocked=new RegExp('(?:^|[^a-z0-9])(?:'+terms.map(t=>[...t].map(c=>c+'+').join('[\\W_]*')).join('|')+')(?:s|es)?(?=$|[^a-z0-9])','i');
const fold=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[аеорсхуіјѕһ]/g,c=>({'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','у':'y','і':'i','ј':'j','ѕ':'s','һ':'h'})[c]).replace(/[013457@$!|]/g,c=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i','|':'i'})[c]);
export function iconOptionText(value){
 if(typeof value!=='string'||value.length>400)throw Error('Use 3–100 characters for your idea.');
 const text=value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu,'').trim().replace(/\s+/gu,' ');
 if([...text].length<3||text.length>ICON_TEXT_LIMIT||!/[\p{L}\p{N}]/u.test(text))throw Error('Use 3–100 characters for your idea.');
 if(/[<>\\]|https?:|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text))throw Error('Write an idea in plain text, without links, contact details or markup.');
 const f=fold(text);if(blocked.test(f)||/\b(?:kill|hurt)\s+(?:you|yourself|jim)|\byou\s+(?:should|must)\s+die\b/i.test(f))throw Error('Keep it playful and reasonably appropriate: no slurs, explicit sexual content, threats or strong profanity.');
 return text;
}
export const iconOptionKey=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const iconVoteComplete=data=>!!data?.complete;
