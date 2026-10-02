// Authored arena landmarks also serve as combat cover. Keep deployment lanes
// symmetric while giving each arena a different route and silhouette language.
export function redesignArena(m){
 const put=(x,z,w,d,h,color,y=0,kind='cover')=>m.boxes.push({x,z,w,d,h,color,y,kind});
 const pair=(...args)=>{put(...args);args[0]*=-1;args[1]*=-1;put(...args);};
 m.revision=2;m.story=[];m.details=[];
 if(m.id==='yard'){
  m.description='Aster’s severed uplink: twin dish spires, blue operations huts, sandbag checkpoints and an elevated signal core. Breach the huts or cross the exposed transmitter deck.';
  for(const b of m.boxes)if(b.kind==='building')b.color=b.x*b.z<0?'slate':'teal';
  pair(-8,-18,4,1.2,1.05,'canvas');pair(-29,9,4,1.2,1.1,'canvas');
  pair(-34,-27,2.4,2.4,7,'slate');pair(-34,-27,3.5,3.5,.4,'amber',7);
  pair(-17,-17,.5,10,1.8,'steel',4.6);pair(-17,-17,6,.5,1.8,'steel',4.6);
  m.landmarks.push({x:-34,z:-27,y:7.4,type:'radar'},{x:34,z:27,y:7.4,type:'radar'});
  m.details.push({type:'checkpoint',x:-27,z:0},{type:'checkpoint',x:27,z:0});
  m.story=['Uplink severed','Evacuation checkpoint','Operations / signals'];
 }else if(m.id==='depot'){
  m.description='Breakwater’s grounded convoy: orange cargo cranes, blue freight stacks, warehouse alleys and a high transfer gantry. Cross under the gantry or fight along its exposed deck.';
  pair(-8,23,11,2.8,2.4,'rust');pair(-29,-9,2,2,1.4,'canvas');
  // A frame straddles the dock without putting a solid wall across its route.
  for(const x of [-12,12]){put(x,0,.65,1.3,15,'amber');put(x,0,1.2,1.8,.4,'steel',15);}
  put(0,0,27,1.3,.7,'amber',15);put(0,0,27,.5,.25,'steel',17);
  m.details.push({type:'cargo-hook',x:0,z:0},{type:'freight',x:-18,z:-16},{type:'freight',x:18,z:16});
  m.story=['Convoy diverted','Pier 04 / military freight','Last shipment abandoned'];
 }else{
  m.description='Ironwake’s cold turbine works: copper exhaust stacks, ribbed machine halls, yellow service gantries and a damaged furnace. Covered maintenance passages meet exposed elevated flanks.';
  pair(-17,15,3.5,2,2,'rust');pair(-30,-8,2,4,1.3,'equipment');
  for(const x of [-5,5]){put(x,0,2.6,2.6,9,'rust',5.55);put(x,0,3.2,3.2,.6,'steel',14.55);}
  for(const z of [-34,34]){put(0,z,10,3,.35,'steel',3);for(const x of [-4.6,4.6])put(x,z,.45,3,3,'rust');}
  m.details.push({type:'pipework',x:0,z:0},{type:'furnace',x:-5,z:5},{type:'furnace',x:5,z:-5});
  m.story=['Turbine overhaul interrupted','Pressure isolation / 07','Cooling line disconnected'];
 }
 return m;
}
