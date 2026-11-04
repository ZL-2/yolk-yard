import {BLACKOUT_LOGS} from './blackout-map.js';
import {setDoor} from './frontier-world.js';
import {canFight} from './stance.js';
import {dist} from './physics.js';

function targets(map, state, player) {
  if(!map.blackout || !state.blackout || !canFight(player) || player.flight!=='ground' || player.vehicleId || player.traversal)return [];
  const {breakers,radios,gate}=map.blackout;
  const result=breakers.map((point,index)=>({point,index,kind:'breaker',active:!!(state.blackout.power & (1<<index))}));
  for(const [index,point] of radios.entries()){
    if(index===0 && !state.blackout.open)continue;
    result.push({point,index,kind:'radio'});
  }
  if(!state.blackout.open)result.push({point:{...gate,z:gate.z-1.25},kind:'hold'});
  return result.filter(target=>dist(player,target.point)<2.6).sort((a,b)=>dist(player,a.point)-dist(player,b.point));
}

export function blackoutPrompt(map,state,player,accessible){
  const target=targets(map,state,player).find(({point})=>accessible(point,2.6));
  if(!target)return null;
  if(target.kind==='hold')return {text:'HOLD SEALED · ACTIVATE BOTH BREAKERS',action:false};
  if(target.kind==='radio')return {text:'PLAY RECORDING · '+BLACKOUT_LOGS[target.index].title,action:true};
  return {text:target.point.label+(target.active?' · POWER ON':' · RESTORE POWER'),action:!target.active};
}

export function blackoutInteract(sim,player,input){
  if(!input.interact || player.interactLatch || player.bot || !sim.blackout)return false;
  const target=targets(sim.map,sim,player).find(({point})=>sim.accessible(player,point,2.6));
  if(!target || target.kind==='hold' || target.active)return false;
  player.interactLatch=true;
  if(target.kind==='radio'){
    sim.emit('blackout-recording',{player:player.id,index:target.index});
    return true;
  }
  sim.blackout.power|=1<<target.index;
  if(sim.blackout.power===3){
    sim.blackout.open=true;
    if(!setDoor(sim,sim.map.blackout.gate,true,player)){
      sim.blackout.open=false;
      sim.blackout.power&=~(1<<target.index);
      return true;
    }
    const {x,y,z}=sim.map.blackout.gate;
    sim.emit('royale-cue',{cue:'blackout-siren',x,y,z,player:player.id});
  }else sim.emit('blackout-breaker',{player:player.id,index:target.index});
  return true;
}
