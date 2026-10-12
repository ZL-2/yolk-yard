import {ROYALE_BOT_RANGE} from './field-refinement.js';
// Shared intelligence, with deliberately fallible execution at every difficulty.
// Hearing mirrors the movement and chest sounds available to human players.
export const BOT_WORLD_SENSES=Object.freeze({footsteps:true,chestHumRadius:12});
export const ROYALE_TEAM_BOT=Object.freeze({followDistance:8,regroupDistance:28,combatLeash:42,lootLeash:24,materialTarget:180,totalMaterials:300,harvestRadius:20,rescueHold:4});
export const BOT_SKILL=[
 {name:'Casual',reaction:.85,error:.10,hit:.30,lead:.08,cover:.32,grenade:.12,turn:2.5,burst:.26,pause:.85,vision:75,fov:1.15,hearing:65,steps:9,perception:.28,decision:2.4,memory:5,retreat:30,build:.08,stormMargin:18,search:8,teamRange:22},
 {name:'Intermediate',reaction:.52,error:.067,hit:.48,lead:.27,cover:.52,grenade:.3,turn:3.6,burst:.44,pause:.62,vision:100,fov:1.3,hearing:80,steps:11,perception:.22,decision:1.7,memory:8,retreat:38,build:.28,stormMargin:25,search:12,teamRange:28},
 {name:'Advanced',reaction:.28,error:.036,hit:.72,lead:.60,cover:.76,grenade:.65,turn:5.2,burst:.72,pause:.45,vision:125,fov:1.4,hearing:95,steps:14,perception:.16,decision:1.1,memory:11,retreat:45,build:.52,stormMargin:35,search:16,teamRange:35},
 {name:'Impossible',reaction:.18,error:.023,hit:.85,lead:.85,cover:.92,grenade:.85,turn:7,burst:.88,pause:.3,vision:145,fov:1.5,hearing:105,steps:16,perception:.13,decision:.75,memory:14,retreat:52,build:.78,stormMargin:42,search:20,teamRange:40},
];
// Intelligence still scales, but even strong bots need time to aim and correct.
// These are execution errors, never damage multipliers or extra perception jobs.
const HUMAN_EXECUTION=[
 {reaction:1.05,trackingDelay:.34,trackingRate:4.2,trackingLead:.55,aimOffset:.28,flinch:.48,burstGap:.34},
 {reaction:.78,trackingDelay:.24,trackingRate:5.5,trackingLead:.7,aimOffset:.18,flinch:.36,burstGap:.28},
 {reaction:.55,trackingDelay:.18,trackingRate:7,trackingLead:.8,aimOffset:.13,flinch:.28,burstGap:.23},
 {reaction:.4,trackingDelay:.14,trackingRate:8.5,trackingLead:.85,aimOffset:.1,flinch:.22,burstGap:.2},
];
for(let i=0;i<BOT_SKILL.length;i++)Object.assign(BOT_SKILL[i],HUMAN_EXECUTION[i]);
const ROYALE_BOT_SKILL=BOT_SKILL.map(s=>({...s,vision:Math.min(s.vision,ROYALE_BOT_RANGE.vision),hearing:Math.min(s.hearing,75),error:s.error*1.07,hit:s.hit*.97,stormMargin:s.stormMargin+10}));
export const skillFor=sim=>(sim.options.mode==='royale'?ROYALE_BOT_SKILL:BOT_SKILL)[Math.max(0,Math.min(3,(sim.options.difficulty||2)-1))];
export const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
