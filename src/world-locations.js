import {groundAt} from './terrain.js';

// Authored identity data is shared by architecture, the map and field briefings.
export const LOCATION_IDENTITIES={
 borough:{title:'Relay Borough',motif:'clock-and-arcades',story:'A civilian market converted into a signal corps checkpoint.',walls:[0x9c6652,0xc7ac82,0x82959b],trim:0xe0cfad,roof:0x364f58,wood:0x675342},
 farm:{title:'Northfield Commons',motif:'grain-elevators',story:'Emergency rations leave abandoned fields through an occupied grain depot.',walls:[0x914b38,0xb49160,0x747960],trim:0xdfcfaa,roof:0x444f49,wood:0x645039},
 observatory:{title:'Aster Command',motif:'command-fortress',story:'Voss has fortified the old observatory; its archive now conceals his vault.',walls:[0x667b82,0x405463,0x7c8a86],trim:0xd5bb80,roof:0x203643,wood:0x4f5e60},
 docks:{title:'Breakwater Docks',motif:'cargo-gantries',story:'An interrupted military evacuation left freight and a stranded supply ship.',walls:[0x597f88,0x8c6552,0x808f8b],trim:0xd7b35f,roof:0x294854,wood:0x655c4b},
 woods:{title:'Sable Woods',motif:'fire-lookout',story:'Ranger cabins and a timber camp shelter a deserted field hospital.',walls:[0x626c50,0x8f7754,0x53695b],trim:0xc6b99b,roof:0x34463e,wood:0x5c4837},
 works:{title:'Ironwake Quarry',motif:'headframe-conveyors',story:'Extraction stopped mid-shift; a broken conveyor feeds a military repair yard.',walls:[0x8e8070,0x66767b,0x765744],trim:0xd7ae58,roof:0x384447,wood:0x565751},
 terraces:{title:'Sunward Terraces',motif:'stepped-white-pergolas',story:'An evacuated coastal resort became a communications and medical refuge.',walls:[0xd8d5c5,0xb4c9c2,0xc8b395],trim:0xf0e8d0,roof:0x547d7b,wood:0x9c8464},
 heights:{title:'Signal Heights',motif:'triple-radar-masts',story:'Three uplink towers mark the failed relay that fractured the coast.',walls:[0x8d9a91,0x6b7d82,0x555e6b],trim:0xbed4c4,roof:0x334553,wood:0x56635c},
 crater:{title:'Crater Conservatory',motif:'bio-domes',story:'Research domes surround a flooded impact basin and sealed samples.',walls:[0x78938b,0xb7c7ac,0x6b8379],trim:0xd7e6c6,roof:0x345c58,wood:0x576b58},
};
export const LANDMARK_IDENTITIES=[
 ['Watchline Tower','checkpoint','A shuttered border post watches the coastal road.'],
 ['Last Stop Fuel','fuel','A fuel convoy was abandoned at the last service station.'],
 ['Driftwood Cabin','rescue','An isolated coastguard rescue hut with emergency stores.'],
 ['Old Mill','mill','A water-powered mill converted to ration storage.'],
 ['Tideglass Beacon','beacon','A lighthouse guides the interrupted evacuation route.'],
 ['Mossy Relay','relay','A fallen communications mast has become a supply cache.'],
 ['Kestrel Depot','depot','A cargo transfer camp links the port to the airstrip.'],
 ['North Pump','pump','Pipes and service drains feed the northern settlements.'],
 ['Copper Camp','camp','A camouflaged observation camp overlooks the river.'],
 ['Orchard Rest','orchard','Harvest crates and an empty roadside shelter.'],
 ['Drydock Salvage','salvage','Dismantled aircraft parts await a recovery crew.'],
 ['Field Kitchen','kitchen','Field ovens and mess benches stand ready for absent troops.'],
 ['Hush Hollow','cave','A concealed cave refuge lies below the forest ridge.'],
 ['Driftwood Shed','drainage','A maintenance shed guards the port drainage culvert.'],
];

export function authorFrontierWorld(c){
 const {terrain,buildings,boxes,props,landmarks,roads,signs,chests,floorLoot,navLinks,prop,box}=c;
 const map={terrain},yAt=(x,z)=>groundAt(map,x,z),doors=[],traversal=[];
 const put=(x,y,z,w,h,d,color=0x536570,extra={})=>box(x,z,w,d,h,color,y,'world-detail',{material:'metal',...extra});
 const sign=(text,x,y,z)=>signs.push({text,x,y,z});
 const space=(x,z,r=2)=>!buildings.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r)&&!boxes.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);
 const storyProp=(kind,x,z,w,d,h,extra={})=>{if(space(x,z,1))return prop(kind,x,z,w,d,h,yAt(x,z),extra);};
 const door=(x,y,z,w=3.1,h=3,extra={})=>{const id='door-'+doors.length,entry={id,x,y,z,w,h,d:.18,material:'wood',...extra};doors.push(entry);box(x,z,w,.18,h,'steel',y,'door',{material:entry.material,doorId:id,indestructible:!!extra.vault,health:extra.vault?1e6:180});return entry;};
 // Ground-floor entries have real authoritative doors. Upper-floor openings remain clear.
 for(const b of buildings){for(const side of [-1,1])door(b.x,b.baseY,b.z+side*b.d/2,3.1,3,{building:buildings.indexOf(b),material:['dock','factory','hatchery'].includes(b.kind)?'metal':'wood'});}
 // Each major skyline is an actual, static structure, readable from the drop.
 for(const p of c.districts){const y=yAt(p.x,p.z),id=LOCATION_IDENTITIES[p.id];Object.assign(p,{name:id.title,identity:id.motif,story:id.story});
  if(p.id==='borough'){prop('clock',p.x-2,p.z-2,3.4,3.4,22,y);for(const side of [-1,1])for(let i=0;i<4;i++){const x=p.x+side*12,z=p.z-8+i*5;put(x,yAt(x,z),z,.7,4,.7,0xb5a18a);put(x,yAt(x,z)+4,z,2,.35,5,0x7f6651);}storyProp('checkpoint',p.x-9,p.z+48,7,2,2);}
  if(p.id==='farm'){for(const dx of [-8,0,8])prop('silo',p.x+dx,p.z,5,5,19+dx*.2,y);put(p.x,y+16,p.z,22,.6,2.4,0x657366);storyProp('truck',p.x+33,p.z-37,3,6,2.8);}
  if(p.id==='observatory'){const b=buildings.find(b=>b.poi===p.id&&b.type==='command');for(const side of [-1,1]){put(b.x+side*(b.w/2-2),b.baseY+b.h,b.z-8,3.5,9,3.5,0x384d5a);put(b.x+side*(b.w/2-2),b.baseY+b.h+9,b.z-8,4.2,.5,4.2,0xc3a467);put(b.x+side*7,b.baseY+2,b.z+b.d/2+.3,2.1,4,.15,0x914a42);}prop('dome',b.x,b.z-3,8,8,7,b.baseY+b.h+1,{decorative:true});sign('VOSS / ASTER COMMAND',b.x,b.baseY+5,b.z+b.d/2+.5);}
  if(p.id==='docks'){for(const dx of [-27,27])prop('gantry',p.x+dx,p.z+46,3,3,29,yAt(p.x+dx,p.z+46));storyProp('wreck',p.x+45,p.z+32,11,4,3);}
  if(p.id==='woods'){prop('watchtower',p.x,p.z,6,6,23,y);storyProp('medical-tent',p.x+23,p.z+34,7,6,3);storyProp('logs',p.x-19,p.z+34,7,3,2);}
  if(p.id==='works'){prop('headframe',p.x,p.z,7,7,25,y);put(p.x+16,y+14,p.z,27,.65,3.2,0x616861);storyProp('excavator',p.x+28,p.z+33,5,7,5);}
  if(p.id==='terraces'){const b=buildings.find(b=>b.poi===p.id&&b.type==='hotel');for(let j=0;j<3;j++){const w=Math.max(6,b.w-5*j),d=Math.max(6,b.d-4*j),rise=2.5+j*2;put(b.x,b.baseY+b.h+rise,b.z,w,.3,d,0xdce4d8);for(const sx of [-1,1])for(const sz of [-1,1])put(b.x+sx*(w/2-.4),b.baseY+b.h,b.z+sz*(d/2-.4),.25,rise,.25,0xb7c6bb);}prop('water-tower',p.x,p.z,4.5,4.5,18,y);storyProp('medical-tent',p.x+25,p.z+39,7,6,3);}
  if(p.id==='heights'){for(const dx of [-10,0,10])prop('radio',p.x+dx,p.z,3,3,26-Math.abs(dx)*.4,yAt(p.x+dx,p.z));storyProp('wreck',p.x+30,p.z+34,9,4,2.5);}
  if(p.id==='crater'){for(const b of buildings.filter(b=>b.poi===p.id&&['greenhouse','lab'].includes(b.type)))prop('bio-dome',b.x,b.z,Math.min(b.w,b.d)*.8,Math.min(b.w,b.d)*.8,7,b.baseY+b.h,{decorative:true});storyProp('tank',p.x-4,p.z+13,4,4,4);}
  sign(p.name.toUpperCase(),p.x,y+4,p.z+7);
 }
 for(const [i,p]of landmarks.filter(p=>p.kind!=='bridge').entries()){
  const identity=LANDMARK_IDENTITIES[i];if(!identity)continue;Object.assign(p,{identity:identity[1],story:identity[2]});const b=buildings.find(b=>b.poi===p.id),y=b.baseY;
  const types={checkpoint:'checkpoint',fuel:'tank',rescue:'beacon',mill:'waterwheel',beacon:'beacon',relay:'radio',depot:'container',pump:'tank',camp:'tent',orchard:'crate',salvage:'wreck',kitchen:'medical-tent',cave:'rock',drainage:'pump'};
  prop(types[identity[1]],b.x+b.w/2+5,b.z,identity[1]==='salvage'?9:3,identity[1]==='kitchen'?5:3,identity[1]==='beacon'?12:identity[1]==='relay'?14:3.4,y);
  sign(p.name.toUpperCase(),b.x,y+3.8,b.z+b.d/2+.5);
  // Individual roof equipment and material bands make small landmarks recognizable too.
  put(b.x,y+b.h-.35,b.z,b.w+.5,.2,b.d+.5,[0x657b75,0x9b744f,0x567e89,0x7f6650][i%4]);
 }
 // A crash site, construction works and two abandoned road checkpoints tell the evacuation story.
 for(const [kind,x,z,w,d,h]of [['wreck',-69,-112,12,5,3],['checkpoint',-94,-81,7,2,2],['checkpoint',67,-94,7,2,2],['excavator',-114,48,5,7,5],['tent',58,113,5,5,2.7],['truck',68,113,3,6,2.7]])storyProp(kind,x,z,w,d,h);
 // Road approaches follow existing crossings and receive spurs to every settlement.
 for(const p of [...c.districts,...landmarks.filter(p=>p.kind!=='bridge')]){let best=null,score=Infinity;for(const r of roads)for(const [x,z]of r.points){const d=Math.hypot(x-p.x,z-p.z);if(d<score){score=d;best=[x,z];}}if(best&&score>12)roads.push({kind:'path',width:3.5,points:[best,[p.x,p.z+Math.max(13,(buildings.find(b=>b.poi===p.id)?.d||16)/2+4)]]});}
 for(const bridge of landmarks.filter(p=>p.kind==='bridge')){const y=.9;roads.push({kind:'road',width:5.4,points:[[bridge.x-28,bridge.z],[bridge.x,bridge.z],[bridge.x+28,bridge.z]]});for(const side of [-1,1]){put(bridge.x+side*10,y,bridge.z+3,.25,4,.25,0x8a7d63);put(bridge.x+side*10,y+4,bridge.z, .3,.3,6.5,0x8a7d63);}sign(bridge.name.toUpperCase(),bridge.x,y+4.5,bridge.z);}

 // Carve an actual below-grade room and entrance. Terrain collision and terrain
 // rendering share these samples; there is no invisible ground inside the vault.
 const house=buildings.find(b=>b.poi==='observatory'&&b.type==='command'),vx=house.x,vz=house.z,vy=house.baseY-6;
 const entrance={x:vx,y:house.baseY,z:vz+29},reader={x:vx+1.35,y:vy,z:vz+10.4};
 for(let iz=0;iz<terrain.n;iz++)for(let ix=0;ix<terrain.n;ix++){const x=ix*terrain.cell-terrain.size,z=iz*terrain.cell-terrain.size,inside=Math.abs(x-vx)<=11&&Math.abs(z-vz)<=9,channel=Math.abs(x-vx)<=3&&z>=vz+8&&z<=vz+28;if(inside||channel)terrain.heights[iz*terrain.n+ix]=vy-.2;else if(Math.abs(x-vx)<=5&&z>vz+28&&z<=vz+33)terrain.heights[iz*terrain.n+ix]=house.baseY;}
 const vaultWall=(x,y,z,w,h,d)=>put(x,y,z,w,h,d,0x42535d,{indestructible:true,vaultShell:true,material:'metal'});
 vaultWall(vx,vy-.25,vz,22,.25,18);vaultWall(vx,vy-.25,vz+19,4.8,.25,22);vaultWall(vx,vy+5.3,vz,22,.5,18);
 for(const side of [-1,1]){vaultWall(vx+side*10.8,vy,vz,.6,5.4,18);vaultWall(vx+side*6.3,vy,vz+8.8,8.6,5.4,.6);vaultWall(vx+side*2.8,vy,vz+18,.4,6.2,19);}
 vaultWall(vx,vy,vz-8.8,22,5.4,.6);vaultWall(vx,vy+3.4,vz+8.8,4,2,.6);
 const gate=door(vx,vy,vz+8.8,4,3.4,{vault:true,material:'metal'});
 put(vx,vy,vz+29,4.8,house.baseY-vy,3.1,0x788b8b,{indestructible:true,kind:'step'});
 for(let i=0;i<18;i++){const z=vz+27.6-i*1.03,top=house.baseY-i/3;put(vx,vy,z,4.8,top-vy,1.05,0x788b8b,{indestructible:true,kind:'step'});}
 navLinks.push({from:{...reader},to:{...entrance}});
 for(const [i,[dx,dz,source]]of [[-6,-4,'epic'],[6,-4,'epic'],[-6,4,'chest'],[6,4,'chest']].entries())chests.push({id:'vault-chest-'+i,x:vx+dx,y:vy,z:vz+dz,poi:'observatory',source,chance:1,vaultId:'aster-vault',room:'vault'});
 for(const side of [-1,1])prop('vault-rack',vx+side*9.2,vz,1.6,12,3.6,vy,{decorative:true});
 for(const side of [-1,1])for(const z of [-6,0,6])put(vx+side*5,vy+5.15,vz+z,3.4,.10,.45,0xd2dec9,{indestructible:true});
 for(const z of [-6,-2,2,6])for(const side of [-1,1])put(vx+side*10.45,vy+.15,vz+z,.14,4.8,.25,0xb0a16a,{indestructible:true});
 put(vx,vy+.25,vz-8.4,7,3,.12,0x263f49,{indestructible:true});sign('VOSS / STRATEGIC RESERVE',vx,vy+2.5,vz-8.2);
 sign('ASTER ARCHIVE / AUTHORIZED PERSONNEL',vx,house.baseY+2.8,entrance.z+1);sign('VOSS VAULT',vx,vy+3.8,vz+9.2);
 const vault={id:'aster-vault',doorId:gate.id,x:vx,y:vy,z:vz,entrance,reader,stairs:[{x:vx,y:house.baseY,z:vz+27},{x:vx,y:vy+3,z:vz+18},{x:vx,y:vy,z:vz+10.5}],house:buildings.indexOf(house)};
 // A covered forest refuge and a dry drainage tunnel are physically traversable.
 for(const [name,x,z,w,d,h]of [['HUSH REFUGE',-38,67,14,18,4],['PORT DRAIN',126,188,5,18,3]]){
  const y=yAt(x,z),rock=name==='HUSH REFUGE';for(const side of [-1,1])put(x+side*w/2,y,z,rock?2:.55,h,d,rock?0x68746a:0x677b80,{material:'brick'});put(x,y+h,z,w+2,rock?2:.6,d,rock?0x6a7765:0x62767b,{material:'brick'});sign(name,x,y+h-.7,z+d/2+.2);floorLoot.push({x,y,z,poi:rock?'landmark-12':'landmark-13',role:'weapon',chance:1,source:'ground'});
 }
 // Exactly three roof-to-roof lines, each backed by an industrial purpose.
 for(const [poi,label]of [['observatory','ASTER SERVICE LINE'],['works','QUARRY HAUL LINE'],['docks','CARGO TRANSFER LINE']]){
  const bs=buildings.filter(b=>b.poi===poi),a=bs[0],b=bs[1];const from={x:a.x+a.w/2+.7,y:a.baseY+a.h+1.1,z:a.z+a.d/2-2},to={x:b.x-b.w/2+1.2,y:b.baseY+b.h+1.1,z:b.z+b.d/2-2};
  traversal.push({id:'zip-'+poi,type:'zipline',label,from,to,speed:13});
  const x=a.x+a.w/2+2,z=a.z,y=yAt(x,z),top=a.baseY+a.h+.02;
  put(x,top-.27,z,4.3,.25,3.4,0x697f85,{indestructible:true});
  // A short bridge joins the roof while leaving the central landing capsule clear.
  put(a.x+a.w/2,top-.27,z,4,.25,3.4,0x697f85,{indestructible:true});
  traversal.push({id:'asc-'+poi,type:'ascender',label:poi==='observatory'?'COMMAND ROOF ACCESS':poi==='works'?'HEADFRAME LIFT':'DOCK SERVICE LIFT',from:{x:x+3.2,y:yAt(x+3.2,z+.55),z:z+.55},to:{x:x+1,y:top,z:z+.55},via:[{x:x+3.2,y:top+.1,z:z+.55}],speed:6.5});
 }
 return {doors,traversal,vault,bossHouse:buildings.indexOf(house)};
}
