import {BOSSES} from './bosses.js';
import {nearbyItems} from './nearby-items.js';
const bossIds=new Set(BOSSES.map(b=>b.id));
export const BOSS_SOUND_ICON='./art/boss-sound.png';
// Presentation consumes existing replicated sounds/movement; no new network scans.
export const SOUND_RANGES=Object.freeze({footsteps:26,glider:24,chest:12,gunfire:125,explosion:190,activity:20});
const paths={
 footsteps:'M9 3c-3 0-4 4-3 6l3 4 4-2-1-4c0-2-1-4-3-4Zm0 12-3 1 1 4 4-1ZM18 6c-2 0-3 3-2 5l2 3 3-1-1-4c0-2-1-3-2-3Zm1 10-3 1 1 3 3-1Z',
 gunfire:'M2 8h5l2 2h8V9h5v3h-5v2h-5l-1 6H7l1-6H2ZM10 6h6v3h-6Z',
 boss:'m3 6 5 5 4-8 4 8 5-5-2 12H5ZM5 20h14',
 crown:'m3 6 5 5 4-8 4 8 5-5-2 12H5ZM5 20h14',
 explosion:'m12 2 2 6 6-4-3 7 5 2-6 2 2 7-6-4-4 4 1-7-7-2 7-2-3-7 6 4Z',
 chest:'M3 9h18v11H3Zm1-5h16v5H4Zm6 6v5h4v-5Z',
 glider:'M2 10c2-9 18-9 20 0H2Zm1 1 8 9h2l8-9M12 10v10',
 activity:'M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z',
};
export function visualSoundsAllowed(state,listener){return !state?.royale?.practice&&listener?.flight!=='transport';}
export function soundBearing(listener,point){return Math.atan2(point.x-listener.x,-(point.z-listener.z))+(listener.yaw||0);}
export function audibleVisualEvent(e){
 if(['shot','launch'].includes(e.type))return {kind:'gunfire',point:e.origin||e,range:e.weapon==='thumper'?190:['needle','anchor','peeper'].includes(e.weapon)?170:125,ttl:1.1};
 if(e.type==='royale-cue'&&['crown-pulse','crown-pickup'].includes(e.cue))return {kind:'crown',point:e,range:60,ttl:1.5};
 if(e.type==='royale-cue'&&['boss-windup','boss-veil'].includes(e.cue))return {kind:'boss',point:e,range:45,ttl:1.2};
 if(e.type==='explosion')return {kind:'explosion',point:e,range:190,ttl:1.25};
 if(e.type==='royale-cue'&&['land','jump','build-place','harvest-hit','chest-open','glider-deploy','glider-cut','barrel-break'].includes(e.cue))return {kind:e.cue.startsWith('glider')?'glider':e.cue==='chest-open'?'chest':'activity',point:e,range:e.cue.startsWith('glider')?24:e.cue==='chest-open'?16:20,ttl:.7};
 return null;
}
export class SoundVisuals{
 constructor(root){this.node=document.createElement('div');this.node.id='visual-sounds';this.node.setAttribute('aria-label','Directional sound indicators');this.node.hidden=true;root.append(this.node);this.signals=new Map();this.lastEvent=0;this.nextAt=0;this.icons=[];}
 update(state,listener,{enabled=true,playing=true}={},now=performance.now()){
  this.node.hidden=!enabled||!playing||!listener||listener.health<=0||!visualSoundsAllowed(state,listener);
  if(this.node.hidden){this.signals.clear();this.lastEvent=state?.events?.at(-1)?.id||0;return;}
  if(now<this.nextAt)return;this.nextAt=now+100;
  const round=(state.royale?.matchId||'')+':'+state.round;
  if(round!==this.round){this.round=round;this.signals.clear();this.lastEvent=0;}
  const add=(key,kind,point,range,ttl)=>{
   if(!Number.isFinite(point?.x)||!Number.isFinite(point?.z))return;
   const distance=Math.hypot(listener.x-point.x,(listener.y||0)-(point.y||0),listener.z-point.z);
   if(distance>=range)return;
   this.signals.set(key,{kind,point:{x:point.x,y:point.y,z:point.z},until:now+ttl*1000,strength:Math.max(.3,1-distance/range)});
  };
  for(const e of state.events||[])if(e.id>this.lastEvent){this.lastEvent=e.id;if(state.time-e.time>1.3||e.player===listener.id)continue;const cue=audibleVisualEvent(e);if(cue){const kind=bossIds.has(e.player)?'boss':cue.kind;add(kind+':'+(e.player||e.id),kind,cue.point,cue.range,cue.ttl);}}
  for(const p of state.players||[]){if(p.id===listener.id||p.health<=0||p.spectating)continue;
   if(p.flight==='glide')add('glider:'+p.id,'glider',p,24,.22);
   else if((p.flight==='ground'||!state.royale)&&p.grounded!==false&&p.moving&&!p.crouching&&!p.sliding&&!p.downed&&Math.hypot(p.vx||0,p.vz||0)>.8)add('footsteps:'+p.id,p.boss?'boss':'footsteps',p,p.sprinting?26:20,.28);
  }
  if(state.royale)for(const c of nearbyItems(state.royale,'chests',listener,12))if(!c.opened&&!(c.landAt>state.time))add('chest:'+c.id,'chest',c,12,.25);
  for(const [id,c]of this.signals)if(c.until<=now)this.signals.delete(id);
  // At most eight sectors/icons during the active match.
  const sectors=new Map();for(const c of this.signals.values()){
   const angle=soundBearing(listener,c.point),sector=Math.round(angle/(Math.PI/6)),key=c.kind+':'+((sector%12+12)%12),old=sectors.get(key);
   if(!old||c.strength>old.strength)sectors.set(key,{...c,angle});
  }
  const cues=[...sectors.values()].sort((a,b)=>b.strength-a.strength).slice(0,8);
  for(let i=0;i<Math.max(cues.length,this.icons.length);i++){
   const c=cues[i];let node=this.icons[i];if(!node&&c){node=document.createElement('span');node.innerHTML=`<i class="sound-arc"></i><svg viewBox="0 0 24 24" aria-hidden="true"><path/></svg><img src="${BOSS_SOUND_ICON}" alt="" decoding="async"/>`;this.node.append(node);this.icons.push(node);}
   if(!node)continue;node.hidden=!c;if(!c)continue;
   if(node.dataset.kind!==c.kind){node.dataset.kind=c.kind;node.className='sound-direction '+c.kind;node.setAttribute('aria-label',c.kind);node.querySelector('img').hidden=c.kind!=='boss';node.querySelector('svg').hidden=c.kind==='boss';node.querySelector('path').setAttribute('d',paths[c.kind]);}
   node.style.setProperty('--bearing',c.angle+'rad');node.style.opacity=c.strength;
  }
 }
}
