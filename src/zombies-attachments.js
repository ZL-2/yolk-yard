export const Z_ATTACHMENTS={
 reflex:{slot:'optic',name:'Reflex sight',cost:80,detail:'Clearer sight picture; 1.15× zoom.',zoom:1.15},
 optic:{slot:'optic',name:'Recon optic',cost:150,detail:'1.3× zoom; 15% slower aiming.',zoom:1.3,adsTime:1.15},
 extended:{slot:'magazine',name:'Extended magazine',cost:150,detail:'30% capacity; 12% longer reload.',magazine:1.3,reload:1.12},
 quickmag:{slot:'magazine',name:'Quick-change magazine',cost:150,detail:'20% faster reload; 15% less capacity.',magazine:.85,reload:.8},
 drum:{slot:'magazine',name:'Drum magazine',cost:240,detail:'60% capacity; 30% longer reload.',magazine:1.6,reload:1.3},
 stabilizer:{slot:'grip',name:'Stabilizing grip',cost:150,detail:'30% tighter spread.',spread:.7},
 angled:{slot:'grip',name:'Light angled grip',cost:100,detail:'15% tighter spread; 5% faster reload.',spread:.85,reload:.95},
 suppressor:{slot:'barrel',name:'Suppressor',cost:150,detail:'Quiet report; 5% less damage.',damage:.95,adsSpread:.85},
 brake:{slot:'barrel',name:'Compensator',cost:150,detail:'20% tighter spread; 3% less damage.',spread:.8,damage:.97},
 longbarrel:{slot:'barrel',name:'Long barrel',cost:200,detail:'8% more damage; 10% wider moving spread.',damage:1.08,spread:1.1},
 stock:{slot:'stock',name:'Precision stock',cost:150,detail:'25% tighter aimed spread.',adsSpread:.75},
 lightstock:{slot:'stock',name:'Light stock',cost:100,detail:'10% faster reload; 8% wider spread.',reload:.9,spread:1.08},
};
export function attachmentIds(item){return item.attachments?Object.values(item.attachments).filter(id=>Z_ATTACHMENTS[id]):item.attachment&&Z_ATTACHMENTS[item.attachment]?[item.attachment]:[];}
export function applyAttachments(base,item){const stats={...base,attachments:attachmentIds(item)};for(const id of stats.attachments){const a=Z_ATTACHMENTS[id];for(const field of ['damage','spread','adsSpread','reload','reloadEmpty','magazine','adsTime']){const factor=a[field]??(field==='reloadEmpty'?a.reload:undefined);if(factor)stats[field]=(stats[field]??1)*factor;}if(a.zoom){stats.zoom/=a.zoom;if(stats.ads){stats.ads={...stats.ads,magnification:stats.ads.magnification*a.zoom};if(Number.isFinite(stats.ads.fov))stats.ads.fov/=a.zoom;}if(stats.magnification)stats.magnification*=a.zoom;}}stats.suppressed=stats.attachments.includes('suppressor');stats.magazine=Math.max(1,Math.round(stats.magazine));return stats;}
