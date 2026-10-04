// Original encounters. Weapon IDs stay compatible with the existing models.
export const BOSSES=Object.freeze([
 {id:'warden-aster',name:'Commandant Voss',title:'Aster Commander',poi:'observatory',health:600,shield:400,weapon:'sprinter',rarity:5,leash:26,notice:38,reaction:1.35,burst:.42,cycle:3.4,aimError:.04,color:'#3b3938',accent:'#e99b49',outfit:'outfit-ember',ability:'rig'},
 {id:'marshal-rook',name:'Marshal Rook',title:'Breakwater Warden',poi:'docks',health:650,shield:350,weapon:'doubleyolk',rarity:5,leash:24,notice:34,reaction:1.2,burst:.2,cycle:2.5,aimError:.05,color:'#233f5b',accent:'#f59f48',outfit:'outfit-tide',ability:'winch'},
 {id:'lieutenant-nyx',name:'Lieutenant Nyx',title:'Nightglass Scout',poi:'woods',health:500,shield:350,weapon:'anchor',rarity:5,leash:22,notice:68,reaction:1.5,burst:.18,cycle:2.8,aimError:.035,color:'#526547',accent:'#e85e59',outfit:'outfit-moss',ability:'veil'},
]);
export const bossDefinition=id=>BOSSES.find(b=>b.id===id)||BOSSES[0];
export const MYTHIC_WEAPONS=Object.freeze({
 'warden-aster':{id:'sprinter',name:"Commandant Voss’s Mythic Service Rifle",damage:1.13,reload:.90},
 'marshal-rook':{id:'doubleyolk',name:"Marshal Rook’s Mythic Breacher Shotgun",damage:1.12,reload:.80,spread:.84,interval:1.12},
 'lieutenant-nyx':{id:'anchor',name:"Lieutenant Nyx’s Mythic DMR",damage:1.12,reload:.90,magazine:6,firstShot:.18},
});
