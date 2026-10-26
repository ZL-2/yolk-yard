// Clone an authored prop without rebuilding/baking every small part. Three's
// default userData clone serializes Object3D sockets rather than remapping them;
// retain live, independent muzzle/reload/lens references instead.
export function cloneModelTemplate(source){
 const nodes=new Map();
 function copy(node){
  const data=node.userData;let result;
  node.userData={};
  try{result=node.clone(false);}finally{node.userData=data;}
  nodes.set(node,result);
  if(node.userData.ownedMaterial){result.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();}
  for(const child of node.children)result.add(copy(child));
  return result;
 }
 const result=copy(source);
 function remap(value){
  if(!value||typeof value!=='object')return value;
  if(nodes.has(value))return nodes.get(value);
  if(value.clone)return value.clone();
  if(Array.isArray(value))return value.map(remap);
  return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,remap(v)]));
 }
 for(const [node,clone]of nodes)clone.userData=remap(node.userData);
 return result;
}
