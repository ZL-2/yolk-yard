import {groundAt} from './terrain.js';
import {canStand,wallDistance} from './physics.js';
import {rollChest,rollItem,placeLoot,validLootPoint} from './royale-loot.js';
import {stormAt,ammoType,AMMO_CAPS} from './royale-data.js';
import {teamKey,teammates} from './teams.js';
import {itemsChanged} from './nearby-items.js';
import {awardMedal,fieldActive,resetFieldRecord} from './field-record.js';

export const OPERATIONS=Object.freeze({radius:8,capture:14,scan:.25,first:75,interval:105,max:3,lifetime:95});
export const ORDER_DEFS=Object.freeze({
  scavenge:{title:'Supply run',description:'Open 3 chests',target:3},
  damage:{title:'Apply pressure',description:'Deal 250 damage to opponents',target:250},
  explore:{title:'Coastal survey',description:'Visit 3 different districts',target:3},
});
const active=p=>p.contestant&&p.health>0&&!p.downed&&!p.spectating&&!p.afkRemoved&&(p.bot||p.connected!==false);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const timing=sim=>sim.options.storm==='quick'?.65:1;

export function initializeOperations(sim) {
  const districts=sim.map.districts||[],available=districts.filter(d=>sim.chests.some(c=>c.poi===d.id&&!c.vaultId));
  const hot=available[Math.floor(sim.random()*available.length)];
  sim.operations={hotspot:hot?{id:hot.id,name:hot.name,x:hot.x,z:hot.z}:null,uplink:null,sequence:0,nextAt:OPERATIONS.first*timing(sim),scanAt:sim.time};
  sim.fieldFirstElim=null;
  for(const p of sim.players.values()) {
    resetFieldRecord(p);p.fieldVisits=[];
    p.fieldOrders=p.bot||!p.contestant?[]:Object.entries(ORDER_DEFS).map(([id,d])=>({id,target:d.target,value:0,complete:false}));
  }
  // A hot drop uses existing authored chest sockets. No extra world meshes or
  // floor weapons above Rare; the two premium chests are the contested reward.
  if(hot) {
    const choices=sim.chests.filter(c=>c.poi===hot.id&&!c.vaultId);
    const offset=Math.floor(sim.random()*choices.length);
    for(let i=0;i<Math.min(2,choices.length);i++) {
      const c=choices[(offset+i)%choices.length];
      Object.assign(c,{hot:true,epic:true,source:'epic',contents:[...rollChest(sim.random,'epic'),{id:'flask',count:1,rarity:2}]});
    }
    sim.lootVersion++;
  }
}

export function advanceOrder(sim,p,id,amount=1) {
  const order=p?.fieldOrders?.find(o=>o.id===id);
  if(!order||order.complete||!active(p)||!fieldActive(sim)||!Number.isFinite(amount)||amount<=0)return;
  order.value=Math.min(order.target,order.value+amount);
  if(order.value+1e-6<order.target)return;
  order.complete=true;p.field.orders++;p.field.xp+=150;
  // Immediate, capped reserve supplies never replace the selected item.
  for(const type of new Set(p.inventory.filter(i=>i?.weapon).map(i=>ammoType(i.id))))p.bank[type]=Math.min(AMMO_CAPS[type],p.bank[type]+({shells:12,heavy:8,rockets:2}[type]||40));
  if(sim.options.building!==false)p.materials.wood=Math.min(999,p.materials.wood+60);
  sim.dropLoot(p,p.health<70?{id:'medkit',count:1,rarity:1}:{id:'mini',count:3,rarity:1});sim.syncInventory(p);
  sim.emit('field-order',{player:p.id,order:id,xp:150});
  if(p.fieldOrders.every(o=>o.complete)) {
    awardMedal(sim,p,'orders');sim.dropLoot(p,rollItem(sim.random,'epic','weapon'));
  }
}
export function operationsEvent(sim,type,e) {
  if(!sim.operations||!fieldActive(sim))return;
  const p=sim.players.get(e.player);if(!p||p.bot)return;
  if(type==='royale-cue'&&e.cue==='chest-open')advanceOrder(sim,p,'scavenge');
  if(type==='hit'&&sim.players.get(e.target)?.contestant&&e.target!==p.id&&!teammates(sim.options,p,sim.players.get(e.target)))advanceOrder(sim,p,'damage',e.amount);
}

// Predict the storm at landing + looting time. Validate the final offset too:
// placing beside a wall must never move a promised safe supply into the storm.
export function safeSupplyPoint(sim,lead=35) {
  const future=stormAt(sim.stormSteps,sim.elapsed+lead),radius=Math.min(200,future.radius-12);
  if(radius<12)return null;
  for(let i=0;i<16;i++) {
    const a=sim.random()*Math.PI*2,r=Math.sqrt(sim.random())*radius*.82;
    const x=future.x+Math.cos(a)*r,z=future.z+Math.sin(a)*r;
    if(Math.abs(x)>sim.map.size-14||Math.abs(z)>sim.map.size-14)continue;
    const point=placeLoot(sim.map,{x,y:groundAt(sim.map,x,z),z});
    if(point&&distance(point,future)<radius&&validLootPoint(sim.map,point,.8))return point;
  }
  return null;
}
export function spawnSupply(sim) {
  const spot=safeSupplyPoint(sim);if(!spot)return false;
  const chest={id:'supply-'+sim.lootId++,...spot,opened:false,supply:true,landAt:sim.time+18,contents:[...rollChest(sim.random,'epic'),{id:'flask',count:1,rarity:2}]};
  sim.chests.push(chest);itemsChanged(sim,'chests',chest);sim.lootVersion++;
  sim.emit('royale-cue',{cue:'supply-incoming'});return true;
}
function uplinkSpot(sim) {
  const future=stormAt(sim.stormSteps,sim.elapsed+40),candidates=(sim.map.floorLoot||[]).filter(p=>['porch','bridge-bank'].includes(p.room)&&distance(p,future)<future.radius-20);
  const offset=Math.floor(sim.random()*candidates.length);
  for(let i=0;i<Math.min(24,candidates.length);i++) {
    const q=candidates[(offset+i)%candidates.length],p={x:q.x,y:groundAt(sim.map,q.x,q.z),z:q.z};
    if(validLootPoint(sim.map,p,.8)&&canStand(sim.map,p,1.2))return {...p,poi:q.poi};
  }
  return safeSupplyPoint(sim,40);
}
function capture(sim,u,players) {
  u.status='secured';u.securedAt=sim.time;u.progress=OPERATIONS.capture;u.contested=false;
  const source=players[0];u.owner=source.name;
  const chest={id:'uplink-cache-'+u.id,x:u.x,y:u.y,z:u.z,opened:false,operation:true,epic:true,source:'epic',contents:[...rollChest(sim.random,'epic'),{id:'flask',count:2,rarity:2},{id:'medkit',count:1,rarity:1}]};
  sim.chests.push(chest);itemsChanged(sim,'chests',chest);sim.lootVersion++;
  for(const p of players){p.field.uplinks++;awardMedal(sim,p,'uplink');p.stamina=Math.min(100,(p.stamina||0)+25);}
  sim.emit('uplink-secured',{player:source.id,players:players.map(p=>p.id),name:u.name,x:u.x,y:u.y,z:u.z});
}
export function tickOperations(sim) {
  const ops=sim.operations;if(!ops||!fieldActive(sim)||sim.time<ops.scanAt)return;
  // Sampled occupancy keeps cost independent of render/physics frequency.
  const dt=Math.min(.5,Math.max(0,sim.time-ops.scanAt+OPERATIONS.scan));ops.scanAt=sim.time+OPERATIONS.scan;
  const living=[...sim.players.values()].filter(active);
  for(const p of living)if(!p.bot&&p.flight==='ground'&&!p.fieldOrders?.find(o=>o.id==='explore')?.complete) {
    const district=sim.map.districts?.find(d=>distance(p,d)<45);
    p.fieldVisits??=[];if(district&&!p.fieldVisits.includes(district.id)){p.fieldVisits.push(district.id);advanceOrder(sim,p,'explore');}
  }
  if(ops.uplink?.status==='secured'&&sim.time-ops.uplink.securedAt>18)ops.uplink=null;
  if(!ops.uplink&&ops.sequence<OPERATIONS.max&&sim.elapsed>=ops.nextAt) {
    const spot=uplinkSpot(sim);ops.nextAt=sim.elapsed+(spot?OPERATIONS.interval*timing(sim):12);
    if(spot){const name=sim.map.districts?.find(d=>d.id===spot.poi)?.name||'Coastal uplink';
      ops.uplink={...spot,id:++ops.sequence,name,status:'active',progress:0,team:null,contested:false,expiresAt:sim.time+OPERATIONS.lifetime*timing(sim),lastOccupied:sim.time};
      sim.emit('uplink-active',{name,x:spot.x,y:spot.y,z:spot.z});}
  }
  const u=ops.uplink;if(!u||u.status!=='active')return;
  if(sim.time>=u.expiresAt||sim.storm.active&&distance(u,sim.storm)>sim.storm.radius-4){ops.uplink=null;return;}
  const occupants=living.filter(p=>p.flight==='ground'&&p.grounded&&!p.vehicleId&&!p.traversal&&Math.abs(p.y-u.y)<2.5&&distance(p,u)<OPERATIONS.radius).filter(p=>{
    const origin={x:p.x,y:p.y+.8,z:p.z},delta={x:u.x-p.x,y:u.y+.8-origin.y,z:u.z-p.z},len=Math.hypot(delta.x,delta.y,delta.z);
    return len<.01||wallDistance(sim.map,origin,{x:delta.x/len,y:delta.y/len,z:delta.z/len},len)>=len-.1;
  });
  const teams=new Set(occupants.map(p=>teamKey(sim.options,p)));u.contested=teams.size>1;
  if(teams.size!==1){if(!teams.size&&sim.time-u.lastOccupied>3)u.progress=Math.max(0,u.progress-dt);return;}
  const team=teams.values().next().value;u.lastOccupied=sim.time;
  if(u.team!==team&&u.progress>0){u.progress=Math.max(0,u.progress-dt*2);return;}
  u.team=team;u.progress=Math.min(OPERATIONS.capture,u.progress+dt);
  if(u.progress+1e-6>=OPERATIONS.capture)capture(sim,u,occupants);
}
export function operationObjective(sim,p,nearSquad) {
  const u=sim.operations?.uplink;if(!u||u.status!=='active'||p.health<55||p.downed||p.vehicleId||!p.inventory?.some(i=>i?.weapon&&i.ammo>0)||distance(p,u)>115||!nearSquad(u))return null;
  // Only one third of available bots pursue the broadcast. Others keep normal
  // fights, looting and rotations; nobody receives hidden enemy coordinates.
  if(((p.joinedOrder||0)+u.id)%3!==0)return null;
  if(sim.storm.active&&distance(u,{x:sim.storm.nextX,z:sim.storm.nextZ})>sim.storm.nextRadius-8)return null;
  return {kind:'uplink',id:u.id,goal:{x:u.x,y:u.y,z:u.z}};
}
