"""Reference-fitted Blender authoring tools, shared by original roster assets.

Coordinates are pixels on a neutral construction sheet. The mesh is genuinely
three-dimensional: shaped garment cross-sections, sculpted armor, solid trim,
separate fingers and weighted joints. Front/back/side projection is baked into
a conventional UV atlas; these are interpreted hidden surfaces, not scans.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ROOT=Path(__file__).resolve().parents[2]
class Builder:
 def __init__(self, id, name, center, back, side, floor, scale, joints, side_direction=1):
  self.id,self.name,self.cx,self.bx,self.sx,self.floor,self.scale=id,name,center,back,side,floor,scale
  self.side_direction=side_direction
  self.directory=ROOT/'art/operators'/id;self.directory.mkdir(parents=True,exist_ok=True)
  self.out=ROOT/'public/models/operators';self.out.mkdir(parents=True,exist_ok=True)
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
  self.scene=bpy.context.scene;self.scene.render.engine='CYCLES';self.scene.cycles.samples=1;self.scene.render.threads_mode='FIXED';self.scene.render.threads=4
  self.scene.view_settings.view_transform='Standard';self.scene.world.color=(.18,.18,.18)
  self.image=bpy.data.images.load(str(self.directory/'turnaround.png'));self.image.pack()
  self.parts=[];self.joints=joints;self.material=bpy.data.materials.new(name+' / reference projection');self.material.use_nodes=True
  n=self.material.node_tree.nodes;l=self.material.node_tree.links;bs=n.get('Principled BSDF');bs.inputs['Roughness'].default_value=.75
  a=n.new('ShaderNodeTexImage');a.image=self.image;u=n.new('ShaderNodeUVMap');u.uv_map='Reference';l.new(u.outputs[0],a.inputs['Vector'])
  b=n.new('ShaderNodeTexImage');b.image=self.image;u=n.new('ShaderNodeUVMap');u.uv_map='Side';l.new(u.outputs[0],b.inputs['Vector'])
  fac=n.new('ShaderNodeAttribute');fac.attribute_name='SideBlend';mix=n.new('ShaderNodeMixRGB');l.new(fac.outputs['Fac'],mix.inputs[0]);l.new(a.outputs[0],mix.inputs[1]);l.new(b.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],bs.inputs['Base Color'])
  self.projection=mix
 def point(self,x,y,depth=0):return ((x-self.cx)*self.scale,depth*self.scale,(self.floor-y)*self.scale)
 def mesh(self,name,vertices,faces,bone,surface='fabric',weights=None,smooth=True,side_blend=True):
  m=bpy.data.meshes.new(name);m.from_pydata([self.point(*v) for v in vertices],[],faces);m.update();o=bpy.data.objects.new(name,m);self.scene.collection.objects.link(o);o.data.materials.append(self.material)
  ref=m.uv_layers.new(name='Reference');side=m.uv_layers.new(name='Side');blend=m.attributes.new('SideBlend','FLOAT','CORNER');surf=m.color_attributes.new(name='Surface',type='FLOAT_COLOR',domain='CORNER')
  # Adding corner layers may reallocate CustomData; reacquire RNA references.
  ref=m.uv_layers['Reference'];side=m.uv_layers['Side'];blend=m.attributes['SideBlend'];surf=m.color_attributes['Surface']
  metal,rough,emit={'fabric':(0,.91,0),'leather':(0,.72,0),'skin':(0,.64,0),'metal':(.72,.43,0),'darkmetal':(.55,.5,0),'glass':(.45,.2,.35),'glow':(.25,.35,1)}[surface]
  width,height=self.image.size
  for p in m.polygons:
   p.use_smooth=smooth
   # Keep each polygon in one projection island. Choosing per vertex could
   # interpolate through the gray gap between front/back reference figures.
   front=sum(vertices[m.loops[li].vertex_index][2] for li in p.loop_indices)/len(p.loop_indices)<=0
   for li in p.loop_indices:
    idx=m.loops[li].vertex_index;x,y,d=vertices[idx];px=x if front else self.bx-(x-self.cx)
    # Blending towards the side photograph removes the stretched tangent seam.
    t=max(0,min(1,(abs(p.normal.x)-.42)/.48)) if side_blend else 0
    ref.data[li].uv=(px/width,1-y/height);side.data[li].uv=((self.sx+d*self.side_direction)/width,1-y/height);blend.data[li].value=t;surf.data[li].color=(0,rough,metal,1)
  if weights:
   for i,v in enumerate(vertices):
    for group,w in weights(v).items():
     if w>0:
      vg=o.vertex_groups.get(group) or o.vertex_groups.new(name=group);vg.add([i],w,'REPLACE')
  else:o.vertex_groups.new(name=bone).add(list(range(len(vertices))),1,'REPLACE')
  o['surface']=surface;self.parts.append(o);return o
 def loft(self,name,rows,bone,surface='fabric',weights=None,sides=28,steps=3):
  rr=[]
  for a,b in zip(rows,rows[1:]):
   for i in range(steps):
    t=i/steps;rr.append([x*(1-t)+y*t for x,y in zip(a,b)])
  rr.append(rows[-1]);v=[];f=[]
  for y,cx,rx,rz,cy in rr:
   for i in range(sides):
    t=2*math.pi*i/sides;v.append((cx+rx*math.cos(t),y,cy+rz*math.sin(t)))
  for j in range(len(rr)-1):
   for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;f.append((a,b,b+sides,a+sides))
  f.extend([tuple(reversed(range(sides))),tuple((len(rr)-1)*sides+i for i in range(sides))])
  # Rows run down the body, hence reverse the side winding to face outwards.
  o=self.mesh(name,v,[tuple(reversed(p)) for p in f],bone,surface,weights)
  if 'trouser' in name.lower():
   # The construction side view's hanging hand occludes the hip. Sample clean
   # cloth from the corresponding front leg instead of baking a ghost hand.
   uv=o.data.uv_layers['Side']
   for loop in o.data.loops:
    idx=loop.vertex_index;row=rr[min(len(rr)-1,idx//sides)];y,cx,rx,rz,cy=row
    clean_x=self.cx+(-65 if cx<self.cx else 65)+math.cos(idx%sides/sides*math.pi*2)*5
    clean_y=480+max(0,min(1,(y-425)/441))*40
    uv.data[loop.index].uv=(clean_x/self.image.size[0],1-clean_y/self.image.size[1])
  return o
 def plate(self,name,points,depth,bone,thickness=5,surface='metal',bulge=5):
  # Convex fan with beveled rim. Actual depth remains visible from the side.
  cx=sum(x for x,y in points)/len(points);cy=sum(y for x,y in points)/len(points);n=len(points)
  v=[(cx,cy,depth-bulge)]+[(x,y,depth) for x,y in points]+[(x,y,depth+thickness) for x,y in points];f=[]
  for i in range(n):j=(i+1)%n;f.append((0,1+j,1+i));f.append((1+i,1+j,1+n+j,1+n+i))
  f.append(tuple(1+n+i for i in range(n)))
  return self.mesh(name,v,f,bone,surface,smooth=False,side_blend=False)
 def sphere(self,name,x,y,depth,rx,ry,rz,bone,surface='metal',segments=20,rings=12):
  v=[];f=[]
  for j in range(rings+1):
   t=math.pi*j/rings
   for i in range(segments):
    a=2*math.pi*i/segments;v.append((x+rx*math.sin(t)*math.cos(a),y-ry*math.cos(t),depth+rz*math.sin(t)*math.sin(a)))
  for j in range(rings):
   for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;f.append((a,a+segments,b+segments,b))
  return self.mesh(name,v,f,bone,surface)
 def silhouette(self,name,points,depth,bone,thickness=5,surface='metal'):
  poly=[Vector((x,y,0)) for x,y in points];lookup={(p.x,p.y):i for i,p in enumerate(poly)};n=len(poly)
  v=[(x,y,depth) for x,y in points]+[(x,y,depth+thickness) for x,y in points];f=[]
  for tri in tessellate_polygon([poly]):
   indices=tuple(p if isinstance(p,int) else lookup[(p.x,p.y)] for p in tri);f.append(indices);f.append(tuple(n+i for i in reversed(indices)))
  for i in range(n):j=(i+1)%n;f.append((i,j,j+n,i+n))
  return self.mesh(name,v,f,bone,surface,smooth=False,side_blend=False)
 def chain(self,a,b,start,end):
  def weight(v):
   t=max(0,min(1,(v[1]-start)/(end-start)));t=max(0,min(1,(t-.65)/.35))*.48
   return {a:1-t,b:t}
  return weight
 def cape(self,rows,bone='chest',columns=32,drape_range=None):
  v=[];f=[];top,bottom=drape_range or (rows[0][0],rows[-1][0])
  for row,(y,width,depth) in enumerate(rows):
   for i in range(columns+1):
    t=i/columns;x=self.cx+(t-.5)*width;d=depth+math.cos(t*math.pi*12)*(2+(y-top)/(bottom-top)*8)
    # Side ridges keep a heavy fabric cape from reading as a flat card.
    v.append((x,y+(math.sin(t*math.pi*8)*3 if row==len(rows)-1 else 0),d))
  for j in range(len(rows)-1):
   for i in range(columns):a=j*(columns+1)+i;f.append((a,a+1,a+columns+2,a+columns+1))
  def drape(vertex):
   t=max(0,min(1,(vertex[1]-top)/(bottom-top)));hold=t*t*(3-2*t)*.85
   return {bone:1-hold,'root':hold}
  return self.mesh('Tailored cape',v,f,bone,'fabric',weights=drape,side_blend=False)
 def fingers(self,side,palm,ends,size=1):
  x,y,d=palm
  self.sphere(side+' articulated palm',x,y,d,13*size,21*size,8*size,'hand'+side,'leather')
  for i,(ex,ey) in enumerate(ends):
   sx=x+(i-1.5)*6 if i<4 else x+(18 if side=='L' else -18);sy=y+10 if i<4 else y-2
   rows=[(sy,sx,3.4*size,4*size,d),(sy+(ey-sy)*.42,sx+(ex-sx)*.45,3.8*size,4*size,d-2),(ey,ex,2.7*size,3*size,d-8)]
   self.loft(side+' finger '+str(i),rows,'finger'+side+str(i),'leather',sides=10,steps=2)
   self.joints['finger'+side+str(i)]=(sx,sy,d)
 def armature(self):
  data=bpy.data.armatures.new(self.name+' skeleton');o=bpy.data.objects.new(self.name,data);self.scene.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
  parents={'root':None,'hips':'root','spine':'hips','chest':'spine','neck':'chest','head':'neck'}
  for side in ['L','R']:
   parents.update({f'shoulder{side}':'chest',f'arm{side}':f'shoulder{side}',f'forearm{side}':f'arm{side}',f'hand{side}':f'forearm{side}',f'thigh{side}':'hips',f'shin{side}':f'thigh{side}',f'foot{side}':f'shin{side}',f'toe{side}':f'foot{side}'})
   for i in range(5):parents[f'finger{side}{i}']=f'hand{side}'
  for name,parent in parents.items():
   b=data.edit_bones.new(name);b.head=self.point(*self.joints[name]);b.tail=b.head+Vector((0,0,.05));
   if parent:b.parent=data.edit_bones[parent]
  bpy.ops.object.mode_set(mode='OBJECT');return o
 def bake(self,body):
  m=self.material;n=m.node_tree.nodes;l=m.node_tree.links;self.scene.render.bake.margin=8
  body.data.uv_layers.new(name='Atlas');body.data.uv_layers.active_index=2;body.data.uv_layers['Atlas'].active_render=True;bpy.context.view_layer.objects.active=body
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.2,island_margin=.005);bpy.ops.object.mode_set(mode='OBJECT')
  target=n.new('ShaderNodeTexImage');albedo=bpy.data.images.new(self.id+' albedo',width=3072,height=3072,alpha=False);target.image=albedo;n.active=target
  bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'});albedo.pack()
  surface=bpy.data.images.new(self.id+' surface',width=1536,height=1536,alpha=False);surface.colorspace_settings.name='Non-Color';target.image=surface;n.active=target
  attr=n.new('ShaderNodeVertexColor');attr.layer_name='Surface';emit=n.new('ShaderNodeEmission');l.new(attr.outputs[0],emit.inputs[0]);output=n.get('Material Output');l.new(emit.outputs[0],output.inputs[0]);bpy.ops.object.bake(type='EMIT');surface.pack()
  n.clear();bs=n.new('ShaderNodeBsdfPrincipled');output=n.new('ShaderNodeOutputMaterial');l.new(bs.outputs[0],output.inputs[0]);tex=n.new('ShaderNodeTexImage');tex.image=albedo;l.new(tex.outputs[0],bs.inputs['Base Color']);l.new(tex.outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.08
  props=n.new('ShaderNodeTexImage');props.image=surface;split=n.new('ShaderNodeSeparateColor');l.new(props.outputs[0],split.inputs[0]);l.new(split.outputs['Green'],bs.inputs['Roughness']);l.new(split.outputs['Blue'],bs.inputs['Metallic'])
  for uv in list(body.data.uv_layers):
   if uv.name!='Atlas':body.data.uv_layers.remove(uv)
  for attr in list(body.data.color_attributes):body.data.color_attributes.remove(attr)
  return albedo,surface
 def finish(self):
  bpy.ops.object.select_all(action='DESELECT')
  for o in self.parts:o.select_set(True)
  bpy.context.view_layer.objects.active=self.parts[0];bpy.ops.object.join();body=bpy.context.object;body.name=self.name+' / reference-fitted mesh'
  # Preserve outward winding, including caps and thin armor bevels.
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
  self.bake(body);rig=self.armature();body.parent=rig;mod=body.modifiers.new('Game skeleton','ARMATURE');mod.object=rig
  bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
  self.scene.cycles.samples=16;self.scene.render.resolution_x=720;self.scene.render.resolution_y=960;self.scene.render.resolution_percentage=100
  data=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',data);self.scene.collection.objects.link(cam);self.scene.camera=cam;data.type='ORTHO';data.ortho_scale=2.12
  for name,pos,power,size in [('Key',(-3,-4,5),300,5),('Fill',(3,-2,3),180,4),('Rim',(1,3,4),260,3)]:
   light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size;o=bpy.data.objects.new(name,light);self.scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
  self.scene.render.film_transparent=False;self.scene.world.color=(.12,.16,.19)
  cam.location=(0,-5,.95);cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler()
  body['reference']='Original cover + generated orthographic construction views';body['hidden_surfaces']='Interpreted from construction reference';rig['production_roster']=215
  bpy.ops.wm.save_as_mainfile(filepath=str(self.directory/(self.id+'.blend')),compress=True)
  def export(suffix='',materials='EXPORT'):
   bpy.ops.export_scene.gltf(filepath=str(self.out/(self.id+suffix+'.glb')),export_format='GLB',use_selection=True,export_skins=True,export_animations=False,export_yup=True,export_image_format='JPEG',export_jpeg_quality=91,export_materials=materials,export_attributes=False)
  export();triangles=sum(len(p.vertices)-2 for p in body.data.polygons)
  for name,pos in [('front',(0,-5,.95)),('side',(5,0,.95)),('back',(0,5,.95)),('three-quarter',(2.8,-5,1.05))]:
   cam.location=pos;cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler();self.scene.render.filepath=str(self.directory/(name+'.png'));bpy.ops.render.render(write_still=True)
  bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('Distance topology','DECIMATE');mod.ratio=.28;bpy.ops.object.modifier_apply(modifier=mod.name);export('-lod','NONE')
  report={'name':self.name,'triangles':triangles,'lodTriangles':sum(len(p.vertices)-2 for p in body.data.polygons),'bones':len(rig.data.bones),'materials':len(body.data.materials),'glbBytes':(self.out/(self.id+'.glb')).stat().st_size,'status':'visual-review-required','source':'Original cover and generated construction sheet; hidden surfaces inferred'}
  (self.directory/'production.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
