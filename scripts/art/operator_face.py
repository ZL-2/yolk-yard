"""High-resolution face UVs for Pulse, retaining her existing sculpt and rig."""
import bpy,bmesh,math
from mathutils import Vector

def pulse_face(body,head,root):
 print('PULSE FACE: connected pieces',flush=True)
 original=body.data.attributes['SourcePosition'];points=[d.vector.copy() for d in original.data]
 # Connected construction pieces separate hair, cranium, neck and accessories.
 parent=list(range(len(body.data.vertices)))
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 for e in body.data.edges:
  a,b=map(find,e.vertices)
  if a!=b:parent[a]=b
 components={}
 for v in body.data.vertices:components.setdefault(find(v.index),[]).append(v.index)
 def belongs(ids,bone):return all(any(body.vertex_groups[g.group].name==bone and g.weight>.9 for g in body.data.vertices[i].groups) for i in ids)
 faces=[];necks=[];hair=[];torsos=[]
 for ids in components.values():
  ps=[points[i] for i in ids];lo=min(p.z for p in ps);hi=max(p.z for p in ps)
  if belongs(ids,'head'):
   if lo<head.z-.07 and hi>head.z+.07 and len(ids)>1000:faces.append(ids)
   elif hi>head.z+.055 and head.z-.075<lo<head.z+.035:hair.extend(ids)
  if belongs(ids,'neck') and len(ids)>150:necks.append(ids)
  names={body.vertex_groups[g.group].name for i in ids for g in body.data.vertices[i].groups if g.weight>.2}
  if 'chest' in names and 'hips' in names:torsos.append(ids)
 print('PULSE FACE: selection',len(faces),len(necks),len(hair),flush=True)
 face=set(max(faces,key=len));neck=set(max(necks,key=len));hair=set(hair);torso=set(max(torsos,key=len))
 # The original torso starts with a wide, closed horizontal ledge around the
 # neck. Taper that entry ring to the neck radius so the clavicle slopes
 # continuously into the chest instead of looking like a pasted rectangle.
 for i in torso:
  y=968-points[i].z/(1.78/950);t=max(0,min(1,(y-176)/22))
  body.data.vertices[i].co.x*=25/37+(1-25/37)*t
  body.data.vertices[i].co.y*=24/30+(1-24/30)*t
 for p in body.data.polygons:
  if set(p.vertices)<=torso and len(p.vertices)>4:p.use_smooth=False
 # Hair used to sample a second eye/cheek from the construction projection.
 # Reuse a clean white-hair UV from the same original atlas for its lower sweep.
 uv=body.data.uv_layers.active
 image=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='sRGB')
 import numpy as np
 pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels);W,H=image.size;pixels=pixels.reshape(H,W,4)
 best=(1e9,(.5,.5))
 for p in body.data.polygons:
  if set(p.vertices)<=hair:
   U=uv.data[p.loop_indices[0]].uv;rgb=pixels[min(H-1,int(U.y*H)),min(W-1,int(U.x*W)),:3];score=float(np.sum((rgb-np.array([.83,.82,.80]))**2))
   if score<best[0]:best=(score,tuple(U))
 for p in body.data.polygons:
  if set(p.vertices)<=hair and min(points[i].z for i in p.vertices)<head.z+.055:
   for li in p.loop_indices:uv.data[li].uv=best[1]
 del pixels
 print('PULSE FACE: mapping and separation',flush=True)
 region=body.data.attributes.new('FaceRegion','INT','POINT');original=body.data.attributes['SourcePosition']
 for i in neck:region.data[i].value=1
 for i in hair:region.data[i].value=2
 for i in torso:region.data[i].value=3
 bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bpy.ops.object.mode_set(mode='OBJECT')
 for p in body.data.polygons:
  ids=set(p.vertices)
  front=sum(points[i].y for i in p.vertices)/len(p.vertices)<-.013
  y=sum(968-points[i].z/(1.78/950) for i in p.vertices)/len(p.vertices)
  p.select=ids<=hair or ids<=neck or ids<=face and front or ids<=torso and front and y<232
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
 print('PULSE FACE: separated',flush=True)
 separate=next(o for o in bpy.context.selected_objects if o!=body);separate.name='Pulse / detailed face and neck'
 # Join the overlapping front neck/clavicle rings, so lighting uses one smooth
 # skin surface as well as a continuous texture. Rear overlaps stay concealed
 # beneath the raised jacket collar.
 bm=bmesh.new();bm.from_mesh(body.data);src=bm.verts.layers.float_vector['SourcePosition']
 caps=[f for f in bm.faces if len(f.verts)>4 and all(abs(968-v[src].z/(1.78/950)-176)<.01 for v in f.verts)]
 bmesh.ops.delete(bm,geom=caps,context='FACES');bm.to_mesh(body.data);bm.free()
 bm=bmesh.new();bm.from_mesh(separate.data);src=bm.verts.layers.float_vector['SourcePosition'];reg=bm.verts.layers.int['FaceRegion']
 drop=[f for f in bm.faces if all(v[reg]==1 for v in f.verts) and sum(v[src].y for v in f.verts)/len(f.verts)<-.013 and min(968-v[src].z/(1.78/950) for v in f.verts)>176.2]
 bmesh.ops.delete(bm,geom=drop,context='FACES')
 seam=[v for v in bm.verts if v[reg] in [1,3] and abs(968-v[src].z/(1.78/950)-176.2)<.7]
 bmesh.ops.remove_doubles(bm,verts=seam,dist=.009);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(separate.data);bm.free()
 mat=bpy.data.materials.new('Pulse / clear face albedo');mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.68
 tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(root/'art/operators/pulse/face-albedo-216.png'));tex.image.pack();mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.06
 separate.data.materials.clear();separate.data.materials.append(mat)
 for p in separate.data.polygons:p.material_index=0
 savedUV=[u.uv.copy() for u in separate.data.uv_layers.active.data]
 while len(separate.data.uv_layers):separate.data.uv_layers.remove(separate.data.uv_layers[-1])
 bodyUV=separate.data.uv_layers.new(name='BodyUV')
 for u,v in zip(bodyUV.data,savedUV):u.uv=v
 uv=separate.data.uv_layers.new(name='FaceUV');source=separate.data.attributes['SourcePosition'];region=separate.data.attributes['FaceRegion']
 scale=1.78/950
 def curve(y):
  knots=[(55,.13),(77,.25),(95,.38),(111,.515),(127,.615),(146,.785)]
  for (a,u),(b,v) in zip(knots,knots[1:]):
   if y<=b:return u+(v-u)*max(0,min(1,(y-a)/(b-a)))
  return .785
 for poly in separate.data.polygons:
  for li in poly.loop_indices:
   i=separate.data.loops[li].vertex_index;p=source.data[i].vector;x=p.x/scale;y=968-p.z/scale
   if region.data[i].value==2:U=.5+p.x/.14*.2;V=.015+max(0,min(1,(head.z+.2-p.z)/.25))*.08
   elif region.data[i].value in [1,3]:U=.5+x/200;V=.80+max(0,min(1,(y-133)/78))*.18
   else:U=.5+x/128;V=curve(y)
   uv.data[li].uv=(U,1-V)
 # Blend the neck back into its original collarbone material, then bake this
 # real three-dimensional material into one exportable face atlas.
 factor=separate.data.color_attributes.new(name='FaceBlend',type='FLOAT_COLOR',domain='CORNER')
 source=separate.data.attributes['SourcePosition'];region=separate.data.attributes['FaceRegion']
 for li,loop in enumerate(separate.data.loops):
  i=loop.vertex_index;y=968-source.data[i].vector.z/scale;t=max(0,min(1,(y-190)/22));t=t*t*(3-2*t)
  w=1-t if region.data[i].value in [1,3] else 1;factor.data[li].color=(w,w,w,1)
 nodes=mat.node_tree.nodes;links=mat.node_tree.links
 genUV=nodes.new('ShaderNodeUVMap');genUV.uv_map='FaceUV';links.new(genUV.outputs[0],tex.inputs['Vector'])
 oldTex=nodes.new('ShaderNodeTexImage');oldTex.image=image;oldUV=nodes.new('ShaderNodeUVMap');oldUV.uv_map='BodyUV';links.new(oldUV.outputs[0],oldTex.inputs['Vector'])
 blend=nodes.new('ShaderNodeAttribute');blend.attribute_name='FaceBlend';mix=nodes.new('ShaderNodeMixRGB');links.new(blend.outputs['Fac'],mix.inputs[0]);links.new(oldTex.outputs['Color'],mix.inputs[1]);links.new(tex.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],bs.inputs['Base Color'])
 faceUV=separate.data.uv_layers['FaceUV'];coords=[u.uv.copy() for u in faceUV.data]
 atlasUV=separate.data.uv_layers.new(name='FaceAtlas')
 for u,v in zip(atlasUV.data,coords):u.uv=v
 separate.data.uv_layers.active=atlasUV
 bpy.ops.object.select_all(action='DESELECT');separate.select_set(True);bpy.context.view_layer.objects.active=separate
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.01);bpy.ops.object.mode_set(mode='OBJECT')
 atlas=bpy.data.images.new('Pulse face and neck albedo 216',width=2048,height=2048);target=nodes.new('ShaderNodeTexImage');target.image=atlas;nodes.active=target
 bpy.ops.object.select_all(action='DESELECT');separate.select_set(True);bpy.context.view_layer.objects.active=separate
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True;scene.render.bake.margin=8
 bpy.ops.object.bake(type='DIFFUSE');atlas.pack()
 for n in list(nodes):
  if n.type not in ['BSDF_PRINCIPLED','OUTPUT_MATERIAL']:nodes.remove(n)
 tex=nodes.new('ShaderNodeTexImage');tex.image=atlas;links.new(tex.outputs['Color'],bs.inputs['Base Color']);links.new(tex.outputs['Color'],bs.inputs['Emission Color'])
 for i in range(len(separate.data.uv_layers)-1,-1,-1):
  if separate.data.uv_layers[i].name!='FaceAtlas':separate.data.uv_layers.remove(separate.data.uv_layers[i])
 separate.data.color_attributes.remove(separate.data.color_attributes['FaceBlend'])
 for o in [body,separate]:
  for name in ['SourcePosition','FaceRegion']:
   a=o.data.attributes.get(name)
   if a:o.data.attributes.remove(a)
 return separate
