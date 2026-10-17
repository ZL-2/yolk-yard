import {Z_CONTRACTS,Z_ZONES} from './zombies-map.js';
import {zAlive} from './zombies-expedition-config.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function initContracts(sim){sim.zContracts=Z_CONTRACTS.map(t=>({...t,status:'available',owner:null,progress:0,goal:0,targets:[],expires:0,completed:0}));sim.zSquads={};}
export function ensureSquad(sim,p){const id=p.zSquad||p.partyId||p.id;p.zSquad=id;sim.zSquads[id]??={id,team:Object.keys(sim.zSquads).length,contracts:0,active:null,story:0,storyProgress:0,briefed:false};p.team=sim.zSquads[id].team;return sim.zSquads[id];}
export function squadPlayers(sim,id){return [...sim.players.values()].filter(p=>p.zSquad===id&&!p.friendSpectator);}
export function startContract(sim,p,id){const s=ensureSquad(sim,p),c=sim.zContracts.find(c=>c.id===id);if(!c||c.status!=='available')return sim.note(p,'This contract is already assigned. Choose another marker.');if(s.active)return sim.note(p,'Finish or abandon your active contract first.');
 if(dist(p,c)>4||!sim.clearMelee(p,c))return;Object.assign(c,{owner:s.id,status:'active',started:sim.time,expires:sim.time+300,progress:0,targets:[],claimed:[],targetId:null,spawnAt:sim.time+2});s.active=id;
 const count=squadPlayers(sim,s.id).filter(zAlive).length;
 if(['recover','sabotage','purge'].includes(c.contractKind)){c.goal=3;for(let i=0;i<3;i++){const a=i*2.094+Math.PI/6,point=sim.safePoint({x:c.x+Math.cos(a)*11,y:0,z:c.z+Math.sin(a)*11})||c;c.targets.push({...point,id:c.id+'-target-'+i,kind:'objective',name:c.contractKind==='recover'?'Recover supply case':c.contractKind==='purge'?'Neutralize spore relay':'Disable hostile relay',index:i});}}
 else if(c.contractKind==='hunt'){c.goal=1;if(sim.spawnEnemy(c.tier===3?'colossus':c.tier===2?'elite':'heavy',{x:c.x+8,y:0,z:c.z+8},c.tier)){const e=sim.enemies.at(-1);e.contractId=c.id;e.maxHealth*=1+count*.2;e.health=e.maxHealth;c.targetId=e.id;}}
 else if(c.contractKind==='escort'){c.goal=100;c.rover={x:Z_ZONES[c.zone].x,z:c.z,y:0,health:1000,maxHealth:1000};c.destination={x:Z_ZONES[c.zone].x,z:Z_ZONES[c.zone].z-42};c.routeLength=dist(c.rover,c.destination);}
 else c.goal=c.contractKind==='vault'?60:45;
 sim.cue('contract');for(const member of squadPlayers(sim,s.id))sim.note(member,c.name+' — follow the gold marker.');
}
export function objectiveInteract(sim,p,id){for(const c of sim.zContracts){if(c.status!=='active'||c.owner!==p.zSquad)continue;const t=c.targets.find(t=>t.id===id);if(!t||c.claimed.includes(t.index)||dist(p,t)>3.4||!sim.clearMelee(p,t))continue;
 // Continuous hold is represented server-side; moving or taking damage cancels.
 p.zTask={id,contract:c.id,index:t.index,start:sim.time,until:sim.time+(c.contractKind==='purge'?3:2),damage:p.lastDamage};return true;}return false;}
export function completeContract(sim,c){if(c.status!=='active')return;const s=sim.zSquads[c.owner];if(!s)return;c.status='complete';c.completed=sim.time;s.active=null;s.contracts++;s.storyProgress=Math.min(3,s.contracts);
 for(const p of squadPlayers(sim,c.owner)){if(p.zExtracted||p.connected===false)continue;p.zStats.contracts=(p.zStats.contracts||0)+1;p.zStats.objectives++;sim.award(p,800+c.tier*600);p.zScrap=Math.min(9999,p.zScrap+60*c.tier);p.zStats[c.contractKind]=(p.zStats[c.contractKind]||0)+1;sim.note(p,s.contracts>=3?'GOAL COMPLETE — follow the green extraction marker, call transport, then board.':s.contracts+' / 3 contracts complete. Choose another gold marker.');}
 // A personal reward claim prevents another squad taking the contract rewards.
 c.reward={x:c.x,y:0,z:c.z,claims:[]};sim.cue('contract-complete');}
export function tickContracts(sim,dt){
 for(const p of sim.players.values())if(p.zTask){const task=p.zTask,c=sim.zContracts.find(c=>c.id===task.contract),t=c?.targets.find(t=>t.id===task.id);if(!zAlive(p)||!t||dist(p,t)>3.4||p.lastDamage>task.damage||c.status!=='active'){p.zTask=null;continue;}if(sim.time>=task.until){if(!c.claimed.includes(task.index)){c.claimed.push(task.index);c.progress=c.claimed.length;p.zStats.objectives++;}p.zTask=null;sim.cue('quest');}}
 for(const c of sim.zContracts){if(c.status==='complete'&&sim.time-c.completed>90){Object.assign(c,{status:'available',owner:null,progress:0,targets:[],reward:null});continue;}if(c.status!=='active')continue;
  const members=squadPlayers(sim,c.owner).filter(zAlive),near=members.filter(p=>dist(p,c.rover||c)<14);
  if(sim.time>=c.expires){c.status='failed';c.completed=sim.time;sim.zSquads[c.owner].active=null;for(const p of members)sim.note(p,'Contract expired. Pick another gold marker.');continue;}
  if(['defend','vault'].includes(c.contractKind)&&near.length)c.progress=Math.min(c.goal,c.progress+dt);
  if(c.contractKind==='escort'&&near.length&&c.rover.health>0){const d=dist(c.rover,c.destination);if(d<2)c.progress=c.goal;else{const step=Math.min(d,1.4*dt);c.rover.x+=(c.destination.x-c.rover.x)/d*step;c.rover.z+=(c.destination.z-c.rover.z)/d*step;c.progress=Math.min(c.goal-1,100*(1-dist(c.rover,c.destination)/Math.max(1,c.routeLength)));}for(const e of sim.enemies)if(e.health>0&&dist(e,c.rover)<2)c.rover.health=Math.max(0,c.rover.health-dt*6);if(!c.rover.health){c.status='failed';c.completed=sim.time;sim.zSquads[c.owner].active=null;}}
  if(c.contractKind==='hunt'&&c.targetId&&sim.enemies.find(e=>e.id===c.targetId)?.health<=0)c.progress=1;
  if(c.contractKind==='hunt'&&!c.targetId&&sim.spawnEnemy(c.tier===3?'colossus':c.tier===2?'elite':'heavy',{x:c.x+8,y:0,z:c.z+8},c.tier)){const e=sim.enemies.at(-1);e.contractId=c.id;c.targetId=e.id;}
  if(near.length&&sim.time>=c.spawnAt){c.spawnAt=sim.time+Math.max(2,5-c.tier);const a=sim.random()*6.28;sim.spawnEnemy(c.contractKind==='sabotage'?'mercenary':null,{x:c.x+Math.cos(a)*20,y:0,z:c.z+Math.sin(a)*20},c.tier);}
  if(c.progress>=c.goal)completeContract(sim,c);
 }
 for(const c of sim.zContracts)if(c.status==='failed'&&sim.time-c.completed>30)c.status='available';
}
export function contractKilled(sim,e){const c=sim.zContracts.find(c=>c.id===e.contractId);if(c&&c.status==='active'&&c.targetId===e.id){c.progress=1;completeContract(sim,c);}}
