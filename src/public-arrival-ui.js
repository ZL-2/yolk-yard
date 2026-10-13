export class PublicArrivalUI{
 constructor(){this.root=document.createElement('aside');this.root.id='public-match-arrival';this.root.hidden=true;this.root.setAttribute('role','status');this.root.innerHTML='<div><small>THE FRONTIER IS FILLING UP</small><strong></strong><span></span></div><button data-action="public-join">JOIN MAIN MATCH →</button><button data-arrival-close aria-label="Dismiss match arrival">×</button>';document.body.append(this.root);this.root.querySelector('[data-arrival-close]').onclick=()=>{this.until=0;this.root.hidden=true;};}
 show(match,now=performance.now()){
  this.until=now+7500;this.root.querySelector('strong').textContent=(match.lastJoin?.name||'A player')+' joined the main match';this.root.querySelector('span').textContent=match.humanPlayers+' real players · Join the same Spawn Island';
 }
 update(match,inLobby,party,id,now=performance.now()){
  this.root.hidden=!inLobby||now>=(this.until||0);if(this.root.hidden)return;
  const ready=!party||party.leader===id&&party.members.every(p=>p.id===id||p.ready)&&party.state==='idle';
  this.root.querySelector('[data-action]').disabled=!match?.joinable||match.recovering||!ready||match.availableSeats<(party?.members.length||1);
 }
}
