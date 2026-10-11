const utilityItems=new Set(['popper','impulse','launchpad']);
export function activeBotUtility(p,now){
 const queued=p.brain?.utility;if(!queued)return null;
 const item=p.inventory?.[queued.slot];
 if(!Number.isFinite(queued.until)||queued.until<=now||p.use||!utilityItems.has(item?.id)||!(item.count>0)){p.brain.utility=null;return null;}
 return queued;
}
