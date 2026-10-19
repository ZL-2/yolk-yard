// Only bounded, explicitly selected diagnostics enter the support inbox.
export function problemText(context={},notes=''){
 const clean=(v,n)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').slice(0,n);
 return `[PROBLEM REPORT]\n${clean(context.title,80)}\n${clean(context.message,380)}\nBuild: ${clean(context.build,45)} | Mode: ${clean(context.mode,20)} | Screen: ${clean(context.screen,15)} | Room: ${clean(context.room,12)}\nConnection: ${clean(context.connection,30)} | Ping: ${clean(context.ping,8)} ms${context.transport?'\nTransport: '+clean(context.transport,110):''}\nPlayer notes: ${clean(notes,300)}`.slice(0,1000);
}
export function captureDialogPosition(dialog){
 const nodes=[dialog,...dialog.querySelectorAll('.dialog-body,.social-list,.social-panel')];
 return nodes.map(node=>({selector:node===dialog?null:node.className,top:node.scrollTop,left:node.scrollLeft}));
}
export function restoreDialogPosition(dialog,positions){
 for(const p of positions){const node=p.selector?[...dialog.querySelectorAll('.dialog-body,.social-list,.social-panel')].find(n=>n.className===p.selector):dialog;if(node){node.scrollTop=p.top;node.scrollLeft=p.left;}}
}
