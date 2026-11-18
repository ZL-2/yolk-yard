export const DEVELOPER_SYMBOL='⟨/⟩';

// Presentation only. Keep the stored name unchanged for login, moderation,
// matchmaking, chat routing, searches and score history.
export function displayPlayerName(name){
 const text=String(name??'');
 return text.normalize('NFKC').trim().toLowerCase()==='zach'?text+' '+DEVELOPER_SYMBOL:text;
}

export function displayWinner(result){
 return String(result??'').replace(/^(.*?)( wins(?: the series)?)$/i,(_,name,suffix)=>displayPlayerName(name)+suffix);
}
