import {ownerApi} from './owner-console.js';
// Public operations policy contains no owner credentials or private analytics.
export class OwnerRuntime{
 constructor(){this.value=null;this.banner=document.createElement('aside');this.banner.className='owner-service-notice';this.banner.hidden=true;this.banner.setAttribute('role','status');document.body.append(this.banner);const api=ownerApi();if(api)void fetch(api+'/public',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(p=>{if(p)this.set(p);}).catch(()=>{});this.timer=setInterval(()=>this.render(),15000);}
 set(value){if(!value||!Number.isSafeInteger(value.revision)||this.value&&value.revision<this.value.revision)return;this.value=value;this.render();}
 render(){const p=this.value,a=p?.announcement,now=Date.now();const text=p?.maintenance?p.maintenanceMessage:a&&a.starts<=now&&a.ends>now?a.text:'';this.banner.textContent=text||'';this.banner.dataset.tone=p?.maintenance?'warning':a?.tone||'info';this.banner.hidden=!text||!!document.querySelector('dialog[open]');}
 admission(mode,access='private'){if(this.value?.maintenance)throw Error(this.value.maintenanceMessage);if(this.value?.modes?.[mode]?.[access]===false)throw Error('This mode is temporarily unavailable.');}
}
