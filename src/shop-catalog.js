import {JIM_OUTFITS,JIM_NORMAL} from './jim-catalog.js';
import {DEFAULT_OPERATOR,DEFAULT_OUTFIT_ID} from './default-operator.js';
import {TOURNAMENT_PICKAXE} from './tournament.js';
import {ROYALE_REWARDS} from './royale-ranking.js';
import {NEW_COLLECTIONS} from './shop-collections.js';
import {ICON_BUNDLE_ITEMS} from './icon-bundle-catalog.js';
// Original Ravelfront cosmetics. IDs are stable save/network identifiers.
export const SHOP_SLOTS=['outfit','pickaxe','wrap','backbling','glider','trail'];
export const SHOP_LABELS={outfit:'Outfits',pickaxe:'Pickaxes',wrap:'Weapon wraps',backbling:'Back accessories',glider:'Gliders',trail:'Dive trails'};
export const TIERS={uncommon:{name:'Field',color:'#7ece9c'},rare:{name:'Rare',color:'#60c7ff'},epic:{name:'Epic',color:'#c58cff'},legendary:{name:'Legendary',color:'#ffcb63'}};
export const SHOP_SETS=[
 ['starbound','Aster Recon','#344955','#5dd9ce',0,0,'epic','Aster Pathfinder','Survey Breacher','Relay Array','Kestrel Wing'],
 ['royal','Sunward Command','#66533a','#eab450',0,0,'legendary','Sunward Marshal','Command Maul','Field Standard','Horizon Foil'],
 ['neon','Night Circuit','#263a49','#61c6e8',0,0,'epic','Circuit Infiltrator','Arc Splitter','Signal Pack','Vector Parafoil'],
 ['frost','Polar Watch','#718a96','#d5e5de',0,0,'rare','Polar Warden','Frostbite Axe','Thermal Pack','Boreal Wing'],
 ['garden','Northfield Patrol','#485b43','#d6b16d',0,0,'rare','Northfield Scout','Trail Cutter','Ranger Pack','Canopy Foil'],
 ['reef','Breakwater Crew','#34555c','#dc936c',0,0,'rare','Breakwater Diver','Tide Hook','Dive Cylinder','Hydrofoil'],
 ['ember','Ironwake Foundry','#3b3938','#e99b49',0,0,'legendary','Ironwake Sentinel','Forge Hammer','Heat Exchanger','Emberwing'],
 ['candy','Rescue Division','#825b54','#e0d3b6',0,0,'rare','Field Responder','Rescue Hammer','Aid Pack','Response Sail'],
 ['midnight','Sable Recon','#323546','#919db2',0,0,'epic','Sable Observer','Nightfall Blade','Recon Array','Dusk Wing'],
 ['retro','Relay Engineering','#36606b','#e3ac52',0,0,'rare','Relay Engineer','Breach Wrench','Power Cell','Service Foil'],
 ['pirate','Coast Runners','#615449','#8dc6bd',0,0,'epic','Coast Runner','Salvage Hook','Expedition Pack','Trade Wind'],
 ['cloud','Frontier Cadre','#68777a','#b6cabb',0,0,'uncommon','Frontier Cadet','Field Pick','Cadet Pack','Patrol Wing'],
].map(([id,name,color,accent,hat,pattern,tier,outfit,pickaxe,backbling,glider],index)=>({id,name,color,accent,hat,pattern,tier,outfit,pickaxe,backbling,glider,index}));
const prices={outfit:[600,800,1100,1400],pickaxe:[350,500,700,950],wrap:[200,300,450,600],backbling:[250,400,600,800],glider:[400,600,850,1100],trail:[200,250,350,450]};
const names={outfit:s=>s.outfit,pickaxe:s=>s.pickaxe,wrap:s=>s.name+' Wrap',backbling:s=>s.backbling,glider:s=>s.glider,trail:s=>s.name+' Trail'};
const outfitStories={starbound:'Chart the forgotten relay routes in an Aster survey uniform and teal field gear.',royal:'Hold the line in Sunward command colors, with amber accents and a fitted field vest.',neon:'Move through the coastal blackout in a dark Circuit uniform with cool signal accents.',frost:'Take the northern watch in pale coastal colors and protective field equipment.',garden:'Patrol the overgrown relay roads in forest green with sand-colored equipment.',reef:'Return to the flooded freight districts in Breakwater teal and weathered copper accents.',ember:'Stand with the Ironwake crews in charcoal workwear and furnace-amber equipment.',candy:'Carry the Rescue Division colors into the frontier: muted clay, warm canvas and field gear.',midnight:'Watch the quiet approaches in Sable charcoal with low-contrast equipment.',retro:'Keep the coast connected in an engineer’s teal uniform and signal-amber equipment.',pirate:'Follow the salvage routes in weathered earth tones and sea-glass accents.',cloud:'Begin your frontier patrol in the Cadre’s slate uniform and pale field equipment.'};
export const SHOP_ITEMS=SHOP_SETS.flatMap(set=>SHOP_SLOTS.filter(slot=>slot!=='outfit').map(slot=>({id:`${slot}-${set.id}`,slot,name:names[slot](set),set:set.id,tier:set.tier,price:prices[slot][Object.keys(TIERS).indexOf(set.tier)],color:set.color,accent:set.accent,shape:set.index,profile:{color:set.color,accent:set.accent,hat:set.hat,pattern:set.pattern,finish:set.tier==='legendary'?3:2,eyewear:6},description:{outfit:outfitStories[set.id],pickaxe:'An original harvesting tool for Royale. Same reach, speed and damage as the starter.',wrap:'A finish for every weapon, including your sidearm. No stat changes.',backbling:'A detailed accessory worn on the back of your operator.',glider:'Deploys automatically when you glide in Royale. Flight stays unchanged.',trail:'A cosmetic ribbon trail while diving or gliding in Royale.'}[slot]})));
for(const set of NEW_COLLECTIONS){
 SHOP_SETS.push(set);
 for(const slot of SHOP_SLOTS){const price=slot==='outfit'?set.price:({pickaxe:750,backbling:600,glider:950,wrap:450,trail:350}[slot]);
  SHOP_ITEMS.push({id:`${slot}-${set.id}`,slot,name:set[slot],set:set.id,tier:set.tier,price,color:set.color,accent:set.accent,shape:set.shape,model:set.model,armor:set.armor,skin:set.skin,hair:set.hair,featured:true,art:slot==='outfit'?set.art:null,styleLabel:'Signature',styleRoot:slot==='outfit'?`outfit-${set.id}`:null,profile:{color:set.color,accent:set.accent,hat:0,pattern:0,finish:2,eyewear:6},description:slot==='outfit'?set.story:`Part of ${set.name}. Original ${SHOP_LABELS[slot].toLowerCase()} with the ${set.outfit} collection’s own silhouette and materials.`});
 }
}
SHOP_SETS.push({id:'jim-icon',name:'Jim McLaughlin',featured:true,group:'icons',color:'#49566c',accent:'#a6d885'});
SHOP_ITEMS.push(...JIM_OUTFITS,...ICON_BUNDLE_ITEMS,DEFAULT_OPERATOR,...ROYALE_REWARDS,TOURNAMENT_PICKAXE);
// Approved release catalog, shared by shop, loadouts and model builders.
const byId=new Map([...SHOP_ITEMS,...ICON_BUNDLE_ITEMS].map(item=>[item.id,item]));
export const shopItem=id=>byId.get(id);
export const outfitStyles=id=>{const item=shopItem(id);return item?.styleRoot?SHOP_ITEMS.filter(i=>i.styleRoot===item.styleRoot):item?[item]:[];};
export const SHOP_BUNDLES=NEW_COLLECTIONS.map(set=>({id:`bundle-${set.id}`,name:set.name+' Bundle',slot:'bundle',set:set.id,tier:set.tier,price:set.bundlePrice,color:set.color,accent:set.accent,art:set.art,featured:true,items:SHOP_SLOTS.map(slot=>`${slot}-${set.id}`),description:`${set.outfit} and five matching pieces of equipment.`}));
SHOP_BUNDLES.unshift({id:'bundle-jim-icon',name:'Jim McLaughlin Bundle',slot:'bundle',set:'jim-icon',tier:'epic',art:'season/jim-icon.webp',price:3000,color:'#49566c',accent:'#a6d885',featured:true,items:[JIM_NORMAL,...ICON_BUNDLE_ITEMS.map(i=>i.id)],description:'Jim’s sweatshirt outfit and all five accessories. Golf is earned separately by winning an online match while wearing Jim; purchasing the bundle does not unlock it.'});
const bundleById=new Map(SHOP_BUNDLES.map(item=>[item.id,item]));
export const shopOffer=id=>bundleById.get(id)||(shopItem(id)?.reviewOnly?undefined:shopItem(id));
export const offerGrants=offer=>[...new Set((offer.items||[offer.id]).flatMap(id=>{const item=shopItem(id);return item?.styleRoot?outfitStyles(id).filter(i=>!i.winReward).map(i=>i.id):[id];}))];
// Recomputed inside the wallet lock, never trusted from a rendered button.
export function quoteOffer(wallet,id){
 const offer=shopOffer(id);if(!offer)return null;
 const owned=new Set(wallet.owned||[]),parts=offer.items||[offer.id];
 const has=id=>{const item=shopItem(id);return item?.styleRoot?outfitStyles(id).some(i=>owned.has(i.id)):owned.has(id);};
 const remaining=parts.filter(id=>!has(id)),ownedValue=parts.filter(has).reduce((sum,id)=>sum+shopItem(id).price,0),total=parts.reduce((sum,id)=>sum+shopItem(id).price,0);
 const price=remaining.length?Math.max(0,offer.price-ownedValue):0;
 return {offer,price,total,owned:remaining.length===0,ownedCount:parts.length-remaining.length,count:parts.length,remaining,grants:offerGrants(offer).filter(id=>!owned.has(id)),saving:Math.max(0,remaining.reduce((n,id)=>n+shopItem(id).price,0)-price)};
}
export const validCosmetic=(slot,id)=>shopItem(id)?.slot===slot&&!shopItem(id).reviewOnly?id:slot==='outfit'?DEFAULT_OUTFIT_ID:'';
export const cosmeticProfile=p=>Object.fromEntries(SHOP_SLOTS.map(slot=>[slot,validCosmetic(slot,p?.[slot])]));
