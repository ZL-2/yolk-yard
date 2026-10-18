// Do not require AbortSignal.timeout: older supported Safari/Chrome versions lack it.
export async function ownerFetch(url,options={},timeout=30000){
 const controller=!options.signal&&typeof globalThis.AbortController==='function'?new AbortController():null;
 const timer=controller?setTimeout(()=>controller.abort(),timeout):null;
 try{return await fetch(url,{...options,credentials:'omit',cache:'no-store',...(options.signal?{signal:options.signal}:controller?{signal:controller.signal}:{})});}
 catch(error){throw Object.assign(Error(error?.name==='AbortError'||controller?.signal.aborted?'The game server took too long to respond. Please try again.':'Could not connect to the game server. Check your connection and try again.'),{cause:error,connectionError:true});}
 finally{if(timer!==null)clearTimeout(timer);}
}
