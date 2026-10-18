// A compact, original reconstruction of the Tilted urban combat layout.
// Floor openings, windows and stairs are real collision geometry, not facades.
export const ZONE_BUILDINGS=[
 {id:'brick-apartments',name:'Brick Apartments',x:-38,z:-36,w:24,d:20,floors:4,color:0x9d6450,trim:0xd6b68d},
 {id:'twin-apartments',name:'Twin Apartments',x:-8,z:-39,w:20,d:22,floors:5,color:0xbdb8a8,trim:0xe9d9bc},
 {id:'office',name:'Office Tower',x:39,z:-37,w:26,d:24,floors:6,color:0x8c9fa2,trim:0xd4dad7},
 {id:'shops',name:'Corner Shops',x:-40,z:1,w:24,d:18,floors:3,color:0xa6a685,trim:0xd6d2b3},
 {id:'construction',name:'Construction',x:4,z:2,w:20,d:20,floors:3,color:0x999c98,trim:0xb9b8b0,unfinished:true},
 {id:'pawn',name:'Pawn & Repair',x:39,z:4,w:18,d:20,floors:3,color:0xa97c67,trim:0xe7caa2},
 {id:'diner',name:'Diner',x:39,z:38,w:26,d:18,floors:2,color:0x779690,trim:0xe1d6b9},
 {id:'brownstone',name:'South Apartments',x:2,z:39,w:18,d:18,floors:4,color:0xb58c65,trim:0xe1c49f},
 {id:'clock',name:'Clock Tower',x:-42,z:37,w:10,d:10,floors:7,color:0xbaad90,trim:0xf0e0bb,clock:true},
];
function createZoneMap(){
 const boxes=[],decor=[],spawnRooms=[],buildings=ZONE_BUILDINGS.map(b=>({...b,h:b.floors*4,baseY:0,roof:'flat'}));let serial=0;
 const block=(x,y,z,w,h,d,color,extra={})=>{const b={x,y,z,w,h,d,color,material:'brick',surface:'brick',objectId:'zw-'+serial++,...extra};boxes.push(b);return b;};
 const deco=(x,y,z,w,h,d,color,surface='metal')=>decor.push({x,y,z,w,h,d,color,surface});
 for(const [bi,b]of buildings.entries()){
  const left=b.x-b.w/2,right=b.x+b.w/2,north=b.z-b.d/2,south=b.z+b.d/2,stairX=right-2.25,stairZ=north+4.75;
  // Every floor has a stairwell opening; the roof is accessible from the same stairs.
  for(let f=0;f<=b.floors;f++){
   const y=f*4;
   if(f===0)block(b.x,-.22,b.z,b.w,.22,b.d,b.trim,{building:bi,surface:'concrete',indestructible:true});
   else{block(b.x-2,y-.22,b.z,b.w-4,.22,b.d,b.trim,{building:bi,surface:'timber'});block(right-2,y-.22,south-(b.d-9)/2,4,.22,b.d-9,b.trim,{building:bi,surface:'timber'});}
   if(f===b.floors)break;
   if(b.clock&&f===b.floors-1){for(const z of [north,south])block(b.x,y,z,b.w,4,.3,b.color,{building:bi});for(const x of [left,right])block(x,y,b.z,.3,4,b.d,b.color,{building:bi});}
   else if(!b.unfinished){
    // 4 m bays with open windows and doors on every side.
    for(const z of [north,south])for(let x=left+2;x<right;x+=4){
     const door=f===0&&Math.abs(x-b.x)<=2;
     block(x,y+2.75,z,4,1.25,.28,b.color,{building:bi});
     for(const dx of [-1.6,1.6])block(x+dx,y,z,.8,3,.28,b.color,{building:bi});
     if(!door)block(x,y,z,2.4,1.1,.28,b.color,{building:bi});
     deco(x,y+2.72,z,2.6,.12,.4,b.trim,'concrete');
    }
    for(const x of [left,right])for(let z=north+2;z<south;z+=4){
     block(x,y+2.75,z,.28,1.25,4,b.color,{building:bi});for(const dz of [-1.6,1.6])block(x,y,z+dz,.28,3,.8,b.color,{building:bi});block(x,y,z,.28,1.1,2.4,b.color,{building:bi});
     deco(x,y+2.72,z,.4,.12,2.6,b.trim,'concrete');
    }
   }else for(const x of [left+.4,right-.4])for(const z of [north+.4,south-.4])block(x,y,z,.8,4,.8,b.color,{building:bi,surface:'concrete'});
   // Shallow 25 cm steps work with both guest prediction and the host collision.
   for(let s=0;s<16;s++)block(stairX,y+s*.25,stairZ-3.75+s*.5,3.3,.25,.5,0x847e73,{building:bi,surface:'concrete'});
   // A short interior partition breaks sightlines while keeping the central passage open.
   if(b.w>12){block(left+4,y,north+6,.22,3.2,5,b.color,{building:bi});deco(left+2,y+.6,south-2,2.7,1.1,.8,0x686d68,'fabric');deco(b.x,y+.35,south-2,2,.7,1,0x88684e,'timber');}
   if(f===0||f===Math.min(2,b.floors-1)){const x=left+2,z=north+2;spawnRooms.push({x,y:y+.02,z,yaw:Math.PI,building:bi,roomName:b.name});}
  }
  for(const z of [north,south])block(b.x,b.h,z,b.w,.65,.3,b.trim,{building:bi,surface:'concrete'});
  for(const x of [left,right])block(x,b.h,b.z,.3,.65,b.d,b.trim,{building:bi,surface:'concrete'});
  deco(b.x-2,b.h+.1,b.z+2,2.4,1.15,1.8,0x6d7b7f);deco(b.x-2,b.h+1.25,b.z+2,2.6,.12,2,0x3e4c51);
  deco(left+.7,b.h+.1,north+.7,.12,3,.12,0x4b5659);
  for(const z of [north-.2,south+.2])deco(b.x,b.h-.35,z,b.w+.7,.24,.7,b.trim,'concrete');
 }
 // Sixteen unique cells, with multiple floors in the same building possible.
 spawnRooms.splice(16);
 const roads=[{x:0,z:-19,w:128,d:10},{x:0,z:22,w:128,d:10},{x:-22,z:0,w:10,d:128},{x:20,z:0,w:10,d:128}].map(r=>({...r,kind:'street',width:Math.min(r.w,r.d),points:r.w>r.d?[[r.x-r.w/2,r.z],[r.x+r.w/2,r.z]]:[[r.x,r.z-r.d/2],[r.x,r.z+r.d/2]]}));
 // Street cover and recognizable basketball/parking courtyards.
 for(const [x,z,c]of [[-22,-5,0x638b98],[-22,45,0xa87052],[20,-4,0xc2b575],[20,45,0x537e92],[-5,-19,0x83977e],[45,22,0x8c6572]]){
  block(x,0,z,2.1,1.05,4.6,c,{material:'metal',surface:'paint',harvestType:'car',buildBlocking:false});deco(x,1.05,z,1.8,.65,2.4,0x263f4d,'glass');
 }
 for(let x=-58;x<=58;x+=16)for(const z of [-25,28]){deco(x,0,z,.14,6,.14,0x3c4b53);deco(x+.8,5.8,z,1.8,.15,.4,0xe4ddba);}
 // Basketball court to the southwest, with hoops that leave the lanes unobstructed.
 for(const z of [27,47]){deco(-58,0,z,.12,3.7,.12,0x717c7e);deco(-58,3.2,z,2,1.2,.12,0xedeae0,'paint');}
 for(const [x,z]of [[-58,-55],[60,-55],[-59,53],[58,53],[-58,7],[59,-8]])block(x,0,z,1.2,4,1.2,0x79664a,{material:'wood',surface:'timber',harvestType:'tree',buildBlocking:false});
 const authored=boxes;
 return {id:'tilted-district',name:'Tilted District',theme:'zonewars',zoneWars:true,size:72,sky:0xa8d9ed,ground:0x809c70,navCell:3,boxes,authored,decor,buildings,spawnRooms,roads,buildBounds:{minX:-72,maxX:72,minZ:-72,maxZ:72,maxY:72},buildLimit:560,spawns:spawnRooms.map(s=>[s.x,s.z]),bases:[[0,-65],[0,65]],pickups:[],trees:[],props:[],landmarks:buildings.map(b=>({name:b.name,x:b.x,z:b.z})),districts:buildings.map(b=>({id:b.id,name:b.name,x:b.x,z:b.z})),doors:[],floorLoot:[]};
}
export const ZONE_MAP=createZoneMap();
export function zoneMap(){return {...ZONE_MAP,boxes:ZONE_MAP.authored.map(b=>({...b})),authored:ZONE_MAP.authored.map(b=>({...b}))};}
