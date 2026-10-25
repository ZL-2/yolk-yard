import {esc,card,num} from './owner-ui.js';
export function iconOwnerView(owner){
 const data=owner.extra;
 if(!data.candidates.length)return '<p>No voting options yet.</p>';
 return '<p class="oc-notice">Editing keeps existing votes. Deleting removes the option and its votes; affected players can vote again before the deadline. Both names require at least three letters. Changes are recorded in the audit trail.</p>'+data.candidates.map(c=>card(c.first+' '+c.last+' · '+num(c.votes)+' votes',`<form id="oc-icon-${esc(c.id)}" data-id="${esc(c.id)}"><div class="oc-form-grid"><label>First name<input name="first" value="${esc(c.first)}" required minlength="3" maxlength="40"></label><label>Last name<input name="last" value="${esc(c.last)}" required minlength="3" maxlength="40"></label></div><button type="submit">Save name</button><details><summary>Delete option</summary><p>Delete ${esc(c.first)} ${esc(c.last)} and all its votes?</p><button type="button" data-icon-delete>Delete option and votes</button></details></form>`)).join('');
}
export async function submitIconOwner(owner,form,action='edit'){
 const candidate=owner.extra.candidates.find(c=>c.id===form.dataset.id);if(!candidate)return;
 const f=new FormData(form);
 await owner.post('/icon-voting',{action,id:candidate.id,expectedFirst:candidate.first,expectedLast:candidate.last,first:f.get('first'),last:f.get('last')});
 await owner.refresh();owner.notify(action==='delete'?'Option and its votes deleted.':'Name updated. Existing votes preserved.');
}
