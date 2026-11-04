export const BLACKOUT_HOLD = 'blackout-hold';
export const BLACKOUT_GATE = 'blackout-bulkhead';

export const BLACKOUT_LOGS = [
  {title:'01 · Distress call', speaker:'Cargo master', text:'Breakwater Control, the ship is pinned against the seawall. We were bound for Aster Command. Voss knew what was in the hold. If you find this, check his routing order.'},
  {title:'02 · Routing order', speaker:'Commandant Voss', text:'Divert the vessel to Breakwater. Keep the cargo sealed and off the harbor manifest. If the harbor loses power, keep the hold closed until my team arrives.'},
  {title:'03 · Nightglass intercept', speaker:'Lieutenant Nyx', text:'I cut the harbor power to stop the delivery. Every tower went dark. The ship hit the seawall, and the signal kept coming from inside the hold.'},
];

// The wreck and seawall use the same authored collision boxes as the island.
export function authorBlackout({box, ground, frontier, chests, floorLoot, landmarks}) {
  const deck = 8.8, lower = 2.2, x = 156;
  const steel = 0x354953, rust = 0x803d32, concrete = 0x626d69;
  const solid = (x,z,w,d,h,y,color=steel) => box(x,z,w,d,h,color,y,'blackout',{material:'metal',indestructible:true});
  const breakers = [
    {x:134,z:193,label:'WEST BREAKER'},
    {x:176,z:193,label:'EAST BREAKER'},
  ].map(point=>({...point,y:ground(point.x,point.z)}));
  const radios = [
    {x:156,y:lower,z:235},
    {x:96,z:-149},
    {x:-100,z:174},
  ].map(point=>({...point,y:point.y??ground(point.x,point.z)}));

  // A widened hull and raked bow. Three levels share continuous walkable floors.
  solid(151,229,22,46,.5,deck-.5);
  solid(153,205.5,17,1,.5,deck-.5,rust);
  solid(153.8,204.8,15.4,.4,.5,deck-.5,rust);
  solid(154.5,203.4,12.8,2.4,.5,deck-.5,rust);
  solid(154.8,202,9.7,.4,.5,deck-.5,rust);
  solid(155.3,201.4,7.4,1,.5,deck-.5,rust);
  solid(151,231,22,42,.6,lower-.6,rust);
  solid(151,231,20.9,42,4.52,-2.92,0x282e31);
  solid(153.5,207.6,12.1,4.8,4.52,-2.92,0x282e31);
  for(const [left,right,z,d] of [[151.6,153.65,202.4,1.4],[148.1,153.65,203.9,1.6],[144.45,153.65,205.45,1.5],[140.25,151.3,208,3.6]]){
    solid((left+right)/2,z,right-left,d,6.68,1.62,rust);
  }
  solid(140.25,231,.5,42,6.1,lower,rust);
  solid(142.25,211.6,4,.45,6.1,lower,rust);
  solid(142.25,227.8,4,.45,6.1,lower,rust);
  solid(161.75,248,.5,8,6.1,lower,rust);
  solid(161.75,232.5,.5,23,6.1,lower,rust);
  // Lower-deck breach and landing on the starboard side, leading to the stair passage.
  solid(164.5,217,5.5,9,.3,lower-.3);
  solid(161.75,211.5,.5,7,6.1,lower,rust);
  solid(161.75,218.5,.5,5,2.8,5.5,rust);
  solid(150.25,210.5,.5,5,6.1,lower,rust);
  solid(151,252,22,.5,6.1,lower,rust);
  solid(145.5,229.6,11,.45,6.1,lower);
  // Port engineering room and aft structural supports.
  solid(145,244,9.5,.4,4,lower,steel);
  solid(149.35,247.5,.4,7,4,lower,steel);
  for(const zz of [239,247])solid(141.65,zz,1.5,3,6,lower,concrete);
  solid(145,247.85,9.5,8.1,.28,deck-.28,steel);
  solid(x,229.6,4.5,.45,6.1,lower);
  // A full-width partition with a three-metre hatch on its east side.
  solid(151.75,229.6,3.5,.45,6.1,lower);
  solid(161.5,229.6,1,.45,6.1,lower);
  solid(159.5,229.6,3,.45,3.1,lower+3);
  const gate={id:BLACKOUT_GATE,x:159.5,y:lower,z:229.6,w:3,h:3,d:.24,material:'metal',vault:true,vaultId:BLACKOUT_HOLD};
  frontier.doors.push(gate);
  box(gate.x,gate.z,gate.w,gate.d,gate.h,steel,gate.y,'door',{material:'metal',doorId:gate.id,indestructible:true,health:1e6});

  // Seawall access descends through a covered utility passage to the lower deck.
  for(let i=0;i<19;i++){
    const z=193+i*.9, top=9.4-i*.4;
    solid(156,z,3.6,.9,.42,top-.42,concrete);
    if(i<12){
      for(const side of [-1,1])solid(156+side*1.95,z,.3,.9,2.35,top,concrete);
      if(i>2&&i<7)solid(156,z,4.2,.9,.28,top+2.35,concrete);
    }
  }
  solid(156,211,4.2,4,.4,lower-.4);
  solid(160,206,4,1.6,.4,lower-.4);
  solid(143,200,22,1.2,4,3.9,concrete);
  solid(156,190.86,3.6,.8,.41,8.47,concrete);
  solid(156,191.73,3.6,.94,.87,8.28,concrete);
  solid(142.5,212.8,3.5,5.5,.35,4.45,steel);
  solid(142.4,215.5,3.5,.65,.3,4.5,steel);
  for(let i=0;i<7;i++)solid(142.5,216.15+i*.57,3.4,.59,.34,4.46-i*.36,concrete);
  for(const z of [215,225,236,246]){
    solid(141.15,z,.48,.65,5.4,deck,steel);
    solid(161.1,z,.35,.6,4.6,deck,steel);
  }
  // Deck gangway, bridge housing and cargo cover.
  for(let i=0;i<13;i++)solid(160,193+i,2.4,1,.45,deck+.25-i*.019-.45);
  // Cargo rails tie the pylons together into two clear loading bays.
  for(const z of [215,236]){
    solid(151.15,z,20.5,.55,.44,deck+4.51,steel);
    solid(151.1,z+.04,8,.19,.53,deck+4.97,concrete);
  }
  solid(141.15,225.5,.42,21,.32,deck+5.15,steel);
  // Aft bridge has a real corridor and an elevated radio balcony.
  solid(158.8,246.8,.42,9.4,3.52,deck,0x71817b);
  solid(150.8,246.8,.42,9.4,3.52,deck,0x71817b);
  solid(154.8,251,8.4,.42,3.52,deck,0x71817b);
  solid(152.4,242.25,3.2,.45,3.52,deck,0x71817b);
  solid(158.1,242.25,1.4,.45,3.52,deck,0x71817b);
  solid(155.85,242.25,3.8,.45,1.0,deck+2.52,steel);
  solid(154.8,246.8,8.9,9.8,.26,deck+3.52,steel);
  solid(146.35,248.66,8.9,4.7,.29,deck+3.49,steel);
  for(let i=0;i<11;i++)solid(143.55,239.35+i*.66,2.4,.675,.33,deck+i*.343,steel);
  for(const x of [143.55,146.55,149.55])solid(x,250.93,2.8,.18,.9,deck+3.78,steel);
  solid(142.02,248.66,.18,4.7,.8,deck+3.78,steel);
  solid(152.5,249.25,2.1,1.4,.94,deck,concrete);
  solid(157.4,246.2,1.4,2.4,1.2,deck,steel);
  const containers=[{x:142.9,z:221,w:2.8,d:6.5,h:2.65,color:0x516775},{x:149.75,z:229,w:2.5,d:5.6,h:2.56,color:0x8e583f},{x:152.4,z:212,w:2.7,d:6,h:2.5,color:0x32676d},{x:159.3,z:222,w:2.8,d:7,h:2.7,color:0x9e542c},{x:152.5,z:229,w:2.8,d:6,h:2.6,color:0x6e747c}];
  for(const c of containers)solid(c.x,c.z,c.w,c.d,c.h,deck,c.color);
  for(const side of [-1,1])for(const z of [207,215,224,234,241])solid(side<0?140.27:161.85,z,.18,4,.65,deck,rust);
  for(const p of breakers)solid(p.x,p.z-.65,1.05,.55,1.1,p.y,steel);

  landmarks.push({id:'blackout-wreck',name:'The Breakwater Freighter',x:151,z:227,kind:'wreck',color:0xe6a655,risk:'high'});
  for(const [x,z] of [[155,208],[157,215],[155,224],[157,232]])floorLoot.push({x,z,y:deck,poi:'blackout-wreck',floor:0,source:'ground',role:'weapon',chance:1});
  floorLoot.push({x:146,z:228,y:deck,poi:'blackout-wreck',floor:0,source:'ground',role:'weapon',chance:1});
  chests.push({x:155.55,z:248,y:deck,poi:'blackout-wreck',source:'high',chance:1});
  chests.push({x:147.5,z:249,y:deck+3.78,poi:'blackout-wreck',source:'high',chance:1});
  chests.push({x:155,z:215,y:deck,poi:'blackout-wreck',source:'high',chance:1});
  for(const x of [153,159])chests.push({x,z:239,y:lower,poi:'blackout-wreck',source:'epic',chance:1,vaultId:BLACKOUT_HOLD});
  return {breakers,radios,gate,containers,deck,lower,x,z:220};
}
