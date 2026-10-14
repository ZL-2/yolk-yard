// Authority-only damage accounting. Bounded, event-driven and checkpoint-safe.
export const RECAP_WINDOW=12,RECAP_LIMIT=24;
export function recordCombatDamage(victim,attacker,amount,source,time,critical=false){
 if(!(amount>0)||!Number.isFinite(amount)||!Number.isFinite(time))return;
 const rows=victim.combatHistory??=[];
 while(rows.length&&(rows[0].time<time-RECAP_WINDOW||rows.length>RECAP_LIMIT))rows.shift();
 const id=attacker&&attacker!==victim?attacker.id:null,last=rows.at(-1);
 // Fixed half-second buckets prevent a continuous source (storm/fire) from
 // extending one aggregate indefinitely and counting damage outside the window.
 if(last&&last.id===id&&last.weapon===source&&Math.floor(time*2)===Math.floor(last.time*2)){last.damage+=amount;last.critical||=!!critical;return;}
 if(rows.length>=RECAP_LIMIT)rows.shift();
 rows.push({id,name:id?attacker.name:source,weapon:source,damage:amount,time,critical:!!critical});
}
export function combatRecap(victim,time,finalHit){
 const enemies=new Set(),sources=new Map();let total=0;
 for(const row of victim.combatHistory||[]){
  if(row.time<time-RECAP_WINDOW||row.time>time||!(row.damage>0))continue;
  total+=row.damage;if(row.id)enemies.add(row.id);
  const key=JSON.stringify([row.id,row.weapon]);let entry=sources.get(key);
  if(!entry){entry={name:row.name,weapon:row.weapon,damage:0};sources.set(key,entry);}entry.damage+=row.damage;
 }
 return {...finalHit,totalDamage:Math.round(total),attackers:enemies.size,window:RECAP_WINDOW,
  sources:[...sources.values()].sort((a,b)=>b.damage-a.damage).slice(0,6).map(row=>({...row,damage:Math.round(row.damage)}))};
}

const PRIORITY={body:1,shield:2,head:3,break:4,knock:5,elimination:6};
export const CONFIRM_LABEL={body:'BODY HIT',shield:'SHIELD HIT',head:'HEADSHOT',break:'SHIELD BROKEN',knock:'KNOCKED',elimination:'ELIMINATED'};
export function confirmationKind(e,id){
 if(e.player!==id||e.target===id)return null;
 if(e.type==='elimination')return 'elimination';
 if(e.type==='knocked')return 'knock';
 if(!['hit','vehicle-hit'].includes(e.type)||!(e.amount>0))return null;
 return e.shieldBreak?'break':e.precision?'head':e.shield?'shield':'body';
}
export class CombatConfirmation{
 constructor(){this.reset();}
 reset(){this.kind='body';this.until=0;this.changedAt=-Infinity;this.pending=null;this.seen=new Map();}
 accept(e,id,now){
  const kind=confirmationKind(e,id);if(!kind)return;
  const key=e.type==='hit'&&e.shotId!=null?JSON.stringify([e.shotId,e.target]):JSON.stringify([e.type,e.id]);
  const seen=this.seen.get(key);if(seen&&seen>=PRIORITY[kind])return;
  if(this.seen.size>=64)this.seen.delete(this.seen.keys().next().value);this.seen.set(key,PRIORITY[kind]);
  if(now-this.changedAt>90||PRIORITY[kind]>=PRIORITY[this.kind]){this.kind=kind;this.changedAt=now;}
  this.until=now+(PRIORITY[this.kind]>=4?300:160);
  if(!this.pending||PRIORITY[kind]>PRIORITY[this.pending])this.pending=kind;
 }
 takeSound(){const kind=this.pending;this.pending=null;return kind;}
}

// Five DOM nodes for the lifetime of the HUD; no per-frame HTML parsing.
export class DamageDirections{
 constructor(root){this.root=root;this.rows=[];this.nodes=Array.from({length:5},()=>{const n=root.ownerDocument.createElement('i');n.className='damage-direction';n.hidden=true;root.append(n);return n;});}
 reset(){this.rows.length=0;for(const n of this.nodes)n.hidden=true;}
 hit(e,now){
  if(!Number.isFinite(e.sourceX)||!Number.isFinite(e.sourceZ))return;
  const kind=e.shieldBreak?'break':e.shield?'shield':'health';
  let row=this.rows.find(r=>r.id===e.player&&now-r.at<150);
  if(!row){if(this.rows.length===5)this.rows.shift();row={};this.rows.push(row);}
  const previous=row.kind;Object.assign(row,{id:e.player,x:e.sourceX,z:e.sourceZ,at:now,until:now+1400,kind:previous==='break'?'break':kind});
 }
 update(p,yaw,now,enabled=true){
  for(let i=this.rows.length-1;i>=0;i--)if(this.rows[i].until<=now)this.rows.splice(i,1);
  const c=Math.cos(yaw),s=Math.sin(yaw);
  for(let i=0;i<5;i++){
   const node=this.nodes[i],row=this.rows[i];node.hidden=!enabled||!p||!row;if(node.hidden)continue;
   const dx=row.x-p.x,dz=row.z-p.z;node.dataset.kind=row.kind;
   node.style.transform=`rotate(${Math.atan2(dx*c-dz*s,-dx*s-dz*c)*180/Math.PI}deg)`;
   node.style.opacity=String(Math.min(1,(row.until-now)/500));
  }
 }
}
