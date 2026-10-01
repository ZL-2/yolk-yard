import {isTeamRoyale,teammates} from './teams.js';
import {canStand,dist} from './physics.js';
import {groundAt} from './terrain.js';
import {ROYALE_TEAM_BOT as policy} from './bot-config.js';
export function squadAnchor(sim,p,brain){
 if(!p.bot||!isTeamRoyale(sim.options))return null;
 const valid=o=>o&&!o.bot&&o.connected!==false&&o.health>0&&!o.downed&&!o.spectating&&o.contestant&&teammates(sim.options,p,o);
 const previous=sim.players.get(brain.followId);if(valid(previous))return previous;
 let mate=null,distance=Infinity;for(const o of sim.players.values())if(valid(o)&&dist(p,o)<distance){mate=o;distance=dist(p,o);}
 brain.followId=mate?.id||null;return mate;
}
export function followGoal(sim,p,mate){
 const angle=(p.teamSlot??p.joinedOrder??0)*2.4,d=policy.followDistance;
 const goal={x:mate.x+Math.cos(angle)*d,y:mate.y,z:mate.z+Math.sin(angle)*d};
 if(Math.abs(groundAt(sim.map,goal.x,goal.z)-mate.y)<1.1&&canStand(sim.map,goal,.5))return goal;
 return {x:mate.x,y:mate.y,z:mate.z};
}
