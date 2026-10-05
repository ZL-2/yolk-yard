// Clip/action assignments come from visible actions in the supplied edited
// montage, not a spoken-word transcription. Timing/ranges are Ravelfront tuning.
const cuts=[
 ['quiet-a',.40,2.25],['quiet-b',2.35,4.85],
 ['patrol-a',5.15,5.90],['patrol-b',6.08,7.62],
 ['contact-a',11.68,12.36],['contact-b',12.86,14.17],
 ['combat-a',14.64,15.81],['combat-b',20.91,22.04],
 ['pursuit-a',22.54,23.94],['pursuit-b',24.30,25.61],
 ['ready-a',29.13,30.04],['ready-b',30.38,31.69],
];
let offset=0;
export const BOSS_VOICE_CLIPS=Object.freeze(Object.fromEntries(cuts.map(([id,start,end])=>{
 const clip=Object.freeze({id,start,end,offset,duration:Number((end-start).toFixed(3))});offset=Number((offset+clip.duration+.12).toFixed(3));return [id,clip];
})));
export const BOSS_VOICE_BANKS=Object.freeze({
 idle:['quiet-a','quiet-b'],patrol:['patrol-a','patrol-b','quiet-a','quiet-b'],
 suspicious:['patrol-a','contact-a'],alerted:['contact-a','contact-b'],
 combat:['combat-a','combat-b'],pursuit:['pursuit-a','pursuit-b'],
 search:['patrol-a','patrol-b'],reload:['ready-a','ready-b'],ability:['combat-a','combat-b'],
});
export const BOSS_VOICE_RULES=Object.freeze({
 idle:{min:20,max:36,chance:.65,range:26,priority:0,cooldown:18},
 patrol:{min:22,max:38,chance:.65,range:28,priority:0,cooldown:18},
 suspicious:{range:36,priority:2,cooldown:8},alerted:{range:58,priority:3,cooldown:10},
 combat:{min:9,max:16,chance:.55,range:54,priority:1,cooldown:8},
 pursuit:{min:11,max:18,chance:.55,range:46,priority:1,cooldown:10},
 search:{min:9,max:15,chance:.7,range:36,priority:1,cooldown:8},
 reload:{chance:.7,range:38,priority:2,cooldown:12},ability:{range:54,priority:2,cooldown:10},
});
export const BOSS_VOICE_PROFILES=Object.freeze({
 'warden-aster':{rate:.96,volume:.80},'marshal-rook':{rate:.88,volume:.86},'lieutenant-nyx':{rate:1.06,volume:.72},
});
function random(p){const v=p.bossVoice;v.seed=(Math.imul(v.seed,1664525)+1013904223)>>>0;return v.seed/4294967296;}
export function initializeBossVoice(sim,p){
 let seed=(sim.options?.seed||1)^(sim.round||1);for(const c of p.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 p.bossVoice={seed,bags:{},lastClip:null,lastByCue:{},busyUntil:0,priority:-1,nextAt:sim.time+8+seed%11,lastAt:-100};
}
export function requestBossVoice(sim,p,cue,{chance=true}={}){
 const rule=BOSS_VOICE_RULES[cue],bank=BOSS_VOICE_BANKS[cue];if(!rule||!bank||p.health<=0||p.spectating||p.flight!=='ground')return false;
 if(!p.bossVoice)initializeBossVoice(sim,p);const v=p.bossVoice;
 if(sim.time<(v.lastByCue[cue]??-100)+rule.cooldown)return false;
 const interrupt=rule.priority>v.priority&&rule.priority>=2;
 if(sim.time<v.busyUntil&&!interrupt||sim.time-v.lastAt<(interrupt?.4:2.5))return false;
 if(chance&&rule.chance!==undefined&&random(p)>rule.chance)return false;
 let bag=v.bags[cue];if(!bag?.length)bag=v.bags[cue]=[...bank];
 let eligible=bag.filter(id=>id!==v.lastClip);if(!eligible.length)eligible=bag;
 const clipId=eligible[Math.min(eligible.length-1,Math.floor(random(p)*eligible.length))];bag.splice(bag.indexOf(clipId),1);
 const clip=BOSS_VOICE_CLIPS[clipId],profile=BOSS_VOICE_PROFILES[p.bossId]||BOSS_VOICE_PROFILES['warden-aster'];
 v.lastClip=clipId;v.lastByCue[cue]=sim.time;v.lastAt=sim.time;v.busyUntil=sim.time+clip.duration/profile.rate;v.priority=rule.priority;
 sim.emit('boss-voice',{player:p.id,bossId:p.bossId,cue,clip:clipId,x:p.x,y:p.y+1.55,z:p.z});return true;
}
// Called only by the existing staggered perception scan (5 Hz, three bosses).
export function bossVoiceTick(sim,p){
 const v=p.bossVoice;if(!v||sim.time<v.nextAt||p.health<=0||p.bossVeil||p.bossWindup)return;
 const cue=p.bossAlert==='searching'?'search':p.bossAlert==='alerted'?'pursuit':p.bossAlert==='suspicious'?null:p.moving?'patrol':'idle';
 if(!cue){v.nextAt=sim.time+2;return;}
 const rule=BOSS_VOICE_RULES[cue];v.nextAt=sim.time+rule.min+random(p)*(rule.max-rule.min);requestBossVoice(sim,p,cue);
}
export function bossCombatVoice(sim,p){
 if(!p.bossVoice)initializeBossVoice(sim,p);const v=p.bossVoice;if(sim.time<(v.combatAt||0))return;
 const rule=BOSS_VOICE_RULES.combat;v.combatAt=sim.time+rule.min+random(p)*(rule.max-rule.min);requestBossVoice(sim,p,'combat');
}
