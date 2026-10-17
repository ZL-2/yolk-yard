import {BOX_ARENAS} from './box-fight-rules.js';
export const BOX_MAPS=BOX_ARENAS.map(a=>{
 const box=(id,x,y,z,w,h,d)=>({objectId:id,x,y,z,w,h,d,material:'metal',color:0x243849,indestructible:true,buildBlocking:true});
 const boxes=[box('box-west',-a.width/2-.3,0,0,.6,8.4,a.depth+1.2),box('box-east',a.width/2+.3,0,0,.6,8.4,a.depth+1.2),box('box-north',0,0,-a.depth/2-.3,a.width,.8+7.6,.6),box('box-south',0,0,a.depth/2+.3,a.width,8.4,.6),box('box-ceiling',0,8,0,a.width,.4,a.depth),box('box-divider',0,0,0,a.width,8,.2)];
 return {id:a.id,name:a.name,theme:'boxfight',size:Math.max(a.width,a.depth)/2+5,sky:0x111d2c,ground:0x293e4f,boxArena:a,navCell:2,boxes,authored:boxes,buildBounds:{minX:-a.width/2,maxX:a.width/2,minZ:-a.depth/2,maxZ:a.depth/2,maxY:8},buildLimit:240,spawns:[[-a.width/2+2,-a.depth/2+2],[a.width/2-2,a.depth/2-2]],bases:[[0,-a.depth/2+2],[0,a.depth/2-2]],pickups:[],roads:[],trees:[],props:[],buildings:[],landmarks:[],districts:[{id:a.id,name:a.name,x:0,z:0}],doors:[],floorLoot:[]};
});
export function boxMap(id){const base=BOX_MAPS.find(m=>m.id===id)||BOX_MAPS[0];return {...base,boxes:base.authored.map(b=>({...b})),authored:base.authored.map(b=>({...b}))};}
