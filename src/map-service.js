import {installPublishedLayouts} from './maps.js';
export function mapServiceUrl(){
 try{const u=new URL(globalThis.window?.YOLK_NETWORK?.relay);u.protocol=u.protocol==='wss:'?'https:':'http:';u.pathname='';u.search='';u.hash='';return u.href.replace(/\/$/,'');}catch{return null;}
}
let refreshed=0,pending=null;
export async function refreshPublishedMaps(force=false){
 const endpoint=mapServiceUrl();if(!endpoint||!force&&Date.now()-refreshed<15000)return;
 if(pending)return pending;
 pending=(async()=>{try{const r=await fetch(endpoint+'/maps',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(r.status===404)return;if(!r.ok)throw Error('Map service unavailable');const data=await r.json();installPublishedLayouts(data.layouts||{});refreshed=Date.now();}catch(error){console.warn('Published maps could not refresh:',error.message);}finally{pending=null;}})();return pending;
}
export const mapAssetUrl=id=>mapServiceUrl()+'/map-assets/'+id+'.glb';
