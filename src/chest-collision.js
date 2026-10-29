// Shared by authoritative movement, projectile rays and remote prediction.
export function syncChestCollisions(map,chests=[],time=0){
 const previous=map.chestCollisionState;let changed=!previous||previous.length!==chests.length;
 const boxes=[];for(const c of chests){let y=c.y;
 if(c.supply&&!c.landed&&c.landAt){if(Number.isFinite(c.cutAt)){const age=Math.max(0,time-c.cutAt);y=Math.max(c.y,c.cutHeight-4*age-12*age*age);}else y=c.y+Math.max(0,(c.landAt-time)*4);}
 else if(c.motion){const age=Math.max(0,time-c.motion.at);y=Math.max(c.motion.floor,c.motion.from+(c.motion.vy||0)*age-12*age*age);}
 const old=previous?.[boxes.length],h=c.opened?.96:1.26;
 if(!old||old.chestId!==c.id||old.x!==c.x||old.y!==y||old.z!==c.z||old.h!==h)changed=true;
 boxes.push(old&&old.chestId===c.id&&old.x===c.x&&old.y===y&&old.z===c.z&&old.h===h?old:{x:c.x,y,z:c.z,w:1.83,h,d:1.3,chestId:c.id,objectId:'chest:'+c.id,indestructible:true});
 }
 if(changed){map.chestCollisionState=boxes;map.chestCollisionMap={size:map.size,boxes};}
}
