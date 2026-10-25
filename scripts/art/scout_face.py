"""Clean Scout's exposed skin UVs and keep the eyes nonmetallic."""
import bpy,numpy as np
from mathutils import Vector

def scout_face(body):
 parent=list(range(len(body.data.vertices)))
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 for e in body.data.edges:
  a,b=map(find,e.vertices)
  if a!=b:parent[a]=b
 parts={}
 for v in body.data.vertices:parts.setdefault(find(v.index),[]).append(v)
 parts={k:vs for k,vs in parts.items() if all(all(body.vertex_groups[g.group].name in ['head','neck'] for g in v.groups if g.weight>.001) for v in vs)}
 face_key=next(k for k,vs in parts.items() if len(vs)==2304)
 skin_keys={k for k,vs in parts.items() if len(vs) in [364,408]}
 inner_keys={k for k,vs in parts.items() if len(vs)==260}
 texture=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='sRGB')
 W,H=texture.size;pixels=np.empty(len(texture.pixels),dtype=np.float32);texture.pixels.foreach_get(pixels);pixels=pixels.reshape(H,W,4)
 uv=body.data.uv_layers.active.data;candidates=[]
 for p in body.data.polygons:
  if find(p.vertices[0])!=face_key:continue
  center=sum((body.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
  if center.y>-.055 or not (1.56<center.z<1.64 and .025<abs(center.x)<.07):continue
  U=sum((uv[i].uv for i in p.loop_indices),Vector((0,0)))/len(p.loop_indices)
  rgb=pixels[max(0,min(H-1,int(U.y*H))),max(0,min(W-1,int(U.x*W))),:3]
  candidates.append((U.copy(),rgb.copy()))
 assert candidates,'Scout cheek sample'
 skin=min(candidates,key=lambda x:float(np.sum((x[1]-np.array([.61,.40,.26]))**2)))[0]
 concha=min(candidates,key=lambda x:float(np.sum((x[1]-np.array([.40,.23,.13]))**2)))[0]
 for p in body.data.polygons:
  key=find(p.vertices[0])
  if key in skin_keys or key in inner_keys:
   for i in p.loop_indices:uv[i].uv=concha if key in inner_keys else skin
 # Separate the head/neck so each exported primitive still has one material.
 # The same atlas is shared; no extra texture or joint is introduced.
 material=body.data.materials[0].copy();material.name='Scout skin and eyes / nonmetal'
 bs=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 for link in list(bs.inputs['Metallic'].links):material.node_tree.links.remove(link)
 bs.inputs['Metallic'].default_value=0
 bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
 bpy.context.tool_settings.mesh_select_mode=(False,False,True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bpy.ops.object.mode_set(mode='OBJECT')
 for p in body.data.polygons:
  if all(all(body.vertex_groups[g.group].name in ['head','neck'] for g in body.data.vertices[i].groups if g.weight>.001) for i in p.vertices):p.select=True
 before=set(bpy.data.objects)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
 head=next(o for o in set(bpy.data.objects)-before if o.type=='MESH');head.name='Scout face, hair and collar'
 head.data.materials.clear();head.data.materials.append(material)
 # The construction colors are already baked into the atlas. Exporting them
 # again tints the game material, even after its color attribute is discarded.
 for o in [body,head]:
  while len(o.data.color_attributes):o.data.color_attributes.remove(o.data.color_attributes[-1])
 return head
