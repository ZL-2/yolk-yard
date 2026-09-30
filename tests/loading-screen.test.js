import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadingMarkup,showLoading,hideLoading} from '../src/loading-screen.js';
test('loading presentation includes status and cancellable match connection without false percentages',()=>{
 const html=loadingMarkup('CONNECTING','Preparing room',true);
 assert.ok(html.includes('RAVELFRONT')&&html.includes('role="status"')&&html.includes('cancel-connect'));
 assert.ok(!loadingMarkup().includes('cancel-connect'));assert.ok(!html.includes('%'));
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
 const css=readFileSync(new URL('../public/loading.css',import.meta.url),'utf8');
 assert.ok(css.includes('prefers-reduced-motion')&&css.includes('[hidden]'));
});
test('a completed load stays visible for two seconds and then dismisses',async()=>{
 const root={hidden:true,removeAttribute(){}};globalThis.document={querySelector:()=>root};
 showLoading('READY','Ready');const started=performance.now();hideLoading();
 assert.equal(root.hidden,false);await new Promise(resolve=>setTimeout(resolve,2050));
 assert.ok(performance.now()-started>=2000);assert.equal(root.hidden,true);delete globalThis.document;
});
