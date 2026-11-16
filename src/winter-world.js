// Season 2 continues after the crew follows the distress call inland.
export const WINTER_SITES={
 borough:['Lantern Borough','EMERGENCY SHELTER / KEEP THE LANTERNS LIT','market'],
 farm:['Hollyfield Commons','FOOD AND FUEL / NEXT CONVOY AT DAWN','relief'],
 observatory:['Aster Signal Station','OUTBOUND CHANNEL / DISTRESS CALL REPEATING','signal'],
 docks:['Breakwater Relief Port','ROOK / ALL CARGO CLEARED FOR RELIEF','relief'],
 woods:['Silentpine Woods','NYX / FOLLOW THE AMBER LIGHTS','shelter'],
 works:['Frostworks Relay','RELAY REWIRED / POWER TO ASTER','signal'],
 terraces:['Yuletide Terraces','PUBLIC SHELTER / SUPPLIES IN THE SQUARE','market'],
 heights:['Northstar Heights','NORTHSTAR / SECOND SIGNAL ACQUIRED','signal'],
 crater:['Glacier Conservatory','THERMAL RESERVE / PUMPS OFFLINE','shelter'],
};
export function authorWinterWorld({districts,ground,clear,roadDistance,box,prop,chests,signs,blackout}){
 const light=(x,z,y)=>prop('winter-lantern',x,z,.48,.48,2.8,y,{decorative:true});
 const crate=(x,z,y,seed)=>prop('winter-parcel',x,z,1.2,1.05,.88,y,{seed});
 for(const district of districts){
  const [name,message,kind]=WINTER_SITES[district.id];
  const sign=signs.find(s=>s.x===district.x&&s.z===district.z+7&&s.text===district.name.toUpperCase());
  if(sign)sign.text=name.toUpperCase();
  district.name=name;
  let site;
  for(const radius of [9,14,19,24,29,34,40,46,51,57,63]){
   for(let i=0;i<32&&!site;i++){
    const angle=i*Math.PI/16+radius*.17;
    const x=Math.round(district.x+Math.cos(angle)*radius),z=Math.round(district.z+Math.sin(angle)*radius),y=ground(x,z);
    const grade=Math.max(...[[3,0],[-3,0],[0,3],[0,-3]].map(([dx,dz])=>Math.abs(ground(x+dx,z+dz)-y)));
    if(y>2&&grade<(district.id==='observatory'?1.7:.85)&&clear(x,z,3.7)&&roadDistance(x,z)>4.7)site={x,y,z};
   }
   if(site)break;
  }
  if(!site)continue;
  const {x,y,z}=site;
  const at=(dx,dz)=>ground(x+dx,z+dz);
  const place=(type,dx,dz,w,d,h)=>prop(type,x+dx,z+dz,w,d,h,at(dx,dz),{decorative:true});
  if(kind==='signal'){
   place('winter-transmitter',0,-1.4,3,2.2,6.2);
   place('generator',-2,-1.5,1.15,.85,1.05);
  }else if(kind==='market'){
   place('winter-spruce',0,-1.4,4,4,6.6);
   place('bench',-2.5,0,1.55,.55,.75);
  }else{
   place('medical-tent',0,-1.6,4.6,2.8,2.6);
   place('winter-spruce',-2.4,-.8,1.85,1.85,3.6);
  }
  // Open front faces the approach. The low walls serve as real combat cover.
  for(const side of [-1,1]){
   const xx=x+side*2.7, zz=z+1.35, yy=ground(xx,zz);
   box(xx,zz,.48,2,.93,0x6f8792,yy-.12,'world-detail',{material:'brick',surface:'concrete',indestructible:true});
   light(xx,zz-1.45,ground(xx,zz-1.45));
  }
  crate(x-1.55,z+.65,at(-1.55,.65),0);
  crate(x+1.6,z+.1,at(1.6,.1),1);
  prop('winter-board',x,z-2.75,3,.2,2.6,at(0,-2.75),{decorative:true,message});
  chests.push({x,y:at(0,1.9),z:z+1.9,poi:district.id,source:'high',chance:1,winterGift:true});
 }
 // Outline the freighter’s upper deck with relief lights and supplies. Signs
 // and lights are scenery so they cannot obstruct the original breaker route.
 for(const z of [212,218,224,230,236,242]){
  for(const x of [143,169])light(x,z,blackout.deck);
 }
 prop('winter-board',151,215,4.3,.2,3,blackout.deck,{decorative:true,message:'RELIEF VESSEL / SIGNAL RELAY ACTIVE'});
 prop('winter-spruce',163,220,2.6,2.6,4.8,blackout.deck,{decorative:true});
 for(const [x,z,seed] of [[163,218,0],[165,220,1],[163,222,2]])crate(x,z,blackout.deck,seed);
}
