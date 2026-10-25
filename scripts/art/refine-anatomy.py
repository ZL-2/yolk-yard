"""UV-preserving anatomy pass over the editable 215 sculpts.
Run one operator at a time, inspect its game poses, then continue. Source files
are recovered from the immutable 215 commit; re-running cannot compound scale.
Cosmetic meshes, materials and rigs only: gameplay collision/hit detection do not read these files.
"""
import bpy,sys,json,math,subprocess,tempfile
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
BASE='bf0d9f24776c735d41db4ee72a9df56cc8d5f5ac'
# Independent silhouette targets: hips, chest, neck, head heights; width at
# hips/waist/chest/shoulders/head; garment depth; limb volume; hand scale.
PROFILES={
 'wren':([.96,1.35,1.485,1.605],[1.18,1.12,1.17,1.18,1.14],1.08,1.08,.88),
 'pulse':([.955,1.35,1.48,1.61],[1.24,1.22,1.30,1.27,1.28],1.14,1.10,.87),
 'scout':([.96,1.365,1.49,1.615],[1.10,1.14,1.15,1.12,1.13],1.10,1.06,.92),
 'voss':([1.005,1.425,1.55,1.68],[1.32,1.42,1.28,1.15,1.12],1.16,1.20,.90),
 'rook':([.965,1.40,1.53,1.67],[1.42,1.53,1.32,1.12,1.18],1.22,1.25,.88),
 'nyx':([.97,1.36,1.49,1.62],[1.15,1.12,1.13,1.12,1.05],1.08,1.10,.87),
 'morrow':([.985,1.39,1.52,1.66],[1.21,1.25,1.18,1.12,1.08],1.13,1.14,.91),
 'rank-25':([.98,1.39,1.515,1.65],[1.21,1.24,1.22,1.10,1.12],1.12,1.15,.90),
 'rank-10':([.975,1.38,1.51,1.65],[1.19,1.22,1.18,1.10,1.08],1.12,1.14,.90),
 'rank-5':([1.00,1.415,1.54,1.68],[1.23,1.30,1.24,1.12,1.12],1.15,1.18,.92),
 'rank-1':([1.01,1.43,1.56,1.70],[1.25,1.32,1.24,1.12,1.13],1.15,1.18,.92),
}
CLOTH_COLORS={
 'pulse':((.045,.06,.09),(.05,.25,.30)),
 'rook':((.055,.075,.11),(.055,.075,.11)),
 'voss':((.065,.06,.055),(.065,.06,.055)),
 'nyx':((.065,.04,.09),(.09,.045,.13)),
 'morrow':((.075,.085,.055),(.10,.11,.07)),
 'rank-25':((.055,.075,.09),(.055,.075,.09)),
 'rank-10':((.055,.04,.07),(.055,.04,.07)),
 'rank-5':((.075,.055,.035),(.075,.055,.035)),
 'rank-1':((.065,.075,.10),(.065,.075,.10)),
 'scout':((.08,.10,.12),(.11,.18,.21)),
}
def interp(x,knots,smooth=False):
 for (a,u),(b,v) in zip(knots,knots[1:]):
  if x<=b:
   t=max(0,min(1,(x-a)/(b-a)))
   if smooth:t=t*t*(3-2*t)
   return u+(v-u)*t
 return knots[-1][1]+(x-knots[-1][0])*(knots[-1][1]-knots[-2][1])/(knots[-1][0]-knots[-2][0]) if not smooth else knots[-1][1]
id=sys.argv[-1]
if id not in PROFILES:raise ValueError('Choose exactly one operator')
local=Path('/tmp/roster215-source/operators')/id/(id+'.blend')
if not local.exists():
 local=Path(tempfile.gettempdir())/('source215-'+id+'.blend')
 local.write_bytes(subprocess.check_output(['git','show',BASE+':art/operators/'+id+'/'+id+'.blend'],cwd=ROOT))
bpy.ops.wm.open_mainfile(filepath=str(local))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');meshes=[o for o in bpy.data.objects if o.type=='MESH']
if id in ['nyx','morrow','rank-10']:
 from repair_hood import repair_hood
 for mesh in meshes:repair_hood(mesh,id)
old={b.name:b.head_local.copy() for b in rig.data.bones}
heights,widths,depth,limb,handScale=PROFILES[id]
hp,ch,ne,he=heights;wh,ww,wc,ws,hw=widths
hip=old['hips'].z;chest=old['chest'].z;neck=old['neck'].z;head=old['head'].z;ankle=old['footL'].z;knee=old['shinL'].z
# Lower an overlong shin, keep the feet on the original ground, and give the
# ribcage room. Head enlargement has its own anchor, not a long neck stretch.
headHeight=1.24 if id=='pulse' else 1.08 if id=='rook' else 1.10 if id in ['wren','scout'] else 1.02
zmap=[(0,0),(ankle,ankle*.94),(knee,(hp-.07)*.55),(hip,hp),(chest,ch),(neck,ne),(head,he),(head+.3,he+.3*headHeight)]
xmap=[(0,1.06),(ankle,1.08),(knee,1.10),(hip,wh),((hip+chest)*.5,ww),(chest,wc),(old['armL'].z,ws),(neck,1.1),(head,hw)]
xmap=sorted(xmap)
def warp(p):
 z=p.z
 return Vector((p.x*interp(z,xmap,True),p.y*interp(z,[(0,.96),(ankle,1.02),(hip,depth),(chest,depth),(neck,1.05),(head,hw*.94)],True),interp(z,zmap)))
new={n:warp(p) for n,p in old.items()}
# Place ankle pivots inside the foot, rather than at the top of a tall boot.
# The mesh stays fixed in its rest pose; this changes only the roll center.
if id!='wren':
 for S in ['L','R']:new['foot'+S].z=.11 if id in ['rook','voss','rank-1','rank-5'] else .10
# A continuous deform field keeps adjacent clothing sections aligned. Extra
# radial mass is local to the limb; stance width and armor do not balloon.
chains={}
for S in ['L','R']:
 for a,b in [('arm','forearm'),('forearm','hand'),('thigh','shin'),('shin','foot')]:
  n=a+S;A=old[n];D=old[b+S]-A;chains[n]=(A,D,D.length_squared)
 for i in range(5):
  n='finger'+S+str(i);new[n]=new['hand'+S]+(new[n]-new['hand'+S])*handScale
for o in meshes:
 ankleHardware=set()
 if id=='rook':
  parent=list(range(len(o.data.vertices)))
  def find(i):
   while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
   return i
  for e in o.data.edges:
   a,b=map(find,e.vertices)
   if a!=b:parent[a]=b
  parts={}
  for v in o.data.vertices:parts.setdefault(find(v.index),[]).append(v.index)
  for ids in parts.values():
   vs=[o.data.vertices[i] for i in ids]
   if .13<min(v.co.z for v in vs) and max(v.co.z for v in vs)<.235 and len(ids)>100:
    ankleHardware.update(ids)
  for S in ['L','R']:
   name='arm'+S
   for ids in parts.values():
    vs=[o.data.vertices[i] for i in ids]
    if min(v.co.z for v in vs)<old[name].z-.085 or max(v.co.z for v in vs)<old[name].z+.02:continue
    if not all(all(o.vertex_groups[g.group].name==name for g in v.groups if g.weight>.001) for v in vs):continue
    o.vertex_groups[name].add(ids,.2,'REPLACE');o.vertex_groups['chest'].add(ids,.8,'REPLACE')
 names={g.index:g.name for g in o.vertex_groups}
 if id=='pulse':
  source=o.data.attributes.new('SourcePosition','FLOAT_VECTOR','POINT')
  for v in o.data.vertices:source.data[v.index].vector=v.co
 for v in o.data.vertices:
  p=v.co.copy();q=warp(p);groups=[(names[g.group],g.weight) for g in v.groups if g.weight>.001]
  for n,w in groups:
   if n in chains:
    A,D,ll=chains[n];t=max(0,min(1,(p-A).dot(D)/ll));center=A+D*t;rad=p-center
    # Fade at the upper joint so shoulder/hip clothing retains continuous seams.
    bulge=(limb-1)*min(1,t*8+.2)*min(1,(1-t)*8+.25)
    q+=Vector((rad.x,rad.y,0))*bulge*w
   if n.startswith('finger') or n.startswith('hand'):
    S=n[6] if n.startswith('finger') else n[-1];anchor=new['hand'+S]
    q+=(anchor+(warp(p)-anchor)*handScale-warp(p))*w
    if n.startswith('finger'):
     # A relaxed arc, rounded fingertips and full knuckles replace thin spikes.
     knuckle=old[n];t=max(0,min(1,(knuckle.z-p.z)/.07));q.y-=.018*t*t*w
     q.x+=(p.x-knuckle.x)*.20*w;q.y+=(p.y-knuckle.y)*.15*w
  if id=='rook':
   volume=math.exp(-(max(0,p.z-ankle-.17)/.08)**2)*max(0,min(1,p.z/.07))
   for S in ['L','R']:
    w=sum(w for n,w in groups if n in ['shin'+S,'foot'+S]);center=old['foot'+S]
    q.x+=(p.x-center.x)*.55*volume*w;q.y+=(p.y-center.y)*.22*volume*w
  if v.index in ankleHardware:q.x+=math.copysign(.04,p.x);q.y-=.01
  # Sculpt soft cheek/jaw volume and shorten the projecting nose on exposed faces.
  headWeight=sum(w for n,w in groups if n=='head')
  if id in ['wren','pulse','scout'] and headWeight>.9 and p.y<-.025:
   z=p.z-head
   face=math.exp(-((z+.025)/.075)**4)*math.exp(-(p.x/.095)**8)
   jaw=math.exp(-((z+.065)/.035)**2)
   q.x+=math.copysign(.006,p.x)*jaw*min(1,abs(p.x)/.035)
   q.y-=.005*face*math.exp(-((abs(p.x)-.04)/.023)**2)
   q.y+=.007*face*math.exp(-(p.x/.018)**2)*math.exp(-((z+.012)/.034)**2)
  if id=='pulse' and sum(w for n,w in groups if n=='neck')>.9:
   t=max(0,min(1,(968-p.z/(1.78/950)-133)/78));q.y+=.016*(1-t)**2;q.z-=.005*(1-t)**2
  v.co=q
 o.data.update()
 # Blend the bend region on both sides of an elbow/knee. The previous chain
 # gave the lower piece 100% weight at the same ring as a 52/48 upper piece.
 for v in o.data.vertices:
  groups=[(names[g.group],g.weight) for g in v.groups if g.weight>.001]
  for S in ['L','R']:
   for upper,lower in [('arm','forearm'),('thigh','shin')]:
    a,b=upper+S,lower+S
    if not groups or any(n not in [a,b] for n,w in groups):continue
    joint=new[b];r=.045 if upper=='arm' else .055
    if abs(v.co.z-joint.z)>r:continue
    t=max(0,min(1,(joint.z+r-v.co.z)/(2*r)));t=t*t*(3-2*t)
    for n,w in [(a,1-t),(b,t)]:
     g=o.vertex_groups.get(n) or o.vertex_groups.new(name=n);g.add([v.index],w,'REPLACE')
 o['anatomy_revision']=216;o['collision']='Cosmetic mesh only; standard gameplay capsules unchanged'
# Flexible underlayers bridge separately modeled garment panels at full bends.
# UVs sample the existing garment atlas; no new image, material or draw call.
body=meshes[0];material=body.data.materials[0]
texture=next(n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='sRGB')
import numpy as np
pixels=np.empty(len(texture.pixels),dtype=np.float32);texture.pixels.foreach_get(pixels)
W,H=texture.size;pixels=pixels.reshape(H,W,4)
surface=next((n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='Non-Color'),None)
finish=None
if surface:
 finish=np.empty(len(surface.pixels),dtype=np.float32);surface.pixels.foreach_get(finish);SW,SH=surface.size;finish=finish.reshape(SH,SW,4)
legColor,sleeveColor=CLOTH_COLORS.get(id,((.20,.22,.23),(.46,.20,.09)))
uv=body.data.uv_layers.active;uvName=uv.name;best=(1e9,(.5,.5));skin=(1e9,(.5,.5));sleeve=(1e9,(.5,.5));glove=(1e9,(.5,.5))
for poly in body.data.polygons:
 if poly.index%3:continue
 p=body.data.vertices[poly.vertices[0]];names=[body.vertex_groups[g.group].name for g in p.groups if g.weight>.5]
 U=uv.data[poly.loop_indices[0]].uv;rgb=pixels[min(H-1,int(U.y*H)),min(W-1,int(U.x*W)),:3]
 if finish is not None:
  physical=finish[min(SH-1,int(U.y*SH)),min(SW-1,int(U.x*SW)),:3]
  if physical[2]>.15 or physical[1]<.55:continue
 if any(n.startswith(('thigh','shin')) for n in names):
  score=float(np.sum((rgb-np.array(legColor))**2))
  if score<best[0]:best=(score,tuple(U))
 if any(n.startswith('arm') for n in names):
  score=float(np.sum((rgb-np.array(sleeveColor))**2))
  if score<sleeve[0]:sleeve=(score,tuple(U))
 if any(n.startswith('hand') for n in names):
  score=float(np.sum((rgb-np.array([.12,.14,.15]))**2))
  if score<glove[0]:glove=(score,tuple(U))
 if any(n.startswith('forearm') for n in names):
  score=float(np.sum((rgb-np.array([.65,.43,.30]))**2))
  if score<skin[0]:skin=(score,tuple(U))
if id in ['wren','rook','voss']:
 for poly in body.data.polygons:
  vs=[body.data.vertices[i] for i in poly.vertices]
  if all(any(body.vertex_groups[g.group].name.startswith('finger') and g.weight>.6 for g in v.groups) for v in vs):
   for li in poly.loop_indices:uv.data[li].uv=skin[1] if id=='wren' else glove[1]
if id=='wren':
 for poly in body.data.polygons:
  center=sum((body.data.vertices[i].co for i in poly.vertices),Vector())/len(poly.vertices)
  if abs(center.x)<.14 and .67<center.z<.97:
   U=uv.data[poly.loop_indices[0]].uv;rgb=pixels[min(H-1,int(U.y*H)),min(W-1,int(U.x*W)),:3]
   if min(rgb)>.43:
    for li in poly.loop_indices:uv.data[li].uv=best[1]
del pixels
bridges=[]
for S in ['L','R']:
 for a,b,rx,ry,rz in [('thigh','shin',.067,.063,.13),('arm','forearm',.045,.043,.075),('chest','arm',.060,.057,.070)]:
  upper=a if a=='chest' else a+S;lower=b+S;center=new[lower].copy()
  if a=='chest':center.z-=.035
  bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=center)
  o=bpy.context.object;o.name=id+' flexible '+lower+' underlayer';o.scale=(rx*limb,ry*depth,rz)
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  o.data.materials.append(material);o.data.uv_layers.active.name=uvName
  for poly in o.data.polygons:poly.use_smooth=True
  for loop in o.data.uv_layers.active.data:loop.uv=sleeve[1] if b in ['arm','forearm'] else best[1]
  ga=o.vertex_groups.new(name=upper);gb=o.vertex_groups.new(name=lower)
  for v in o.data.vertices:
   t=max(0,min(1,(center.z+rz-v.co.z)/(2*rz)));t=t*t*(3-2*t)
   ga.add([v.index],1-t,'REPLACE');gb.add([v.index],t,'REPLACE')
  bridges.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in [body]+bridges:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
for layer in list(body.data.uv_layers):
 if layer.name!=uvName:body.data.uv_layers.remove(layer)

if id not in ['wren','scout']:
 from repair_cloth import repair_cloth
 repair_cloth(body,finish,best[1],sleeve[1],glove[1],id)

if id=='pulse':
 from operator_face import pulse_face
 meshes.append(pulse_face(body,old['head'],ROOT))
 for o in meshes:
  for v in o.data.vertices:
   if any(o.vertex_groups[g.group].name=='neck' and g.weight>.9 for g in v.groups):
    t=max(0,min(1,(ne-.025-v.co.z)/.08));t=t*t*(3-2*t)
    o.vertex_groups['neck'].add([v.index],1-t,'REPLACE');o.vertex_groups['chest'].add([v.index],t,'REPLACE')

if id=='scout':
 from scout_face import scout_face
 meshes.append(scout_face(body))

# Armature rest and geometry receive the same map. Bind matrices are regenerated
# by the exporter; no runtime mesh scaling or per-player geometry copies.
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for b in rig.data.edit_bones:
 b.head=new[b.name];b.tail=b.head+Vector((0,0,.05));b.roll=0
bpy.ops.object.mode_set(mode='OBJECT')
rig['anatomy_revision']=216
for o in meshes:
 bpy.context.view_layer.objects.active=o
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=960;scene.render.resolution_percentage=100
# Material maps stay packed and use the final authored UVs.
out=ROOT/'art/operators'/id;out.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in [rig]+meshes:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(out/(id+'.blend')),compress=True)
def export(lod=False):
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/operators'/(id+('-lod' if lod else '')+'.glb')),export_format='GLB',use_selection=True,export_skins=True,export_animations=False,export_yup=True,export_image_format='JPEG',export_jpeg_quality=93,export_materials='NONE' if lod else 'EXPORT',export_attributes=False)
export()
cam=scene.camera
for name,pos in [('face',(.7,-3,1.65)),('three-quarter',(2.4,-5,1.05)),('front',(0,-5,1)),('side',(5,0,1)),('back',(0,5,1))]:
 cam.location=pos;target=Vector((0,0,1.62 if name=='face' else .95));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.62 if name=='face' else 2.12;scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
if id=='scout':
 from scout_face import render_scout_portrait
 render_scout_portrait(scene,out,ROOT)
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
for o in meshes:
 bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Distance topology','DECIMATE');mod.ratio=.24 if id=='wren' else .28;bpy.ops.object.modifier_apply(modifier=mod.name)
export(True)
report={'id':id,'revision':216,'sourceCommit':BASE,'triangles':triangles,'lodTriangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'bones':len(rig.data.bones),'materials':sum(len(o.data.materials) for o in meshes),'profile':PROFILES[id],'joints':{n:list(p) for n,p in new.items()},'status':'requires-game-pose-review','notes':'UV-preserving anatomy and joint-weight refinement. Hidden surfaces are artistic interpretations; collision unchanged.'}
(out/'production.json').write_text(json.dumps(report,indent=2)+'\n');print('REFINED',id,flush=True)
