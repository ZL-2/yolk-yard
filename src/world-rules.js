export const WORLD_RULES=Object.freeze({epicChestChance:.05,vaultUse:2,doorRange:2.7,doorCooldown:.45});
export const TACTICAL_SPRINT=Object.freeze({speed:8.8,arenaMultiplier:1.32,drain:18,recharge:22,delay:1.1,restart:25,raiseTime:.2,acceleration:5});

export const worldDoorBox=(box,doors)=>box.doorId&&doors?.[box.doorId]?.open?{...box,x:box.x-box.w/2,z:box.z-box.w/2,w:box.d,d:box.w}:box;
