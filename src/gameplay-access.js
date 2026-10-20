// Prompts never compete with a deliberately opened game interface, nor request
// browser capture without a user gesture. The entry button performs the request.
export function needsMouseCapture({screen,phase,player,locked,paused,dialog,chat,hidden,coarse,pending}){
 return screen==='game'&&phase==='playing'&&player?.health>0&&!player.spectating&&!locked&&!paused&&!dialog&&!chat&&!hidden&&!coarse&&!pending;
}
export function matchInviteURL(href,code){
 const room=String(code||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
 if(!/^[A-Z0-9]{8}$/.test(room))throw Error('The room invite is not ready yet. Try again once the match connects.');
 const url=new URL(href);url.search='';url.hash='';url.searchParams.set('room',room);return url.href;
}
