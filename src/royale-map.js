import {naturalHeight,createTerrain,groundAt,riverX} from './terrain.js';
// Sunnybreak: an egg-export island fractured by an experimental hatchery pulse.
// Authoring is deterministic and static. Only match loot is randomized by the host.
export const DISTRICTS=[
 {id:'borough',name:'Shellside Borough',x:-53,z:-30,kind:'town',color:0xe4ad75,risk:'high'},
 {id:'farm',name:'Cornflake Commons',x:-155,z:-140,kind:'farm',color:0xd4b364,risk:'medium'},
 {id:'observatory',name:'Albumen Observatory',x:117,z:-139,kind:'hatchery',color:0x9fc7ca,risk:'high'},
 {id:'docks',name:'Sunny Docks',x:151,z:157,kind:'dock',color:0x719ba6,risk:'high'},
 {id:'woods',name:'Whisker Woods',x:-96,z:163,kind:'park',color:0x699178,risk:'low'},
 {id:'works',name:'Yolkworks Quarry',x:-158,z:62,kind:'factory',color:0x9aa6a5,risk:'high'},
 {id:'terraces',name:'Toast Terraces',x:90,z:52,kind:'resort',color:0xe9ae8d,risk:'medium'},
 {id:'heights',name:'Hatchery Heights',x:-20,z:-186,kind:'hatchery',color:0xc5d7b1,risk:'high'},
 {id:'crater',name:'Crater Conservatory',x:172,z:-25,kind:'camp',color:0xa5bca6,risk:'medium'},
];
const boxes=[],chests=[],floorLoot=[],buildings=[],trees=[],props=[],landmarks=[],roads=[],navLinks=[],signs=[];
const box=(x,z,w,d,h,color='stone',y=0,kind='building',extra={})=>{const b={x,z,w,d,h,color,y,kind,...extra};boxes.push(b);return b;};
const buildingPlans={
 borough:[[-25,-19,18,18,3,'apartment'],[0,-22,18,16,2,'shop'],[26,-19,18,18,3,'apartment'],[-25,14,18,16,2,'shop'],[2,19,16,18,2,'bakery'],[27,17,18,16,2,'shop'],[-7,43,16,14,1,'garage']],
 farm:[[-22,-19,24,20,2,'barn'],[15,-20,16,16,2,'house'],[-26,20,16,14,1,'stable'],[9,19,22,18,1,'greenhouse'],[35,13,12,14,1,'garage']],
 observatory:[[-20,-14,20,18,2,'lab'],[15,-18,18,18,3,'tower'],[-18,20,22,18,1,'lab'],[14,17,16,18,2,'lab'],[38,10,12,14,1,'garage']],
 docks:[[-23,-22,24,18,2,'warehouse'],[12,-24,18,16,2,'office'],[-26,13,20,18,1,'hangar'],[9,14,18,16,2,'warehouse'],[35,-11,12,14,1,'garage']],
 woods:[[-20,-18,16,16,2,'lodge'],[13,-19,12,14,1,'cabin'],[-27,17,12,14,1,'cabin'],[9,20,14,16,2,'lodge'],[34,10,10,14,1,'shed']],
 works:[[-29,-24,24,18,2,'warehouse'],[14,-25,18,18,3,'office'],[-33,17,16,16,1,'garage'],[6,15,24,18,2,'refinery'],[34,10,12,14,1,'shed']],
 terraces:[[-26,-23,16,18,2,'villa'],[6,-22,18,18,2,'villa'],[33,-19,12,14,1,'garage'],[-22,17,18,16,2,'house'],[12,19,20,18,2,'hotel'],[37,17,12,14,1,'shop']],
 heights:[[-24,-12,18,18,2,'lab'],[9,-16,20,18,3,'hatchery'],[-25,24,18,18,2,'greenhouse'],[12,20,18,16,2,'office']],
 crater:[[-31,-21,16,16,2,'lodge'],[1,-34,16,16,1,'greenhouse'],[-32,15,12,16,1,'cabin'],[9,30,16,16,2,'lodge'],[30,8,12,14,1,'shed']],
};
function addBuilding(p,plan,index=0){
 const [dx,dz,w,d,floors,type]=plan,x=p.x+dx,z=p.z+dz;
 const baseY=Math.round(naturalHeight(x,z)*2)/2;
 const b={x,z,w,d,h:floors*4.2,baseY,y:baseY,floors,type,kind:p.kind,index,poi:p.id,roof:['barn','cabin','lodge','house'].includes(type)?'gable':type==='refinery'?'sawtooth':'terrace',stairs:true};
 buildings.push(b);return b;
}
for(const p of DISTRICTS)buildingPlans[p.id].forEach((b,i)=>addBuilding(p,b,i));
const landmarkPlan=[
 ['Nestwatch Tower',-207,-24,'tower','camp',2],['Last Stop Fuel',-93,-99,'station','factory',1],['Shellfall Cabin',-202,157,'cabin','park',1],
 ['Old Mill',-19,101,'mill','farm',2],['Tideglass Beacon',207,88,'tower','dock',3],['Mossy Relay',-106,99,'radio','camp',2],
 ['Eggspress Depot',-9,211,'station','town',1],['North Pump',61,-218,'station','factory',1],['Copper Camp',73,-65,'cabin','camp',1],
 ['Orchard Rest',-204,-102,'cabin','farm',1],['Cracked Cargo',205,-117,'warehouse','dock',1],['Field Kitchen',-89,-204,'cabin','farm',1],
 ['Hush Hollow',-28,47,'cabin','park',1],['Driftwood Shed',113,214,'shed','dock',1],
];
for(const [name,x,z,type,kind,floors] of landmarkPlan){const p={id:'landmark-'+landmarks.length,name,x,z,kind,risk:'low'};landmarks.push(p);addBuilding(p,[0,0,type==='tower'?12:14,16,floors,type],landmarks.length);}
const terrain=createTerrain(buildings,DISTRICTS),surface={terrain};
const yAt=(x,z)=>groundAt(surface,x,z);
function prop(kind,x,z,w=2,d=1.5,h=1.4,y=yAt(x,z),extra={}){
 const material=['truck','car','tank','container','lamp','barrels','console','generator','pump','radio','silo','crane','telescope','dome','beacon','drill','solar'].includes(kind)?'metal':['rock','planter'].includes(kind)?'brick':'wood';
 const p={kind,x,z,w,d,h,y,material,...extra};props.push(p);
 if(!extra.decorative)box(x,z,w,d,h,material==='metal'?'steel':material==='wood'?'crate':'stone',y,'prop',{material,prop:props.length-1});
 return p;
}
function anchor(b,x,z,level,role='mixed',room='room',chest=false){
 const target=chest?chests:floorLoot;
 target.push({x:b.x+x,z:b.z+z,y:b.baseY+level*4.2,poi:b.poi,building:buildings.indexOf(b),floor:level,room,role,source:chest?(room==='roof'?'high':'chest'):'ground',chance:chest?.68:role==='weapon'?.86:role==='ammo'?.72:.63,roof:room==='roof'});
}
for(const [bi,b] of buildings.entries()){
 const {x,z,w,d,floors,baseY}=b,material=['factory','dock','hatchery'].includes(b.kind)?'metal':['farm','park','camp'].includes(b.kind)?'wood':'brick';
 const wall=(dx,dz,ww,dd,hh,yy=0,color='wall',kind='building')=>box(x+dx,z+dz,ww,dd,hh,color,baseY+yy,kind,{building:bi,material});
 // A continuous foundation over a terrain pad avoids buried floors and step-up lips.
 wall(0,0,w,d,.25,-.25,'foundation');
 for(let f=0;f<floors;f++){
  const y=f*4.2;
  // Front and rear doors are full-height openings. Windows are real openings, not painted panels.
  for(const side of [-1,1]){
   const dz=side*d/2,span=(w-3.2)/2;
   wall(0,dz,3.2,.35,1.15,y+3.05,'lintel');
   for(const sx of [-1,1]){
    const mid=sx*(1.6+span/2),ww=Math.min(2.3,span-1.0);
    wall(mid,dz,span,.35,.9,y);wall(mid,dz,span,.35,1.1,y+3.1);
    for(const edge of [-1,1])wall(mid+edge*(ww/2+(span-ww)/4),dz,(span-ww)/2,.35,2.2,y+.9);
   }
  }
  for(const side of [-1,1]){
   for(let q=0;q<3;q++){
    const mid=-d/2+(q+.5)*d/3,len=d/3,opening=Math.min(2.4,len-1.2);
    wall(side*w/2,mid,.35,len,.9,y);wall(side*w/2,mid,.35,len,1.1,y+3.1);
    for(const end of [-1,1])wall(side*w/2,mid+end*(opening/2+(len-opening)/4),.35,(len-opening)/2,2.2,y+.9);
   }
  }
  // Open-tread stairs leave a return corridor linking every floor and the roof.
  const sx=-w/2+2.1,run=d-4,steps=12,sign=1;
  for(let k=0;k<steps;k++){const zz=sign*(-run/2+(k+.5)*run/steps);wall(sx,zz,3.25,run/steps+.02,.26,y+(k+1)*.35-.26,'stair','step');}
  const topZ=sign*(run/2+1.05);wall(sx,topZ,3.6,2.1,.24,y+4.2-.24,'floor');
  const endZ=-sign*(run/2+1.05);wall(sx,endZ,3.6,2.1,.24,y+4.2-.24,'floor');
  wall(1.8,0,w-3.6,d,.24,y+4.2-.24,'floor');
  navLinks.push({building:bi,from:{x:x+sx,y:baseY+y,z:z-sign*(run/2+.7)},to:{x:x+sx,y:baseY+y+4.2,z:z+sign*(run/2+.7)}});
  // Right-hand rooms retain a central 3m passage between their doorways.
  if(w>=16){wall(w*.17,-d*.29,.25,d*.38,3.65,y,'partition');wall(w*.17,d*.29,.25,d*.38,3.65,y,'partition');}
  const px=x+w*.34;
  if(['lab','hatchery','office','refinery','radio'].includes(b.type)){
   prop('console',px,z-d*.32,2.4,1.1,1.05,baseY+y,{building:bi});prop('shelf',px,z+d*.3,2.3,.65,2.0,baseY+y,{building:bi});
  }else if(['barn','warehouse','hangar','garage','shed','stable'].includes(b.type)){
   prop('crate',px,z-d*.3,2.0,2,1.5,baseY+y,{building:bi});prop('barrels',px,z+d*.3,1.5,1.5,1.3,baseY+y,{building:bi});
  }else{
   prop(f%2?'bed':'counter',px,z-d*.33,2.3,1.6,1.0,baseY+y,{building:bi});prop(f%2?'shelf':'sofa',px,z+d*.31,2.2,1.0,1.1,baseY+y,{building:bi});
  }
  anchor(b,-.4,-d*.28,f,'weapon',f?'bedroom':b.type);anchor(b,w*.34,0,f,'ammo','hall');
  anchor(b,-.3,d*.28,f,'mixed',f?'landing':'kitchen');anchor(b,w*.31,-d*.1,f,'utility','room');
  anchor(b,w*.31,d*.12,f,'mixed',f?'bedroom':'store',true);
  // Exterior balconies provide alternate entry and a deliberate exposed firing position.
  if(f>0&&['villa','hotel','apartment','lodge'].includes(b.type)){
   wall(0,d/2+1.55,w*.65,3.0,.23,y-.23,'floor');wall(0,d/2+3.0,w*.65,.16,.8,y,'rail');
   anchor(b,2.6,d/2+1.8,f,'mixed','balcony');
  }
 }
 // Roof is walkable with stair access; pitched halves leave an open roof terrace.
 for(const side of [-1,1])wall(side*w/2,0,.2,d,.65,b.h,'rail');
 if(b.roof==='gable'){
  const cx=w*.18,r=w*.29;
  for(let k=0;k<16;k++){const dx=-r+(k+.5)*r/8,yy=2.1+(r-Math.abs(dx))*Math.tan(.42);wall(cx+dx,0,r/8,d+.6,.18,b.h+yy-.09,'roof','roof-collider');}
 }
 anchor(b,-.1,-d*.25,floors,'weapon','roof');anchor(b,w*.32,0,floors,'mixed','roof',true);anchor(b,0,d*.28,floors,'ammo','roof');
 // Exterior doorstep loot remains on the authored pad and outside door clearance.
 const az=z+d/2+3;floorLoot.push({x:x+w*.32,z:az,y:yAt(x+w*.32,az),poi:b.poi,building:bi,role:'mixed',room:'porch',source:'ground',chance:.55});
 signs.push({x,z:z+d/2+.24,y:baseY+3.5,text:b.type==='bakery'?'DAILY YOLK':b.type==='lab'?'ALBUMEN / '+(bi+1):b.type==='warehouse'?'SUNNYBREAK FREIGHT':b.type==='station'?'EGGSPRESS':b.type.toUpperCase(),building:bi});
}
// Interconnected loops and cross-island routes, not spokes converging on one dominant center.
const routePoints=[[-205,-32],[-155,-140],[-20,-186],[117,-139],[205,-100],[172,-25],[207,88],[151,157],[113,214],[-9,211],[-96,163],[-202,157],[-158,62],[-205,-32]];
function road(points,width=6,kind='road'){roads.push({points,width,kind});}
road(routePoints,6);road([[-158,62],[-106,99],[-19,101],[90,52],[172,-25]],5);
road([[-155,-140],[-93,-99],[-53,-30],[-28,47],[-19,101],[-9,211]],5);
road([[-20,-186],[-53,-30],[73,-65],[117,-139]],5);
road([[90,52],[151,157]],5);road([[-96,163],[-106,99],[-53,-30]],3,'path');
function roadDistance(x,z){let best=1e6;for(const r of roads)for(let i=1;i<r.points.length;i++){const [ax,az]=r.points[i-1],[bx,bz]=r.points[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-ax-dx*t,z-az-dz*t)-r.width/2);}return best;}
// Three bridges leave a ford route alongside. Decks and banks remain physically connected.
for(const z of [-102,20,112]){
 const x=riverX(z),y=.9,w=32;box(x,z,w,6,.35,'crate',y-.35,'bridge',{material:'wood'});
 for(const side of [-1,1]){box(x,z+side*3,w,.2,.8,'crate',y,'bridge',{material:'wood'});for(const dx of [-12,-6,0,6,12])box(x+dx,z+side*2.7,.28,.28,1.6,'crate',0,'bridge',{material:'wood'});}
 landmarks.push({id:'bridge-'+z,name:z<0?'Copper Crossing':z<80?'Shellspan Bridge':'Millwater Crossing',x,z,kind:'bridge',risk:'medium'});
 for(const side of [-1,1]){const xx=x+side*18;floorLoot.push({x:xx,z:z+5,y:yAt(xx,z+5),poi:'bridge-'+z,role:'weapon',room:'bridge-bank',source:'ground',chance:.78});chests.push({x:xx,z:z-5,y:yAt(xx,z-5),poi:'bridge-'+z,source:'chest',chance:.65,room:'bridge-bank'});}
}
// Major landmarks tell a shared story: freight, food production and the ruptured hatchery.
for(const p of DISTRICTS){
 const y=yAt(p.x,p.z);
 if(p.kind==='farm'){for(const dx of [-7,7])prop('silo',p.x+dx,p.z,4.4,4.4,13,y);}
 else if(p.kind==='factory'){for(const dx of [-6,6])prop('tank',p.x+dx,p.z-4,4.5,4.5,10,y);prop('truck',p.x+21,p.z+36,3,6,2.6);}
 else if(p.kind==='hatchery'){prop(p.id==='observatory'?'radio':'incubator',p.x,p.z,5,5,10,y);}
 else if(p.kind==='dock'){for(let i=0;i<4;i++)prop('container',p.x-16+i*10,p.z+37,7.0,3.4,3);}
 else if(p.kind==='town'){prop('clock',p.x-2,p.z-2,3,3,13,y);}
 else if(p.kind==='camp'){for(let i=0;i<6;i++){const a=i*Math.PI/3;prop('crystal',p.x-7+Math.cos(a)*6,p.z+Math.sin(a)*6,1.5,1.5,2.5,yAt(p.x-7+Math.cos(a)*6,p.z+Math.sin(a)*6));}}
 else if(p.kind==='park')prop('campfire',p.x,p.z,2.4,2.4,.7,y);
 else prop('planter',p.x,p.z,6,4,1.4,y);
 signs.push({x:p.x,z:p.z+4,y:yAt(p.x,p.z+4)+2.5,text:p.name.toUpperCase()});
}
// Sheltered coastal docks with real collision and loot.
for(const x of [127,147,167]){const z=212,y=Math.max(...Array.from({length:13},(_,i)=>yAt(x,z-12+i*2)))+.15;box(x,z,5,24,.3,'crate',y-.3,'bridge',{material:'wood'});for(const dz of [-10,0,10])prop('bollard',x+2,z+dz,.3,.3,1.2,y);floorLoot.push({x,z:z+8,y,poi:'docks',role:'weapon',room:'pier',source:'ground',chance:.85});chests.push({x,z:z-8,y,poi:'docks',source:'high',chance:.6,room:'pier'});}
const clear=(x,z,r=2)=>!buildings.some(b=>Math.abs(x-b.x)<b.w/2+r+3&&Math.abs(z-b.z)<b.d/2+r+5)&&!boxes.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r)&&!floorLoot.some(p=>Math.hypot(x-p.x,z-p.z)<r+2)&&!chests.some(p=>Math.hypot(x-p.x,z-p.z)<r+2);
// Freight, farming and the hatchery experiment share a recognizable island history.
for(const [kind,x,z,w,d,h]of [['crane',118,192,2,2,15],['crane',184,180,2,2,13],['telescope',117,-139,2,2,5],['drill',-171,64,3,3,8],['waterwheel',-9,101,2,3,6]])if(clear(x,z,1))prop(kind,x,z,w,d,h);
for(const [i,b]of buildings.entries())if(b.type==='tower')prop(b.poi==='observatory'?'dome':'beacon',b.x+b.w*.23,b.z,3,3,4,b.baseY+b.h+2.3,{building:i,decorative:true});
for(let row=0;row<5;row++)for(let col=0;col<10;col++){
 const x=-204+col*2.8,z=-183+row*3.2;if(clear(x,z,.35))prop('crop',x,z,.65,.7,1.35,yAt(x,z),{decorative:true,seed:row+col});
}
for(const [x,z]of [[94,-171],[101,-171],[108,-171],[94,-176],[101,-176],[108,-176]])if(clear(x,z,.7))prop('solar',x,z,4,2,1.5);
for(const p of [...DISTRICTS,...landmarks])for(const side of [-1,1])for(let i=0;i<3;i++){
 const x=p.x+side*(23+i*4),z=p.z+43;if(roadDistance(x,z)>2&&clear(x,z,1))prop('fence',x,z,3.6,.18,1.25);
}
for(const [i,b]of buildings.entries()){
 const x=b.x+b.w/2+3.5,z=b.z+4;
 if(clear(x,z,.5))prop(i%4===0?'car':i%4===1?'bench':i%4===2?'lamp':'crate',x,z,i%4===0?2.1:1.4,i%4===0?4:1, i%4===0?1.5:i%4===2?4.5:1.2);
}
// Seeded, spatially varied vegetation; no loot is sprinkled through random forest coordinates.
for(let i=0;i<3700&&trees.length<640;i++){
 const x=((i*193.371)%480)-240,z=((i*317.719+i*i*.019)%480)-240;
 if(yAt(x,z)<2||roadDistance(x,z)<2.5||!clear(x,z,2.8))continue;
 if(x>-30&&z>-100&&z<95&&i%3!==0)continue;
 const kind=z>135&&x>70?'palm':x<-105&&z<-65?'orchard':x<-35&&z>80?'pine':x>60&&z<-80?'autumn':i%4===0?'pine':'oak';
 const y=yAt(x,z),h=kind==='orchard'?6+i%3:8+i%6;
 trees.push({x,y,z,h,kind,seed:i});box(x,z,.65,.65,h*.65,'crate',y,'tree',{material:'wood',tree:trees.length-1});
}
for(let i=0;i<650;i++){
 const x=(i*173.43%480)-240,z=(i*271.77%480)-240;if(yAt(x,z)<1.2||roadDistance(x,z)<1.5||!clear(x,z,2.4))continue;
 prop(i%4===0?'bush':'rock',x,z,2+i%3,1.8+i%3, i%4===0?1.2:1.6+i%3*.6,yAt(x,z),{seed:i});
}
// Material assignments and stable IDs are shared by harvesting, destruction and rendering.
for(const [i,b]of boxes.entries())b.objectId='world-'+i;
for(const p of [...chests,...floorLoot]){p.id=(chests.includes(p)?'anchor-chest-':'anchor-loot-')+(chests.includes(p)?chests.indexOf(p):floorLoot.indexOf(p));}
export const ROYALE_MAP={id:'sunnybreak',revision:2,name:'Sunnybreak Island',tag:'SUNNYBREAK REBORN • 512 × 512',description:'Rivers, ridgelines and nine distinct districts.',size:256,navCell:1.5,navMax:70,sky:0xaedcea,ground:0x81b178,accent:0xf6cc66,theme:'royale',zone:[0,0,0],bases:[[-230,0],[230,0]],spawns:[[0,0],[-75,-75],[75,-75],[-75,75],[75,75]],lanes:[],boxes,props,pickups:[],districts:DISTRICTS,buildings,trees,chests,floorLoot,shelters:[],terrain,landmarks,roads,navLinks,signs,material:'brick'};
