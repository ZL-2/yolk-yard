import {isWarmup} from './royale-phases.js';
import {teammates} from './teams.js';

export const MEDALS = Object.freeze({
  first: {name:'FIRST STRIKE',detail:'First elimination of the match',xp:100,icon:'Ⅰ'},
  double: {name:'DOUBLE ELIMINATION',detail:'Two eliminations within eight seconds',xp:100,icon:'Ⅱ'},
  triple: {name:'TRIPLE ELIMINATION',detail:'Three eliminations within eight seconds',xp:150,icon:'Ⅲ'},
  longshot: {name:'LONG SHOT',detail:'Elimination from at least 45 metres',xp:75,icon:'⌖'},
  clutch: {name:'AGAINST THE ODDS',detail:'Win a fight with 25 health or less',xp:75,icon:'✦'},
  precision: {name:'SHARPSHOOTER',detail:'Land five critical shots',xp:100,icon:'⊕'},
  support: {name:'BACK IN THE FIGHT',detail:'Revive a teammate',xp:100,icon:'✚'},
  uplink: {name:'SIGNAL SECURED',detail:'Capture a contested-world uplink',xp:150,icon:'◎'},
  orders: {name:'MISSION COMPLETE',detail:'Complete all three field orders',xp:250,icon:'◇'},
});

export function resetFieldRecord(p) {
  p.field={damage:0,shots:0,hits:0,critical:0,healing:0,chests:0,uplinks:0,orders:0,xp:0,medals:[]};
  p.fieldHitShots=[];p.fieldCriticalShots=[];p.fieldShotGroups=[];p.fieldChain=0;p.fieldLastElim=-100;
}
export function fieldActive(sim) {
  return sim.phase==='playing'&&!sim.options.training&&!(sim.options.mode==='royale'&&isWarmup(sim.stage));
}
export function awardMedal(sim,p,id) {
  const def=MEDALS[id];if(!p||p.bot||!def||!p.field||!fieldActive(sim))return;
  let row=p.field.medals.find(m=>m.id===id);
  if(row?.count>=5)return;
  if(row)row.count++;else p.field.medals.push({id,count:1});
  p.field.xp+=def.xp;
  sim.emit('field-medal',{player:p.id,medal:id,xp:def.xp});
}
function unique(p,key,id) {
  if(id==null)return false;
  const list=p[key]??=[];if(list.includes(id))return false;
  if(list.length>=64)list.shift();list.push(id);return true;
}
// One event hook shared by private hosts and the public server. Shield/body
// portions and shotgun pellets share a trigger ID and cannot inflate accuracy.
export function recordFieldEvent(sim,type,e) {
  if(!['shot','launch','hit','elimination','revived','royale-cue'].includes(type)||!fieldActive(sim))return;
  const p=sim.players.get(e.player),victim=sim.players.get(e.target);
  if(!p||p.boss||p.friendSpectator)return;
  if(type==='elimination'&&victim&&victim!==p&&!victim.boss&&!teammates(sim.options,p,victim)&&!sim.fieldFirstElim){sim.fieldFirstElim=p.id;awardMedal(sim,p,'first');}
  if(p.bot)return;
  if(!p.field)resetFieldRecord(p);
  const f=p.field,target=sim.players.get(e.target);
  if(type==='shot'||type==='launch') {
    if(!e.popper&&unique(p,'fieldShotGroups',e.shotId))f.shots++;
  } else if(type==='hit'&&target&&target!==p&&!target.boss&&!teammates(sim.options,p,target)&&e.amount>0) {
    f.damage+=e.amount;
    if(unique(p,'fieldHitShots',e.shotId))f.hits++;
    if(e.precision&&unique(p,'fieldCriticalShots',e.shotId)){f.critical++;if(f.critical===5)awardMedal(sim,p,'precision');}
  } else if(type==='elimination'&&target&&target!==p&&!target.boss&&!teammates(sim.options,p,target)) {
    p.fieldChain=sim.time-p.fieldLastElim<=8?p.fieldChain+1:1;p.fieldLastElim=sim.time;
    if(p.fieldChain===2)awardMedal(sim,p,'double');if(p.fieldChain===3)awardMedal(sim,p,'triple');
    if(Math.hypot(p.x-target.x,p.y-target.y,p.z-target.z)>=45)awardMedal(sim,p,'longshot');
    if(p.health>0&&!p.downed&&p.health<=25)awardMedal(sim,p,'clutch');
    f.xp+=75;
  } else if(type==='revived')awardMedal(sim,p,'support');
  else if(type==='royale-cue'&&e.cue==='chest-open')f.chests++;
}
export function fieldSnapshot(p) {
  if(!p.field||p.bot||p.boss)return undefined;
  return {...p.field,damage:Math.round(p.field.damage),healing:Math.round(p.field.healing),medals:p.field.medals.map(m=>({...m}))};
}
