import {emptyLayout,validateLayout,sourceRecord,baseObjects} from './map-layout.js';
export class MapDocument{
 constructor(base,layout=emptyLayout(base.id)){this.base=base;this.layout=validateLayout(layout,base.id);this.saved=JSON.stringify(this.layout);this.undoStack=[];this.redoStack=[];this.sources=new Map(baseObjects(base).map(o=>[o.id,o]));}
 get dirty(){return JSON.stringify(this.layout)!==this.saved;}
 record(id){return this.layout.objects.find(o=>o.id===id)||this.sources.has(id)&&sourceRecord(this.sources.get(id))||null;}
 change(next){next=validateLayout(next,this.base.id);if(JSON.stringify(next)===JSON.stringify(this.layout))return false;this.undoStack.push(this.layout);if(this.undoStack.length>50)this.undoStack.shift();this.redoStack=[];this.layout=next;return true;}
 set(record){return this.change({...this.layout,objects:[...this.layout.objects.filter(o=>o.id!==record.id),record]});}
 remove(id){const r=this.record(id);if(!r)return;if(r.source&&r.id===r.source)this.set({...r,removed:true});else this.change({...this.layout,objects:this.layout.objects.filter(o=>o.id!==id)});}
 restore(id){this.change({...this.layout,objects:this.layout.objects.filter(o=>o.id!==id)});}
 undo(){if(!this.undoStack.length)return false;this.redoStack.push(this.layout);this.layout=this.undoStack.pop();return true;}
 redo(){if(!this.redoStack.length)return false;this.undoStack.push(this.layout);this.layout=this.redoStack.pop();return true;}
 markSaved(){this.saved=JSON.stringify(this.layout);}
 visibleObjects(){const map=new Map([...this.sources.values()].map(s=>[s.id,this.record(s.id)]));for(const o of this.layout.objects)map.set(o.id,o);return [...map.values()].filter(o=>!o.removed);}
}
