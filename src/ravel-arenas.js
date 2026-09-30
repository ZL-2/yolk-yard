// Shared, deterministic arena geometry: rendering, shots, players and bots use these solids.
const solid=(x,z,w,d,h,color='concrete',y=0,kind='cover')=>({x,z,w,d,h,color,y,kind});
const mirrored=(boxes,...items)=>{for(const b of items)boxes.push(b,{...b,x:-b.x,z:-b.z});};
function steps(boxes,x,z,axis,sign,height,width=4){const count=Math.round(height/.4);for(let i=0;i<count;i++)boxes.push(solid(x+(axis==='x'?i*1.5*sign:0),z+(axis==='z'?i*1.5*sign:0),axis==='x'?1.52:width,axis==='z'?1.52:width,(i+1)*.4,'concrete',0,'step'));}
function house(boxes,x,z,w,d,h,color='slate'){
 // Opposite 3.6m doors create a genuinely traversable interior.
 boxes.push(solid(x-w/2+.3,z,.6,d,h,color,0,'building'),solid(x+w/2-.3,z,.6,d,h,color,0,'building'));
 for(const side of [-1,1])for(const end of [-1,1])boxes.push(solid(x+side*(w+3.6)/4,z+end*(d/2-.3),(w-3.6)/2,.6,h,color,0,'building'));
 boxes.push(solid(x,z,w,d,.3,'steel',h,'roof'));
}
function base(id,name,size,theme,sky){return {id,name,tag:`RAVEL COAST / ${theme.toUpperCase()} • ${size*2} × ${size*2}`,description:'',size,sky,ground:0x71837c,accent:0xd8b978,theme:'frontier',district:theme,revision:1,navMax:8,zone:[0,0,0],bases:[[-size+6,0],[size-6,0]],spawns:[[-size+6,-size+6],[size-6,size-6],[-size+6,size-6],[size-6,-size+6],[-size+6,0],[size-6,0],[0,-size+6],[0,size-6]],boxes:[],lanes:[],props:[],pickups:[],landmarks:[]};}
function bounds(m){const s=m.size;for(const side of [-1,1])m.boxes.push(solid(side*(s+1),0,2,s*2+4,4.2,'concrete',0,'boundary'),solid(0,side*(s+1),s*2,2,4.2,'concrete',0,'boundary'));}
function finish(m){bounds(m);m.pickups.push([-m.size+9,-m.size+9,'health'],[m.size-9,m.size-9,'health'],[-m.size+9,m.size-9,'ammo'],[m.size-9,-m.size+9,'ammo'],[0,-17,'popper'],[0,17,'health']);return m;}
export function createRavelArenas(){
 const relay=base('yard','Aster Relay',40,'uplink compound',0x9db6b5);relay.ground=0x687b6b;
 relay.description='An abandoned coastal uplink: breach the operations huts, flank through service lanes, or contest the elevated relay platform. Opposing approaches share equal cover.';
 relay.lanes=[[0,0,70,8,'road'],[-27,0,6,70,'road'],[27,0,6,70,'road'],[0,-27,60,6,'concrete'],[0,27,60,6,'concrete']];
 for(const sign of [-1,1]){house(relay.boxes,sign*17,sign*-17,10,10,4.3,'slate');house(relay.boxes,sign*17,sign*17,10,10,4.3,'canvas');}
 relay.boxes.push(solid(0,0,11,12,3.2,'concrete',0,'platform'));steps(relay.boxes,-16,0,'x',1,3.2);steps(relay.boxes,16,0,'x',-1,3.2);
 mirrored(relay.boxes,solid(-10,-7,8,1.2,1.5,'concrete'),solid(-28,-16,3,7,2.2,'equipment',0,'generator'),solid(-7,-27,6,3,1.8,'olive',0,'supply'),solid(-30,23,5,2,1.2,'concrete'));
 relay.boxes.push(solid(0,0,4,4,1.6,'equipment',3.2,'radar-base'));relay.landmarks=[{x:0,z:0,y:3.2,type:'radar',label:'ASTER / 01'}];relay.pickups.push([3.7,0,'ammo'],[-17,-10,'ammo'],[17,10,'ammo']);
 const docks=base('depot','Breakwater Docks',44,'freight port',0x8aa9b4);docks.ground=0x74868c;docks.bases=[[-39,0],[39,0]];
 docks.description='Storm-worn cargo stacks, loading bays and a cross-dock gantry. Broad outer flanks and covered centre routes connect both deployment zones.';
 docks.lanes=[[0,0,78,10,'road'],[-32,0,6,78,'road'],[32,0,6,78,'road'],[0,-31,66,5,'concrete'],[0,31,66,5,'concrete']];
 mirrored(docks.boxes,solid(-18,-16,14,5,3.0,'teal',0,'container'),solid(-18,16,6,13,3.0,'rust',0,'container'),solid(-18,-16,9,5,2.5,'olive',3,'container'),solid(-33,-17,4,8,2.8,'teal',0,'container'),solid(-10,-31,9,4,1.6,'concrete',0,'platform'),solid(-7,-9,4,2.8,1.3,'olive',0,'supply'));
 docks.boxes.push(solid(0,0,30,6,.3,'steel',3.3,'bridge'));for(const sign of [-1,1]){docks.boxes.push(solid(sign*11,0,1.2,6,3.3,'concrete',0,'support'),solid(sign*22,0,10,6,3.2,'concrete',0,'platform'));steps(docks.boxes,sign*(sign===1?37:36.5),0,'x',-sign,3.2);for(const x of [-10,0,10])docks.boxes.push(solid(x,sign*2.85,5,.25,.8,'steel',3.6,'rail'));}
 house(docks.boxes,-23,-33,9,7,4,'slate');house(docks.boxes,23,33,9,7,4,'slate');docks.landmarks=[{x:-55,z:-17,type:'crane'},{x:55,z:17,type:'crane'},{x:0,z:-51,type:'ship',label:'BREAKWATER'}];docks.pickups.push([-22,0,'ammo'],[22,0,'ammo']);
 const foundry=base('courtyard','Ironwake Foundry',42,'industrial works',0xb5aaa0);foundry.ground=0x807f76;
 foundry.description='A decommissioned turbine works with a traversable machine hall, split catwalks, service yards and armored equipment cover. Fight through the hall or take either flank.';
 foundry.lanes=[[0,0,72,10,'road'],[-29,0,7,72,'road'],[29,0,7,72,'road'],[0,-27,64,6,'road'],[0,27,64,6,'road']];
 // Tall machine hall has doors on every approach, with a true full-height interior.
 for(const sign of [-1,1])for(const end of [-1,1])foundry.boxes.push(solid(sign*7.25,end*11,8.5,.7,5.2,'rust',0,'building'),solid(end*11,sign*7.25,.7,8.5,5.2,'slate',0,'building'));
 foundry.boxes.push(solid(0,0,23,23,.35,'steel',5.2,'roof'),solid(-5,5,4,3,2.1,'equipment',0,'generator'),solid(5,-5,4,3,2.1,'equipment',0,'generator'));
 for(const sign of [-1,1]){for(const z of [-8,8])foundry.boxes.push(solid(sign*22,z,.7,.7,2.9,'steel',0,'support'));foundry.boxes.push(solid(sign*22,0,6,20,.3,'steel',2.9,'platform'));steps(foundry.boxes,sign*22,-sign*20.5,'z',sign,3.2);for(const z of [-6,5])foundry.boxes.push(solid(sign*24.8,z,.3,4,.8,'steel',3.2,'rail'));house(foundry.boxes,sign*21,sign*27,10,7,3.8,'slate');}
 mirrored(foundry.boxes,solid(-7,-28,7,3.2,1.8,'olive',0,'supply'),solid(-32,17,4,7,2.2,'equipment',0,'generator'),solid(-32,-17,5,3,1.2,'concrete'),solid(-6,15,7,2,1.4,'concrete'));
 foundry.landmarks=[{x:-52,z:-20,type:'chimneys'},{x:52,z:20,type:'chimneys'},{x:0,z:-49,type:'factory',label:'IRONWAKE / WORKS'}];foundry.pickups.push([-22,0,'ammo'],[22,0,'ammo']);
 return [relay,docks,foundry].map(finish);
}
