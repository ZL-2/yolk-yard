const app=document.querySelector('#app');
document.querySelector('#world').hidden=true;
document.body.style.cssText='margin:0;background:#12232d;color:#eaf3f2;font-family:system-ui,sans-serif;min-height:100vh;display:grid;place-items:center';
app.innerHTML=`<main style="max-width:480px;margin:24px;padding:38px;background:#1c343f;border:1px solid #385963;border-radius:18px"><p style="color:#eeb755;letter-spacing:.2em">RAVELFRONT</p><h1>Temporarily under maintenance</h1><p style="line-height:1.7;color:#bed0d4">We’re fixing performance and connection issues. Public access is paused while we work. Please check back soon.</p><button id="admin-access" style="padding:12px 18px;border:0;border-radius:8px;background:#eeb755;color:#12232d;font-weight:700">Administrator access</button><form id="maintenance-login" hidden style="margin-top:24px"><label for="maintenance-code">Administrator code</label><input id="maintenance-code" type="password" inputmode="numeric" autocomplete="off" minlength="12" maxlength="32" required style="display:block;box-sizing:border-box;width:100%;margin:12px 0;padding:12px"><button style="padding:12px 18px">Unlock game</button></form><p id="maintenance-status" role="status" aria-live="polite"></p></main>`;
document.querySelector('#admin-access').onclick=()=>{document.querySelector('#maintenance-login').hidden=false;document.querySelector('#maintenance-code').focus();};
document.querySelector('#maintenance-login').onsubmit=async e=>{
 e.preventDefault();const button=e.target.querySelector('button'),field=document.querySelector('#maintenance-code'),status=document.querySelector('#maintenance-status');button.disabled=true;status.textContent='Verifying administrator access…';
 try{
  const endpoint=new URL(window.YOLK_NETWORK.relay);endpoint.protocol=endpoint.protocol==='wss:'?'https:':'http:';endpoint.pathname='/owner/login';
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:field.value}),signal:AbortSignal.timeout(30000)});field.value='';const result=await response.json();if(!response.ok)throw Error(result.error||'Access denied.');
  window.RAVEL_OWNER_SESSION=result.token;
  setTimeout(()=>location.reload(),Math.max(0,result.expires-Date.now()));
  document.body.style.cssText='';document.querySelector('#world').hidden=false;app.innerHTML='<div class="boot">ESTABLISHING UPLINK…</div>';await import('./main.js');
 }catch(error){field.value='';status.textContent=error.message||'Cannot verify access. Please try again.';button.disabled=false;}
};
