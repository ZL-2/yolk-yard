// Dry layout reconstructed from the supplied Tilted Zone Wars trailer and stills.
// One footprint drives the render, collision, spawn rooms and tactical map.
export const ZONE_MAP_REVISION=2;
const stone=0xa5a596,trim=0xd1cbb9;
export const ZONE_BUILDINGS=[
 {id:'central',name:'Central Tower',x:0,z:-4,w:16,d:16,floors:7,color:0x8a8e85,trim,style:'office',sections:[{x:0,z:0,w:16,d:16,floors:7},{x:0,z:12,w:16,d:8,floors:3}]},
 {id:'north-apartments',name:'North Apartments',x:-30,z:-30,w:20,d:16,floors:4,color:stone,trim,style:'apartments',sections:[{x:0,z:0,w:20,d:16,floors:4},{x:-2,z:12,w:8,d:8,floors:4},{x:-2,z:-10,w:8,d:4,floors:4}]},
 {id:'brick-apartments',name:'Brick Apartments',x:30,z:-30,w:20,d:16,floors:4,color:0x9a6253,trim:0xcfb8a1,style:'brick',sections:[{x:0,z:0,w:20,d:16,floors:4},{x:-2,z:12,w:8,d:8,floors:4},{x:-2,z:-10,w:8,d:4,floors:4}]},
 {id:'courtyard-west',name:'Courtyard West',x:23,z:28,w:8,d:24,floors:3,color:0xb7b9ac,trim:0xd7d4c4,style:'courtyard',sections:[{x:0,z:0,w:8,d:24,floors:3},{x:6,z:-8,w:4,d:8,floors:3}],stairX:23,stairNorth:16},
 {id:'courtyard-east',name:'Courtyard East',x:43,z:28,w:8,d:24,floors:3,color:0xa9ada5,trim:0xd7d4c4,style:'courtyard',sections:[{x:0,z:0,w:8,d:24,floors:3},{x:-6,z:-8,w:4,d:8,floors:3}],stairX:43,stairNorth:16},
 ...[['west',-30,0],['north',0,-32],['east',30,0],['south',0,32]].map(([id,x,z])=>({id:'clock-'+id,name:id[0].toUpperCase()+id.slice(1)+' Clock',x,z,w:6,d:8,floors:7,color:0xc5b897,trim:0xe1d4b8,clock:true,style:'clock'})),
 {id:'basketball',name:'Basketball Court',x:-30,z:30,w:20,d:24,floors:1,color:0x877e6b,trim,style:'court',noStairs:true},
];
export function zoneFootprints(b){return (b.sections||[{x:0,z:0,w:b.w,d:b.d,floors:b.floors}]).map(s=>({...s,x:s.x+b.x,z:s.z+b.z}));}
function createZoneMap(){
 const boxes=[],decor=[],windows=[],spawnRooms=[],buildings=ZONE_BUILDINGS.map(b=>({...b,h:b.floors*4,baseY:0,roof:'flat',footprints:zoneFootprints(b)}));let serial=0;
 const block=(x,y,z,w,h,d,color,extra={})=>{const o={x,y,z,w,h,d,color,material:'brick',surface:'brick',objectId:'zw2-'+serial++,...extra};boxes.push(o);return o;};
 const detail=(x,y,z,w,h,d,color,surface='concrete',objectId)=>decor.push({x,y,z,w,h,d,color,surface,objectId});
 const slab=(r,y,hole,color,extra)=>{
  const l=r.x-r.w/2,rr=r.x+r.w/2,n=r.z-r.d/2,s=r.z+r.d/2,hl=hole?Math.max(l,hole.l):rr,hr=hole?Math.min(rr,hole.r):l,hn=hole?Math.max(n,hole.n):s,hs=hole?Math.min(s,hole.s):n;
  if(!hole||hl>=hr||hn>=hs){block(r.x,y-.22,r.z,r.w,.22,r.d,color,extra);return;}
  for(const [x,z,w,d]of [[(l+hl)/2,r.z,hl-l,r.d],[(hr+rr)/2,r.z,rr-hr,r.d],[(hl+hr)/2,(n+hn)/2,hr-hl,hn-n],[(hl+hr)/2,(hs+s)/2,hr-hl,s-hs]])if(w>.01&&d>.01)block(x,y-.22,z,w,.22,d,color,extra);
 };
 for(const [bi,b]of buildings.entries()){
  const stairX=b.stairX??b.x+b.w/2-(b.clock?1.45:2.25),north=b.stairNorth??b.z-b.d/2,run=b.clock?6:8,stairW=b.clock?2.05:3.15,hole={l:stairX-stairW/2-.15,r:stairX+stairW/2+.15,n:north+.1,s:north+run+1.1};
  b.stairs=b.noStairs?null:{x:stairX,north,run,width:stairW};
  if(b.clock){
   for(let f=0;f<=7;f++){
    slab(b,f*4,f?hole:null,f===7?0x8e5c3e:0x969183,{building:bi,part:'floor',level:f,surface:f===7?'roof':'concrete',indestructible:f===0});
    if(f===7)break;const y=f*4;
    for(const [side,x,z,w,d]of [[0,b.x,b.z+4,6,.35],[1,b.x+3,b.z,.35,8],[2,b.x,b.z-4,6,.35],[3,b.x-3,b.z,.35,8]]){
     const across=side%2===0,len=across?w:d,door=f===0&&side===0,arch=f===6;
     const face=(off,yy,width,height)=>block(x+(across?off:0),yy,z+(across?0:off),across?width:.35,height,across?.35:width,b.color,{building:bi,part:'wall',level:f});let owner;
     if(door||arch){const gap=door?2.6:3.3;for(const sign of [-1,1])owner=face(sign*(len+gap)/4,y,(len-gap)/2,4);face(0,y+3.25,gap,.75);if(arch)windows.push({x,z,y:y+.15,w:gap,h:3.1,side,arch:true,color:b.trim,objectId:owner.objectId});}
     else owner=face(0,y,len,4);
     if(f===0||f===1||f===6)detail(x,y+.04,z,across?len+.32:.65,.2,across?.65:len+.32,b.trim,'concrete',owner.objectId);
     if(f===5){b.clockOwners??=[];b.clockOwners[side]=owner.objectId;}
    }
    for(let i=0;i<16;i++)block(stairX,y+i*.25,north+.75+(i+.5)*run/16,stairW,.25,run/16,0x8c8575,{building:bi,part:'stair',level:f,surface:'concrete'});
   }
   for(const dx of [-2.88,2.88])for(const dz of [-3.88,3.88])detail(b.x+dx,4,b.z+dz,.3,20,.3,b.trim);
   for(const z of [b.z-4,b.z+4])block(b.x,28,z,6.6,.45,.4,b.trim,{building:bi,part:'parapet'});
   for(const x of [b.x-3,b.x+3])block(x,28,b.z,.4,.45,8.6,b.trim,{building:bi,part:'parapet'});
   continue;
  }
  const cells=f=>{const m=new Map();for(const s of b.footprints.filter(s=>s.floors>f))for(let x=s.x-s.w/2+2;x<s.x+s.w/2;x+=4)for(let z=s.z-s.d/2+2;z<s.z+s.d/2;z+=4)m.set(x+','+z,{x,z,w:4,d:4});return m;};
  for(let f=0;f<=b.floors;f++){
   const current=cells(f),below=f?cells(f-1):current,all=new Map([...below,...current]),y=f*4;
   for(const [key,r]of all){const roof=f>0&&!current.has(key);slab(r,y,f&&!b.noStairs?hole:null,roof?0x353b3b:f?0x807f78:b.trim,{building:bi,part:'floor',level:f,surface:roof?'roof':f?'timber':'concrete',indestructible:f===0});}
   for(const r of current.values())for(const [side,dx,dz]of [[0,0,4],[1,4,0],[2,0,-4],[3,-4,0]]){
    if(current.has((r.x+dx)+','+(r.z+dz)))continue;
    const x=r.x+dx/2,z=r.z+dz/2,across=!dx,front=side===0,office=b.style==='office',strip=office&&(side===1&&z===-2||side===0&&f>=3&&x===2),solid=office&&(side===1&&z<4&&z!==-2&&z!==-10||side===0&&f>=3&&x!==2&&x!==-6),door=f===0&&(front||b.style==='courtyard'&&side%2===1),arched=office&&(f===0||f===b.floors-1||f===2&&!strip),gap=door?2.7:strip?2.8:office?1.65:2.3,sill=door?0:strip?.15:1;
    const face=(off,yy,width,height)=>block(x+(across?off:0),yy,z+(across?0:off),across?width:.32,height,across?.32:width,b.color,{building:bi,part:'wall',level:f});
    if(solid){face(0,y,4,4);continue;}
    const owner=face(-(4+gap)/4,y,(4-gap)/2,4);face((4+gap)/4,y,(4-gap)/2,4);face(0,y+(strip&&f<6?3.8:3.1),gap,strip&&f<6?.2:.9);if(sill)face(0,y,gap,sill);
    windows.push({x,z,y:y+sill,w:gap,h:(strip&&f<6?3.8:3.1)-sill,side,arch:arched,color:b.trim,objectId:owner.objectId,storefront:door&&b.style==='office'});
    if(!office||f===2||f===6)detail(x,y+3.83,z,across?4.12:.5,.17,across?.5:4.12,b.trim,'concrete',owner.objectId);
    if(f===0&&door&&b.style==='office')detail(x,y,z,across?3.4:.55,.2,across?.55:3.4,0x4d7058,'paint',owner.objectId);
   }
   for(const [key,r]of below){if(current.has(key))continue;for(const [side,dx,dz]of [[0,0,4],[1,4,0],[2,0,-4],[3,-4,0]])if(!below.has((r.x+dx)+','+(r.z+dz))&&!(b.style==='court'&&side===0&&Math.abs(r.x-b.x)<4)){const across=!dx;block(r.x+dx/2,y,r.z+dz/2,across?4.2:.34,.65,across?.34:4.2,b.trim,{building:bi,part:'parapet',level:f});}}
   if(f===b.floors)break;
   if(!b.noStairs)for(let s=0;s<16;s++)block(stairX,y+s*.25,north+.75+(s+.5)*.5,stairW,.25,.5,0x8a8273,{building:bi,part:'stair',level:f,surface:'concrete'});
   if(b.w>=16){const left=b.x-b.w/2;for(const dz of [-4,4])block(left+5,y,b.z+dz,.2,3.8,4,b.color,{building:bi,part:'partition',level:f,surface:'plaster'});detail(left+2,y+.1,b.z+4,2.6,.75,1.1,0x6a7a72,'fabric');detail(b.x-2,y+.05,b.z-3,3,.08,4,0x596777,'fabric');}
  }
  if(!b.noStairs){const owner=boxes.find(o=>o.building===bi&&o.part==='floor'&&o.level===b.floors);detail(b.x-2,b.h,b.z+2,2,1,1.6,0x737b7a,'metal',owner?.objectId);detail(b.x-2,b.h+1,b.z+2,2.2,.15,1.8,0x424d50,'metal',owner?.objectId);}
 }
 const sidewalks=[{x:0,z:0,w:22,d:30},...buildings.filter(b=>b.clock).map(b=>({x:b.x,z:b.z,w:11,d:13})),{x:-30,z:-28,w:26,d:34},{x:30,z:-28,w:26,d:34},{x:33,z:28,w:32,d:30},{x:-30,z:30,w:24,d:28}];
 for(const r of sidewalks)block(r.x,0,r.z,r.w,.12,r.d,0xbcb8a5,{part:'sidewalk',surface:'concrete',indestructible:true,buildBlocking:false});
 const roads=[{x:0,z:18,w:94,d:8},{x:0,z:-18,w:94,d:8},{x:-16,z:0,w:8,d:96},{x:16,z:0,w:8,d:96},{x:-46,z:0,w:6,d:94},{x:48,z:0,w:5,d:94},{x:0,z:-46,w:94,d:6},{x:0,z:46,w:94,d:6}].map(r=>({...r,kind:'street',width:Math.min(r.w,r.d),points:r.w>r.d?[[r.x-r.w/2,r.z],[r.x+r.w/2,r.z]]:[[r.x,r.z-r.d/2],[r.x,r.z+r.d/2]]}));
 const cars=[{x:-16,z:30,color:0xe3bd36,yaw:0},{x:13,z:-26,color:0x78b4a4,yaw:0},{x:-12,z:10,color:0x303c42,yaw:Math.PI/2},{x:28,z:16,color:0x6e7a82,yaw:Math.PI/2},{x:42,z:-14,color:0xcc709d,yaw:Math.PI/2}];
 for(const c of cars){const across=Math.abs(c.yaw)>1;c.objectId=block(c.x,.12,c.z,across?4.5:2.1,1.15,across?2.1:4.5,c.color,{part:'car',material:'metal',surface:'paint',harvestType:'car',buildBlocking:false}).objectId;}
 const trees=[{x:-16,z:-12,r:3.1,planter:'square'},{x:15,z:13,r:3.2,planter:'square'},{x:33,z:29,r:2.8,planter:'round'},{x:33,z:44,r:3.5,planter:'round'}];
 for(const t of trees){t.objectId=block(t.x,.12,t.z,.7,4,.7,0x746044,{part:'tree',material:'wood',surface:'timber',harvestType:'tree',buildBlocking:false}).objectId;if(t.planter==='square')block(t.x,0,t.z,4.6,.18,4.6,0xbab5a2,{part:'planter',surface:'concrete',indestructible:true,buildBlocking:false});}
 const court={x:-30,z:30,w:20,d:24,y:4,fenceIds:[]};
 for(let side=0;side<4;side++){const alongX=side%2===0,x=court.x+(side===1?10:side===3?-10:0),z=court.z+(side===0?12:side===2?-12:0),id='court-fence-'+side;court.fenceIds.push(id);for(const end of side===0?[-1,1]:[0])block(x+(side===0?end*7:0),4.65,z,alongX?(side===0?6:20):.12,2.35,alongX?.12:24,0x424d46,{objectId:id,part:'fence',hidden:true,material:'metal',surface:'metal'});}
 for(let s=0;s<16;s++)block(-30,s*.25,50-(s+.5)*.5,7,.25,.5,0xa4a190,{part:'court-stair',surface:'concrete'});
 const bouncePads=[{id:'roof-west',x:29,y:12,z:20,size:3.6},{id:'roof-east',x:43,y:12,z:20,size:3.6},{id:'street-south',x:8,y:0,z:46,size:3.6},{id:'street-north',x:-10,y:0,z:-46,size:3.6},{id:'street-east',x:47,y:0,z:7,size:3.6},{id:'street-west',x:-46,y:0,z:8,size:3.6}];
 for(const pad of bouncePads){const support=pad.y>0&&boxes.find(b=>b.part==='floor'&&Math.abs(b.y+b.h-pad.y)<.01&&Math.abs(pad.x-b.x)<=b.w/2&&Math.abs(pad.z-b.z)<=b.d/2);pad.objectId=block(pad.x,pad.y,pad.z,pad.size,.13,pad.size,0x4385af,{part:'bouncer',surface:'metal',material:'metal',indestructible:!support,buildBlocking:true,...(support?{objectId:support.objectId}: {})}).objectId;}
 const spawn=(id,x,z,levels)=>{const b=buildings.find(b=>b.id===id);for(const y of levels)spawnRooms.push({x,y:y+(y===0?.14:.02),z,yaw:Math.PI,building:buildings.indexOf(b),roomName:b.name});};
 spawn('central',-4,7,[0,4,8]);spawn('central',-5,-7,[16]);
 spawn('north-apartments',-37,-27,[0,4,8,12]);spawn('brick-apartments',23,-27,[0,4,8,12]);
 spawn('courtyard-west',23,35,[0,4]);spawn('courtyard-east',43,35,[0,4]);
 const cliffs=[];
 for(let side=0;side<4;side++)for(let i=0;i<7;i++){
  const a=side*Math.PI/2,v=-44+i*14.5,offset=57+(i%3)*1.6,x=Math.round(Math.cos(a)*v-Math.sin(a)*offset),z=Math.round(Math.sin(a)*v+Math.cos(a)*offset),h=(side===0||side===3?12:17)+(i*3+side)%7;
  const c={x,z,w:side%2?15:17,d:side%2?17:15,h,color:[0xa57551,0xb38259,0x977054,0xc18a5e][(i+side)%4],seed:i+side*7};cliffs.push(c);block(x,0,z,c.w,h*.72,c.d,c.color,{part:'cliff',surface:'plaster',indestructible:true,hidden:true});
 }
 const authored=boxes;
 return {id:'tilted-district',revision:ZONE_MAP_REVISION,name:'Tilted District',theme:'zonewars',zoneWars:true,size:76,sky:0xa8d9e9,ground:0x605d56,navCell:3,boxes,authored,decor,windows,buildings,spawnRooms,roads,sidewalks,cars,trees,cliffs,court,bouncePads,buildBounds:{minX:-52,maxX:52,minZ:-52,maxZ:52,maxY:72},buildLimit:560,spawns:spawnRooms.map(s=>[s.x,s.z]),bases:[[0,-46],[0,46]],pickups:[],props:[],landmarks:buildings.map(b=>({name:b.name,x:b.x,z:b.z})),districts:[{id:'central',name:'Central',x:0,z:0},{id:'court',name:'Court',x:-30,z:30},{id:'courtyard',name:'Courtyard',x:33,z:30}],doors:[],floorLoot:[]};
}
export const ZONE_MAP=createZoneMap();
export function zoneMap(){return {...ZONE_MAP,boxes:ZONE_MAP.authored.map(b=>({...b})),authored:ZONE_MAP.authored.map(b=>({...b}))};}
