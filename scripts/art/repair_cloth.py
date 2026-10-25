"""Blend clean garment color around limb sides, then bake into the body atlas.

The construction sheet's side silhouettes do not exactly match the mesh.
Preserve front/back detail and metalwork while removing gray studio-background
projection from the side of fabric sleeves and trousers. No runtime shader cost.
"""
import bpy
from mathutils import Vector

def repair_cloth(body,finish,leg_uv,sleeve_uv,glove_uv,operator=None):
 if finish is None:return
 material=body.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links
 texture=next(n for n in nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='sRGB')
 original=texture.image;uv_name=body.data.uv_layers.active.name
 coords=[u.uv.copy() for u in body.data.uv_layers.active.data]
 weights=[0.]*len(coords);samples=[leg_uv]*len(coords);height,width=finish.shape[:2]
 # Continue the adjacent cloth across projected studio-background cape edges.
 # Keep the source height and UV corner order so the weave and gradient join.
 if operator in ['rank-10','rank-5','rank-1']:
  navy_faces=set();rgb=None
  if operator=='rank-1':
   import numpy as np
   W,H=original.size
   rgb=np.empty(len(original.pixels),dtype=np.float32)
   original.pixels.foreach_get(rgb)
   rgb=rgb.reshape(H,W,4)
  parent=list(range(len(body.data.vertices)))
  def find(i):
   while parent[i]!=i:
    parent[i]=parent[parent[i]]
    i=parent[i]
   return i
  for edge in body.data.edges:
   a,b=map(find,edge.vertices)
   if a!=b:parent[a]=b
  rows={}
  for v in body.data.vertices:
   key=find(v.index);z=round(v.co.z,4)
   row=rows.setdefault(key,{})
   row[z]=max(row.get(z,0),abs(v.co.x))
  rows={key:sorted(row.items()) for key,row in rows.items()}
  candidates=[];border=[];faces=[]
  for p in body.data.polygons:
   vs=[body.data.vertices[i] for i in p.vertices]
   center=sum((v.co for v in vs),Vector())/len(vs)
   if not (.25<center.z<1.5 and center.y>.085):continue
   if any(any(body.vertex_groups[g.group].name not in ['chest','root'] for g in v.groups if g.weight>.001) for v in vs):continue
   if not any(any(body.vertex_groups[g.group].name=='root' and g.weight>.001 for g in v.groups) for v in vs):continue
   key=find(p.vertices[0]);edge_width=0
   faces.append((p,center.copy(),key))
   gray=True
   if rgb is not None:
    color=np.mean([rgb[max(0,min(H-1,int(coords[i].y*H))),max(0,min(W-1,int(coords[i].x*W))),:3] for i in p.loop_indices],axis=0)
    if color[2]-color[0]>.025 and color[2]-color[1]>.01:navy_faces.add(p.index)
    gray=min(color)>.03 and max(color)-min(color)<.04 and center.z>.65
   for (a,x),(b,y) in zip(rows[key],rows[key][1:]):
    if a<=center.z<=b:
     edge_width=x+(y-x)*(center.z-a)/(b-a)
     break
   for i in p.loop_indices:
    candidates.append((body.data.vertices[body.data.loops[i].vertex_index].co.copy(),coords[i],key))
   if edge_width and abs(center.x)>.78*edge_width and gray:border.append((p,center,key,edge_width))
  for p,center,key,edge_width in border:
   if operator in ['rank-5','rank-1']:
    x=center.x-(1 if center.x>0 else -1)*edge_width*.20
    local=[f for f in faces if f[2]==key and len(f[0].loop_indices)==len(p.loop_indices) and (operator!='rank-1' or f[0].index in navy_faces)]
    if not local:continue
    target=min(local,key=lambda f:abs(f[1].z-center.z)*8+abs(f[1].x-x))[0]
    for i,j in zip(p.loop_indices,target.loop_indices):weights[i]=1;samples[i]=coords[j]
    continue
   local=[c for c in candidates if c[2]==key]
   if not local:continue
   for i in p.loop_indices:
    v=body.data.vertices[body.data.loops[i].vertex_index]
    x=v.co.x-(1 if center.x>0 else -1)*edge_width*.20
    uv=min(local,key=lambda c:abs(c[0].z-v.co.z)*8+abs(c[0].x-x))[1]
    weights[i]=1;samples[i]=uv
  del rgb
 for p in body.data.polygons:
  v=body.data.vertices[p.vertices[0]];names=[body.vertex_groups[g.group].name for g in v.groups if g.weight>.3]
  arms=any(n.startswith(('arm','forearm')) for n in names)
  hands=any(n.startswith(('hand','finger')) for n in names)
  legs=any(n.startswith(('thigh','shin','foot')) for n in names)
  if not (arms or hands or legs):continue
  u=sum((coords[i] for i in p.loop_indices),Vector((0,0)))/len(p.loop_indices)
  physical=finish[max(0,min(height-1,int(u.y*height))),max(0,min(width-1,int(u.x*width))),:3]
  if physical[2]>.1 or physical[1]<.70:continue
  for i in p.loop_indices:
   v=body.data.vertices[body.data.loops[i].vertex_index]
   t=max(0,min(1,(abs(v.normal.x)-.35)/.45));weights[i]=t*t*(3-2*t)
   samples[i]=glove_uv if hands else sleeve_uv if arms else leg_uv
 repair_uv=body.data.uv_layers.new(name='ClothColor')
 for u,c in zip(repair_uv.data,samples):u.uv=c
 color=body.data.color_attributes.new(name='ClothBlend',type='FLOAT_COLOR',domain='CORNER')
 for c,w in zip(color.data,weights):c.color=(w,w,w,1)
 base_uv=nodes.new('ShaderNodeUVMap');base_uv.uv_map=uv_name;links.new(base_uv.outputs[0],texture.inputs['Vector'])
 sample=nodes.new('ShaderNodeTexImage');sample.image=original
 sample_uv=nodes.new('ShaderNodeUVMap');sample_uv.uv_map='ClothColor';links.new(sample_uv.outputs[0],sample.inputs['Vector'])
 factor=nodes.new('ShaderNodeVertexColor');factor.layer_name='ClothBlend'
 mix=nodes.new('ShaderNodeMixRGB');links.new(factor.outputs['Color'],mix.inputs[0]);links.new(texture.outputs['Color'],mix.inputs[1]);links.new(sample.outputs['Color'],mix.inputs[2])
 emit=nodes.new('ShaderNodeEmission');links.new(mix.outputs[0],emit.inputs['Color'])
 output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL');bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');links.new(emit.outputs[0],output.inputs['Surface'])
 atlas=bpy.data.images.new('Continuous garment albedo 216',width=original.size[0],height=original.size[1],alpha=False);atlas.colorspace_settings.name='sRGB'
 target=nodes.new('ShaderNodeTexImage');target.image=atlas;nodes.active=target
 body.data.uv_layers.active=body.data.uv_layers[uv_name]
 bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.margin=8
 bpy.ops.object.bake(type='EMIT');atlas.pack();links.new(bs.outputs[0],output.inputs['Surface'])
 texture.image=atlas
 for node in [base_uv,sample,sample_uv,factor,mix,emit,target]:nodes.remove(node)
 body.data.uv_layers.remove(body.data.uv_layers['ClothColor']);body.data.color_attributes.remove(body.data.color_attributes['ClothBlend'])
 if original.users==0:bpy.data.images.remove(original)
