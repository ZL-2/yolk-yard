"""Render both editable Jim assets together; no paintover or source-photo insert."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];ART=ROOT/'art/jim'
bpy.ops.wm.open_mainfile(filepath=str(ART/'models/jim-normal.blend'))
scene=bpy.context.scene
for o in list(scene.objects):
 if o.type in ['CAMERA','LIGHT']:bpy.data.objects.remove(o,do_unlink=True)
for o in scene.objects:
 if o.type=='ARMATURE':o.location.x=-.58
with bpy.data.libraries.load(str(ART/'models/jim-golf.blend'),link=False) as (source,target):
 target.objects=[n for n in source.objects if n.startswith('Jim')]
for o in target.objects:
 if o and o.type in ['MESH','ARMATURE']:
  scene.collection.objects.link(o)
  if o.type=='ARMATURE':o.location.x=.58
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1);return m
ink=material('Review ink',(.015,.030,.020));muted=material('Review muted',(.065,.085,.065))
for m in [ink,muted]:
 n=m.node_tree.nodes;n.clear();e=n.new('ShaderNodeEmission');e.inputs[0].default_value=m.diffuse_color;o=n.new('ShaderNodeOutputMaterial');m.node_tree.links.new(e.outputs[0],o.inputs[0])
def label(text,x,z,size,mat):
 d=bpy.data.curves.new(text,'FONT');d.body=text;d.align_x='CENTER';d.size=size;d.space_character=1.12;d.extrude=0
 o=bpy.data.objects.new(text,d);scene.collection.objects.link(o);o.location=(x,-.25,z);o.rotation_euler=(1.570796,0,0);o.data.materials.append(mat)
label('JIM / OUTFIT STUDY',0,2.15,.055,ink)
label('NORMAL',-.58,2.025,.026,muted);label('Sweatshirt',-.58,1.955,.050,ink)
label('SPECIAL',.58,2.025,.026,muted);label('Golf',.58,1.955,.050,ink)
label('ACTUAL 3D MODELS / AWAITING APPROVAL',0,-.13,.025,muted)
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.72,.77,.67,1);bg.inputs[1].default_value=.75
for name,pos,power,size in [('Key',(-3,-4,5),380,4),('Fill',(3,-2,3),240,4),('Rim',(1,3,4),220,3)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
camData=bpy.data.cameras.new('Approval camera');cam=bpy.data.objects.new('Approval camera',camData);scene.collection.objects.link(cam);cam.location=(0,-6,1.03);cam.rotation_euler=(Vector((0,0,1.03))-cam.location).to_track_quat('-Z','Y').to_euler();camData.type='ORTHO';camData.ortho_scale=2.68;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.film_transparent=False;scene.render.resolution_x=1600;scene.render.resolution_y=1500;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ART/'review/Jim-Outfits-Approval.png')
bpy.ops.render.render(write_still=True)
