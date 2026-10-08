import {isTeamRoyale,teammates} from './teams.js';
import {canStand,dist} from './physics.js';
import {groundAt} from './terrain.js';
import {ROYALE_TEAM_BOT as policy} from './bot-config.js';
import {botWorld} from './bot-work.js';
export function squadAnchor(sim,p,brain){
 if(!p.bot||!isTeamRoyale(sim.options))return null;
 const valid=o=>o&&!o.bot&&o.connected!==false&&o.health>0&&!o.downed&&!o.spectating&&o.contestant&&teammates(sim.options,p,o);
 const previous=sim.players.get(brain.followId);if(valid(previous))return previous;
 let mate=null,distance=Infinity;for(const o of sim.players.values())if(valid(o)&&dist(p,o)<distance){mate=o;distance=dist(p,o);}
 brain.followId=mate?.id||null;return mate;
}
// One cached local assignment: healthy pressure, two different flank angles,
// then support. Humans keep freedom of movement; bots do not read enemy inputs.
export function combatRole(sim,p,brain,target){
 if(!isTeamRoyale(sim.options))return 'solo';
 if(brain.roleTarget===target.id&&sim.time<(brain.roleAt||0))return brain.role;
 const mates=(botWorld(sim).teams.get(p.team)||[]).filter(m=>!m.downed&&dist(p,m)<35&&(m===p||teammates(sim.options,p,m)));
 mates.sort((a,b)=>Number(!!a.bot)-Number(!!b.bot)||(a.joinedOrder||0)-(b.joinedOrder||0)||String(a.id).localeCompare(String(b.id)));
 const healthy=mates.filter(m=>m.health>=45&&!(m.reloadEnd>sim.time)),index=healthy.indexOf(p);
 brain.role=mates.length<2?'solo':index===0?'pressure':index===1?'flank-left':index===2?'flank-right':'support';
 brain.roleAt=sim.time+1;brain.roleTarget=target.id;return brain.role;
}
export function followGoal(sim,p,mate){
 const angle=(p.teamSlot??p.joinedOrder??0)*2.4,d=policy.followDistance;
 const goal={x:mate.x+Math.cos(angle)*d,y:mate.y,z:mate.z+Math.sin(angle)*d};
 if(Math.abs(groundAt(sim.map,goal.x,goal.z)-mate.y)<1.1&&canStand(sim.map,goal,.5))return goal;
 return {x:mate.x,y:mate.y,z:mate.z};
}
