export const EMOTES=Object.freeze([
 {id:'salute',name:'Field Salute',description:'Stand tall and salute your squad.',duration:4,icon:'salute'},
 {id:'shuffle',name:'Coast Shuffle',description:'A looping sidestep dance.',duration:0,icon:'dance'},
 {id:'cheer',name:'Rally Cheer',description:'Raise both arms and celebrate.',duration:5,icon:'cheer'},
 {id:'crown',name:'Crown Record',description:'Display your crowned victories this season.',duration:7,icon:'crown',locked:true},
]);
export function canEmote(p){return !!p&&p.health>0&&!p.spectating&&!p.downed&&!p.reviving&&!p.traversal&&(!p.inventory||p.flight==='ground')&&p.grounded!==false&&!p.sliding&&!p.use;}
export function startEmote(sim,p,id){
 const def=EMOTES.find(e=>e.id===id);if(!def||p.bot||!canEmote(p)||def.locked&&!p.crownEmoteUnlocked||sim.time<(p.emoteReadyAt||0))return false;
 p.emote={id,start:sim.time,yaw:p.yaw,until:def.duration?sim.time+def.duration:0};p.emoteReadyAt=sim.time+.25;
 p.building=false;p.editing=false;p.aim=false;p.reloadEnd=0;p.crouching=false;p.burstLeft=0;p.pendingFireUntil=0;p.sprinting=false;
 sim.emit('emote',{player:p.id,emote:id});return true;
}
export function cancelEmote(p){if(!p?.emote)return false;p.emote=null;p.pendingFireUntil=0;p.burstLeft=0;return true;}
export function emoteInput(sim,p,input){
 if(!p.emote)return input;
 const cancel=!canEmote(p)||p.lastDamage>=p.emote.start||p.emote.until&&sim.time>=p.emote.until||Math.abs(input.forward||0)+Math.abs(input.strafe||0)>.05||input.jump||input.crouch||input.sprint||input.fire||input.aim||input.reload||input.interact||input.drop||input.buildMode||input.editing||input.slot!==undefined&&input.slot!==p.slot||input.swapSlot>0;
 if(cancel){cancelEmote(p);return input;}
 // Camera look remains free, while the dance faces the direction it started.
 return {...input,yaw:p.emote.yaw,pitch:0,forward:0,strafe:0,fire:false,aim:false};
}
export function emotePose(id,t,side){
 if(id==='salute')return {hand:side>0?[.13,1.76,-.12]:[-.3,1.02,0],foot:[side*.12,.09,0],bob:0,sway:0};
 if(id==='cheer')return {hand:[side*.43,1.91+Math.sin(t*6)*.06,-.05],foot:[side*.15,.09,0],bob:Math.max(0,Math.sin(t*5))*.06,sway:0};
 if(id==='crown')return {hand:[side*.22,1.22,-.43],foot:[side*.12,.09,0],bob:0,sway:0};
 const beat=t*5;return {hand:[side*(.32+Math.sin(beat+side)*.09),1.19+Math.cos(beat+side)*.18,-.22],foot:[side*.15+Math.sin(beat)*.07,.09+Math.max(0,Math.sin(beat+side*Math.PI/2))*.12,-Math.cos(beat+side)*.06],bob:Math.sin(beat*2)*.035,sway:Math.sin(beat)*.08};
}
