import {groundAt} from './terrain.js';

// Shared authoring only: no renderer imports reach the map/relay path. Four
// open-frame steel outposts have actual treads and decks, never a solid tower
// hitbox. Called before vegetation placement, their parts reserve the approach.
export const WATCHTOWER_SITES=Object.freeze([
 Object.freeze({id:'northfield-watch',name:'Northfield Overwatch',x:-150,z:-45,rotation:0,color:0x606e53}),
 Object.freeze({id:'aster-watch',name:'Aster Perimeter Post',x:195,z:-160,rotation:1,color:0x5b737a}),
 Object.freeze({id:'coast-watch',name:'Coastwatch Outpost',x:-210,z:120,rotation:2,color:0x7c806a}),
 Object.freeze({id:'breakwater-watch',name:'Breakwater Overwatch',x:90,z:140,rotation:3,color:0x6e786c}),
]);
export const WATCHTOWER_LAYOUT=Object.freeze({deckSize:9,levels:4,rise:3.6,steps:10,stairWidth:2.2,stairRun:6.8,stairCenter:5.5,landingSize:4.2,height:17.8,padHalf:8.2,padBlend:4});
const turn=(x,z,rotation)=>rotation===1?[-z,x]:rotation===2?[-x,-z]:rotation===3?[z,-x]:[x,z];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

export function watchtowerPoint(tower,x,y,z){const [dx,dz]=turn(x,z,tower.rotation||0);return {x:tower.x+dx,y:tower.baseY+y,z:tower.z+dz};}

function flattenPad(terrain,tower){
 const {padHalf,padBlend}=WATCHTOWER_LAYOUT;
 for(let iz=Math.max(0,Math.floor((tower.z-padHalf-padBlend+terrain.size)/terrain.cell));iz<terrain.n&&iz*terrain.cell-terrain.size<=tower.z+padHalf+padBlend;iz++)for(let ix=Math.max(0,Math.floor((tower.x-padHalf-padBlend+terrain.size)/terrain.cell));ix<terrain.n&&ix*terrain.cell-terrain.size<=tower.x+padHalf+padBlend;ix++){
  const x=ix*terrain.cell-terrain.size,z=iz*terrain.cell-terrain.size,d=Math.max(Math.abs(x-tower.x),Math.abs(z-tower.z)),weight=1-smooth((d-padHalf)/padBlend),i=iz*terrain.n+ix;
  if(weight>0)terrain.heights[i]=terrain.heights[i]*(1-weight)+tower.baseY*weight;
 }
 terrain.max=Math.max(terrain.max||0,tower.baseY);
}

// Exact part records are also used by the standard structural render pass.
// `surface` selects the existing shared PBR material/atlas, without new maps.
export function createWatchtower(site,baseY){
 const tower={...site,baseY,w:15.3,d:15.3,h:WATCHTOWER_LAYOUT.height,levels:[],stairs:[],parts:[],loot:[],chests:[],entry:null};
 const add=(x,y,z,w,h,d,role,surface='metal',color=tower.color)=>{
  const p=watchtowerPoint(tower,x,y,z),rotated=tower.rotation%2,part={...p,w:rotated?d:w,d:rotated?w:d,h,color,material:surface==='concrete'?'brick':'metal',surface,kind:role==='tread'?'step':'world-detail',watchtowerId:tower.id,towerPart:role};
  tower.parts.push(part);return part;
 };
 const rail=(a,b,y)=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],middle=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  add(middle[0],y+.99,middle[1],Math.abs(dx)||.09,.09,Math.abs(dz)||.09,'rail');
  for(const t of [0,.5,1])add(a[0]+dx*t,y,a[1]+dz*t,.08,1.07,.08,'rail-post');
 };
 // Steel columns sit inside the decks, leaving every corner landing clear.
 for(const x of [-3,3])for(const z of [-3,3]){
  add(x,-.25,z,1.05,.25,1.05,'footing','concrete',0x94988b);
  add(x,0,z,.25,17.8,.25,'column');
 }
 const corners=[[-5.5,-5.5],[5.5,-5.5],[5.5,5.5],[-5.5,5.5],[-5.5,-5.5]];
 add(-5.5,-.18,-5.5,4.2,.18,4.2,'landing');
 tower.entry=watchtowerPoint(tower,-6.4,0,-5.5);
 for(let floor=0;floor<4;floor++){
  const from=corners[floor],to=corners[floor+1],rise=floor*3.6,upper=rise+3.6,alongX=from[1]===to[1],sign=alongX?Math.sign(to[0]-from[0]):Math.sign(to[1]-from[1]),points=[];
  const first=alongX?[sign*-3.4,from[1]]:[from[0],sign*-3.4],last=alongX?[sign*3.4,from[1]]:[from[0],sign*3.4];
  const foot=watchtowerPoint(tower,first[0]-Number(alongX)*sign*.7,rise,first[1]-Number(!alongX)*sign*.7);points.push(foot);
  for(let step=0;step<10;step++){
   const run=-3.4+(step+.5)*6.8/10,x=alongX?run*sign:from[0],z=alongX?from[1]:run*sign,top=rise+(step+1)*.36;
   // Steel treads provide real support with an open underside, without
   // blocking the occupied space below an elevated staircase.
   add(x,top-.18,z,alongX?6.8/10:2.2,.18,alongX?2.2:6.8/10,'tread');
   points.push(watchtowerPoint(tower,x,top,z));
   for(const side of [-1,1]){
    const rx=x+(alongX?0:side*1.06),rz=z+(alongX?side*1.06:0);
    add(rx,top+.99,rz,alongX?6.8/10:.07,.08,alongX?.07:6.8/10,'stair-rail');
    if(step%3===0||step===9)add(rx,top-.08,rz,.07,1.15,.07,'stair-post');
   }
  }
  add(to[0],upper-.18,to[1],4.2,.18,4.2,'landing');
  const end=watchtowerPoint(tower,last[0]+Number(alongX)*sign*.7,upper,last[1]+Number(!alongX)*sign*.7);points.push(end);
  tower.stairs.push({watchtowerId:tower.id,floor,from:foot,to:end,points});
  add(0,upper-.18,0,9,.18,9,'deck');
  const sx=Math.sign(to[0]),sz=Math.sign(to[1]),landing=watchtowerPoint(tower,to[0],upper,to[1]);
  tower.levels.push({floor:floor+1,y:tower.baseY+upper,landing,entrance:watchtowerPoint(tower,sx*3.5,upper,sz*3.5)});
  // The arrival corner is a wide open connection between the landing and
  // deck. Other sides have actual narrow rails rather than invisible walls.
  for(const side of [-1,1]){
   const endsX=side===sz?(sx>0?[-4.5,2.5]:[-2.5,4.5]):[-4.5,4.5];
   const endsZ=side===sx?(sz>0?[-4.5,2.5]:[-2.5,4.5]):[-4.5,4.5];
   rail([endsX[0],side*4.5],[endsX[1],side*4.5],upper);
   rail([side*4.5,endsZ[0]],[side*4.5,endsZ[1]],upper);
  }
  rail([to[0]-2.1,to[1]+sz*2.1],[to[0]+2.1,to[1]+sz*2.1],upper);
  rail([to[0]+sx*2.1,to[1]-2.1],[to[0]+sx*2.1,to[1]+2.1],upper);
  // A waist-high armored screen gives the top lookout usable cover.
  if(floor===3)for(const side of [-1,1]){
   add(side*4.48,upper+.08,-side*1.0,.13,.73,3.8,'screen','paint');
   add(side*1.0,upper+.08,side*4.48,3.8,.73,.13,'screen','paint');
  }
  for(const [x,z,role]of [[-1.5,0,'weapon'],[1.5,0,'ammo']])tower.loot.push({...watchtowerPoint(tower,x,upper,z),watchtowerId:tower.id,poi:tower.id,floor:floor+1,room:'watch-deck',role,source:'ground',chance:role==='weapon'?.9:1});
  if(floor===1||floor===3)tower.chests.push({...watchtowerPoint(tower,0,upper,2),watchtowerId:tower.id,poi:tower.id,floor:floor+1,room:'watch-deck',source:floor===3?'high':'chest',chance:1});
 }
 add(0,17.55,0,9.6,.25,9.6,'roof','metal',0x3d4e48);
 return tower;
}

export function authorWatchtowers(c){
 const watchtowers=[];
 for(const site of WATCHTOWER_SITES){
  const tower=createWatchtower(site,Math.round(groundAt({terrain:c.terrain},site.x,site.z)*10)/10);flattenPad(c.terrain,tower);
  c.boxes.push(...tower.parts);c.floorLoot.push(...tower.loot);c.chests.push(...tower.chests);c.navLinks.push(...tower.stairs);
  c.landmarks.push({id:tower.id,name:tower.name,x:tower.x,z:tower.z,kind:'watchtower',risk:'medium',watchtowerId:tower.id});
  c.signs?.push({text:tower.name.toUpperCase(),...watchtowerPoint(tower,0,17.2,4.85),watchtowerId:tower.id});watchtowers.push(tower);
 }
 return {watchtowers};
}

// Optional bounded dressing. Root passes the already shared architectureKit;
// collidable parts are rendered by the normal box pass, so nothing duplicates.
export function dressWatchtower(group,tower,k){
 const beam=(a,b,r,c)=>{const p=watchtowerPoint(tower,...a),q=watchtowerPoint(tower,...b);return k.beam(group,[p.x,p.y,p.z],[q.x,q.y,q.z],r,c,'metal');};
 const block=(x,y,z,w,h,d,c,kind='metal')=>{const p=watchtowerPoint(tower,x,y,z);return k.block(group,p.x,p.y,p.z,tower.rotation%2?d:w,h,tower.rotation%2?w:d,c,kind);};
 for(const level of [0,3.6,7.2,10.8])for(const side of [-1,1]){
  beam([-3,level+.3,side*3],[3,level+3.3,side*3],.055,0x9aa594);
  beam([-3,level+3.3,side*3],[3,level+.3,side*3],.055,0x9aa594);
 }
 for(let floor=1;floor<=4;floor++)for(const side of [-1,1])block(side*3.75,floor*3.6+.015,0,.065,.025,7.6,0xc6ad62,'paint');
 // Roof antenna, ceramic insulators, a sealed floodlight and curved mounting
 // arms identify the outposts from the drop without animated/transparent FX.
 beam([2.7,17.8,-2.7],[2.7,20.3,-2.7],.05,0xaeb9af);
 for(const dy of [18.2,18.9,19.6])beam([2.1,dy,-2.7],[3.3,dy,-2.7],.035,0xced4c3);
 block(-3,17.17,3.7,.8,.25,.3,0xb8baa2);block(-3,17.17,3.88,.64,.15,.045,0xe2d3aa,'glass');
}
