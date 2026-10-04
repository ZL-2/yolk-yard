// Includes the open world to the left of the equipment panel, beyond the dialog.
export function inventoryDropTarget(root,x,y){
 const slot=root.querySelector('.royale-inventory-grid'),bounds=slot?.getBoundingClientRect();
 const hit=root.ownerDocument.elementFromPoint(x,y);
 const target=hit?.closest('[data-royale-slot]');
 if(target)return {kind:'swap',slot:Number(target.dataset.royaleSlot)};
 if(bounds&&x<bounds.left&&x>=0&&y>=0&&y<=root.ownerDocument.documentElement.clientHeight)return {kind:'drop'};
 if(hit?.closest('[data-inventory-drop]'))return {kind:'drop'};
 return null;
}
