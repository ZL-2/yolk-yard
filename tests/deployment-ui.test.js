import test from 'node:test';
import assert from 'node:assert/strict';
import {DeploymentUI} from '../src/deployment-ui.js';
test('published readiness clears a persisted screen, refreshes once, and survives blocked status HTTP',async()=>{
 const original={window:globalThis.window,location:globalThis.location,document:globalThis.document,sessionStorage:globalThis.sessionStorage};
 let removed=0,latch='1',frontend='new',refreshes=[];
 Object.assign(globalThis,{window:{YOLK_NETWORK:{relay:'wss://relay.example/game'}},location:{href:'https://example.com/game/?build=old'},document:{querySelector:()=>({remove:()=>removed++})},sessionStorage:{removeItem:()=>{latch=null;}}});
 const ui=Object.assign(Object.create(DeploymentUI.prototype),{build:'old',active:true,onReady:b=>refreshes.push(b),fetcher:async url=>{if(String(url).includes('/deployment'))throw Error('network blocked');return {ok:true,json:async()=>({build:frontend})};}});
 try{
  ui.readyStatus={updating:false,build:'new'};
  await ui.check();assert.deepEqual(refreshes,['new']);assert.equal(latch,null);await ui.check();assert.equal(refreshes.length,1,'no reload loop');
  ui.refreshing=false;ui.build='new';ui.active=true;latch='1';await ui.verify(ui.readyStatus);assert.equal(ui.active,false);assert.equal(removed,1);assert.equal(latch,null);assert.equal(refreshes.at(-1),null);
  ui.active=true;frontend='old';await ui.verify(ui.readyStatus);assert.equal(ui.active,true,'incomplete Pages deployment stays blocked');
  ui.readyStatus={updating:true,build:'new'};frontend='new';await ui.verify(ui.readyStatus);assert.equal(ui.active,true,'server still updating stays blocked');
  let release;ui.fetcher=async()=>({ok:true,json:()=>new Promise(resolve=>{release=resolve;})});ui.readyStatus={updating:false,build:'new'};const pending=ui.verify(ui.readyStatus);await Promise.resolve();ui.readyStatus={updating:true,build:'next'};release({build:'new'});await pending;assert.equal(ui.active,true,'new update supersedes old ready request');
 }finally{Object.assign(globalThis,original);}
});
