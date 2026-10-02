import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Network} from '../src/network.js';
import {VERSION} from '../src/data.js';

function channel(){
 const conn=new EventEmitter();Object.assign(conn,{peer:'guest',open:true,sent:[],send(m){this.sent.push(m);},close(){this.open=false;this.emit('close');}});return conn;
}
test('private host survives queued 60 Hz controls after an eight-second renderer stall',t=>{
 let now=0,inputs=0;t.mock.method(performance,'now',()=>now);
 const net=new Network({onJoin:()=>true,onInput:()=>inputs++}),conn=channel();t.after(()=>net.destroy());
 net.accept(conn);conn.emit('data',{type:'hello',version:VERSION,profile:{name:'Guest'}});
 now=8000;
 for(let seq=1;seq<=480;seq++)conn.emit('data',{type:'input',input:{seq,forward:1}});
 assert.equal(conn.open,true,'a delayed host frame cannot evict its guest');assert.equal(inputs,480);
 now+=1000;conn.emit('data',{type:'ping',time:now});assert.equal(conn.sent.at(-1).type,'pong');
});
test('private host still bounds sustained packet floods',t=>{
 let now=0;t.mock.method(performance,'now',()=>now);
 const net=new Network({onJoin:()=>true}),conn=channel();t.after(()=>net.destroy());
 net.accept(conn);conn.emit('data',{type:'hello',version:VERSION,profile:{name:'Guest'}});
 for(let seq=1;seq<=2000&&conn.open;seq++){now+=1;conn.emit('data',{type:'input',input:{seq}});}
 assert.equal(conn.open,false,'a sustained 1000-packet/s flood is rejected');
});
test('full private matches receive 48 contestants, 16 spectators and the boss',async t=>{
 let received=0;const net=new Network({onState:()=>received++}),conn=channel();t.after(()=>net.destroy());
 net.makePeer=async()=>{net.peer={protocol:2,connect:()=>conn,destroy(){}};};
 const joining=net.join('ABCDEFGH',{name:'Guest'});await Promise.resolve();
 conn.emit('open');conn.emit('data',{type:'welcome',version:VERSION,id:'guest',members:[]});await joining;
 const players=Array.from({length:65},(_,i)=>({id:String(i),name:'Operator '+i}));
 const state={version:VERSION,players,options:{mode:'royale',capacity:48},events:[]};
 conn.emit('data',{type:'state',state});assert.equal(received,1);
 conn.emit('data',{type:'state',state:{...state,players:[...players,{id:'extra'}]}});assert.equal(received,1,'unbounded extra actors remain rejected');
});
