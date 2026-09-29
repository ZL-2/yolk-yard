export const LOBBY_TRACK={title:'The Complex',artist:'Kevin MacLeod',file:'audio/patrol-theme.mp3',source:'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300025',license:'https://creativecommons.org/licenses/by/4.0/'};
// Stream the local compressed asset rather than decoding minutes of PCM into RAM.
export class LobbyMusic{
 constructor(factory=null){this.factory=factory;this.audio=null;this.unlocked=false;this.inLobby=false;this.hidden=false;this.level=0;this.volume=.135;this.pending=false;}
 unlock(){
  this.unlocked=true;
  if(!this.audio){
   const make=this.factory||(typeof Audio!=='undefined'?(src=>new Audio(src)):null);if(!make)return;
   const base=typeof document!=='undefined'?document.baseURI:'https://localhost/';
   this.audio=make(new URL(LOBBY_TRACK.file,base).href);this.audio.loop=true;this.audio.preload='none';this.audio.volume=0;
  }
  this.start();
 }
 start(){
  if(!this.audio||!this.inLobby||this.hidden||this.volume<=0||!this.audio.paused||this.pending)return;
  this.pending=true;
  Promise.resolve(this.audio.play()).catch(()=>{this.unlocked=false;}).finally(()=>{this.pending=false;if(!this.inLobby||this.hidden||this.volume<=0)this.audio.pause();});
 }
 setVolume(value){this.volume=Math.max(0,Math.min(1,Number.isFinite(value)?value:0));}
 update(inLobby,dt,hidden=false){
  const left=this.inLobby&&!inLobby;this.inLobby=inLobby;this.hidden=hidden;
  const target=inLobby&&!hidden?this.volume:0;
  this.level+=(target-this.level)*(1-Math.exp(-Math.max(0,Math.min(.1,dt))*5));
  if(!this.audio)return;
  this.audio.volume=this.level;
  if(left){this.audio.pause();this.audio.currentTime=0;this.level=0;this.audio.volume=0;return;}
  if(hidden||this.volume===0){this.audio.pause();this.level=0;this.audio.volume=0;}
  else if(inLobby&&this.unlocked)this.start();
 }
}
