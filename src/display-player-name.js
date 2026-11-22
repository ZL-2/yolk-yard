// Display names do not grant server permissions.
const escapeName=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge='<svg class="developer-badge" style="display:inline-block;width:1em;height:1em;vertical-align:-.13em;margin-inline-start:.27em" viewBox="0 0 24 24" role="img" aria-label="Developer"><title>Developer</title><path fill="#f9cb62" stroke="#87501c" stroke-width="1.25" d="M12 1.8 21 5v6.9c0 4.1-3.6 7.5-9 10.3-5.4-2.8-9-6.2-9-10.3V5z"/><path fill="none" stroke="#5d350c" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.65" d="m8.8 8.3-3 3.4 3 3.4m6.4-6.8 3 3.4-3 3.4m-2-7.4-2.4 8"/></svg>';

export function playerNameMarkup(name,verified=false){return escapeName(name)+(verified===true?badge:'');}
export function playerNameNode(name,verified=false){
 const node=document.createElement('b');
 node.innerHTML=playerNameMarkup(name,verified);
 return node;
}

export function displayPlayerName(name){return String(name??'');}

export function winnerMarkup(result){
 const text=String(result??''),match=/^(.*?)( wins(?: the series)?)$/i.exec(text);
 return match?playerNameMarkup(match[1])+escapeName(match[2]):escapeName(text);
}
