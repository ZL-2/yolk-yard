// Visual/optic tuning only. Combat damage, magazines and projectile balance live in data.js.
export const OPTICS = {
 needle:{radius:.065,objective:.078,length:.56,overlay:'precision',reticle:'mil-dot'},
 anchor:{radius:.054,objective:.067,length:.49,overlay:'precision',reticle:'chevron'},
 peeper:{radius:.060,objective:.072,length:.52,overlay:'precision',reticle:'mil-dot'},
 duet:{radius:.050,objective:.060,length:.38,overlay:'prism',reticle:'chevron'},
};
export function adsFov(w,base){return w.ads?.fov??(w.ads?2*Math.atan(Math.tan(base*Math.PI/360)/w.ads.magnification)*180/Math.PI:w.zoom);}
// Separate from the standardized world-space muzzle/shoulder transform. A fixed
// viewmodel FOV keeps the gun readable when the world camera zooms for ADS.
export const WEAPON_ART_REVISION=4;
export const VIEWMODELS={
 sprinter:{scale:.48,x:.23,y:-.21,z:-.61,fov:68},
 scatter:{scale:.49,x:.23,y:-.22,z:-.65,fov:70},
 needle:{scale:.47,x:.25,y:-.22,z:-.67,fov:70},
 zipper:{scale:.48,x:.22,y:-.21,z:-.61,fov:68},
 thumper:{scale:.47,x:.25,y:-.23,z:-.66,fov:72},
 anchor:{scale:.47,x:.24,y:-.22,z:-.66,fov:70},
 duet:{scale:.48,x:.23,y:-.21,z:-.62,fov:68},
 pip:{scale:.53,x:.18,y:-.19,z:-.63,fov:65},
 peeper:{scale:.47,x:.24,y:-.22,z:-.67,fov:70},
 doubleyolk:{scale:.48,x:.23,y:-.22,z:-.64,fov:70},
 comet:{scale:.48,x:.24,y:-.22,z:-.64,fov:70},
};
export function viewmodelProfile(id,aspect=16/9){const p=VIEWMODELS[id]||VIEWMODELS.sprinter;return {...p,z:p.z-Math.max(0,1.25/aspect-1)*.26};}
export const RETICLES={sprinter:'crosshair',scatter:'iron',needle:'mil-dot',zipper:'reflex-dot',thumper:'ring',anchor:'chevron',duet:'chevron',pip:'iron',peeper:'mil-dot',doubleyolk:'iron',comet:'reflex-dot'};
export const GROUND_DISPLAY = {
 sprinter:{scale:1,yaw:.95,pitch:-.06,lift:.57},scatter:{scale:1,yaw:1.1,pitch:-.04,lift:.52},
 needle:{scale:.95,yaw:1.05,pitch:-.05,lift:.6},zipper:{scale:1.12,yaw:1.05,pitch:0,lift:.64},
 thumper:{scale:1.05,yaw:1.0,pitch:-.04,lift:.65},anchor:{scale:1,yaw:1.0,pitch:-.05,lift:.59},
 duet:{scale:1.04,yaw:1.05,pitch:-.03,lift:.61},pip:{scale:1.35,yaw:1.05,pitch:0,lift:.65},
 peeper:{scale:1,yaw:1.05,pitch:-.05,lift:.61},doubleyolk:{scale:1,yaw:1.05,pitch:-.04,lift:.55},
 comet:{scale:1.05,yaw:1.05,pitch:0,lift:.61},
};
export const AMMO_VISUALS={light:{color:0xf0cd77,height:.28,radius:.055,count:8},medium:{color:0xd4a75c,height:.43,radius:.062,count:6},heavy:{color:0xd9b989,height:.66,radius:.084,count:4},shells:{color:0xd96651,height:.34,radius:.09,count:6},rockets:{color:0x819a68,height:1.08,radius:.14,count:2}};
