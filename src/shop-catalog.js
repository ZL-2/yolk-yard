// Original Ravelfront cosmetics. IDs are stable save/network identifiers.
export const SHOP_SLOTS=['outfit','pickaxe','wrap','backbling','glider','trail'];
export const SHOP_LABELS={outfit:'Outfits',pickaxe:'Pickaxes',wrap:'Weapon wraps',backbling:'Back accessories',glider:'Gliders',trail:'Dive trails'};
export const TIERS={uncommon:{name:'Field',color:'#7ece9c'},rare:{name:'Rare',color:'#60c7ff'},epic:{name:'Epic',color:'#c58cff'},legendary:{name:'Legendary',color:'#ffcb63'}};
export const SHOP_SETS=[
 ['starbound','Aster Recon','#344955','#5dd9ce',0,0,'epic','Aster Pathfinder','Survey Crescent','Relay Array','Kestrel Wing'],
 ['royal','Sunward Command','#66533a','#eab450',0,0,'legendary','Sunward Marshal','Command Maul','Field Standard','Horizon Foil'],
 ['neon','Night Circuit','#263a49','#61c6e8',0,0,'epic','Circuit Infiltrator','Arc Splitter','Signal Pack','Vector Kite'],
 ['frost','Polar Watch','#718a96','#d5e5de',0,0,'rare','Polar Warden','Frostbite Axe','Thermal Pack','Boreal Wing'],
 ['garden','Northfield Patrol','#485b43','#d6b16d',0,0,'rare','Northfield Scout','Trail Cutter','Ranger Pack','Canopy Foil'],
 ['reef','Breakwater Crew','#34555c','#dc936c',0,0,'rare','Breakwater Diver','Tide Hook','Dive Cylinder','Hydrofoil'],
 ['ember','Ironwake Foundry','#3b3938','#e99b49',0,0,'legendary','Ironwake Sentinel','Forge Hammer','Heat Exchanger','Emberwing'],
 ['candy','Rescue Division','#825b54','#e0d3b6',0,0,'rare','Field Responder','Rescue Hammer','Aid Pack','Response Sail'],
 ['midnight','Sable Recon','#323546','#919db2',0,0,'epic','Sable Observer','Nightfall Blade','Recon Array','Dusk Wing'],
 ['retro','Relay Engineering','#36606b','#e3ac52',0,0,'rare','Relay Engineer','Breach Wrench','Power Cell','Service Foil'],
 ['pirate','Coast Runners','#615449','#8dc6bd',0,0,'epic','Coast Runner','Salvage Hook','Expedition Pack','Trade Wind'],
 ['cloud','Frontier Cadre','#68777a','#b6cabb',0,0,'uncommon','Frontier Cadet','Field Pick','Cadet Pack','Patrol Kite'],
].map(([id,name,color,accent,hat,pattern,tier,outfit,pickaxe,backbling,glider],index)=>({id,name,color,accent,hat,pattern,tier,outfit,pickaxe,backbling,glider,index}));
const prices={outfit:[600,800,1100,1400],pickaxe:[350,500,700,950],wrap:[200,300,450,600],backbling:[250,400,600,800],glider:[400,600,850,1100],trail:[200,250,350,450]};
const names={outfit:s=>s.outfit,pickaxe:s=>s.pickaxe,wrap:s=>s.name+' Wrap',backbling:s=>s.backbling,glider:s=>s.glider,trail:s=>s.name+' Trail'};
const outfitStories={starbound:'Chart the forgotten relay routes in an Aster survey uniform and teal field gear.',royal:'Hold the line in Sunward command colors, with amber accents and a fitted field vest.',neon:'Move through the coastal blackout in a dark Circuit uniform with cool signal accents.',frost:'Take the northern watch in pale coastal colors and protective field equipment.',garden:'Patrol the overgrown relay roads in forest green with sand-colored equipment.',reef:'Return to the flooded freight districts in Breakwater teal and weathered copper accents.',ember:'Stand with the Ironwake crews in charcoal workwear and furnace-amber equipment.',candy:'Carry the Rescue Division colors into the frontier: muted clay, warm canvas and field gear.',midnight:'Watch the quiet approaches in Sable charcoal with low-contrast equipment.',retro:'Keep the coast connected in an engineer’s teal uniform and signal-amber equipment.',pirate:'Follow the salvage routes in weathered earth tones and sea-glass accents.',cloud:'Begin your frontier patrol in the Cadre’s slate uniform and pale field equipment.'};
export const SHOP_ITEMS=SHOP_SETS.flatMap(set=>SHOP_SLOTS.map(slot=>({id:`${slot}-${set.id}`,slot,name:names[slot](set),set:set.id,tier:set.tier,price:prices[slot][Object.keys(TIERS).indexOf(set.tier)],color:set.color,accent:set.accent,shape:set.index,profile:{color:set.color,accent:set.accent,hat:set.hat,pattern:set.pattern,finish:set.tier==='legendary'?3:2,eyewear:6},description:{outfit:outfitStories[set.id],pickaxe:'An original harvesting tool for Royale. Same reach, speed and damage as the starter.',wrap:'A finish for every weapon, including your sidearm. No stat changes.',backbling:'A detailed accessory worn on the back of your operator.',glider:'Deploys automatically when you glide in Royale. Flight stays unchanged.',trail:'A cosmetic ribbon trail while diving or gliding in Royale.'}[slot]})));
for(const set of SHOP_SETS)SHOP_ITEMS.push({...SHOP_ITEMS.find(i=>i.id===`outfit-${set.id}`),id:`outfit-${set.id}-alt`,name:set.outfit+' · Remix',price:Math.max(450,prices.outfit[Object.keys(TIERS).indexOf(set.tier)]-150),color:set.accent,accent:set.color,profile:{color:set.accent,accent:set.color,hat:set.hat,pattern:(set.pattern+3)%10,finish:1,eyewear:6}});
const byId=new Map(SHOP_ITEMS.map(item=>[item.id,item]));
export const shopItem=id=>byId.get(id);
export const validCosmetic=(slot,id)=>shopItem(id)?.slot===slot?id:'';
export const cosmeticProfile=p=>Object.fromEntries(SHOP_SLOTS.map(slot=>[slot,validCosmetic(slot,p?.[slot])]));
