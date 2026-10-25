"""Blend clean garment color around limb sides, then bake into the body atlas.

The construction sheet's side silhouettes do not exactly match the mesh.
Preserve front/back detail and metalwork while removing gray studio-background
projection from the side of fabric sleeves and trousers. No runtime shader cost.
"""
import bpy
from mathutils import Vector

def repair_cloth(body,finish,leg_uv,sleeve_uv,glove_uv):
 if finish is None:return
 material=body.data.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links
 texture=next(n for n in nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='sRGB')
 original=texture.image;uv_name=body.data.uv_layers.active.name
 coords=[u.uv.copy() for u in body.data.uv_layers.active.data]
 weights=[0.]*len(coords);samples=[leg_uv]*len(coords);height,width=finish.shape[:2]
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
