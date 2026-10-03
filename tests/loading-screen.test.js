import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOADING_ART,createLoadingRotation,loadingMarkup,showLoading,hideLoading} from '../src/loading-screen.js';
test('loading presentation includes status and cancellable match connection without false percentages',()=>{
 const html=loadingMarkup('CONNECTING','Preparing room',true);
 assert.ok(html.includes('RAVELFRONT')&&html.includes('role="status"')&&html.includes('cancel-connect'));
 assert.ok(!loadingMarkup().includes('cancel-connect'));assert.ok(!/>\s*\d+(?:\.\d+)?%\s*</.test(html));
});
test('loading screen show, ready and failure paths are reversible',()=>{
 const root={hidden:true,className:'ravel-loading',removeAttribute(){}};
 globalThis.document={querySelector:()=>root};
 showLoading('DEPLOYING','Preparing terrain');assert.equal(root.hidden,false);assert.ok(root.innerHTML.includes('DEPLOYING'));
 hideLoading();assert.equal(root.hidden,false);
 hideLoading(true);assert.equal(root.hidden,true);delete globalThis.document;
});
test('startup markup and reduced-motion rules are available before game JavaScript',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('id="loading-screen"')&&html.includes('./loading.css'));
 assert.ok(html.includes('data-loading-art="startup"')&&html.includes('loading/kestrel-airstrip.webp'));
 const css=readFileSync(new URL('../public/loading.css',import.meta.url),'utf8');
 assert.ok(css.includes('prefers-reduced-motion')&&css.includes('[hidden]'));
});
test('four-art match rotation includes the original, excludes startup, and never repeats at a bag boundary',()=>{
 for(const random of [()=>0,()=>.99,Math.random]){const rotation=createLoadingRotation(random);let previous=null;
  for(let batch=0;batch<20;batch++){const seen=new Set();for(let i=0;i<4;i++){const art=rotation.next();assert.notEqual(art.id,'startup');assert.notEqual(art.id,previous);seen.add(art.id);previous=art.id;}assert.deepEqual([...seen].sort(),['coast','docks','quarry','woods']);}
 }
});
test('startup is fixed and all transition contexts preserve actual status text with escaping',()=>{
 for(const kind of ['boot','connect','enter','spectate','exit']){const html=loadingMarkup('Ready <now>','Wait & regroup',kind==='connect',{kind});assert.ok(html.includes('Ready &lt;now&gt;'));assert.ok(html.includes('Wait &amp; regroup'));assert.ok(html.includes('data-loading-kind="'+kind+'"'));if(kind==='boot')assert.ok(html.includes('data-loading-art="startup"'));if(kind==='exit')assert.ok(html.includes('RETURNING TO LOBBY')&&html.includes('Regroup in the lobby.'));}
});
test('entry phases retain their image but returning to lobby rolls a new match image',()=>{
 const root={hidden:true,removeAttribute(){}};globalThis.document={querySelector:()=>root};
 try{const connection=showLoading('CONNECTING','Room',{kind:'connect'}),entry=showLoading('DEPLOYING','Map',{kind:'enter'});assert.equal(entry.id,connection.id);const exit=showLoading('RETURNING','Lobby',{kind:'exit'});assert.notEqual(exit.id,entry.id);assert.notEqual(exit.id,'startup');hideLoading(true);}finally{delete globalThis.document;}
});
test('the four new project assets are optimized WebP and the original art stays in use',()=>{
 for(const art of [LOADING_ART.startup,...LOADING_ART.matches]){const bytes=readFileSync(new URL('../public/'+art.file,import.meta.url));assert.ok(bytes.length>100000&&bytes.length<550000);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
});
test('a completed load stays visible for two seconds and then dismisses',async()=>{
 const root={hidden:true,removeAttribute(){}};globalThis.document={querySelector:()=>root};
 showLoading('READY','Ready');const started=performance.now();hideLoading();
 assert.equal(root.hidden,false);await new Promise(resolve=>setTimeout(resolve,2050));
 assert.ok(performance.now()-started>=2000);assert.equal(root.hidden,true);delete globalThis.document;
});
