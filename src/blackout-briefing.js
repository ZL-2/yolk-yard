import {BLACKOUT_LOGS} from './blackout-map.js';
import './blackout-briefing.css';

const base=import.meta.env?.BASE_URL||'/';
const folder=base+'season/blackout/';
const seenKey='ravelfront-blackout-briefing-v1';
const archiveKey='ravelfront-blackout-recordings-v1';
let pending, audio;
function readArchive(){
  try{
    const value=JSON.parse(localStorage.getItem(archiveKey));
    return new Set(Array.isArray(value)?value.filter(index=>Number.isInteger(index)&&BLACKOUT_LOGS[index]):[]);
  }catch{return new Set();}
}
export function rememberBlackoutRecording(index){
  if(!BLACKOUT_LOGS[index])return;
  const archive=readArchive();
  archive.add(index);
  try{localStorage.setItem(archiveKey,JSON.stringify([...archive]));}catch{}
}
export function stopBlackoutRecording(){
  audio?.pause();
  audio=null;
}
export function playBlackoutRecording(index,volume){
  stopBlackoutRecording();
  if(!BLACKOUT_LOGS[index] || !(volume>0))return;
  audio=new Audio(folder+`recording-${index+1}.mp3`);
  audio.volume=Math.min(1,volume);
  void audio.play().catch(()=>{});
}
export function showBlackoutBriefing({force=false}={}){
  if(pending)return pending;
  try{if(!force && localStorage.getItem(seenKey)==='yes')return Promise.resolve();}catch{}
  pending=new Promise(resolve=>{
    const previous=document.activeElement;
    const archive=readArchive();
    const dialog=document.createElement('dialog');
    dialog.className='blackout-briefing';
    dialog.setAttribute('aria-labelledby','blackout-title');
    dialog.innerHTML=`<div class="blackout-art">
      <img src="${folder}cover.webp" alt="A damaged cargo ship lodged in the Breakwater seawall above a utility tunnel">
      <div class="blackout-headline"><span>RAVELFRONT · SEASON 1</span><p>OPERATION BREAKWATER</p><h1 id="blackout-title">THE BLACKOUT</h1></div>
    </div>
    <button type="button" class="blackout-close" aria-label="Close Blackout briefing">×</button>
    <div class="blackout-body">
      <p class="blackout-lead">The harbor is dark. A freighter is pinned to the seawall. Its radio is still transmitting.</p>
      <div class="blackout-steps">
        <article><b>01 · LAND AT THE WRECK</b><p>Drop onto the cargo deck or approach through the hull breach and the seawall service tunnel.</p></article>
        <article><b>02 · RESTORE POWER</b><p>Use both breakers marked on the map. The cargo hold opens and a siren warns nearby players.</p></article>
        <article><b>03 · RECOVER THE RECORDINGS</b><p>Search the hold for two Epic chests and a distress call. Follow the trail to Aster Command and Sable Woods.</p></article>
      </div>
      <details><summary>Recovered recordings · ${archive.size} / 3</summary>
        ${BLACKOUT_LOGS.map((log,index)=>archive.has(index)?`<article class="blackout-log"><b>${log.title} · ${log.speaker}</b><p>${log.text}</p><audio controls preload="none" src="${folder}recording-${index+1}.mp3"></audio></article>`:`<p class="blackout-log">Recording 0${index+1} · Undiscovered</p>`).join('')}
      </details>
      <footer><label><input type="checkbox" data-blackout-dismiss> Don’t show again on startup</label><button type="button" class="primary" data-blackout-close>RETURN TO LOBBY</button></footer>
    </div>`;
    document.body.append(dialog);
    const close=()=>{
      if(!dialog.isConnected)return;
      try{if(dialog.querySelector('[data-blackout-dismiss]').checked)localStorage.setItem(seenKey,'yes');}catch{}
      dialog.close();
      dialog.remove();
      previous?.focus?.();
      pending=null;
      resolve();
    };
    dialog.querySelector('.blackout-close').onclick=close;
    dialog.querySelector('[data-blackout-close]').onclick=close;
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.showModal();
    dialog.querySelector('.blackout-close').focus();
  });
  return pending;
}
