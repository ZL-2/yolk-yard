// Original, lightweight score. Notes are scheduled on the audio clock; the
// render loop never catches up missed bars after a suspended/background tab.
export function scoreScene(state,me,combatUntil,clock) {
  if(!state||!me||me.health<=0||state.phase!=='playing')return 'silent';
  const world=state.royale;
  if(world&&['waiting','spawn-island','starting'].includes(world.stage))return 'silent';
  if(me.flight&&me.flight!=='ground')return 'deployment';
  if(clock<combatUntil)return 'combat';
  if(world?.alive<=6)return 'final';
  const u=world?.operations?.uplink;
  if(u?.status==='active'&&Math.hypot(me.x-u.x,me.z-u.z)<55)return 'objective';
  return 'exploration';
}
const ROOTS=[110,87.307,130.813,97.999]; // A minor / F / C / G
const MOTIF=[0,-1,7,-1,12,7,-1,3,0,-1,10,-1,7,-1,3,-1];
export class AdaptiveScore {
  constructor(sound){this.sound=sound;this.scene='silent';this.voices=new Set();this.combatUntil=0;this.duckUntil=0;this.step=0;this.nextAt=0;}
  activity(seconds=4){this.combatUntil=this.sound.clock+seconds;this.duckUntil=this.sound.clock+1.1;}
  stop(){for(const voice of this.voices)try{voice.stop();}catch{}this.voices.clear();this.scene='silent';this.nextAt=0;this.step=0;}
  update(state,me,playing){
    const s=this.sound,c=s.ctx,scene=playing?scoreScene(state,me,this.combatUntil,s.clock):'silent';
    if(!c||scene==='silent'||!s.enabled||s.musicVolume<=0||s.volume<=0){if(this.scene!=='silent')this.stop();return;}
    for(const v of this.voices)if(v.scoreEnd<c.currentTime)this.voices.delete(v);
    const entered=this.scene==='silent';this.scene=scene;
    const duck=s.clock<this.duckUntil?.22:me.use?.55:1;
    s.scoreBus?.gain.setTargetAtTime(s.musicVolume*duck,c.currentTime,duck<1?.045:.65);
    if(entered||this.nextAt<c.currentTime-.3)this.nextAt=c.currentTime+.04;
    if(this.nextAt>c.currentTime+.09)return;
    const at=Math.max(0,this.nextAt-c.currentTime),step=this.step++%64,beat=step%16,root=ROOTS[Math.floor(step/16)],intense=scene==='combat'||scene==='final',active=intense||scene==='objective'||scene==='deployment';
    const play=(p)=>{if(this.voices.size>=12||s.voices.size>=36)return;const v=s.layer({...p,at:(p.at||0)+at},null,'score');if(v){v.scoreEnd=c.currentTime+at+(p.at||0)+p.d+.02;this.voices.add(v);}};
    // Warm sustained thirds, a soft bass pulse, and an authored sparse motif.
    if(beat===0){for(const ratio of [1,1.1892,1.4983])play({f:root*2*ratio,d:2.4,v:.014,w:'sine',attack:.18});}
    if(beat%(active?4:8)===0)play({f:root,d:.44,v:intense?.062:.034,w:'triangle',attack:.02});
    if(MOTIF[beat]>=0&&(active||beat%4===0))play({f:root*4*2**(MOTIF[beat]/12),d:scene==='deployment'?.58:.3,v:intense?.018:.026,w:'sine',attack:.008});
    if(intense&&beat%4===0)play({f:95,to:38,d:.16,v:.065,w:'sine'});
    if(active&&beat%4===2)play({noise:true,f:intense?2600:1400,d:.07,v:intense?.018:.008});
    this.nextAt+=60/108/2;
  }
}
