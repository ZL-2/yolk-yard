"""Wren asset study: reference-fitted surfaces, authored skin weights and GLB export.
Run with Blender 4.3+ background --python, or a Python environment containing bpy.
Coordinates on the modeling sheet are deliberately retained for art review.
"""
import bpy, math, json, os, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models/operators'
OUT.mkdir(parents=True,exist_ok=True)
S=1.82/975
CENTER=317
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
print('WREN_STAGE start',flush=True)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.world.color=(.25,.25,.25)
scene.view_settings.view_transform='Standard'
scene.view_settings.look='Medium High Contrast'
scene.render.image_settings.file_format='PNG'
# The complete turnaround is an explicit texture source, with front/back UV islands.
image=bpy.data.images.load(str(ROOT/'art/wren/turnaround.png'));image.pack()
import numpy as np
pixels=np.array(image.pixels[:],dtype=np.float32).reshape(image.size[1],image.size[0],4)
def safe_uv(x,y,back=False):
 x=1230-(x-CENTER) if back else x
 if y>960:y=960 if not back else 953
 ix=max(0,min(1535,round(x)));iy=max(0,min(1023,1023-round(y)))
 def foreground(k,j):
  c=pixels[j,k,:3]
  return float(max(c)-min(c))>.055 or float(max(c))<.32
 if not foreground(ix,iy):
  candidates=[]
  for dy in range(-6,7,2):
   j=max(0,min(1023,iy+dy))
   for dx in range(-60,61):
    k=max(0,min(1535,ix+dx))
    if foreground(k,j):candidates.append((abs(dx)+abs(dy)*2,k,j))
  if candidates:
   _,ix,iy=min(candidates);x=ix;y=1023-iy
 return (x/1536,1-y/1024)

mat=bpy.data.materials.new('Wren reference albedo');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.76
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Linear';tex.extension='EXTEND'
mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
# Light emission avoids double-darkening reference-painted cavities, but is not unlit.
mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.22
meshes=[]
def point(x,y,depth=0):return Vector(((x-CENTER)*S,depth,(975-y)*S))
def uv(x,y,back=False):return safe_uv(x,y,back)
def mesh(name,verts,faces,uvs,weights):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
 o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);m.materials.append(mat)
 layer=m.uv_layers.new(name='Reference projection')
 sidecolor=m.color_attributes.new(name='SideColor',type='FLOAT_COLOR',domain='POINT')
 m.attributes.new(name='SeamBlend',type='FLOAT',domain='POINT')
 sidecolor=m.color_attributes['SideColor'];seam=m.attributes['SeamBlend'];layer=m.uv_layers['Reference projection']
 def base_color(y):
  if any(k in name.lower() for k in ['hair','curl','nape']):return (.23,.060,.027)
  if any(k in name.lower() for k in ['scarf']):return (.18,.30,.30)
  if any(k in name.lower() for k in ['glove','boot','toe and sole']):return (.10,.055,.030)
  if any(k in name.lower() for k in ['shoulder plate','knee plate']):return (.62,.57,.47)
  if any(k in name.lower() for k in ['face','neck','forearm','finger','thumb']):return (.50,.27,.16)
  if 'jacket' in name.lower():return (.44,.13,.035)
  if 'undersuit' in name.lower() and y<324:return (.40,.12,.032)
  return (.052,.061,.074)
 for i,v in enumerate(m.vertices):
  y=975-v.co.z/S
  sidecolor.data[i].color=(*((.018,.016,.014) if 'toe and sole' in name.lower() and v.co.z<.03 else base_color(y)),1)
  # Loft seams lie at the widest x of each row; the surface normal is lateral.
  normal=v.normal
  seam.data[i].value=1 if 'toe and sole' in name.lower() and v.co.z<.03 else max(0,min(.92,(abs(normal.x)-.60)/.4))

 for p in m.polygons:
  p.use_smooth=True
  for li in p.loop_indices:layer.data[li].uv=uvs[m.loops[li].vertex_index]
 for vi,w in enumerate(weights):
  for bone,amount in w.items():
   if amount<=0:continue
   group=o.vertex_groups.get(bone) or o.vertex_groups.new(name=bone)
   group.add([vi],amount,'REPLACE')
 meshes.append(o);return o

def mix(a,b,t):return {a:1-t,b:t} if a!=b else {a:1}
def weight_at(y,part,side=''):
 if part=='head':return {'head':1}
 if part=='body':
  if y<205:return {'chest':1}
  if y<290:return mix('chest','spine',(y-205)/85)
  if y<375:return mix('spine','hips',(y-290)/85)
  return {'hips':1}
 if part=='arm':
  if y<190:return {'shoulder'+side:.6,'chest':.4}
  if y<245:return mix('shoulder'+side,'arm'+side,(y-190)/55)
  if y<300:return {'arm'+side:1}
  if y<350:return mix('arm'+side,'forearm'+side,(y-300)/50)
  if y<420:return {'forearm'+side:1}
  if y<450:return mix('forearm'+side,'hand'+side,(y-420)/30)
  return {'hand'+side:1}
 if part=='leg':
  if y<450:return mix('hips','thigh'+side,max(0,min(1,(y-408)/42)))
  if y<590:return {'thigh'+side:1}
  if y<660:return mix('thigh'+side,'shin'+side,(y-590)/70)
  if y<875:return {'shin'+side:1}
  if y<915:return mix('shin'+side,'foot'+side,(y-875)/40)
  return {'foot'+side:1}
 return {part:1}

def interp(rows,steps=5):
 out=[]
 for a,b in zip(rows,rows[1:]):
  for j in range(steps):
   t=j/steps;out.append([a[k]*(1-t)+b[k]*t for k in range(len(a))])
 out.append(rows[-1]);return out

def loft(name,rows,part,side='',fold=0,face=False):
 """Rows: reference y,left,right,half-depth,depth center. Split sides retain UV seams."""
 rows=interp(rows);verts=[];uvs=[];weights=[];faces=[];n=24
 for back in [False,True]:
  base=len(verts)
  for y,left,right,depth,cy in rows:
   cx=(left+right)/2;rx=(right-left)/2
   for k in range(n+1):
    t=-math.pi/2+k/n*math.pi
    x=cx+rx*math.sin(t);front=math.cos(t)
    d=depth*front
    if face and not back:
     # Sculpted nasal bridge, nose tip, cheeks, philtrum and recessed eye sockets.
     d+=.018*math.exp(-((x-317)/7)**2-((y-89)/17)**2)
     d+=.021*math.exp(-((x-317)/9)**2-((y-99)/5)**2)
     d+=.008*math.exp(-((x-317)/16)**2-((y-115)/5)**2)
     for ex in [296,338]:d-=.010*math.exp(-((x-ex)/10)**2-((y-80)/7)**2)
     for ex in [291,344]:d+=.006*math.exp(-((x-ex)/12)**2-((y-97)/9)**2)
    if fold:
     # Small continuous folds, most visible at knee and elbow compression.
     f=math.sin(y*.23+math.sin(t*3)*1.2)*math.sin(t*4+y*.035)
     d+=fold*f*front
    p=point(x,y,cy+(d if back else -d));verts.append(p);uvs.append(uv(x,y,back));weights.append(weight_at(y,part,side))
  for j in range(len(rows)-1):
   for k in range(n):
    a=base+j*(n+1)+k;b=a+n+1
    faces.append((b,b+1,a+1,a) if not back else (a,a+1,b+1,b))
 return mesh(name,verts,faces,uvs,weights)

# Separate fitted garment shells with smoothly changing anatomical cross sections.
loft('Fitted undersuit and pelvis',[
 [150,292,343,.044,0],[171,264,373,.060,0],[191,237,399,.076,0],
 [220,243,391,.098,-.003],[247,252,382,.105,-.004],[273,264,373,.082,0],
 [315,273,365,.065,0],[344,271,368,.067,0],[372,264,376,.080,0],
 [398,259,380,.093,.003],[424,254,383,.102,.005],[449,257,378,.097,0],
 [470,280,355,.078,0]],'body',fold=.0015)
# Torso outer jacket, open across the front, with shaped lapels modeled separately.
# Surface strips follow a front opening rather than adding square chest plates.
def patch(name,grid,part,back=False,thickness=0):
 vs=[];uvs=[];ws=[];fs=[];cols=len(grid[0])
 for row in grid:
  for x,y,d in row:vs.append(point(x,y,d));uvs.append(uv(x,y,back));ws.append(weight_at(y,part))
 for j in range(len(grid)-1):
  for k in range(cols-1):
   a=j*cols+k;fs.append((a+cols,a+cols+1,a+1,a))
 o=mesh(name,vs,fs,uvs,ws)
 if thickness:
  mod=o.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=thickness
 sub=o.modifiers.new('Tailored surface smoothing','SUBSURF');sub.levels=2
 return o
for side in [-1,1]:
 def sx(x):return x if side<0 else 634-x
 patch('Cropped jacket '+str(side),[
  [(sx(252),178,-.05),(sx(270),180,-.09),(sx(285),191,-.095)],
  [(sx(240),207,-.04),(sx(259),215,-.105),(sx(282),227,-.111)],
  [(sx(247),245,-.035),(sx(267),248,-.107),(sx(282),262,-.103)],
  [(sx(258),280,-.032),(sx(272),283,-.086),(sx(279),298,-.083)],
  [(sx(264),315,-.03),(sx(272),321,-.073),(sx(282),324,-.076)],
 ],'body',thickness=.004)
# Neck and head are continuous, deliberately narrower than the old common body.
loft('Neck',[[131,300,335,.042,0],[145,298,337,.044,0],[167,291,344,.045,0],[178,286,349,.048,0]],'neck')
loft('Wren sculpted face',[[39,302,332,.04,.008],[47,289,347,.065,.008],[62,279,355,.074,.009],[79,278,357,.071,.01],[91,281,355,.067,.01],[103,287,350,.063,.007],[116,296,343,.060,.003],[127,306,335,.049,.002],[135,313,328,.027,.003]],'head',face=True)
# Swept hair shell: silhouette follows the art; sculpted locks below break up its edge.
hair_obj=loft('Auburn hair crown',[[7,307,324,.015,.02],[14,282,345,.047,.02],[25,266,359,.068,.025],[40,258,368,.078,.033],[56,252,373,.083,.04],[74,251,373,.082,.047],[92,255,371,.069,.052],[110,259,369,.057,.062],[129,270,360,.035,.072],[142,287,350,.015,.083]],'head')
# The front hair shell must not cover the face. Delete its front-facing center faces.
hair=hair_obj;bm=hair.data
for loop in bm.loops:
 v=bm.vertices[loop.vertex_index].co
 x=CENTER+v.x/S;y=975-v.z/S
 bm.uv_layers.active.data[loop.index].uv=(max(1184,min(1274,1184+(x-252)/121*90))/1536,1-max(31,min(122,y))/1024)
# Remove front lower crown using explicit reference coordinates after mesh update.
import bmesh
b=bmesh.new();b.from_mesh(hair.data)
for f in list(b.faces):
 c=f.calc_center_median();py=975-c.z/S;px=CENTER+c.x/S
 if c.y<.04 and py>48 and 273<px<360:b.faces.remove(f)
b.to_mesh(hair.data);b.free();hair.data.update()
# Tapered, swept locks add real silhouette relief around the crown and nape.
def hair_lock(name,points,width):
 vs=[];us=[];ws=[];fs=[]
 path=[]
 for a,b in zip(points,points[1:]):
  for k in range(4):path.append(tuple(a[j]+(b[j]-a[j])*k/4 for j in range(3)))
 path.append(points[-1])
 for j,(x,y,d) in enumerate(path):
  t=j/(len(path)-1);r=width*math.sin(math.pi*(.08+.90*t))
  for k in range(8):
   angle=k/8*math.tau;v=point(x+math.cos(angle)*r,y,d+math.sin(angle)*r*S*.38)
   vs.append(v);us.append((min(1270,1190+k*8)/1536,1-(38+t*75)/1024));ws.append({'head':1})
  if j:
   for k in range(8):a=(j-1)*8+k;b=(j-1)*8+(k+1)%8;fs.append((a,b,b+8,a+8))
 mesh(name,vs,fs,us,ws)
for j in range(5):
 hair_lock('Swept left hair '+str(j),[(293+j*4,20+j*3,.033),(273+j*2,42+j*6,.027),(256-j,73+j*7,.04),(247-j*2,103+j*6,.06),(237+j*3,111+j*5,.065)],7-j*.6)
 hair_lock('Swept right hair '+str(j),[(327+j*3,21+j*2,.043),(354+j*2,48+j*5,.045),(366+j*2,75+j*7,.05),(363+j*3,100+j*5,.055),(378+j*2,113+j*4,.045)],6-j*.5)
for j in range(6):
 hair_lock('Nape curl '+str(j),[(282+j*14,54,.10),(279+j*14,86,.115),(284+j*13,114,.11),(276+j*15,139+(j%2)*7,.085)],8)
# Arms, fingers, trousers and boots use separate anatomical loops, without ball joints.
for side in [-1,1]:
 suffix='L' if side<0 else 'R'
 def mirror(rows):return rows if side<0 else [[y,634-r,634-l,d,cy]for y,l,r,d,cy in rows]
 loft('Jacket sleeve '+suffix,mirror([[177,209,251,.055,0],[195,191,248,.067,0],[226,180,239,.067,0],[256,169,227,.064,0],[289,155,215,.058,0],[313,140,205,.054,0],[333,134,194,.05,0]]),'arm',suffix,fold=.003)
 loft('Forearm '+suffix,mirror([[330,138,189,.046,0],[350,132,180,.043,0],[380,113,155,.036,0],[407,98,133,.03,0],[432,90,122,.027,0],[453,84,117,.026,0]]),'arm',suffix)
 loft('Leather glove '+suffix,mirror([[402,101,136,.033,0],[423,90,126,.033,0],[444,80,116,.03,0],[469,67,108,.025,-.003],[490,66,100,.023,-.003],[507,70,94,.018,-.004]]),'hand'+suffix)
 for n in range(4):
  x=68+n*7
  rows=[[491,x,x+7,.009,-.006],[506+n*2,x-2,x+5,.009,-.008],[523+n*1.5,x-1,x+5,.007,-.010],[533-n*2,x+1,x+4,.003,-.010]]
  loft('Finger '+suffix+str(n),mirror(rows),'finger'+suffix+str(n))
 loft('Thumb '+suffix,mirror([[478,97,111,.012,-.013],[491,100,112,.011,-.024],[508,100,108,.008,-.03]]),'finger'+suffix+'4')
 loft('Tailored cargo trousers '+suffix,mirror([[408,255,317,.088,.003],[437,242,313,.094,.003],[472,231,306,.089,0],[512,223,302,.085,0],[551,219,299,.075,0],[580,214,293,.066,0],[606,210,287,.061,-.005],[631,210,282,.059,-.008],[663,208,280,.059,-.005],[698,204,280,.063,0],[734,202,280,.064,.003],[762,205,277,.060,.003],[780,209,274,.049,0]]),'leg',suffix,fold=.003)
 loft('Leather boot '+suffix,mirror([[765,201,279,.062,0],[787,201,279,.061,0],[818,207,273,.057,0],[848,207,269,.051,-.002],[875,205,266,.048,-.006],[903,203,267,.050,-.01],[925,200,265,.049,-.012],[945,198,264,.047,-.012]]),'leg',suffix,fold=.0012)
 # Flat-soled, rounded toe volume. Projection follows the front toe box and heel.
 vs=[];us=[];ws=[];fs=[]
 for level,(height,wide) in enumerate([(.006,.070),(.025,.073),(.075,.073),(.110,.060),(.150,.046),(.180,.038)]):
  for k in range(32):
   a=k/32*math.tau;x=(side*(317-232))*S+math.sin(a)*wide
   depth=[-.06,-.06,-.06,-.03,-.005,0][level]+math.cos(a)*[.14,.14,.14,.10,.06,.045][level]
   vs.append(Vector((x,depth,height)))
   px=CENTER+x/S;py=975-height/S
   us.append(((211+math.sin(a)*24)/1536,1-(946-level*3)/1024));ws.append({'foot'+suffix:1})
  if level:
   for k in range(32):a=(level-1)*32+k;b=(level-1)*32+(k+1)%32;fs.append((a,b,b+32,a+32))
 fs.append(tuple(reversed(range(32))));fs.append(tuple(range(160,192)))
 mesh('Sculpted toe and sole '+suffix,vs,fs,us,ws)
 # Rounded knee shell with boundary loops rather than a block.
 loft('Contoured knee plate '+suffix,mirror([[611,229,267,.008,-.067],[619,217,277,.014,-.067],[641,214,278,.020,-.066],[671,218,275,.016,-.065],[688,229,268,.008,-.064],[693,243,254,.002,-.062]]),'shin'+suffix)
 loft('Curved shoulder plate '+suffix,mirror([[173,216,228,.007,-.037],[182,202,240,.025,-.035],[207,187,244,.035,-.033],[231,178,237,.026,-.032],[245,174,220,.008,-.03]]),'arm',suffix)
# Actual scarf fabric hanging off neck and across chest; modeled as a curved sheet.
patch('Long woven scarf',[
 [(296,151,-.058),(310,158,-.067),(337,163,-.058)],
 [(282,185,-.092),(296,190,-.106),(318,196,-.105)],
 [(263,228,-.118),(280,235,-.126),(300,243,-.119)],
 [(246,280,-.125),(264,290,-.136),(284,298,-.123)],
 [(232,333,-.112),(250,342,-.122),(269,353,-.109)],
 [(222,375,-.098),(241,384,-.111),(261,393,-.097)],
 [(212,402,-.104),(232,413,-.119),(251,424,-.106)],
 ],'body',thickness=.002)
loft('Wrapped scarf collar',[[139,292,342,.046,-.001],[149,285,348,.057,-.004],[162,283,348,.061,-.007],[176,290,340,.054,-.007],[184,302,332,.042,-.005]],'neck',fold=.002)
# Goggles follow the forehead, with separate shaped lens surfaces and bridge.
for x in [295,343]:
 rows=[[20,x-7,x+7,.004,-.056],[24,x-18,x+18,.009,-.058],[33,x-21,x+21,.014,-.06],[44,x-17,x+17,.008,-.058],[49,x-5,x+5,.003,-.056]]
 loft('Amber goggle '+str(x),rows,'head')
# Armature bind positions fit this model's actual proportions; bone names match the game.
bones=[('root',None,point(317,975)),('hips','root',point(317,411)),('spine','hips',point(317,324)),('chest','spine',point(317,228)),('neck','chest',point(317,156)),('head','neck',point(317,104))]
for sign in [-1,1]:
 su='L'if sign<0 else'R'
 def p(x,y,d=0):return point(x if sign<0 else 634-x,y,d)
 bones += [('shoulder'+su,'chest',p(240,195)),('arm'+su,'shoulder'+su,p(220,205)),('forearm'+su,'arm'+su,p(164,334)),('hand'+su,'forearm'+su,p(103,441)),('thigh'+su,'hips',p(274,427)),('shin'+su,'thigh'+su,p(247,640)),('foot'+su,'shin'+su,p(233,927)),('toe'+su,'foot'+su,p(213,952,-.12))]
 for i in range(5):bones.append(('finger'+su+str(i),'hand'+su,p(72+i*7,496,-.01)))
arm=bpy.data.armatures.new('Wren skeleton');rig=bpy.data.objects.new('Wren',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,parent,p in bones:
 b=arm.edit_bones.new(name);b.head=p;b.tail=p+Vector((0,0,.04))
 if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for o in meshes:
 bpy.context.view_layer.objects.active=o
 for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=o.modifiers.new('Wren skin','ARMATURE');mod.object=rig;o.parent=rig
print('WREN_STAGE mesh and rig ready',flush=True)
# Join into one textured skinned asset to keep runtime draw calls bounded.
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=bpy.context.object;body.name='Wren reference-fitted mesh'
mod=body.modifiers.new('Game topology reduction','DECIMATE');mod.ratio=.42
bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=mod.name)
print('WREN_STAGE topology reduced',flush=True)
# Bake the projected front/back detail and painted side material into a real UV atlas.
# This eliminates backdrop streaks on tangential surfaces and gives the GLB a
# single self-contained texture, independent of the construction reference.
attrs=mat.node_tree.nodes.new('ShaderNodeVertexColor');attrs.layer_name='SideColor'
fade=mat.node_tree.nodes.new('ShaderNodeAttribute');fade.attribute_name='SeamBlend'
blend=mat.node_tree.nodes.new('ShaderNodeMixRGB');blend.blend_type='MIX'
mat.node_tree.links.new(fade.outputs['Fac'],blend.inputs[0]);mat.node_tree.links.new(tex.outputs['Color'],blend.inputs[1]);mat.node_tree.links.new(attrs.outputs['Color'],blend.inputs[2])
mat.node_tree.links.new(blend.outputs[0],bs.inputs['Base Color']);mat.node_tree.links.new(blend.outputs[0],bs.inputs['Emission Color'])
source_uv=mat.node_tree.nodes.new('ShaderNodeUVMap');source_uv.uv_map='Reference projection';mat.node_tree.links.new(source_uv.outputs[0],tex.inputs['Vector'])
body.data.uv_layers.new(name='BakedUV');body.data.uv_layers.active_index=1
bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.008);bpy.ops.object.mode_set(mode='OBJECT')
baked=bpy.data.images.new('Wren baked albedo',width=3072,height=3072,alpha=False)
target=mat.node_tree.nodes.new('ShaderNodeTexImage');target.image=baked;mat.node_tree.nodes.active=target
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);scene.cycles.samples=1;scene.render.bake.margin=8
bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'})
baked.filepath_raw=str(ROOT/'art/wren/wren-albedo.png');baked.file_format='PNG';baked.save();baked.pack()
for node in list(mat.node_tree.nodes):mat.node_tree.nodes.remove(node)
bs=mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled');bs.inputs['Roughness'].default_value=.74
out=mat.node_tree.nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(bs.outputs[0],out.inputs[0])
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=baked
mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.15
# Export only the baked UV set. The editable source retains the reference image.
body.data.uv_layers.remove(body.data.uv_layers['Reference projection']);body.data.uv_layers.active_index=0
scene.cycles.samples=24
body['asset_status']='prototype';body['source']='Original Wren art + generated turnaround; custom reference-fitted surface mesh'
rig['asset_revision']=1;rig['reference_front']='art/wren/turnaround.png';rig['review_required']='Face, side seams, hair and deformation'
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'wren-prototype.glb'),export_format='GLB',use_selection=True,export_skins=True,export_animations=False,export_apply=False,export_yup=True)
# A neutral studio is saved in the editable source, never shipped as game geometry.
def area(name,pos,power,size):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
 o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',(-3,-4,5),350,4);area('Fill',(3,-2,3),200,4);area('Rim',(1,3,4),350,3)
camdata=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',camdata);scene.collection.objects.link(camera);scene.camera=camera;camdata.type='ORTHO';camdata.ortho_scale=2.05
scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
camera.location=(0,-5,1.0);camera.rotation_euler=(Vector((0,0,.92))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/wren/wren-prototype.blend'))
for name,pos in [('front',(0,-5,1.0)),('three-quarter',(2.5,-4.5,1.15)),('back',(0,5,1.0)),('side',(5,0,1.0))]:
 camera.location=pos;camera.rotation_euler=(Vector((0,0,.92))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'art/wren'/('model-'+name+'.png'));bpy.ops.render.render(write_still=True)
report={'asset':'wren-prototype.glb','status':'prototype','vertices':len(body.data.vertices),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons),'bones':len(bones),'materials':len(body.data.materials),'glbBytes':(OUT/'wren-prototype.glb').stat().st_size}
(ROOT/'art/wren/report.json').write_text(json.dumps(report,indent=2));print('WREN_ASSET',json.dumps(report))
