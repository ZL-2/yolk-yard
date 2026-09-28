import {randomUUID,randomInt} from 'node:crypto';
import {safeProfile,VERSION} from '../../src/data.js';
import {matchOptions} from '../../src/match-options.js';
const code=()=>Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
// Separate lobby identities survive gameplay room changes. Opaque session tokens
// authenticate reconnects; invitations and admission tickets never come from profiles.
export class PartyService{
 constructor(relay){this.relay=relay;this.users=new Map();this.parties=new Map();this.invites=new Map();this.tickets=new Map();this.timer=setInterval(()=>this.sweep(),5000);this.timer.unref?.();}
 send(u,message){if(u?.ws?.readyState===1)u.ws.send(JSON.stringify(message));}
 create(u){const p={id:randomUUID(),leader:u.id,members:[u.id],privacy:'invite',selection:{mode:'royale',teamSize:1,duoFill:true},state:'idle'};this.parties.set(p.id,p);u.party=p.id;return p;}
 snapshot(p){return {...p,members:p.members.map(id=>{const u=this.users.get(id);return {id,profile:u.profile,ready:!!u.ready,inMatch:!!u.inMatch,connected:!!u.ws};})};}
 sync(p){if(p)for(const id of p.members)this.send(this.users.get(id),{type:'party',party:this.snapshot(p)});}
 leave(u){const p=this.parties.get(u.party);if(!p)return;if(p.state==='queueing')this.cancel(p,'Party membership changed.');p.members=p.members.filter(id=>id!==u.id);if(!p.members.length)this.parties.delete(p.id);else{if(p.leader===u.id)p.leader=p.members[0];if(!p.members.some(id=>this.users.get(id).inMatch)){p.state='idle';delete p.launch;}this.sync(p);}u.ready=false;u.inMatch=false;this.create(u);this.sync(this.parties.get(u.party));}
 cancel(p,reason='Matchmaking cancelled.'){for(const id of p.members){const u=this.users.get(id);u.inMatch=false;u.ready=false;delete u.joined;}p.state='idle';delete p.launch;for(const [t,a]of this.tickets)if(a.party===p.id&&!a.peer)this.tickets.delete(t);for(const id of p.members)this.send(this.users.get(id),{type:'cancel',message:reason});this.sync(p);}
 attach(ws){let user,at=0,count=0;const timeout=setTimeout(()=>{if(!user)ws.close();},10000);
  ws.on('message',raw=>{let m;try{if(raw.length>8192)throw Error('Message too large');m=JSON.parse(raw);if(Date.now()-at>1000){at=Date.now();count=0;}if(++count>25)throw Error('Too many requests');
   if(!user){if(m.type!=='hello'||m.version!==VERSION)throw Error('Refresh Ravelfront to connect.');user=m.token?[...this.users.values()].find(u=>u.token===m.token):null;if(user?.ws&&user.ws!==ws)user.ws.close();if(!user){user={id:randomUUID(),token:randomUUID(),profile:safeProfile(m.profile),ready:false};this.users.set(user.id,user);this.create(user);}user.ws=ws;user.seen=Date.now();clearTimeout(timeout);this.send(user,{type:'hello',id:user.id,token:user.token});this.sync(this.parties.get(user.party));return;}
   if(user.ws!==ws)return;user.seen=Date.now();const result=this.command(user,m);if(m.request)this.send(user,{type:'reply',request:m.request,result:result??true});
  }catch(e){if(user)this.send(user,{type:'reply',request:m?.request,error:e.message});else ws.close(1008,String(e.message).slice(0,100));}});
  ws.on('close',()=>{clearTimeout(timeout);if(user?.ws===ws){user.ws=null;user.seen=Date.now();const p=this.parties.get(user.party);if(p?.state==='queueing')this.cancel(p,'A party member disconnected.');this.sync(p);}});ws.on('error',()=>{});
 }
 command(u,m){const p=this.parties.get(u.party),leader=()=>{if(p.leader!==u.id)throw Error('Only the party leader can do that.');},idle=()=>{if(p.state!=='idle')throw Error('Return to the lobby first.');};
  switch(m.type){
   case 'ping':return true;
   case 'profile':u.profile=safeProfile(m.profile);this.sync(p);return;
   case 'online':return [...this.users.values()].filter(v=>v.ws&&v.id!==u.id).slice(0,100).map(v=>({id:v.id,name:v.profile.name,party:v.party,joinable:this.parties.get(v.party)?.privacy==='open',state:this.parties.get(v.party)?.state}));
   case 'privacy':leader();idle();p.privacy=m.value==='open'?'open':'invite';this.sync(p);return;
   case 'select':leader();idle();if(!['royale','ffa','teams'].includes(m.mode))throw Error('Unknown mode');if(p.members.length>1&&m.mode==='royale'&&m.teamSize!==2)throw Error('Choose Duos for a two-player party, or leave the party for Solo.');p.selection={mode:m.mode,teamSize:m.mode==='royale'&&m.teamSize===2?2:1,duoFill:m.duoFill!==false};for(const id of p.members)this.users.get(id).ready=false;this.sync(p);return;
   case 'ready':idle();u.ready=!!m.value;this.sync(p);return;
   case 'invite':{leader();idle();if(p.members.length>=2)throw Error('This party is full.');const to=this.users.get(m.id);if(!to?.ws||to.party===p.id)throw Error('Player unavailable.');if(Date.now()-(u.invitedAt||0)<1500)throw Error('Wait a moment before inviting again.');u.invitedAt=Date.now();const invite={id:randomUUID(),from:u.id,to:to.id,party:p.id,expires:Date.now()+60000};this.invites.set(invite.id,invite);this.send(to,{type:'invite',invite:{...invite,name:u.profile.name}});return;}
   case 'accept':case 'decline':{const invite=this.invites.get(m.id);if(!invite||invite.to!==u.id||invite.expires<Date.now())throw Error('Invitation expired.');this.invites.delete(m.id);if(m.type==='decline')return;return this.join(u,invite.party);}
   case 'join':{const dest=this.parties.get(m.id);if(dest?.privacy!=='open')throw Error('This party is invite-only.');return this.join(u,m.id);}
   case 'leave':this.leave(u);return;
   case 'kick':{leader();idle();const v=this.users.get(m.id);if(!v||v.party!==p.id||v.id===u.id)throw Error('Invalid member.');this.leave(v);return;}
   case 'returned':u.ready=false;u.inMatch=false;delete u.joined;if(p.state==='queueing')this.cancel(p,'Party returned to the lobby.');else{if(!p.members.some(id=>this.users.get(id).inMatch)){p.state='idle';delete p.launch;}this.sync(p);}return;
   case 'cancel':leader();if(p.state==='playing')throw Error('Return to the lobby before finding another match.');this.cancel(p);return;
   case 'queue':{leader();idle();if(p.members.some(id=>!this.users.get(id).ws))throw Error('Wait for your teammate to reconnect.');if(p.members.some(id=>id!==u.id&&!this.users.get(id).ready))throw Error('Your teammate must ready up.');const selection=p.selection;
    if(selection.mode==='royale'&&selection.teamSize===1&&p.members.length>1)throw Error('A party of two needs Duos.');
    let options=matchOptions({...m.options,...selection,fill:m.options?.fill!==false,session:'online'}),room;
    const rooms=[...this.relay.peers.values()].filter(peer=>peer.ws&&peer.listing&&Date.now()-peer.listedAt<15000).map(peer=>peer.listing);
    const pending=roomCode=>[...this.tickets.values()].filter(t=>t.code===roomCode&&(!t.peer||t.claimedAt>(this.relay.peers.get(`yolk-yard-v${VERSION}-${roomCode}`)?.listedAt||0))&&t.expires>Date.now()).length;
    if(m.code){room=rooms.find(r=>r.code===m.code);if(!room)throw Error('That room is not accepting contestants. Check the code with its host.');}
    else if(!m.custom)room=rooms.filter(r=>r.public!==false&&r.version===VERSION&&r.mode===selection.mode&&(r.teamSize||1)===selection.teamSize&&(r.phase==='lobby'||selection.mode!=='royale'&&r.phase==='playing')&&r.capacity-r.players-pending(r.code)>=p.members.length).sort((a,b)=>b.players-a.players)[0];
    if(room&&(room.mode!==selection.mode||(room.teamSize||1)!==selection.teamSize||(!m.code&&room.phase!=='lobby'&&selection.mode==='royale')||((room.phase==='lobby'||selection.mode!=='royale')&&room.capacity-room.players-pending(room.code)<p.members.length)))throw Error('That match cannot fit this party.');
    if(room)options=matchOptions({...options,capacity:room.contestantCapacity||room.capacity,teamSize:room.teamSize});
    if(!room&&selection.teamSize===2&&options.capacity<4)throw Error('Duos needs at least four contestant positions for opposing teams.');
    const roomCode=room?.code||code(),creating=!room,launch={id:randomUUID(),code:roomCode,options,creating,rewardPublic:!m.custom&&!m.code,visibility:m.custom&&m.visibility==='private'?'private':'public',created:Date.now()};p.launch=launch;p.state='queueing';
    for(const id of p.members){const token=randomUUID(),a={party:p.id,member:id,code:roomCode,teamSize:selection.teamSize,duoFill:selection.duoFill,partySize:p.members.length,expires:Date.now()+90000,token};this.tickets.set(token,a);const member=this.users.get(id);member.ticket=token;}
    this.sync(p);if(creating)this.send(u,{type:'launch',launch:{...launch,host:true,ticket:u.ticket,admission:this.publicAdmission(this.tickets.get(u.ticket))}});else this.dispatch(p);return launch.id;}
   case 'host-ready':leader();if(!p.launch||p.launch.id!==m.id)throw Error('Launch expired.');{const host=this.relay.peers.get(`yolk-yard-v${VERSION}-${p.launch.code}`);if(host)host.rewardPublic=p.launch.rewardPublic;}this.claim(u.ticket,`yolk-yard-v${VERSION}-${p.launch.code}`,`yolk-yard-v${VERSION}-${p.launch.code}`);this.dispatch(p,true);return;
   case 'joined':if(p.launch&&m.id===p.launch.id){u.joined=m.id;u.inMatch=true;if(p.members.every(id=>this.users.get(id).joined===m.id)){p.state='playing';this.sync(p);}}return;
   case 'failed':if(p.launch?.id===m.id)this.cancel(p,String(m.reason||'Unable to join together.').slice(0,120));return;
   default:throw Error('Unknown party action.');
  }
 }
 join(u,id){const dest=this.parties.get(id),old=this.parties.get(u.party);if(!dest||dest===old||dest.state!=='idle'||dest.members.length>=2||old.state!=='idle')throw Error('Party is unavailable.');this.leave(u);this.parties.delete(u.party);u.party=id;u.ready=false;dest.members.push(u.id);if(dest.selection.mode==='royale')dest.selection.teamSize=2;this.sync(dest);}
 dispatch(p,skipHost=false){for(const id of p.members){if(skipHost&&id===p.leader)continue;const u=this.users.get(id);this.send(u,{type:'launch',launch:{...p.launch,host:false,ticket:u.ticket}});}}
 publicAdmission(t){return {partyId:t.party,memberId:t.member,partySize:t.partySize,duoFill:t.duoFill,teamSize:t.teamSize};}
 claim(token,peer,room){const t=this.tickets.get(token);if(!t||t.expires<Date.now()||room!==`yolk-yard-v${VERSION}-${t.code}`||t.peer&&t.peer!==peer) return null;t.peer=peer;t.claimedAt=Date.now();return this.publicAdmission(t);}
 sweep(){const now=Date.now();for(const [id,i]of this.invites)if(i.expires<now)this.invites.delete(id);for(const [id,t]of this.tickets)if(t.expires<now)this.tickets.delete(id);for(const u of this.users.values())if(!u.ws&&now-u.seen>90000){this.leave(u);this.parties.delete(u.party);this.users.delete(u.id);}for(const p of this.parties.values())if(p.state==='queueing'&&now-p.launch.created>35000)this.cancel(p,'Matchmaking timed out. Try again.');}
 close(){clearInterval(this.timer);for(const u of this.users.values())u.ws?.close(1001,'Server restarting');}
}
