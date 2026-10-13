export const WORLD_RULES=Object.freeze({epicChestChance:.05,vaultUse:2,doorRange:2.7,doorCooldown:.45});
export const TACTICAL_SPRINT=Object.freeze({speed:8.8,arenaMultiplier:1.32,drain:18,recharge:22,delay:1.1,restart:25,raiseTime:.2,acceleration:5});

export const worldDoorBox=(box,doors)=>box.doorId&&doors?.[box.doorId]?.open&&doors[box.doorId].passable!==false?null:box;
export function doorFrame(door){
 const yaw=door.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),alongX=Math.abs(c)>.5;
 const width=alongX?door.w:door.d,depth=alongX?door.d:door.w;
 return {yaw,width,depth:depth||.18,x:door.x-c*width/2,y:door.y,z:door.z+s*width/2};
}
