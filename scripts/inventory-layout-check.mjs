import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const vite=await createServer({server:{host:'127.0.0.1',port:5191,strictPort:true,watch:null}});
await vite.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1365,height:768}});
 await page.goto('http://127.0.0.1:5191/');
 await page.evaluate(()=>{
  document.body.classList.add('in-royale');
  const dialog=document.querySelector('#dialog');
  dialog.dataset.kind='royale-inventory';
  const slot=index=>`<button class="royale-slot" data-royale-slot="${index}" style="--rarity:#4b9568"><kbd>${index||'P'}</kbd><span class="empty-slot-mark">＋</span></button>`;
  dialog.innerHTML=`<div class="dialog-body"><div class="inventory-content"><section class="inventory-equipment"><div class="royale-inventory-grid">${slot(0)}<div class="royale-item-slots">${[1,2,3,4,5].map(slot).join('')}</div></div></section></div></div>`;
  dialog.showModal();
 });
 for(const width of [1365,760,620]){
  await page.setViewportSize({width,height:768});
  const layout=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,width:r.width,right:r.right};};
   const grid=document.querySelector('.royale-inventory-grid');
   return {grid:rect(grid),pickaxe:rect(grid.children[0]),group:rect(grid.children[1]),items:[...grid.querySelectorAll('.royale-item-slots .royale-slot')].map(rect)};
  });
  assert.ok(layout.group.width>layout.pickaxe.width*4.7,`item group collapsed at ${width}px`);
  assert.ok(layout.items.every(item=>Math.abs(item.width-layout.items[0].width)<.1),`unequal item slots at ${width}px`);
  assert.ok(layout.items[4].right<=layout.grid.right+.1,`inventory overflow at ${width}px`);
 }
 console.log('PASS dedicated pickaxe and five equal full-width inventory slots');
}finally{await browser.close();await vite.close();}
