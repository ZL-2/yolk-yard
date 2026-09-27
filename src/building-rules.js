// Classic Battle Royale reference and deliberate Yolk adaptations: docs/BUILDING_REFERENCE.md.
// Keep balance in this file; geometry and authority never duplicate these numbers.
export const MATERIALS={
 wood:{name:'Wood',health:150,start:90,seconds:4,tick:.5,gain:8,color:0xba8852,damageColor:0xffc681},
 brick:{name:'Brick',health:300,start:100,seconds:11.5,tick:.5,gain:9,color:0xbc705c,damageColor:0xff8061},
 metal:{name:'Metal',health:500,start:110,seconds:25,tick:.5,gain:8,color:0x799ba8,damageColor:0xb4eaff},
};
export const GRID=4,COST=10,CAP=999,EDIT_RANGE=8;
export const PICKAXE={player:20,environment:50,structure:75,weakMultiplier:2,interval:.45};
// Original Sunnybreak balancing, NOT claimed to be Fortnite object statistics.
export const HARVEST_TYPES={
 tree:{material:'wood',health:250,resources:55,volume:3.2},
 crate:{material:'wood',health:150,resources:32,volume:11},
 bench:{material:'wood',health:100,resources:25,volume:2},
 woodWall:{material:'wood',health:350,resources:60,volume:30},
 rock:{material:'brick',health:450,resources:48,volume:10},
 planter:{material:'brick',health:300,resources:30,volume:11},
 stoneWall:{material:'brick',health:500,resources:42,volume:30},
 lamp:{material:'metal',health:300,resources:14,volume:.55},
 barrels:{material:'metal',health:400,resources:22,volume:3},
 car:{material:'metal',health:700,resources:55,volume:16},
 metalWall:{material:'metal',health:650,resources:32,volume:30},
 metalFixture:{material:'metal',health:800,resources:48,volume:90},
};
export function harvestDefinition(box,map){
 const prop=map?.props?.find(p=>p.x===box.x&&p.z===box.z);
 const key=box.harvestType||(box.kind==='tree'?'tree':HARVEST_TYPES[prop?.kind]?prop.kind:box.material==='wood'?'woodWall':box.material==='metal'?(box.kind==='landmark'?'metalFixture':'metalWall'):'stoneWall');
 const def=HARVEST_TYPES[key]||HARVEST_TYPES.stoneWall;
 const volume=Math.max(.01,(box.w||1)*(box.h||1)*(box.d||1));
 const scale=Math.max(.2,Math.min(3,Math.sqrt(volume/def.volume)));
 return {type:key,material:box.material||def.material,health:Math.max(50,Math.round(def.health*scale/25)*25),resources:Math.max(1,Math.round(def.resources*scale)),weakPoints:true};
}
export function buildStats(piece){
 const def=MATERIALS[piece.material];
 // Shape-specific health ratios could not be verified for a single BR version.
 // Use a stable material maximum; edit/reset preserve health, never heal.
 return {maxHealth:def.health,start:def.start,gain:def.gain,tick:def.tick};
}
export function snappedFacing(yaw,previous){
 const turn=Math.PI/2,angle=Math.atan2(Math.sin(yaw),Math.cos(yaw));
 if(Number.isInteger(previous)){
  const diff=Math.atan2(Math.sin(angle-previous*turn),Math.cos(angle-previous*turn));
  if(Math.abs(diff)<=Math.PI/4+.07)return ((previous%4)+4)%4;
 }
 return ((Math.round(angle/turn)%4)+4)%4;
}
export const canEdit=(piece,player)=>!!piece&&!!player&&(piece.owner===player.id||(piece.team!=null&&piece.team===player.team&&piece.teamMode===true));

// Preserve a usable choice. Only walk forward around the material order when needed.
export function selectMaterial(bank,selected='wood',cost=COST){
 const order=Object.keys(MATERIALS),start=Math.max(0,order.indexOf(selected));
 for(let i=0;i<order.length;i++){const material=order[(start+i)%order.length];if((bank?.[material]||0)>=cost)return material;}
 return null;
}
