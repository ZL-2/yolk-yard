// Original, mode-local tuning. None of these values mutate the PvP definitions.
export const ZOMBIES = Object.freeze({map:'blacktide',capacity:24,maxAlive:48,maxCorpses:8,maxDrops:12,maxEffects:32,intermission:12,bleedOut:45,revive:4,spawnGrace:8,startPoints:650,perkSlots:9,maxPoints:999999,lateJoinRound:10,deployment:1500,shutdown:300,lateJoinSeconds:600,contractsGoal:3});
export const Z_TYPES = Object.freeze({
 husk:{name:'Drifter',health:1,speed:1.55,damage:1,color:0x8e9b87,cloth:0x40565a,scale:1,first:1},
 runner:{name:'Rusher',health:.8,speed:3.45,damage:.85,color:0xb0ae8b,cloth:0x9a5c39,scale:.96,first:3},
 armored:{name:'Shellback',health:1.6,speed:1.6,damage:1.1,color:0x789083,cloth:0x546b73,scale:1.07,first:5},
 heavy:{name:'Breakwater',health:3.4,speed:1.25,damage:1.65,color:0x839778,cloth:0x51534b,scale:1.28,first:7},
 leaper:{name:'Skitter',health:1.05,speed:2.8,damage:1.15,color:0xbca78b,cloth:0x615b75,scale:.9,first:6},
 disruptor:{name:'Signal Wraith',health:1.8,speed:1.7,damage:.9,color:0x82a9a5,cloth:0x354e64,scale:1.06,first:9},
 elite:{name:'Warden',health:5.5,speed:2.1,damage:1.4,color:0xb1a293,cloth:0x6b3444,scale:1.23,first:12},
 boss:{name:'The Bellwether',health:28,speed:1.65,damage:1.8,color:0x99aba2,cloth:0x263e49,scale:1.8,first:15},
 hound:{name:'Ash Hound',health:.65,speed:4.3,damage:.8,color:0x694b3e,cloth:0x373d37,scale:.8,first:1},
 mimic:{name:'Lure',health:3,speed:2.8,damage:1.3,color:0x8b6568,cloth:0x555050,scale:1.3,first:1},
 mercenary:{name:'Black Wake Rifleman',health:1.8,speed:2,damage:.8,color:0x9b8b75,cloth:0x464b42,scale:1,first:1},
 colossus:{name:'The Drowned',health:32,speed:1.2,damage:2,color:0x74877b,cloth:0x454f4e,scale:2.4,first:1},
});
export const Z_PERKS = Object.freeze({
 vigor:{name:'Iron Pulse',cost:2200,color:'#ef785d',icon:'♥',description:'180 maximum health. Restores health when purchased.'},
 quickhands:{name:'Quickwire',cost:1800,color:'#e2bf68',icon:'↻',description:'Reload 32% faster. Swap weapons 25% faster.'},
 stride:{name:'Longstride',cost:2000,color:'#88c9a0',icon:'»',description:'12% faster movement and faster stamina recovery.'},
 lifeline:{name:'Lifeline',cost:1600,color:'#7dbbdd',icon:'＋',description:'Revive twice as fast. One self recovery per purchase.'},
 deadeye:{name:'Glass Eye',cost:2400,color:'#c1a4e4',icon:'⌖',description:'35% more critical damage and steadier aim.'},
 recovery:{name:'Second Wind',cost:1900,color:'#69c5bc',icon:'◇',description:'Regeneration starts after 3 seconds and heals faster.'},
 scavenger:{name:'Surveyor',cost:1800,color:'#e0cd8d',icon:'◈',description:'25% more Scrap from supply caches.'},
 elemental:{name:'Flux',cost:2800,color:'#ca97d6',icon:'ϟ',description:'Periodically triggers a random elemental ammunition effect.'},
 insurance:{name:'Echo Keeper',cost:3000,color:'#b2c6db',icon:'◎',description:'Banks your unused backpack even if this deployment fails, after verified combat participation.'},
});
export const Z_SPECIALS = Object.freeze([
 {id:'arcLoom',base:'comet',name:'ARC LOOM',role:'RESONANCE',color:0x70e3d2,special:'chain',damage:90,magazine:14,reserve:84,interval:.36},
 {id:'riftDriver',base:'thumper',name:'RIFT DRIVER',role:'GRAVITY',color:0xab91e9,special:'rift',damage:175,magazine:4,reserve:24,interval:1.05},
 {id:'cinderLance',base:'anchor',name:'CINDER LANCE',role:'THERMAL',color:0xf4a15b,special:'cinder',damage:125,magazine:8,reserve:48,interval:.52},
]);
export const Z_UPGRADE_COST=[3500,8000,16000],Z_UPGRADE_DAMAGE=[1,2.2,4.2,7.2],Z_GRADE_DAMAGE=[1,1.25,1.55,2,2.6];
export const Z_BOX_WEIGHTS=[['pip',3],['zipper',18],['sprinter',20],['scatter',13],['duet',12],['anchor',10],['needle',6],['doubleyolk',8],['comet',7],['thumper',5],['arcLoom',2],['riftDriver',1],['cinderLance',2]];
export const Z_POWERUPS={ammo:{name:'FULL RESUPPLY',color:0xe7c375,duration:0},double:{name:'DOUBLE CHARGE',color:0xe2c96f,duration:25},overcharge:{name:'OVERCHARGE',color:0xf18a66,duration:18},chill:{name:'DEEP FREEZE',color:0x86ceea,duration:16},guard:{name:'SAFEGUARD',color:0x85dbad,duration:18}};
export function zombieDifficulty(round,players=1){
 const r=Math.max(1,Math.min(1000000,Math.floor(round)||1)),p=Math.max(1,Math.min(4,players));
 return {population:Math.min(130,Math.round((7+r*2.4+Math.min(r,30)*.15)*(1+(p-1)*.42))),aliveCap:Math.min(ZOMBIES.maxAlive,10+p*3+Math.floor(r*.6)),health:Math.min(1350,75+30*(r-1)+Math.max(0,r-8)*12),damage:Math.min(42,22+(r-1)*.8),speed:Math.min(1.35,1+(r-1)*.012),interval:Math.max(.38,1.65-r*.055-(p-1)*.12),specialWave:r%5===0};
}
const statCache=new Map();
export function zombiesGun(base,item={},perks=[]){
 const tier=Math.max(0,Math.min(3,item.tier||0)),grade=Math.max(0,Math.min(4,item.grade||0)),quick=perks.includes('quickhands'),eye=perks.includes('deadeye'),key=`${base.id}:${tier}:${grade}:${quick}:${eye}:${item.mod||''}:${item.attachment||''}`;
 if(!statCache.has(key)){const special=Z_SPECIALS.find(w=>w.id===base.id),damage=(special?.damage??base.damage*1.7)*Z_UPGRADE_DAMAGE[tier]*Z_GRADE_DAMAGE[grade];
  statCache.set(key,{...base,...special,damage,projectile:false,hitscan:true,burst:0,range:Math.max(60,base.range||60),name:(tier?['','RESONANT ','HARMONIC ','ASCENDANT '][tier]:'')+base.name,magazine:Math.round((special?.magazine??base.magazine)*(1+tier*.25)),reserve:Math.round((special?.reserve??base.reserve)*(1+tier*.3)),critical:(base.critical||1.7)*(eye?1.35:1),reload:base.reload*(quick?.68:1),reloadEmpty:base.reloadEmpty*(quick?.68:1),spread:base.spread*(eye?.8:1),adsSpread:base.adsSpread*(eye?.8:1),tier,grade,mod:item.mod||null});
 }const value=statCache.get(key);if(!item.attachment)return value;return {...value,...(item.attachment==='extended'?{magazine:Math.round(value.magazine*1.3),reload:value.reload*1.12}:item.attachment==='stabilizer'?{spread:value.spread*.7,adsSpread:value.adsSpread*.7}:item.attachment==='suppressor'?{damage:value.damage*.95,adsSpread:value.adsSpread*.65}:item.attachment==='optic'?{zoom:(value.zoom||1.5)*1.3}:{})};
}
export const zHas=(p,key)=>p.zPerks?.includes(key);

