// Artwork is presentation only. Never change match admission, physics or timings.
export const LOADING_ART=Object.freeze({
 startup:Object.freeze({id:'startup',file:'loading/kestrel-airstrip.webp',location:'FORWARD AIRFIELD',eyebrow:'SEASON 1 / OPERATION BREAKWATER',title:'HOLD THE<br>FRONT.',story:'Beyond the coast, the storm is closing in. Stay together. Move with purpose. Make every shot count.',position:'67% center'}),
 matches:Object.freeze([
  Object.freeze({id:'coast',file:'season/breakwater.webp',location:'RAVEL COAST',eyebrow:'SEASON 1 / OPERATION BREAKWATER',title:'ONE<br>FRONTIER.',story:'From Aster Command to the coast, every route is a new opportunity. Choose your landing. Watch the storm.',position:'62% center'}),
  Object.freeze({id:'docks',file:'loading/breakwater-docks.webp',location:'BREAKWATER DOCKS',eyebrow:'RAVEL COAST / CARGO DISTRICT',title:'BREAKWATER<br>DOCKS.',story:'Cargo gantries, warehouse cover and open waterfront sightlines. Cross the harbor with a plan.',position:'68% center'}),
  Object.freeze({id:'quarry',file:'loading/ironwake-quarry.webp',location:'IRONWAKE QUARRY',eyebrow:'RAVEL COAST / INDUSTRIAL DISTRICT',title:'IRONWAKE<br>QUARRY.',story:'Terraced stone, steel headframes and elevated routes. Take the high ground without losing your way out.',position:'68% center'}),
  Object.freeze({id:'woods',file:'loading/sable-woods.webp',location:'SABLE WOODS',eyebrow:'RAVEL COAST / RECON DISTRICT',title:'SABLE<br>WOODS.',story:'Timber lodges, ruined checkpoints and woodland cover. Stay together when visibility closes in.',position:'64% center'}),
 ]),
});
// A shuffled bag gives every match illustration a turn; boundaries never repeat.
export function createLoadingRotation(random=Math.random){
 let bag=[],last=null;
 return {next(){
  if(!bag.length){bag=[...LOADING_ART.matches];for(let i=bag.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[bag[i],bag[j]]=[bag[j],bag[i]];}
   if(bag.at(-1).id===last)[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
  }
  const art=bag.pop();last=art.id;return art;
 }};
}
const rotation=createLoadingRotation();
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const contextLabels={boot:'INITIALIZING FIELD OPERATIONS',connect:'CONNECTING TO MATCH',enter:'DEPLOYING TO THE FRONT',spectate:'ENTERING SPECTATOR VIEW',exit:'RETURNING TO LOBBY'};
export function loadingMarkup(status='PREPARING THE FRONT',detail='Loading terrain, operators and equipment.',cancel=false,{kind='enter',art}={}){
 art??=kind==='boot'?LOADING_ART.startup:rotation.next();
 const caption=kind==='exit'?'Regroup in the lobby. Your next deployment starts there.':art.story;
 return `<div class="ravel-loading" data-loading-art="${art.id}" data-loading-kind="${kind}" style="--load-art:url('./${art.file}');--load-position:${art.position}"><div class="load-brand">RAVELFRONT<small>${art.eyebrow}</small></div><section class="load-story"><span>${art.location}</span><h1>${art.title}</h1><p>${caption}</p></section><div class="load-footer"><div class="load-state" role="status" aria-live="polite"><div class="load-context">${contextLabels[kind]||contextLabels.enter}</div><div class="load-status">${escape(status)}</div><div class="load-track" aria-hidden="true"></div><div class="load-detail">${escape(detail)}</div></div>${cancel?'<button class="load-cancel" data-action="cancel-connect">CANCEL DEPLOYMENT</button>':''}</div></div>`;
}
export const MIN_LOADING_MS=2000;
let shownAt=performance.now(),hideTimer=null,generation=0,activeArt=LOADING_ART.startup,activeKind='boot',imageReady=true,imageTimer=null,imageFinish=null,imagePromise=Promise.resolve();
function prepareImage(art,current){
 imageFinish?.();clearTimeout(imageTimer);imageReady=typeof Image==='undefined';if(imageReady){imagePromise=Promise.resolve();return imagePromise;}
 const img=new Image();img.decoding='async';
 imagePromise=new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;if(current===generation){imageReady=true;imageFinish=null;clearTimeout(imageTimer);}resolve();};imageFinish=finish;img.onload=finish;img.onerror=finish;imageTimer=setTimeout(finish,4000);img.src='./'+art.file;});
 return imagePromise;
}
export function showLoading(status,detail,{kind='enter',art}={}){
 const root=document.querySelector('#loading-screen');if(!root)return;
 // Connecting and battlefield preparation are phases of one entry, not two rolls.
 const continuing=!root.hidden&&['connect','enter','spectate'].includes(activeKind)&&['connect','enter','spectate'].includes(kind);
 activeArt=art||(kind==='boot'?LOADING_ART.startup:continuing?activeArt:rotation.next());activeKind=kind;
 clearTimeout(hideTimer);hideTimer=null;generation++;shownAt=performance.now();root.className='';root.removeAttribute('role');root.innerHTML=loadingMarkup(status,detail,false,{kind,art:activeArt});root.hidden=false;prepareImage(activeArt,generation);return activeArt;
}
export function hideLoading(force=false){
 const root=document.querySelector('#loading-screen');if(!root||root.hidden)return;
 if(!force&&!imageReady)return;
 const remaining=MIN_LOADING_MS-(performance.now()-shownAt);
 if(force||remaining<=0){clearTimeout(hideTimer);hideTimer=null;imageFinish?.();clearTimeout(imageTimer);root.hidden=true;}
 else if(hideTimer===null){const current=generation;hideTimer=setTimeout(()=>{hideTimer=null;if(current===generation)hideLoading();},remaining);}
}
export function waitForLoading(){return Promise.all([imagePromise,new Promise(resolve=>setTimeout(resolve,Math.max(0,MIN_LOADING_MS-(performance.now()-shownAt))))]);}
