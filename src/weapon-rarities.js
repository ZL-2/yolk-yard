// Explicit Fortnite weapon-family reference rows, not a universal percentage.
// Damage is a complete close-range body shot; physics stores damage per pellet.
// References: fortnite.gs extracted Creative rows (42.30); Skye's AR and Oscar's
// Frenzy Auto named Mythics. Fortnite changes these rows between game versions.
// Recoil and named-Mythic cadence use the reference's relative changes, while
// retaining Ravelfront's existing Rare recoil and standard firing cadence.
const row=(reference,damage,reload,magazine,recoil,fireRateScale=1)=>Object.freeze({reference,damage:Object.freeze(damage),reload:Object.freeze(reload),magazine:Object.freeze(Array.isArray(magazine)?magazine:damage.map(()=>magazine)),recoil:Object.freeze(recoil),fireRateScale:Object.freeze(Array.isArray(fireRateScale)?fireRateScale:damage.map(()=>fireRateScale))});
export const WEAPON_RARITIES=Object.freeze({
 sprinter:row('Assault Rifle / Skye',[30,31,33,35,36,37],[2.75,2.63,2.5,2.38,2.25,2.1],30,[3.85,3.68,3.5,3.33,3.15],[1,1,1,1,1,6/5.5]),
 scatter:row('Pump Shotgun',[87,95,103,111,119],[5.22,4.86,4.5,4.14,3.78],5,[10.44,9.72,9,8.28,7.56]),
 needle:row('Bolt-Action Sniper Rifle',[99,105,110,116,121],[3.3,3.15,3,2.5,2.35],1,[5.5,5.25,5,4.75,4.5]),
 zipper:row('Submachine Gun',[15,16,17,18,19],[2.42,2.31,2.2,2.09,1.98],36,[1.65,1.58,1.5,1.43,1.35]),
 thumper:row('Rocket Launcher',[74,89,105,121,137],[4.55,4.03,3.5,2.98,2.45],1,[5.85,5.18,4.5,3.83,3.15]),
 anchor:row('DMR',[45,48,50,53,55,58],[2.75,2.63,2.5,2.38,2.25,2.13],10,[6.88,6.56,6.25,5.94,5.63,5.31]),
 duet:row('Burst Assault Rifle',[31,32,34,36,37],[2.75,2.63,2.5,2.38,2.25],20,[2.75,2.63,2.5,2.38,2.25]),
 pip:row('Tactical Pistol',[24,26,27,28,30,31],[1.54,1.47,1.4,1.35,1.3,1.25],15,[3.85,3.68,3.5,3.33,3.15,2.98]),
 peeper:row('DMR',[45,48,50,53,55,58],[2.75,2.63,2.5,2.38,2.25,2.13],10,[6.88,6.56,6.25,5.94,5.63,5.31]),
 doubleyolk:row('Frenzy Auto Shotgun / Oscar',[62,66,69,72,76,78],[4.73,4.52,4.3,4.09,3.87,3.66],8,[4.4,4.2,4,3.8,3.6,3.4],[1,1,1,1,1,2.5/2.3]),
 comet:row('Infantry Rifle',[36,38,40,42,44],[2.53,2.42,2.3,2.19,2.07],[8,8,8,10,10],[4.4,4.2,4,3.8,3.6]),
});
