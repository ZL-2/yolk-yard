import {architectureKit,buildingSurface} from './architecture-surfaces.js';

// The clear rectangle is exactly the authored window opening. Frames, reveals
// and the projecting drip sill sit outside it; no invisible pane blocks a shot.
export function architectureWindow(g,{x,y,z,w=1.1,h=1.05,axis='z',sign=1,trim=0xd9d7cb,wood=0x6b6255},raw={}){
 const {block:box}=architectureKit(raw),part=(u,v,depth,ww,hh,dd,c,kind='paint')=>axis==='x'?box(g,x+sign*depth,y+v,z+u,dd,hh,ww,c,kind):box(g,x+u,y+v,z+sign*depth,ww,hh,dd,c,kind);
 for(const edge of [-1,1]){
  part(edge*(w/2+.055),0,.045,.11,h+.20,.40,trim);
  part(0,edge*(h/2+.055),.045,w+.22,.11,.40,trim);
  part(edge*(w/2+.017),0,-.035,.034,h,.30,0x4d4e47,'metal');
 }
 part(0,-h/2-.12,.11,w+.34,.13,.54,0xbcb5a3,'concrete');
 part(0,-h/2-.20,.29,w+.23,.025,.035,wood,'metal');
}

// A bounded close-range dressing pass: all additions stay on existing wall,
// roof and stair surfaces. It does not move or add collision/layout records.
export function detailBuilding(g,b,s,raw={}){
 const k=architectureKit(raw,b),{block:box,beam,cylinder}=k,{x,z,w,d,h}=b,y=b.baseY||0,floors=b.floors||1,industrial=buildingSurface({},b)==='concrete',wood=buildingSurface({},b)==='timber',metal=industrial?0x7f9294:0x687772;
 const start=g.children.length;
 // A stone damp course is split at both entrances, preserving the clear span.
 const span=(w-3.35)/2;
 for(const side of [-1,1]){
  box(g,x+side*(w/2+.015),y+.14,z,.40,.28,d+.10,0x8e9488,'concrete');
  for(const sx of [-1,1])box(g,x+sx*(1.675+span/2),y+.14,z+side*d/2,span,.28,.40,0x8e9488,'concrete');
 }
 if(b.floors)for(let f=0;f<floors;f++){
  const fy=y+f*4.2,interior=wood?s.wood:0xb5b3a2;
  // Plinths are against solid walls and stop at the 3.2m entrance openings.
  for(const side of [-1,1]){
   box(g,x+side*(w/2-.205),fy+.075,z,.055,.15,d-.35,interior,wood?'timber':'paint');
   for(const sx of [-1,1])box(g,x+sx*(1.65+span/2),fy+.075,z+side*(d/2-.205),span-.05,.15,.055,interior,wood?'timber':'paint');
  }
  // Thin tread nosings sit on the existing stair surface, without a new step.
  const run=d-4,sx=x-w/2+1.8;
  for(let j=0;j<12;j++)box(g,sx,fy+(j+1)*.35-.012,z-run/2+j*run/12+.04,3.18,.024,.065,industrial?0xa9b4b0:0x8d7b61,industrial?'metal':'timber');
  // Wall-mounted service plates and a recessed vent, clear of the central window.
  const vx=x+w/2+.2,vz=z-d*.27,vy=fy+2.85;
  box(g,vx,vy,vz,.08,.46,1.1,0x465652,'metal');
  for(let j=0;j<4;j++)box(g,vx+.055,vy-.14+j*.095,vz,.08,.035,1.02,metal,'metal');
  box(g,x+w/2-.20,fy+1.1,z+d*.22,.032,.20,.12,0xd5d2c1,'paint');
 }
 // Proper fascia, drip edges and rainwater downpipes give roofs thickness.
 const gable=b.roof==='gable'&&b.floors,cx=gable?x+w*.18:x,r=gable?w*.29:w/2;
 const gutterY=y+h+(gable?2.07:.72);
 for(const side of [-1,1]){
  const gx=cx+side*(r+.09);
  box(g,gx,gutterY,z,.17,.16,d+.76,metal,'metal');
  box(g,gx+side*.055,gutterY+.09,z,.055,.055,d+.76,0xa6ae9f,'metal');
  const px=x+side*(w/2+.29),pz=z-d/2+.42,top=y+h-.10;
  beam(g,[px,y+.24,pz],[px,top,pz],.07,metal);
  for(const yy of [y+.5,y+h*.52,top-.18])box(g,px,yy,pz,.20,.06,.10,0x5e6d65,'metal');
  beam(g,[px,y+.25,pz],[px+side*.22,y+.14,pz],.075,metal);
  if(gable)beam(g,[gx,gutterY,pz],[px,top,pz],.07,metal);
 }
 if(gable){
  const peak=y+h+2.1+r*Math.tan(.42);
  box(g,cx,peak+.08,z,.22,.12,d+.82,s.roof,'roof');
  for(const end of [-1,1])for(const side of [-1,1])beam(g,[cx,peak+.025,z+end*(d/2+.34)],[cx+side*r,y+h+2.1,z+end*(d/2+.34)],.07,s.trim,'paint');
 }else{
  for(const end of [-1,1])box(g,x,y+h+.76,z+end*(d/2+.05),w+.27,.08,.25,s.trim,'concrete');
 }
 // Exterior utility box, fasteners and conduit are flush against a solid bay.
 const ux=x+w/2+.21,uz=z+d*.32;
 box(g,ux,y+1.21,uz,.17,.64,.45,0x86958b,'metal');
 box(g,ux+.092,y+1.26,uz,.025,.46,.34,0x62746c,'paint');
 box(g,ux+.11,y+1.13,uz+.10,.025,.09,.035,0xc2bca3,'metal');
 beam(g,[ux,y+.15,uz],[ux,y+.88,uz],.028,metal);
 // A compact ventilation outlet occupies an existing solid roof corner.
 const rx=x+w*.34,rz=z-d*.32;
 box(g,rx,y+h+.045,rz,.69,.09,.69,0x616e68,'metal');
 cylinder(g,rx,y+h+.34,rz,.14,.6,0x889995,10,'metal');
 cylinder(g,rx,y+h+.69,rz,.23,.08,0x72817b,10,'metal');
 for(const m of g.children.slice(start))m.userData.architectureDetail=true;
 g.userData.architectureRevision=160;
 return g;
}
