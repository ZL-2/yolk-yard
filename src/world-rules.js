import {vaultDoorPose} from './vaults.js';
export const WORLD_RULES=Object.freeze({epicChestChance:.05,vaultUse:2,doorRange:2.7,doorCooldown:.45});
export const TACTICAL_SPRINT=Object.freeze({speed:8.8,arenaMultiplier:1.32,drain:18,recharge:22,delay:1.1,restart:25,raiseTime:.2,acceleration:5});

export function worldDoorBox(box,doors,definitions=[],time=0){
 const state=doors?.[box.doorId];if(!box.doorId||!state?.open)return box;
 const door=definitions.find(d=>d.id===box.doorId);
 if(!door?.vault)return state.passable!==false?null:box;
 const frame=doorFrame(door),reach=frame.width+frame.depth;
 const owner={...box,x:frame.x,z:frame.z,w:reach*2,d:reach*2,doorLeaf:door,collisionShape:{kind:'obb'}};
 updateDoorLeaf(owner,state,time);return owner;
}
function updateDoorLeaf(box,state,time){
 const door=box.doorLeaf,frame=doorFrame(door),angle=(door.yaw||0)+vaultDoorPose(door,state,time).angle;
 if(angle===box.doorAngle)return;box.doorAngle=angle;
 Object.assign(box.collisionShape,{kind:'obb',x:frame.x+Math.cos(angle)*frame.width/2,y:door.y,z:frame.z-Math.sin(angle)*frame.width/2,w:frame.width,h:door.h,d:frame.depth,yaw:angle});
}
export function cacheDoorCollisions(map){map.movingDoors=map.boxes.filter(b=>b.doorLeaf);}
export function updateDoorCollisions(map,doors,time){for(const box of map.movingDoors||[])updateDoorLeaf(box,doors?.[box.doorId],time);}
export function doorFrame(door){
 const yaw=door.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),alongX=Math.abs(c)>.5;
 const width=alongX?door.w:door.d,depth=alongX?door.d:door.w;
 return {yaw,width,depth:depth||.18,x:door.x-c*width/2,y:door.y,z:door.z+s*width/2};
}
