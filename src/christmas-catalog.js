const theme={id:'northstar-courier',name:'Northstar Courier',group:'originals',featured:true,
 color:'#a12635',accent:'#f3d07b',tier:'legendary'};
export const CHRISTMAS_SET=theme;
const pieces=[
 ['outfit','Northstar Courier',1500,'A red shearling coat, amber snow goggles and a white beard. The Northstar relief crew delivers in any weather.'],
 ['pickaxe','Candy Cane Hook',750,'A reinforced peppermint cane with a brass cap and a taped grip.'],
 ['wrap','Peppermint Stripe',500,'Diagonal sugar-white stripes over cranberry lacquer with brass trim.'],
 ['backbling','Special Delivery',550,'Three ribbon-wrapped parcels strapped into a snowproof delivery frame.'],
 ['glider','Northstar Sleigh',900,'A cranberry and spruce sleigh with curled brass runners and a golden star on the prow.'],
 ['trail','Starfall Ribbons',400,'Twin spirals of red and mint with golden stars and ice crystals.'],
];
export const CHRISTMAS_ITEMS=pieces.map(([slot,name,price,description])=>({
 id:slot+'-'+theme.id,slot,name,price,description,set:theme.id,model:theme.id,
 tier:theme.tier,color:theme.color,accent:theme.accent,featured:true,shape:19,
 armor:'#233d37',skin:'#ae755b',hair:'#e6e4df',
 profile:{color:theme.color,accent:theme.accent,hat:0,pattern:0,finish:2,eyewear:6},
}));
export const CHRISTMAS_BUNDLE={
 id:'bundle-'+theme.id,name:'Northstar Courier Bundle',slot:'bundle',set:theme.id,
 tier:theme.tier,price:3000,color:theme.color,accent:theme.accent,featured:true,
 items:CHRISTMAS_ITEMS.map(item=>item.id),
 description:'Six pieces of Northstar relief gear: the Northstar Courier outfit, Candy Cane Hook, Peppermint Stripe, Special Delivery, Northstar Sleigh and Starfall Ribbons.',
};
