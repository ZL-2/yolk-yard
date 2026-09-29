import {nearbyItems} from './nearby-items.js';
import {gun,weapon,mode} from './data.js';
import {falloffAt} from './combat.js';
import {ITEMS,ammoType,AMMO_CAPS} from './royale-data.js';
import {dist,candidates,canStand} from './physics.js';
import {groundAt} from './terrain.js';
import {seesPoint} from './bot-perception.js';
import {isWarmup} from './royale-phases.js';
import {BOT_WORLD_SENSES} from './bot-config.js';
export function selectWeapon(p,target){
 const distance=target?dist(p,target):22;
 if(!p.inventory){const primary=weapon(p.weapon);return p.ammo[1]>0&&(!p.ammo[0]&&(!p.reserve[0]||distance<10)||distance<8&&(primary.optic==='scope'||primary.projectile))?1:0;}
 const options=p.inventory.map((item,slot)=>({item,slot})).filter(({item})=>item?.weapon&&(item.ammo>0||p.bank[ammoType(item.id)]>0));
 const score=({item,slot})=>{const w=weapon(item.id),[near,far]=w.engage;return (item.ammo>0?15:0)+(slot===p.slot?4:0)+(item.rarity||0)*2+falloffAt(w,distance)*22+(distance>=near&&distance<=far?12:-Math.min(20,Math.abs(distance-(near+far)/2)*.3))-(w.projectile&&distance<8?80:0);};
 options.sort((a,b)=>score(b)-score(a));return options[0]?.slot||0;
}
export function usefulLoot(p,item){
 if(item.ammoType){const used=p.inventory.some(i=>i?.weapon&&ammoType(i.id)===item.ammoType);return used&&p.bank[item.ammoType]<AMMO_CAPS[item.ammoType]*.5?35:0;}
 if(item.resource)return p.materials[item.resource]<100?12:0;
 const empty=p.inventory.slice(1).filter(i=>!i).length;
 if(item.weapon){const weapons=p.inventory.filter(i=>i?.weapon);if(!weapons.length)return 100;const w=weapon(item.id),similar=weapons.find(i=>weapon(i.id).role===w.role);if(similar)return (item.rarity||0)>(similar.rarity||0)?25+(item.rarity||0)*5:0;if(weapons.length<3&&empty)return 45;return 0;}
 const def=ITEMS[item.id];if(!def)return 0;const stack=p.inventory.find(i=>i?.id===item.id);if(!empty&&(!stack||stack.count>=def.stack))return 0;
 return def.kind==='heal'?(p.health<70?65:22):def.kind==='shield'?(p.shield<50?60:25):def.kind==='splash'?50:empty&&p.inventory.filter(i=>i&&!i.weapon&&!i.pickaxe).length<2?14:0;
}
export function coverPoint(sim,p,enemy){
 let best=null,score=Infinity;
 for(const b of candidates(sim.map,p,null,0,14)){
  if(b.h<1.15||b.y>p.y+1||Math.hypot(b.x-p.x,b.z-p.z)>14||b.kind==='boundary')continue;
  const dx=b.x-enemy.x,dz=b.z-enemy.z,l=Math.hypot(dx,dz)||1;
  for(const shift of [-1,0,1]){const q={x:b.x+dx/l*(b.w/2+1.2)-dz/l*shift,y:p.y,z:b.z+dz/l*(b.d/2+1.2)+dx/l*shift};
   const d=dist(p,q);if(d<score&&canStand(sim.map,q,.5)&&!seesPoint(sim,q,enemy)){score=d;best=q;}}
 }return best;
}
export function stormPriority(sim,p,skill){
 const s=sim.storm;if(!s?.active||isWarmup(sim.stage))return null;
 const outside=Math.hypot(p.x-s.x,p.z-s.z)>s.radius,travel=Math.max(0,Math.hypot(p.x-s.nextX,p.z-s.nextZ)-s.nextRadius*.78)/5;
 if(!outside&&travel+skill.stormMargin<s.seconds)return null;
 const angle=Math.atan2(p.z-s.nextZ,p.x-s.nextX),r=Math.max(0,s.nextRadius*.55);
 const x=s.nextX+Math.cos(angle)*r,z=s.nextZ+Math.sin(angle)*r;
 return {kind:'rotate',urgent:outside,goal:{x,z,y:groundAt(sim.map,x,z)},travel};
}
export function chooseObjective(sim,p,brain,skill,target){
 const royale=!!p.inventory&&!isWarmup(sim.stage),storm=royale?stormPriority(sim,p,skill):null;
 const underFire=sim.time-(brain.attackedAt??-100)<2.5,threat=!!target&&(target.visible||underFire);
 if(storm?.urgent)return storm;
 if(threat){
  const unarmed=!!p.inventory&&!p.inventory.some(i=>i?.weapon&&(i.ammo>0||p.bank[ammoType(i.id)]>0));
  if(unarmed){const cover=coverPoint(sim,p,target);if(cover)return {kind:'cover',goal:cover};const dx=p.x-target.x,dz=p.z-target.z,len=Math.hypot(dx,dz)||1;return {kind:'retreat',goal:{x:p.x+dx/len*8,y:p.y,z:p.z+dz/len*8}};}
  const low=p.health<skill.retreat||p.reloadEnd>sim.time||p.ammo[p.slot]===0;
  if(low||underFire&&sim.random()<skill.cover){const cover=coverPoint(sim,p,target);if(cover)return {kind:'cover',goal:cover,enemy:target};}
  if(storm&&dist(p,target)>14)return storm;
  return {kind:'fight',goal:target,enemy:target};
 }
 if(storm)return storm;
 if(brain.assistUntil>sim.time&&p.health>=skill.retreat&&(!p.inventory||p.inventory.some(i=>i?.weapon&&i.ammo>0))){const mate=sim.players.get(brain.assistMate);if(mate?.health>0&&teammates(sim.options,p,mate))return {kind:'support',goal:{x:mate.x+brain.side*5,y:mate.y,z:mate.z}};}
 if(royale){
  const heal=p.inventory.findIndex(i=>i&&((ITEMS[i.id]?.kind==='heal'&&p.health<80)||(ITEMS[i.id]?.kind==='shield'&&p.shield<Math.min(100,ITEMS[i.id].cap||100))||(i.id==='splash'&&(p.health<85||p.shield<70))));
  if(heal>=1&&!underFire){if(target){const cover=coverPoint(sim,p,target);if(cover&&dist(p,cover)>1)return {kind:'cover',goal:cover};}return {kind:'heal',goal:{x:p.x,y:p.y,z:p.z},slot:heal};}
  // Items become known by proximity + LOS. Authored rooms guide searches, not hidden rolls.
  for(const item of nearbyItems(sim,'loot',p,28))if(dist(p,item)<28&&seesPoint(sim,p,item))brain.lootMemory[item.uid]={uid:item.uid,at:sim.time};
  let best=null,bestValue=0;
  for(const item of sim.loot){const known=brain.lootMemory[item.uid];if(!known||sim.time-known.at>35)continue;const value=usefulLoot(p,item)/(1+dist(p,item)*.055);if(value>bestValue){bestValue=value;best=item;}}
  if(best)return {kind:'loot',goal:{x:best.x,y:best.y,z:best.z},uid:best.uid};
  const weapons=p.inventory.filter(i=>i?.weapon),needs=weapons.length<2||!weapons.some(i=>i.ammo+p.bank[ammoType(i.id)]>10)||p.shield<35;
  if(needs){const chest=nearbyItems(sim,'chests',p,20).filter(c=>!c.opened&&(!c.landAt||c.landAt<=sim.time)&&dist(p,c)<20&&(dist(p,c)<BOT_WORLD_SENSES.chestHumRadius||seesPoint(sim,p,c))).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(chest)return {kind:'chest',goal:{x:chest.x,y:chest.y,z:chest.z},id:chest.id};}
  if(!underFire&&p.materials.wood<40&&weapons.length){const tree=[...candidates(sim.map,p,null,0,15)].filter(b=>b.kind==='tree'&&dist(p,b)<15&&seesPoint(sim,p,b)).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(tree)return {kind:'harvest',goal:{x:tree.x,y:tree.y,z:tree.z}};}
  if(needs){const anchors=(sim.map.floorLoot||[]).filter(q=>q.role==='weapon'&&sim.time-(brain.visited[q.id]??-100)>35).sort((a,b)=>dist(p,a)-dist(p,b));if(anchors[0])return {kind:'search-room',goal:anchors[0],id:anchors[0].id};}
 }
 if(target)return {kind:'investigate',goal:{x:target.x,y:target.y,z:target.z},id:target.id};
 if(teamMode(sim.options)){const mates=[...sim.players.values()].filter(t=>teammates(sim.options,p,t)&&t.health>0&&dist(p,t)<70);const mate=mates.find(t=>t.brain?.target)||mates.find(t=>dist(p,t)>22);if(mate)return {kind:'support',goal:{x:mate.x+brain.side*5,y:mate.y,z:mate.z}};}
 if(!p.inventory){const pickup=sim.pickups?.filter(i=>sim.time>=i.availableAt&&(i.type==='health'&&p.health<70||i.type==='ammo'&&p.reserve[p.slot]<10)).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(pickup)return {kind:'resupply',goal:pickup};}
 const landmarks=royale?[...(sim.map.districts||[]),...(sim.map.landmarks||[])]:(sim.map.spawns||[[0,0]]).map(([x,z],i)=>({x,z,id:'patrol-'+i}));
 const safeLandmarks=landmarks.filter(q=>!sim.storm?.active||!royale||Math.hypot(q.x-sim.storm.nextX,q.z-sim.storm.nextZ)<sim.storm.nextRadius*.9);
 const choices=safeLandmarks.length?safeLandmarks:landmarks;
 choices.sort((a,b)=>((brain.visited[a.id||a.name]||-100)+dist(p,a)*.2)-((brain.visited[b.id||b.name]||-100)+dist(p,b)*.2));
 const q=choices[0]||{x:0,z:0};return {kind:royale?'rotate-poi':'patrol',id:q.id||q.name,goal:{x:q.x,y:q.y??groundAt(sim.map,q.x,q.z),z:q.z}};
}
import {teammates,teamMode} from './teams.js';
