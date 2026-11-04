// Authoritative heightfield and location edits for After the Signal.
const clamp=value=>Math.max(0,Math.min(1,value));
const fade=value=>{const t=clamp(value);return t*t*(3-2*t);};
const ellipse=(x,z,cx,cz,rx,rz)=>Math.hypot((x-cx)/rx,(z-cz)/rz);
export function winterCover(map,x,z,y){
 if(!map.afterTheSignal)return 0;
 const edge=Math.sin(x*.16+z*.09)*.062+Math.cos(z*.24-x*.08)*.044;
 const north=1-fade((ellipse(x,z,-14,-188,91,64)+edge-.64)/.45);
 const aster=1-fade((ellipse(x,z,111,-161,55,53)+edge-.51)/.56);
 const pass=1-fade((ellipse(x,z,60,-178,53,30)+edge-.55)/.56);
 const frost=1-fade((ellipse(x,z,-136,-158,39,33)+edge-.4)/.67);
 return Math.max(north,aster*.92,pass*.94,frost*.43)*fade((y-2.1)/4.5);
}
const DISTRICT_NAMES={
 docks:'Battered Breakwater',works:'Ruptured Relay',observatory:'Armored Aster',
 woods:'Whispering Woods',heights:'Whiteout Heights',farm:'Frostfield Commons',
 crater:'Shattered Conservatory',
};
const SITES=[
 {id:'scarline-cut',name:'Scarline Cut',x:-164,z:-48,risk:'medium'},
 {id:'frostline-pass',name:'Frostline Pass',x:55,z:-183,risk:'medium'},
 {id:'rime-ridge',name:'Rime Ridge',x:-79,z:-162,risk:'low'},
];
const bulge=(x,z,cx,cz,rx,rz)=>1-fade(ellipse(x,z,cx,cz,rx,rz));
function relief(x,z){
 const pass=8.5*bulge(x,z,64,-199,27,24)+6.4*bulge(x,z,44,-165,24,19)
  -2.8*bulge(x,z,55,-183,22,10);
 const ridge=5.2*bulge(x,z,-80,-171,31,23)+3.8*bulge(x,z,-89,-152,20,14);
 // A shell-cut valley between two broken shelves, with open ends.
 const scar=-5.8*bulge(x,z,-164,-48,26,37)+4.7*bulge(x,z,-143,-46,15,28)
  +3.4*bulge(x,z,-183,-43,13,24);
 const spillway=4.4*bulge(x,z,149,-3,17,16)-2.6*bulge(x,z,166,-2,16,12);
 return pass+ridge+scar+spillway;
}
export function reshapeSeasonTerrain({terrain,buildings,boxes,trees,props,floorLoot,chests,landmarks,signs,groundAt}){
 const previous={terrain:{...terrain,heights:terrain.heights.slice()}};
 const protect=buildings.map(b=>({x:b.x,z:b.z,w:b.w/2+3,d:b.d/2+3}));
 for(const b of boxes)if(b.watchtowerId&&b.towerPart==='column'||b.kind==='bridge')protect.push({x:b.x,z:b.z,w:b.w/2+3,d:b.d/2+3});
 for(let row=0;row<terrain.n;row++)for(let col=0;col<terrain.n;col++){
  const x=col*terrain.cell-terrain.size,z=row*terrain.cell-terrain.size,i=row*terrain.n+col;
  const delta=relief(x,z);if(Math.abs(delta)<.01)continue;
  let weight=fade((terrain.heights[i]-.8)/3);
  for(const p of protect){
   const gap=Math.max(Math.abs(x-p.x)-p.w,Math.abs(z-p.z)-p.d);
   if(gap<7)weight=Math.min(weight,fade(gap/7));
  }
  terrain.heights[i]+=weight*delta;
 }
 terrain.max=terrain.heights.reduce((max,y)=>Math.max(max,y),0);
 const sample={terrain,afterTheSignal:true};
 const deltaAt=p=>groundAt(sample,p.x,p.z)-groundAt(previous,p.x,p.z);
 for(const b of boxes)if(b.tree!==undefined||b.prop!==undefined&&props[b.prop].building===undefined)b.y+=deltaAt(b);
 for(const p of [...trees,...props,...floorLoot,...chests,...signs]){
  if(p.building===undefined&&Number.isFinite(p.y))p.y+=deltaAt(p);
 }
 for(const t of trees)if(winterCover(sample,t.x,t.z,t.y)>.55)t.kind='snow-pine';
 for(const l of landmarks)if(l.id==='landmark-5')l.name='Cracked Convoy';
}
export function authorSeasonLocations({districts,terrain,landmarks,buildings,signs,frontier,blackout,box,prop,chests,navLinks,groundAt}){
 const map={terrain},ground=(x,z)=>groundAt(map,x,z);
 for(const p of districts){const name=DISTRICT_NAMES[p.id];if(!name)continue;const sign=signs.find(s=>s.x===p.x&&s.z===p.z+7&&s.text===p.name.toUpperCase());if(sign)sign.text=name.toUpperCase();p.name=name;}
 const solid=(x,y,z,w,h,d,color,surface='metal')=>box(x,z,w,d,h,color,y,'world-detail',{indestructible:true,material:surface==='concrete'?'brick':'metal',surface});
 const placement=(x,z)=>({x,y:ground(x,z),z});
 const highLoot=(site,x,z,y=ground(x,z))=>chests.push({x,y,z,poi:site.id,source:'high',chance:1,room:'season-outpost'});
 for(const site of SITES)landmarks.push({...site,kind:'camp'});
 // The ridge pass is defended from two elevations. Its road is open at both ends.
 const pass=SITES[1];
 for(const [i,x,z] of [[0,47,-185],[1,64,-180]]){
  const y=ground(x,z);
  solid(x,y-.24,z,6,.32,4.6,0x738791,'concrete');
  solid(x,y,z-2.1,6,1.4,.42,0x63787e,'concrete');
  solid(x+(i===0?-2.8:2.8),y,z,.42,1.4,4.3,0x63787e,'concrete');
  prop('generator',x+1.5,z-1.3,1.5,1.3,1.4,y+.08);
  prop('lamp',x-1.7,z-1.8,.4,.4,4.2,y+.08);
  highLoot(pass,x-.1,z+.6,Math.max(ground(x-.1,z+.6),y+.08));
 }
 // Wind-packed drifts cover the solid portions of northern roofs. The
 // original stairwell and opening remain clear at every affected building.
 for(const b of buildings){
  const y=b.baseY+b.h,cover=winterCover({afterTheSignal:true},b.x,b.z,b.baseY);
  if(cover<.62||b.roof!=='terrace'||b===buildings[frontier.bossHouse])continue;
  solid(b.x+2.05,y+.004,b.z-b.d*.15,b.w*.58,.055,b.d*.45,0xc9dce0,'concrete');
 }
 const frost=SITES[2];
 prop('radio',-78,-162,2.4,2.4,12,ground(-78,-162),{decorative:true});
 prop('medical-tent',-82,-166,7,6,3,ground(-82,-166),{decorative:true});
 prop('crate',-84,-163,1.7,1.3,1.4,ground(-84,-163));
 highLoot(frost,-82,-164);
 // Abandoned southern counteroffensive. Staggered barriers leave both ends
 // of the earth cut open and put resupply outside the low ground.
 const scar=SITES[0];
 for(const [x,z] of [[-171,-57],[-157,-47],[-170,-36]]){
  const y=ground(x,z);solid(x,y-.3,z,5,1.45,.8,0x69625a,'concrete');
  solid(x,y+1.15,z,4.5,.10,.67,0xa68d62);
 }
 prop('wreck',-178,-48,7.3,3.6,2.7,ground(-178,-48),{decorative:true});
 prop('truck',-151,-58,2.7,5.3,2.7,ground(-151,-58));
 highLoot(scar,-151,-52);
 highLoot(scar,-172,-51);
 // The Conservatory has a broken flood wall and a protected route along
 // the uplifted west rim. Leave the low lakeshore as its alternate flank.
 const conservatory=districts.find(p=>p.id==='crater');
 for(const [x,z,w,h] of [[151,-8,3.9,1.65],[155.8,-6,2.7,1.1],[164,-3,4.1,1.5]]){
  const y=ground(x,z);solid(x,y-.34,z,w,h,.63,0x64777a,'concrete');
 }
 prop('wreck',147,-7,7.2,3,2.1,ground(147,-7),{decorative:true});
 prop('generator',155,-9,1.9,1.5,1.22,ground(155,-9));
 highLoot(conservatory,152.6,-6.2);
 // The original three characters hold new positions and patrol routes. The
 // existing vault IDs and keyed doors keep map and interaction compatibility.
 const roof=buildings[frontier.bossHouse],ry=roof.baseY+roof.h;
 frontier.bossSites.push({bossId:'warden-aster',x:roof.x+3,y:ry,z:roof.z+4,
  cache:{...frontier.vault.reader,id:'aster-cache',name:frontier.vault.name,key:frontier.vault.key,vaultId:frontier.vault.id},
  patrol:[{x:roof.x+3,y:ry,z:roof.z-6},{x:roof.x+6,y:ry,z:roof.z-5},{x:roof.x+6,y:ry,z:roof.z+5},{x:roof.x+3,y:ry,z:roof.z+4}],
 });
 const rook=frontier.bossSites.find(p=>p.bossId==='marshal-rook');
 Object.assign(rook,{x:146,y:blackout.deck,z:230,patrol:[{x:146,y:blackout.deck,z:230},{x:145,y:blackout.deck,z:218},{x:147,y:blackout.deck,z:240}]});
 const nyx=frontier.bossSites.find(p=>p.bossId==='lieutenant-nyx');
 Object.assign(nyx,{...placement(-110,188),patrol:[placement(-110,188),placement(-114,191),placement(-108,195)]});
 navLinks.push({from:{x:160,y:blackout.deck,z:201},to:{x:157,y:blackout.deck,z:211}});
}
