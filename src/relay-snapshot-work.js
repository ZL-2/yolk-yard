import {SnapshotBatch} from './snapshot-codec.js';
// One broadcast owns this memo. Detached player rows, world arrays and the
// recovery checkpoint can be measured/normalized once across all recipients.
// Sizes exactly match JSON.stringify(...).length; queue limits do not change.
export class RelaySnapshotWork{
 constructor(){this.batch=new SnapshotBatch();this.sizes=new WeakMap();this.records=new WeakMap();this.lists=new WeakMap();}
 value(value){
  if(value&&typeof value==='object'){
   if(!this.sizes.has(value))this.sizes.set(value,JSON.stringify(value).length);
   return this.sizes.get(value);
  }
  const json=JSON.stringify(value);return json===undefined?undefined:json.length;
 }
 list(rows){
  if(!this.lists.has(rows)){let size=2+Math.max(0,rows.length-1);for(const row of rows)size+=this.value(row)??4;this.lists.set(rows,size);}
  return this.lists.get(rows);
 }
 record(source,kind){
  if(this.records.has(source))return this.records.get(source);
  let size=2,count=0;
  for(const [key,value]of Object.entries(source)){
   let bytes;
   if(!value||typeof value!=='object')bytes=this.value(value);
   else if(kind==='envelope'&&key==='data')bytes=this.record(value,'message');
   else if(kind==='message'&&key==='state')bytes=this.record(value,'state');
   else if(kind==='state'&&key==='royale')bytes=this.record(value,'world');
   else if(kind==='state'&&key==='players'&&Array.isArray(value))bytes=this.list(value);
   else bytes=this.value(value);
   if(bytes===undefined)continue;
   size+=JSON.stringify(key).length+1+bytes+(count++?1:0);
  }
  this.records.set(source,size);return size;
 }
 measure(message){return this.record(message,'envelope');}
}
