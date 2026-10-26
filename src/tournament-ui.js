import {tournamentClock} from './tournament-clock.js';
import {tournamentEvents,visibleTournament,eventTime,eventDate,placementReward} from './tournament.js';
import {tournamentName,tournamentMode,tournamentTeamSize,TOURNAMENT_CARD_LEAD_MS} from './tournament.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function tournamentTeamEntryMarkup(e){
 const size=tournamentTeamSize(e);if(size===1||!['scheduled','preparing','entry'].includes(e.phase))return '';
 return `<aside class="tournament-team-entry" aria-label="Team cup entry directions"><strong>JOIN YOUR TEAMMATES’ LOBBY PARTY FIRST</strong><p>Use Social to join or invite the people you want to play with. Your party leader then selects JOIN TOURNAMENT.</p><p><b>1–${size} players allowed · ${size} maximum.</b> Smaller parties can enter. No bots or other players fill empty slots.</p></aside>`;
}
export function tournamentCard(event,online=false,now=tournamentClock.now()??event?.serverNow){
 if(!Number.isFinite(now))return '';
 const e=visibleTournament(tournamentEvents(event),now);if(!e)return '';
 const phase=e.phase,entry=phase==='entry',live=phase==='running',done=['finished','cancelled'].includes(phase),seconds=Math.max(0,Math.ceil(((entry?e.startsAt:e.opensAt)-now)/1000));
 const timer=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 const status=done?'MATCHMAKING OPEN':live?`${e.alive} STILL STANDING`:entry?`ENTRY CLOSES IN ${timer}`:`ENTRY OPENS IN ${timer}`;
 return `<section class="public-royale-card tournament-card ${done?'tournament-finished':''}" aria-label="${esc(tournamentName(e))} tournament"><div class="public-royale-heading"><span class="eyebrow">${esc(eventDate(e.opensAt))} · ${esc(tournamentMode(e).toUpperCase())}</span><strong class="public-royale-live">${esc(status)}</strong></div><div class="public-royale-title"><strong>${esc(tournamentName(e))}</strong><small>Join ${esc(eventTime(e.opensAt))}–${esc(eventTime(e.startsAt))} · New York</small></div><div class="public-royale-facts"><span><b>1ST</b> ${e.prizes[0].toLocaleString()} Marks${e.pickaxe?' + Frontier Champion':''}</span><span><b>2ND</b> ${e.prizes[1].toLocaleString()} · <b>3RD</b> ${e.prizes[2].toLocaleString()} Marks</span>${e.duplicateReward?'<span>Already own the pickaxe? Win '+e.duplicateReward.toLocaleString()+' extra Marks.</span>':''}</div>${tournamentTeamSize(e)>1?'<span class="tournament-prize-note">Full prize per teammate · never split</span>':''}<div class="public-royale-action"><span>${done?(e.results?.[0]?`${tournamentTeamSize(e)>1?'CHAMPIONS':'CHAMPION'} · ${esc(e.results.filter(r=>r.place===1).map(r=>r.name).join(', '))}`:'EVENT CLOSED'):live?`${e.spectators} / ${e.spectatorCapacity??16} spectator seats`:entry?`${e.players} / ${e.capacity} players`:Math.round((e.startsAt-e.opensAt)/60000)+' MIN TO ENTER'}</span>${done?'':`<button class="primary" data-action="${live?'tournament-spectate':'tournament-join'}" data-event-id="${esc(e.id)}" ${!online||!entry&&!live?'disabled':''}>${live?'SPECTATE MATCH':entry?'JOIN TOURNAMENT':'OPENS '+esc(eventTime(e.opensAt))}</button>`}</div>${tournamentTeamEntryMarkup(e)}${done?standingsMarkup(e,{compact:true}):''}<p class="public-royale-hint">${done?esc(e.message):`Other matches close at ${esc(eventTime(e.lockAt))}. Battle starts at ${esc(eventTime(e.startsAt))}. Watch after elimination or if you miss entry.`}</p><button class="tournament-details-link" data-action="compete-event" data-event-id="${esc(e.id)}">EVENT DETAILS & REWARDS ↗</button></section>`;
}
export function standingsMarkup(e,{compact=false,identity='',query=''}={}){
 const live=e.phase==='running',rows=(live?e.standings:e.results)||[],filtered=rows.filter(r=>!query||r.name.toLowerCase().includes(query.toLowerCase()));
 if(!rows.length)return `<p class="compete-empty">${e.phase==='cancelled'?'Event cancelled. No tournament rewards awarded.':live?'Waiting for the first standings update.':'Placements appear here after the match. Rewards below show what each placement earns.'}</p>`;
 return `<div class="tournament-standings ${compact?'compact':''}" tabindex="0" role="region" aria-label="Tournament placements and rewards"><table><thead><tr><th>PLACE</th><th>PLAYER</th>${compact?'':'<th>ELIMS</th>'}<th>${live?'STATUS / PROJECTED REWARD':'REWARD AWARDED'}</th></tr></thead><tbody>${filtered.map(r=>`<tr class="${r.identity===identity?'is-you':''}"><td>${live&&(r.alive||r.teamAlive)?'—':'#'+(r.place||'—')}</td><td>${esc(r.name)}${tournamentTeamSize(e)>1&&Number.isInteger(r.team)?' <small>TEAM '+(r.team+1)+'</small>':''}${r.identity===identity?' <small>YOU</small>':''}</td>${compact?'':`<td>${r.kills??'—'}</td>`}<td>${live?r.alive?'Still competing':r.teamAlive?'Teammates still competing':`Eliminated · ${(e.prizes[(r.place||0)-1]||0).toLocaleString()} Marks if placement holds`:esc(placementReward(e,r))}</td></tr>`).join('')||'<tr><td colspan="4">No players match your search.</td></tr>'}</tbody></table></div>${!live&&!e.standingsComplete?'<p class="compete-note">Archived podium only. This event’s original release did not save placements below third.</p>':''}${live?'<p class="compete-note">Live standings are provisional. Survivors are not assigned final places until the match ends.</p>':''}`;
}
// Keep controls and the scrolling standings region mounted as the clock ticks.
// Replacing innerHTML every second can interrupt pointer clicks or keyboard focus.
function patchCardNode(current,next){
 if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName){current.replaceWith(next.cloneNode(true));return;}
 if(current.nodeType===3){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
 if(current.nodeType!==1)return;
 for(const a of [...current.attributes])if(!next.hasAttribute(a.name))current.removeAttribute(a.name);
 for(const a of next.attributes)if(current.getAttribute(a.name)!==a.value)current.setAttribute(a.name,a.value);
 const old=[...current.childNodes],fresh=[...next.childNodes];
 for(let i=0;i<Math.max(old.length,fresh.length);i++){
  if(!fresh[i])old[i].remove();else if(!old[i])current.append(fresh[i].cloneNode(true));else patchCardNode(old[i],fresh[i]);
 }
}
export function updateTournamentCard(root,event,online,now){
 const slot=root.querySelector('[data-tournament-slot]');if(!slot)return;
 const html=tournamentCard(event,online,now),card=slot.firstElementChild;
 if(!html){if(card)slot.replaceChildren();return;}
 const template=slot.ownerDocument.createElement('template');template.innerHTML=html;
 if(!card){slot.append(template.content);return;}
 patchCardNode(card,template.content.firstElementChild);
}
