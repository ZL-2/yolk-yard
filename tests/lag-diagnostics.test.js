import test from 'node:test';
import assert from 'node:assert/strict';
import {publicDiagnosticsActive,summarize,LagDiagnostics} from '../src/lag-diagnostics.js';
test('diagnostics are public-game only, not lobby, private or training',()=>{
 assert.equal(publicDiagnosticsActive('game',{options:{recurring:true}}),true);
 for(const screen of ['menu','lobby','editor'])assert.equal(publicDiagnosticsActive(screen,{options:{recurring:true}}),false);
 assert.equal(publicDiagnosticsActive('game',{options:{training:true}}),false);
 assert.equal(publicDiagnosticsActive('game',{options:{recurring:false}}),false);
});
test('bounded summaries ignore invalid values and calculate real frame peaks',()=>{
 assert.deepEqual(summarize([]),{mean:0,p95:0,max:0});
 assert.deepEqual(summarize([10,20,30,NaN]),{mean:20,p95:20,max:30});
});
test('panel updates public data without identities and expires old client spikes',()=>{
 const old={document:globalThis.document,window:globalThis.window};
 const nodes=new Map(),root={hidden:true,querySelector:s=>{if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);}};
 globalThis.document={hidden:false,createElement:()=>root};globalThis.window={addEventListener(){}};
 try{
  const panel=new LagDiagnostics({append(){}}),state={options:{recurring:true},phase:'playing',players:[{name:'DO NOT DISPLAY'}],network:{timing:{phases:{battle:{stepMaxMs:18,stepCpuAtMaxMs:12,broadcastMaxMs:4,gapMaxMs:70}}}}},report={network:{samples:[],acks:[]},performance:{updates:[],pending:0}};
  panel.update(1000,150,8,4,state,null,null,report,'game');assert.equal(root.hidden,false);
  assert.match(nodes.get('.lag-client').textContent,/150.0 ms/);assert.match(nodes.get('.lag-server').textContent,/18.0 ms/);
  assert.doesNotMatch([...nodes.values()].map(n=>n.textContent).join(''),/DO NOT DISPLAY/);
  panel.update(12000,16,3,2,state,null,null,report,'game');assert.equal(panel.samples.length,1);
  panel.update(13000,16,3,2,state,null,null,report,'menu');assert.equal(root.hidden,true);
 }finally{globalThis.document=old.document;globalThis.window=old.window;}
});
