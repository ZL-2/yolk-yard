import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Exercise the production CSS without loading an unrelated multiplayer match.
const browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox']});
try {
 const page=await browser.newPage();
 await page.setContent('<body class="in-game"><div id="hud"><div id="scope" class="scope" data-overlay="precision" data-reticle="mil-dot" style="display:block"></div></div></body>');
 await page.addStyleTag({content:await readFile('src/style.css','utf8')});
 for(const [width,height] of [[1280,720],[1920,1080],[2560,1080],[1365,767]]){
  await page.setViewportSize({width,height});
  for(const reticle of ['mil-dot','chevron'])for(const fontSize of ['16px','32px']){
   const point=await page.evaluate(({reticle,fontSize})=>{
    const scope=document.querySelector('#scope');scope.dataset.reticle=reticle;
    scope.dataset.overlay=reticle==='chevron'?'prism':'precision';
    scope.style.fontFamily='serif';scope.style.fontSize=fontSize;
    const rect=scope.getBoundingClientRect(),mark=getComputedStyle(scope,'::after'),matrix=new DOMMatrix(mark.transform);
    const w=parseFloat(mark.width),h=parseFloat(mark.height);
    return {x:rect.left+parseFloat(mark.left)+matrix.e+w/2,
     y:rect.top+parseFloat(mark.top)+matrix.f+(reticle==='mil-dot'?h/2:0),
     content:mark.content,clip:mark.clipPath,shadow:mark.boxShadow};
   },{reticle,fontSize});
   assert.equal(point.content,'""','reticle must not depend on a font glyph');
   assert.ok(Math.abs(point.x-width/2)<.01,`${reticle} horizontal center at ${width}x${height}`);
   assert.ok(Math.abs(point.y-height/2)<.01,`${reticle} aim point vertical center at ${width}x${height}`);
   if(reticle==='chevron')assert.match(point.clip,/^polygon\(50% 0px,/,'chevron tip must be at top center');
   else for(const offset of [-48,-24,24,48])assert.ok(point.shadow.includes(`${offset}px 0px`),'symmetric mil dots');
  }
 }
 console.log('PASS sniper dot and burst chevron aim points centered at four desktop sizes, independent of font metrics');
} finally {await browser.close();}
