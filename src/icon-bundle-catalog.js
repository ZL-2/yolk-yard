// Approved Jim accessories. Stable IDs preserve review and saved loadout references.
export const ICON_BUNDLE_ITEMS = [
  {id:'pickaxe-jim-sixty',slot:'pickaxe',name:'Sixty Degrees',color:'#9bb7b5',accent:'#d3fd91',swingStyle:'golf',description:'A forged 60° lob wedge. Milled face grooves, stepped chrome shaft, wrapped grip and a sweeping follow-through.'},
  {id:'wrap-jim-watermelon',slot:'wrap',name:'CUBA Watermelon',color:'#f4f1df',accent:'#ef4162',description:'CUBA Watermelon can-lid graphics with red fruit print, green trim and cream panels.'},
  {id:'backbling-jim-keepsake',slot:'backbling',name:'Crown Russe Vodka',color:'#edf5ee',accent:'#d92e26',description:'A Crown Russe Vodka clear bottle with a red cap, red-and-white label, fitted leather harness and gently moving liquid surface.'},
  {id:'glider-jim-sleepingbag',slot:'glider',name:'Bedtime Flight',color:'#174b49',accent:'#e7be78',description:'Unzip, unfold, take flight. A quilted sleeping bag becomes a broad canopy with a padded hood, fluttering ties and articulated panels.'},
  {id:'trail-jim-whiteout',slot:'trail',name:'White Goo',color:'#f8fffd',accent:'#d3e7f1',description:'Glossy white slime stretches into four flowing strands, with ripples, tapered ends and tumbling droplets.'},
].map(item=>Object.freeze({...item,set:'jim-icon',tier:'epic',price:({pickaxe:750,wrap:450,backbling:600,glider:950,trail:350}[item.slot]),featured:true,iconBundle:true,reviewOnly:false}));

export const ICON_BUNDLE_IDS=Object.freeze(Object.fromEntries(ICON_BUNDLE_ITEMS.map(item=>[item.slot,item.id])));
