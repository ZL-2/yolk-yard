// Keep marker nodes alive while only their position or distance changes. Apart
// from avoiding HTML parsing, this prevents screen readers announcing the
// entire team on every HUD refresh.
export class WorldMarkers {
 constructor(root){this.root=root;root.setAttribute('aria-live','off');this.nodes=new Map();}
 update(markers){
  const seen=new Set();
  for(const marker of markers){
   seen.add(marker.id);let row=this.nodes.get(marker.id);
   if(!row){
    const element=document.createElement('div'),icon=document.createElement('b'),label=document.createElement('span'),name=document.createElement('small');
    element.append(icon,label,name);this.root.append(element);row={element,icon,label,name};this.nodes.set(marker.id,row);
   }
   const {element}=row,kind='duo-world-marker '+marker.kind;
   if(element.className!==kind)element.className=kind;
   const transform=`translate3d(${marker.x.toFixed(2)}vw,${marker.y.toFixed(2)}vh,0) translate(-50%,-50%)`;
   if(element.style.transform!==transform)element.style.transform=transform;
   if(row.color!==marker.color){element.style.setProperty('--team-color',marker.color);row.color=marker.color;}
   for(const key of ['icon','label','name']){const text=String(marker[key]??'');if(row[key].textContent!==text)row[key].textContent=text;}
  }
  for(const [id,row]of this.nodes)if(!seen.has(id)){row.element.remove();this.nodes.delete(id);}
 }
}
