import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const items=[['pickaxe','SIXTY DEGREES','60° golf club'],['wrap','CUBA WATERMELON','Branded watermelon wrap'],['backbling','CROWN RUSSE','Crown Russe vodka bottle'],['glider','BEDTIME FLIGHT','Sleeping-bag glider'],['trail','WHITE GOO','Flowing white dive trail']];
const inputs=await Promise.all(items.map(async row=>[...row,'data:image/png;base64,'+(await readFile('art/icon-bundle/validation/'+row[0]+'-render.png')).toString('base64')]));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/tmp/input-browser-extract/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.setContent('<canvas id="board" width="2100" height="1080"></canvas>');
 const data=await page.evaluate(async inputs=>{
  const c=document.querySelector('canvas'),ctx=c.getContext('2d');ctx.fillStyle='#eef0e7';ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle='#254338';ctx.font='800 26px sans-serif';ctx.fillText('RAVEL FRONT',54,68);ctx.font='600 14px sans-serif';ctx.fillStyle='#698165';ctx.fillText('ICON SERIES / EQUIPMENT REVIEW 01',54,109);
  ctx.fillStyle='#243a30';ctx.font='600 74px Georgia';ctx.fillText('Jim’s off-duty kit.',50,202);ctx.font='500 22px sans-serif';ctx.fillStyle='#71836c';ctx.fillText('Five native game accessories. Rotate and replay them in the interactive review.',54,249);
  ctx.fillStyle='#294a38';ctx.beginPath();ctx.roundRect(1690,46,355,47,24);ctx.fill();ctx.font='700 14px sans-serif';ctx.fillStyle='#daf2af';ctx.textAlign='center';ctx.fillText('FOR REVIEW · NOT DEPLOYED',1867,76);ctx.textAlign='left';
  for(let n=0;n<inputs.length;n++){
   const [slot,name,desc,url]=inputs[n],image=new Image();image.src=url;await image.decode();const raw=document.createElement('canvas');raw.width=image.width;raw.height=image.height;const q=raw.getContext('2d');q.drawImage(image,0,0);const pixels=q.getImageData(0,0,raw.width,raw.height).data;let left=raw.width,top=raw.height,right=0,bottom=0;
   for(let y=0;y<raw.height;y++)for(let x=0;x<raw.width;x++)if(pixels[(y*raw.width+x)*4+3]>55){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   const x=52+n*405,y=302,w=382,h=654,dark=slot==='trail';ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,17);ctx.fillStyle=dark?'#294039':'#e3e8dc';ctx.fill();ctx.clip();
   const gradient=ctx.createRadialGradient(x+w*.4,y+h*.3,0,x+w*.4,y+h*.3,w*1.2);gradient.addColorStop(0,dark?'#40574c':'#f9faed');gradient.addColorStop(1,dark?'#1a2c25':'#dce3d3');ctx.fillStyle=gradient;ctx.fillRect(x,y,w,h);
   ctx.fillStyle=dark?'#c4d9b1':'#647e5d';ctx.font='600 12px sans-serif';ctx.fillText('0'+(n+1)+' / '+({pickaxe:'PICKAXE',wrap:'WEAPON WRAP',backbling:'BACK ACCESSORY',glider:'GLIDER',trail:'DIVE TRAIL'}[slot]),x+22,y+33);
   const iw=right-left+1,ih=bottom-top+1,s=Math.min((w-38)/iw,490/ih),dw=iw*s,dh=ih*s;ctx.drawImage(image,left,top,iw,ih,x+(w-dw)/2,y+69+(490-dh)/2,dw,dh);ctx.restore();
   ctx.fillStyle=dark?'#f3f7e9':'#294335';ctx.font='800 20px sans-serif';ctx.fillText(name,x+22,y+594);ctx.font='400 14px sans-serif';ctx.fillStyle=dark?'#b9cbb2':'#728568';ctx.fillText(desc,x+22,y+620);
  }
  ctx.fillStyle='#6e8067';ctx.font='400 16px sans-serif';ctx.fillText('Actual model renders · Outfit handled separately · CUBA Watermelon / Crown Russe fan concept',54,1007);ctx.font='700 15px sans-serif';ctx.fillStyle='#375b3b';ctx.textAlign='right';ctx.fillText('OPEN JIM-BUNDLE-REVIEW.HTML TO INSPECT',2047,1007);
  return c.toDataURL('image/png');
 },inputs);
 const output=process.argv[2]||'art/icon-bundle/validation/Jim-Bundle-Preview.png';await writeFile(output,Buffer.from(data.split(',')[1],'base64'));console.log(output);
}finally{await browser.close();}
