// Manual popovers enter the browser's top layer, above modal dialogs and lobby
// panels. Re-promote if another modal opens while a message is still visible.
export function showFrontMessage(node,text){
 node.textContent=text;prepareFrontMessage(node);node.style.opacity='1';
 if(node.showPopover){node.setAttribute('popover','manual');if(node.matches(':popover-open'))node.hidePopover();node.showPopover();node._frontDialog=document.querySelector('dialog[open]');}
}
export function prepareFrontMessage(node){
 node.setAttribute('role','status');node.setAttribute('aria-live','polite');
 document.body.append(node);node.dataset.frontMessage='true';if(node.showPopover)node.setAttribute('popover','manual');
}
export function updateFrontMessage(node,visible){
 if(node.dataset.frontMessage!=='true')return;
 node.style.opacity=visible?'1':'0';
 if(node.showPopover){const open=node.matches(':popover-open');if(!visible&&open)node.hidePopover();else if(visible){const dialog=document.querySelector('dialog[open]');if(!open||dialog!==node._frontDialog){if(open)node.hidePopover();node.showPopover();node._frontDialog=dialog;}}}
}
