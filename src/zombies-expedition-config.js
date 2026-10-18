export const Z_GAS={x:-180,z:108,startRadius:60,growth:365};
export const Z_GRADES=['FIELD','IMPROVED','RARE','ELITE','MASTERWORK'];
export const Z_GRADE_COST=[80,160,260,400];
export const Z_ITEMS={
 plate:{name:'Armor plate',icon:'▰',description:'Restore 50 armor.',cost:120},medkit:{name:'Trauma kit',icon:'✚',description:'Restore health.',cost:250},mask:{name:'Filter cartridge',icon:'◉',description:'60 seconds of contamination protection.',cost:600},self:{name:'Self-recovery kit',icon:'✚',description:'One recovery while downed.',cost:1800},
 tool1:{name:'Improved calibration',icon:'⌁',description:'Upgrade held weapon to grade 1.'},tool2:{name:'Rare calibration',icon:'⌁',description:'Upgrade held weapon to grade 2.'},tool3:{name:'Elite calibration',icon:'⌁',description:'Upgrade held weapon to grade 3.'},tool4:{name:'Masterwork calibration',icon:'⌁',description:'Upgrade held weapon to grade 4.'},crystal1:{name:'Resonance cell I',icon:'◇',description:'Upgrade held weapon to resonance I.'},crystal2:{name:'Resonance cell II',icon:'◇',description:'Upgrade held weapon to resonance II.'},
 chill:{name:'Frost cartridge',icon:'❄',description:'Slowing ammunition.'},burn:{name:'Ember cartridge',icon:'ϟ',description:'Incendiary ammunition.'},chain:{name:'Arc cartridge',icon:'ϟ',description:'Chaining electrical ammunition.'},convert:{name:'Accord cartridge',icon:'◎',description:'Temporarily turns a normal infected into an ally.'},blast:{name:'Fracture cartridge',icon:'✹',description:'Periodic explosive damage.'},
 turret:{name:'Sentry deployment',icon:'⊥',description:'Automatic support fire for 35 seconds.',cost:2200},strike:{name:'Mortar designation',icon:'⌖',description:'Three blasts at your activation position. Move clear.',cost:1800},juggernaut:{name:'Bulwark suit',icon:'▣',description:'Temporary heavy armor and damage resistance.',cost:4000},
 arcLoom:{name:'Arc Loom case',icon:'ϟ',description:'Unpack the chain weapon.'},riftDriver:{name:'Rift Driver case',icon:'◎',description:'Unpack the gravity weapon.'},cinderLance:{name:'Cinder Lance case',icon:'♨',description:'Unpack the thermal weapon.'},
};
export const Z_FIELDS={pulse:{name:'Repulsor',description:'Damage and slow the nearby horde.'},sanctuary:{name:'Sanctuary',description:'Heal and revive nearby operators.'},shroud:{name:'Veil',description:'Avoid infected damage for ten seconds.'},guard:{name:'Challenge',description:'Become invulnerable for eight seconds.'},mine:{name:'Resonance mine',description:'Plant a proximity blast.'},link:{name:'Stormlink',description:'Restore nearby squad health and armor; revive downed allies.'}};
export const Z_STORY=[
 {name:'Safe Harbor',description:'Complete three contracts and extract with the evacuation supplies.',kind:'contracts',goal:3},
 {name:'The Missing Convoy',description:'Recover all three field recordings and extract the evidence.',kind:'logs',goal:3},
 {name:'Black Wake',description:'Complete a sabotage contract, align the Lattice cipher using the recordings, then extract.',kind:'sabotage',goal:1},
 {name:'The Last Transmission',description:'Charge all three resonators, enter the Lattice breach, defeat its guardian, and extract.',kind:'rift',goal:1},
 {name:'Silence the Coast',description:'Defeat the Bellwether in the Observatory and extract its signal core.',kind:'boss',goal:1},
];
export const Z_SCHEMATICS={tool1:{name:'Improved calibration',cooldown:300},chill:{name:'Frost cartridge',cooldown:300},medkit:{name:'Trauma kit',cooldown:180},tool2:{name:'Rare calibration',cooldown:600},crystal1:{name:'Resonance cell',cooldown:900},self:{name:'Self-recovery kit',cooldown:900},arcLoom:{name:'Arc Loom case',cooldown:1800},riftDriver:{name:'Rift Driver case',cooldown:2400},cinderLance:{name:'Cinder Lance case',cooldown:1800}};
export const zSquad=(state,p)=>state.players.filter(o=>!o.friendSpectator&&o.zSquad===p.zSquad);
export const zAlive=p=>p&&p.health>0&&!p.downed&&!p.spectating&&p.connected!==false&&!p.loading&&!p.friendSpectator&&!p.zExtracted;
