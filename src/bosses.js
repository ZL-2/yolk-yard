// After the Signal encounters. Character identity and keycard IDs are stable.
export const BOSSES=Object.freeze([
 {id:'warden-aster',name:'Commandant Voss',title:'Bastion Commander',poi:'observatory',health:580,shield:380,weapon:'bastionburst',rarity:5,leash:23,notice:52,reaction:1.45,burst:.32,cycle:3.15,aimError:.041,color:'#27232b',accent:'#d4ac53',outfit:'outfit-voss',backbling:'backbling-voss',ability:'barrage',key:'asterKeycard',utility:'scanner',utilityCount:2,ammo:60},
 {id:'marshal-rook',name:'Marshal Rook',title:'Freighter Marshal',poi:'docks',health:640,shield:290,weapon:'breakwaterrepeater',rarity:5,leash:23,notice:37,reaction:1.05,burst:.24,cycle:2.65,aimError:.045,color:'#203a57',accent:'#f7b44e',outfit:'outfit-rook',backbling:'backbling-rook',ability:'winch',key:'rookKeycard',utility:'impulse',utilityCount:3,ammo:16},
 {id:'lieutenant-nyx',name:'Lieutenant Nyx',title:'Nightglass Interceptor',poi:'woods',health:470,shield:320,weapon:'rimeglass',rarity:5,leash:25,notice:64,reaction:1.65,burst:.20,cycle:2.95,aimError:.03,color:'#352341',accent:'#bc79f5',outfit:'outfit-nyx',backbling:'backbling-nyx',ability:'shadowstep',key:'nyxKeycard',utility:'veilProjector',utilityCount:2,ammo:16},
]);
export const bossDefinition=id=>BOSSES.find(b=>b.id===id)||BOSSES[0];
export const MYTHIC_WEAPONS=Object.freeze({
 'warden-aster':{id:'bastionburst',name:"Commandant Voss’s Mythic Bastion Burst"},
 'marshal-rook':{id:'breakwaterrepeater',name:"Marshal Rook’s Mythic Breakwater Repeater"},
 'lieutenant-nyx':{id:'rimeglass',name:"Lieutenant Nyx’s Mythic Rimeglass DMR"},
});
const BOSS_REWARDS={barrage:'Mythic Bastion Burst, Scanners & Voss keycard',winch:'Mythic Breakwater Repeater, Impulses & Rook keycard',shadowstep:'Mythic Rimeglass DMR, Veil Projectors & Nyx keycard'};
export function bossDefeatMessage(event){
 const def=BOSSES.find(b=>b.id===(event.bossId||event.target)||b.name===event.name);
 return def?`${def.name.toUpperCase()} DEFEATED · ${BOSS_REWARDS[def.ability]} dropped`:`${event.name||'Boss'} defeated`;
}
export function bossMapMarkers(map,players,caches=[]){
 return BOSSES.flatMap(def=>{
  const boss=players.find(p=>p.boss&&(p.bossId||p.id)===def.id),site=map.bossSites?.find(s=>s.bossId===def.id),poi=map.districts?.find(p=>p.id===def.poi),cache=caches.find(c=>c.bossId===def.id);
  const point=site||poi;if(!point)return [];
  const alive=!!boss&&boss.health>0,label=def.name.split(' ').at(-1).toUpperCase()+(alive?' · BOSS':cache?.opened?' · CLEARED':' · VAULT');
  return [{id:def.id,x:point.x,z:point.z,alive,label,color:def.accent}];
 });
}
