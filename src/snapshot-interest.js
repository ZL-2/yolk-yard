import {teammates} from './teams.js';
// Render poses are sampled; authoritative damage, projectiles, health,
// inventory, events and host-migration checkpoints are never delayed.
const POSE=['x','y','z','yaw','pitch','vx','vy','vz','grounded','moving','crouching','sliding','lowCrouch','sprintBlend'];
// Prediction state is only consumed by its owner (or the watched player).
// Sending it for every nearby opponent made human firefights quadratic in
// fields traversed and flooded the uplink with continually changing internals.
const PRIVATE=new Set(['inputQueue','ack','combatState','weaponCooldowns','pendingFireUntil','lastFirePress','lastJumpPress','jumpLatch','jumpHeld','jumpBuffer','crouchLatch','slideVX','slideVZ','slideAge','slideCooldown','slideUphill','slideStartX','slideStartZ','mobilityJumpWindow','sprintRest','sprintRecovery','vehicleLock','vehicleExitSince','phasedBuilds','mantleCooldown','nextShot','fireLatch','shotgunReadyAt','burstWeapon','burstLeft','burstTime','viewBlend','viewBoom','cameraEye','shotSpread','firstShot','recoilPitch','recoilYaw',
 // These feed the owner's HUD/reconciliation, never an opponent's model. The
 // watched player keeps the full row, including inventory and reward details.
 'ammo','reserve','bank','materials','field','fieldOrders','tutorial','training','chestId','chestProgress','cacheProgress','vaultProgress','swapUid','swapProgress','fall','redeploy','forceGlider','launchVelocity','lastHarvest','flightLatch','aimBreakUntil','traversalLock','afkRemaining','afkRemoved','recap','spawnRequested','stamina','exhausted','poppers']);
const PRECISION={x:1000,y:1000,z:1000,vx:1000,vy:1000,vz:1000,yaw:10000,pitch:10000,lean:1000,sprintBlend:1000};
export function remotePlayerRow(p,{compactInventory=false}={}){const row={};for(const key of Object.keys(p)){if(PRIVATE.has(key))continue;const value=p[key];if(value===undefined)continue;const scale=PRECISION[key];row[key]=scale&&Number.isFinite(value)?Math.round(value*scale)/scale:value;}if(compactInventory&&p.inventory)row.inventory=p.inventory.map((item,i)=>i===p.slot&&item?{id:item.id,weapon:item.weapon,pickaxe:item.pickaxe,rarity:item.rarity,bossId:item.bossId}:null);return row;}
export class SnapshotInterest {
 constructor(){this.poses=new Map();this.key=null;}
 players(state,recipient,{privatePlayers=true}={}){
  if(!state.royale||!recipient)return state.players;
  const key=state.royale.matchId+':'+state.round+':'+state.options.map;
  if(key!==this.key){this.poses.clear();this.key=key;}
  const observer=state.players.find(p=>p.id===(recipient.watchingId||recipient.killerId)&&p.health>0)||recipient;
  if(this.framePlayers!==state.players||this.frameTime!==state.time||this.privatePlayers!==privatePlayers){this.privatePlayers=privatePlayers;this.framePlayers=state.players;this.frameTime=state.time;this.rows=new Map();this.remoteRows=new Map();this.arrays=new Map();}
  const radius=observer.aim?750:observer.flight&&observer.flight!=='ground'?350:180,living=new Set();
  let selection='';const result=state.players.map(p=>{
   living.add(p.id);if(privatePlayers&&(p.id===recipient.id||p.id===observer.id)){selection+='2';return p;}
   let remote=this.remoteRows.get(p.id);if(!remote){remote=remotePlayerRow(p,{compactInventory:!privatePlayers});this.remoteRows.set(p.id,remote);}
   if(teammates(state.options,p,recipient)||p.health<=0||p.spectating||p.boss||(p.x-observer.x)**2+(p.z-observer.z)**2<radius*radius){selection+='1';return remote;}selection+='0';
   let sample=this.poses.get(p.id);
   if(!sample||state.time-sample.time>=.1||(p.x-sample.pose.x)**2+(p.y-sample.pose.y)**2+(p.z-sample.pose.z)**2>144||p.flight!==sample.flight||p.shotSerial!==sample.shot){const pose={};for(const k of POSE)pose[k]=p[k];sample={pose,time:state.time,flight:p.flight,shot:p.shotSerial};this.poses.set(p.id,sample);this.arrays.clear();}
   const cached=this.rows.get(p.id);if(cached?.sample===sample)return cached.row;
   const row={...remote};for(const key of POSE){const value=sample.pose[key],scale=PRECISION[key];row[key]=scale&&Number.isFinite(value)?Math.round(value*scale)/scale:value;}row.presentationAt=sample.time;
   this.rows.set(p.id,{sample,row});return row;
  });
  for(const id of this.poses.keys())if(!living.has(id))this.poses.delete(id);
  if(this.arrays.has(selection))return this.arrays.get(selection);this.arrays.set(selection,result);return result;
 }
}
