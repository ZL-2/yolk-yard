import {esc,card,num} from './owner-ui.js';
export function iconOwnerView(owner){
 const data=owner.extra;if(!data?.categories)return '<p>The archived results are loading.</p>';
 return `<p class="oc-notice"><b>${esc(data.winner)} is the Icon Series winner.</b> Bundle voting has ended. These results are archived; players can enter games without voting.</p>`+data.categories.map(c=>card(c.label,c.options.length?`<ol>${[...c.options].sort((a,b)=>b.votes-a.votes).map(o=>`<li><strong>${esc(o.text)}</strong> · ${num(o.votes)} votes</li>`).join('')}</ol>`:'<p>No recorded options.</p>')).join('');
}
export async function submitIconOwner(){throw Error('The bundle vote has ended. Archived results cannot be edited.');}
