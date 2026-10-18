import {Z_STATIONS} from './zombies-map.js';
import {zAlive} from './zombies-expedition-config.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const operationState=(sim,p)=>sim.zSquads[p.zSquad].operation??={fuses:[],sequence:[],aligned:false,charged:[0,0,0],active:-1,until:0,complete:false};
export function operationAction(sim,p,t,choice){
 const op=operationState(sim,p),members=()=>[...sim.players.values()].filter(o=>o.zSquad===p.zSquad&&!o.zExtracted);
 const message=text=>{for(const o of members())sim.note(o,text);};
 if(t.kind==='fuse'){
  if(op.fuses.includes(t.index))return true;
  op.fuses.push(t.index);sim.cue('quest',t);message(`Stabilizer ${op.fuses.length}/2 recovered. Bring both to the Lattice cipher console.`);return true;
 }
 if(t.kind==='cipher'){
  if(op.aligned)return true;if(op.fuses.length<2){sim.note(p,'Recover the two marked stabilizer fuses at Freight and Hospital first.');return true;}
  if(!['0','1','2'].includes(choice))return true;
  const expected=[2,0,1];if(Number(choice)!==expected[op.sequence.length]){op.sequence=[];sim.note(p,'Sequence reset. The records say: BEACON, HARBOR, WARD.');sim.cue('denied',t);return true;}
  op.sequence.push(Number(choice));if(op.sequence.length===3){op.aligned=true;for(const o of members())o.zStats.cipher=1;message('Network aligned. Charge the three resonators: defend each marked circle.');sim.cue('power',t);}return true;
 }
 if(t.kind==='resonator'){
  if(!op.aligned){sim.note(p,'Align the Lattice cipher first.');return true;}
  if(op.charged[t.index]>=18)return true;
  if(op.active>=0&&op.active!==t.index){sim.note(p,'Finish the active resonator first.');return true;}
  op.active=t.index;op.until=sim.time+90;op.spawnAt=sim.time;message('Hold this resonator for 18 seconds. Leave its circle and charging pauses.');return true;
 }
 if(t.kind==='boss-anchor'){
  const e=sim.enemies.find(e=>e.finalBoss===p.zSquad&&e.zShield===t.index);
  if(!e){sim.note(p,'This grounding anchor is dormant.');return true;}
  p.zAnchorTask={boss:e.id,index:t.index,until:sim.time+3,damage:p.lastDamage,x:t.x,z:t.z};sim.note(p,'Grounding the shield. Stay here and avoid damage for three seconds.');return true;
 }
 return false;
}
export function tickOperations(sim,dt){
 for(const squad of Object.values(sim.zSquads)){const op=squad.operation;if(!op||op.active<0)continue;
  const t=Z_STATIONS.find(t=>t.kind==='resonator'&&t.index===op.active),members=[...sim.players.values()].filter(p=>p.zSquad===squad.id&&zAlive(p));
  if(sim.time>op.until){op.active=-1;for(const p of members)sim.note(p,'Resonator interrupted. Progress saved; activate it to try again.');continue;}
  if(members.some(p=>distance(p,t)<8))op.charged[op.active]=Math.min(18,op.charged[op.active]+dt);
  if(sim.time>op.spawnAt){op.spawnAt=sim.time+4;sim.spawnEnemy('runner',{x:t.x+13,z:t.z+10},2);}
  if(op.charged[op.active]>=18){op.active=-1;sim.cue('quest',t);if(op.charged.every(n=>n>=18)){op.complete=true;for(const p of members){p.zStats.network=1;sim.award(p,1200);sim.note(p,'LATTICE STABILIZED. The optional breach is open. Enter it when your squad is ready.');}}}
 }
 for(const p of sim.players.values()){const task=p.zAnchorTask;if(!task)continue;const boss=sim.enemies.find(e=>e.id===task.boss);
  if(!zAlive(p)||distance(p,task)>3.4||p.lastDamage>task.damage||!boss||boss.zShield!==task.index){p.zAnchorTask=null;continue;}
  if(sim.time>=task.until){boss.zShield=-1;boss.staggerUntil=sim.time+2;boss.nextSpecial=sim.time+3;p.zAnchorTask=null;sim.cue('power',boss);for(const o of sim.players.values())if(o.zSquad===p.zSquad)sim.note(o,'SHIELD GROUNDED. Strike the Bellwether before its next phase.');}
 }
}
export function operationHint(op){if(!op)return 'Optional: recover the two stabilizers at Freight and Hospital.';if(op.fuses.length<2)return `Stabilizers ${op.fuses.length}/2 — Freight and Hospital.`;if(!op.aligned)return 'Cipher clue: BEACON → HARBOR → WARD. Enter it at the Lattice console.';if(!op.complete)return `Resonators ${op.charged.filter(n=>n>=18).length}/3 — activate each, then defend its circle.`;return 'The Lattice breach is stabilized. Defeat its guardian and extract.';}
