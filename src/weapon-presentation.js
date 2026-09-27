// Visual/optic tuning only. Combat damage, magazines and projectile balance live in data.js.
export const OPTICS = {
 needle:{radius:.185,objective:.218,length:.66,magnification:4.5,sensitivity:.72,transition:10,overlay:'precision',reticle:'mil-dot'},
 anchor:{radius:.166,objective:.195,length:.59,magnification:3.25,sensitivity:.84,transition:12,overlay:'precision',reticle:'chevron'},
 peeper:{radius:.174,objective:.202,length:.62,magnification:3.5,sensitivity:.8,transition:12,overlay:'precision',reticle:'mil-dot'},
 duet:{radius:.125,objective:.145,length:.43,magnification:1.8,sensitivity:1,transition:15,overlay:'prism',reticle:'chevron'},
};
export function adsFov(w,base){return w.ads?.fov??(w.ads?2*Math.atan(Math.tan(base*Math.PI/360)/w.ads.magnification)*180/Math.PI:w.zoom);}
export const GROUND_DISPLAY = {
 sprinter:{scale:1,yaw:.95,pitch:-.06,lift:.57},scatter:{scale:1,yaw:1.1,pitch:-.04,lift:.52},
 needle:{scale:.95,yaw:1.05,pitch:-.05,lift:.6},zipper:{scale:1.12,yaw:1.05,pitch:0,lift:.64},
 thumper:{scale:1.05,yaw:1.0,pitch:-.04,lift:.65},anchor:{scale:1,yaw:1.0,pitch:-.05,lift:.59},
 duet:{scale:1.04,yaw:1.05,pitch:-.03,lift:.61},pip:{scale:1.35,yaw:1.05,pitch:0,lift:.65},
 peeper:{scale:1,yaw:1.05,pitch:-.05,lift:.61},doubleyolk:{scale:1,yaw:1.05,pitch:-.04,lift:.55},
 comet:{scale:1.05,yaw:1.05,pitch:0,lift:.61},
};
export const AMMO_VISUALS={light:{color:0xf0cd77,height:.28,radius:.055,count:8},medium:{color:0xd4a75c,height:.43,radius:.062,count:6},heavy:{color:0xd9b989,height:.66,radius:.084,count:4},shells:{color:0xd96651,height:.34,radius:.09,count:6},rockets:{color:0x819a68,height:1.08,radius:.14,count:2}};
