// Original oscillator/noise compositions. No recordings, melodies or voices
// from another game. Existing mixer provides distance, pan, occlusion and caps.
const tone=(f,d=.3,v=.05,to=0,at=0,w='sine')=>({f,d,v,to,at,w});
const air=(f,d=.3,v=.04,at=0)=>({noise:true,f,d,v,at});
const chime=[tone(392,.18,.045),tone(466,.22,.045,0,.13),tone(587,.45,.035,0,.3)];
export const ZOMBIE_SOUNDS={
 'z-contract':chime,'z-contract-complete':[...chime,tone(784,.7,.04,0,.5)],'z-shutdown':[tone(440,.4,.06),tone(330,.4,.06,0,.6),tone(220,1,.06,0,1.2)],'z-transport-landed':[...chime],'z-transport-depart':[tone(110,1.4,.05,220)],
 'z-arrival':[air(260,2,.06),tone(73.4,2,.07,55),tone(146.8,1.5,.025,0,.6)],
 'z-wave':[tone(82.4,.8,.08,55),air(390,.55,.06,.1),tone(164.8,1.1,.025,110,.25)],
 'z-special-wave':[tone(110,1,.08,65),air(980,.8,.045),tone(220,.5,.04,146,.5)],
 'z-wave-clear':[tone(146.8,.4,.04),tone(220,.8,.04,0,.3),tone(293.6,1,.03,0,.6)],
 'z-perk':chime,'z-purchase':chime,'z-craft':[air(1400,.15,.06),...chime],
 'z-upgrade':[air(900,1.2,.05),tone(110,.8,.07,440),tone(660,.7,.04,880,.6)],
 'z-power':[air(130,2,.08),tone(55,1.5,.08,220),tone(440,1,.035,0,1)],
 'z-cache':[air(1800,.7,.04),tone(165,.6,.035,330),tone(247,.5,.035,494,.7),tone(587,.9,.04,0,1.7)],
 'z-cache-move':[tone(440,.9,.05,110),air(260,.5,.04,.4)],
 'z-door':[air(380,.65,.09),tone(65,.3,.06,35,.5)],
 'z-repair':[air(1600,.06,.06),tone(180,.07,.05)],
 'z-resupply':chime,'z-drop':[tone(587,.3,.03),tone(784,.45,.03,0,.2)],
 'z-powerup':[tone(440,.18,.04),tone(587,.22,.04,0,.1),tone(880,.6,.045,0,.28)],
 'z-down':[tone(165,.7,.07,55),air(190,.4,.055)],'z-bleedout':[tone(65,1,.06,35)],
 'z-revive':[tone(220,.25,.05),tone(330,.3,.05,0,.2),tone(440,.7,.04,0,.45)],
 'z-quest':[tone(196,.5,.045),tone(294,.5,.04,0,.2),tone(392,.9,.035,0,.5)],
 'z-log':[air(2600,.18,.035),tone(880,.08,.03)],
 'z-secret':[tone(147,.6,.04),tone(220,1,.04,0,.3),tone(349,1.4,.045,0,.6)],
 'z-quest-complete':[tone(147,1,.06),tone(220,1.2,.05,0,.3),tone(294,1.5,.045,0,.6),tone(440,1.8,.035,0,.9)],
 'z-boss':[tone(41,2,.08,55),air(160,2,.09),tone(82.4,1.4,.05,65,.8)],
 'z-telegraph':[tone(440,.5,.06,220),air(750,.3,.04)],
 'z-exfil':[tone(220,.25,.06),tone(220,.25,.06,0,.45),tone(440,1,.05,0,.9)],
 'z-extracted':[...chime,tone(294,1.4,.04,0,.6),tone(440,1.6,.04,0,.9)],
 'z-defeat':[tone(110,1.5,.06,55),tone(146.8,1.5,.035,73.4,.2),air(250,1,.03,.7)],
 'z-denied':[tone(130,.15,.04),tone(98,.3,.04,0,.15)],
 'z-field':[air(450,.7,.09),tone(110,.7,.08,330),tone(660,.8,.03,330,.2)],
 'z-decoy':[tone(740,.15,.03),tone(620,.15,.03,0,.25),tone(740,.15,.03,0,.5)],
 'z-melee':[air(1200,.12,.05)],'z-throw':[air(1900,.14,.035)],
 'z-blast':[air(90,.7,.12),air(600,.3,.07),tone(45,.5,.08,25)],
 'z-trap':[air(700,1,.07),tone(110,.6,.055,330)],
 'z-attack':[air(230,.26,.065),tone(83,.24,.045,62)],
 'z-husk':[air(170,.8,.04),tone(63,.75,.025,49)],
 'z-runner':[air(420,.45,.04),tone(132,.3,.025,87)],
 'z-armored':[air(220,.7,.045),tone(71,.55,.025,55),air(1600,.1,.02,.4)],
 'z-heavy':[air(110,1,.045),tone(41,1,.04,34)],
 'z-leaper':[air(700,.5,.035),tone(180,.35,.02,91)],
 'z-disruptor':[air(1100,.6,.025),tone(196,.7,.025,147),tone(208,.65,.02,156)],
 'z-elite':[air(240,.8,.04),tone(55,.8,.035,41)],
 'z-boss-voice':[air(130,1.4,.06),tone(32.7,1.3,.045,49),tone(65.4,1.2,.025,55,.1)],
};
export function updateZombiesAudio(sound,state,me){
 const z=state.zombies;if(!z){sound.loop('blacktide-sea',0);sound.loop('blacktide-lattice',0);return;}
 const rover=z.vehicles?.find(v=>v.id===me.zVehicle),transport=z.evacs?.find(e=>['approaching','landed','departing'].includes(e.status)&&Math.hypot(e.x-me.x,e.z-me.z)<90);
 sound.loop('blacktide-rover',rover?.5+Math.min(.5,Math.abs(rover.speed)/24):0,{freq:rover?65+Math.abs(rover.speed)*6:65,volume:.065,noise:false});sound.loop('blacktide-rotor',transport?Math.max(0,1-Math.hypot(transport.x-me.x,transport.z-me.z)/90)*(.6+Math.sin(sound.clock*23)*.2):0,{freq:110,volume:.1,noise:false});
 const nearby=z.enemies.filter(e=>e.health>0&&Math.hypot(e.x-me.x,e.z-me.z)<22).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z));
 sound.loop('blacktide-sea',.45,{freq:270,volume:.055});sound.loop('blacktide-lattice',z.power?.28:.12,{freq:z.power?73.4:49,volume:.04,noise:false});
 if(sound.clock>=(sound.zFootAt||0)){sound.zFootAt=sound.clock+.3;const e=nearby.find(e=>Math.hypot(e.vx||0,e.vz||0)>.5);if(e)sound.cue(e.type==='armored'||e.type==='colossus'?'step-metal':'step-soil',e,.3);}
 if(sound.clock>=(sound.zNextVoice||0)){sound.zNextVoice=sound.clock+2.3+(Math.floor(sound.clock)%3)*.5;const e=nearby[Math.floor(sound.clock)%Math.min(nearby.length,4)];if(e)sound.cue(e.type==='boss'?'z-boss-voice':'z-'+e.type,e,.9);}
 if(sound.clock>=(sound.zNextPulse||0)){sound.zNextPulse=sound.clock+(nearby.length>6?2.4:5);const intensity=nearby.length>6?.05:.025;for(const [f,at]of [[73.4,0],[110,.3],[146.8,.9]])sound.layer(tone(f,1.8,intensity,0,at),null,'score',1);}
}
