"""Jim review sculpt. Original 3D surfaces, 32-joint game skin, two clothing styles.
Run: /tmp/jim-blender/bin/python scripts/art/build-jim.py [normal|golf] [--quick]
The supplied close-up anchors identity; clothing references guide albedo.
Nothing here registers a production cosmetic or changes the live build.
"""
import bpy, bmesh, math, random, json, sys
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
ROOT=Path(__file__).resolve().parents[2];DIR=ROOT/'art/jim';OUT=DIR/'models';OUT.mkdir(exist_ok=True)
STYLE=sys.argv[1] if len(sys.argv)>1 else 'normal';QUICK='--quick' in sys.argv
assert STYLE in ['normal','golf']
random.seed(173)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20 if QUICK else 40;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=6;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.world.color=(.18,.18,.18)
S=1.82/811;FLOOR=826;CX=225 if STYLE=='normal' else 1111;BX=665 if STYLE=='normal' else 1553
image=bpy.data.images.load(str(DIR/'textures/clothing-reference.png'));image.pack()
FACE_SPEC=json.loads((DIR/'face-landmarks.json').read_text())
faceImage=bpy.data.images.load(str(DIR/FACE_SPEC['reference']));faceImage.pack()
from jim_detail_geometry import build_identity, build_footwear
from PIL import Image
referencePixels=Image.open(DIR/'textures/clothing-reference.png').convert('RGB')
facePixels=Image.open(DIR/FACE_SPEC['reference']).convert('RGB')
parts=[];groups={'body':[],'face':[],'hair':[],'cards':[],'footwear':[]}
joints={'root':(0,0,0),'hips':(0,0,.94),'spine':(0,0,1.12),'chest':(0,0,1.34),'neck':(0,0,1.505),'head':(0,0,1.66)}
parents={'root':None,'hips':'root','spine':'hips','chest':'spine','neck':'chest','head':'neck'}
for sign,side in [(-1,'L'),(1,'R')]:
 for name,parent,x,y,z in [('shoulder','chest',.205,0,1.43),('arm','shoulder',.245,0,1.42),('forearm','arm',.31,0,1.14),('hand','forearm',.365,-.004,.835),('thigh','hips',.11,0,.90),('shin','thigh',.145,-.009,.485),('foot','shin',.16,0,.105),('toe','foot',.17,-.14,.04)]:
  n=name+side;joints[n]=(sign*x,y,z);parents[n]=parent if parent in ['chest','hips'] else parent+side
 for i in range(5):
  n='finger'+side+str(i);joints[n]=(sign*(.365+(i-1.5)*.012 if i<4 else .337),-.008 if i<4 else -.018,.785 if i<4 else .807);parents[n]='hand'+side

def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def weights_body(v):
 z=v[2]
 if z<1.02:return {'hips':1}
 if z<1.19:t=smooth(1.02,1.19,z);return {'hips':1-t,'spine':t}
 t=smooth(1.19,1.37,z);return {'spine':1-t,'chest':t}
def weights_arm(side):
 def f(v):
  z=v[2];t=smooth(1.19,1.09,z);w=smooth(.88,.81,z)
  if z>1.38:
   a=smooth(.16,.27,abs(v[0]));return {'chest':1-a,'arm'+side:a}
  if z>.91:return {'arm'+side:1-t,'forearm'+side:t}
  return {'forearm'+side:1-w,'hand'+side:w}
 return f
def weights_leg(side):
 def f(v):
  z=v[2];t=smooth(.54,.435,z);a=smooth(.16,.08,z)
  if z>.80:p=smooth(.80,.99,z);return {'hips':p,'thigh'+side:1-p}
  if z>.2:return {'thigh'+side:1-t,'shin'+side:t}
  return {'shin'+side:1-a,'foot'+side:a}
 return f

def solid(name,color,rough=.7,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;n=m.node_tree.nodes;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;return m
skin=solid('Jim / skin',(.58,.33,.225),.64);nail=solid('Jim / nails',(.64,.38,.30),.54)
clothColor=(.066,.083,.119) if STYLE=='normal' else (.80,.81,.79)
cloth=solid('Jim / garment base',clothColor,.94);black=solid('Jim / shorts',(.012,.016,.022),.9)
white=solid('Jim / golf glove',(.78,.78,.74),.7);dark=solid('Jim / stitching and sole',(.025,.025,.024),.9)
metal=solid('Jim / brushed hardware',(.35,.36,.36),.35,.65);suede=solid('Jim / sand suede',(.30,.215,.142),.93)

# Two-sided anatomical projection with clean tangent blending. Tangents are
# cloth/skin color, never a stretched strip of the construction background.
def projection_material(name,img,face=False):
 m=solid(name,(.5,.5,.5),.67 if face else .91);nodes=m.node_tree.nodes;links=m.node_tree.links;bs=nodes.get('Principled BSDF')
 uv=nodes.new('ShaderNodeUVMap');uv.uv_map='Projection';tex=nodes.new('ShaderNodeTexImage');tex.image=img;tex.extension='EXTEND';links.new(uv.outputs[0],tex.inputs['Vector'])
 color=nodes.new('ShaderNodeVertexColor');color.layer_name='CleanSide';weight=nodes.new('ShaderNodeAttribute');weight.attribute_name='ProjectionWeight'
 mix=nodes.new('ShaderNodeMixRGB');links.new(weight.outputs['Fac'],mix.inputs[0]);links.new(color.outputs[0],mix.inputs[1]);links.new(tex.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],bs.inputs['Base Color'])
 return m
bodyMat=projection_material('Jim / garment and leg projection',image);faceMat=projection_material('Jim / detailed face projection',faceImage,True)
shortsMat=projection_material('Jim / clean shorts projection',image)
ns=shortsMat.node_tree.nodes;ls=shortsMat.node_tree.links;tx=next(n for n in ns if n.type=='TEX_IMAGE');mix=next(n for n in ns if n.type=='MIX_RGB');attr=next(n for n in ns if n.type=='ATTRIBUTE')
sep=ns.new('ShaderNodeSeparateColor');ls.new(tx.outputs['Color'],sep.inputs[0]);valid=ns.new('ShaderNodeMath');valid.operation='LESS_THAN';valid.inputs[1].default_value=.14;ls.new(sep.outputs[0],valid.inputs[0]);weight=ns.new('ShaderNodeMath');weight.operation='MULTIPLY';ls.new(valid.outputs[0],weight.inputs[0]);ls.new(attr.outputs['Fac'],weight.inputs[1]);ls.new(weight.outputs[0],mix.inputs[0])


def mesh(name,verts,faces,bone='root',group='body',mat=None,weight=None,sideColor=None,face=False):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free();data.update()
 data.materials.append(mat or (faceMat if face else bodyMat))
 uv=data.uv_layers.new(name='Projection');data.color_attributes.new(name='CleanSide',type='FLOAT_COLOR',domain='CORNER');data.attributes.new('ProjectionWeight','FLOAT','CORNER')
 uv=data.uv_layers['Projection'];col=data.color_attributes['CleanSide'];blend=data.attributes['ProjectionWeight']
 for p in data.polygons:
  p.use_smooth=True;front=p.normal.y<0
  for li in p.loop_indices:
   v=data.vertices[data.loops[li].vertex_index];x,y,z=v.co
   if face:
    scale=FACE_SPEC['metersPerPixel'];cx,cy=FACE_SPEC['originPixel'];fw,fh=FACE_SPEC['imageSize']
    u=(cx+x/scale)/fw;fy=cy-(z-FACE_SPEC['chinHeight'])/scale
    if 'Neck' in name:fy=min(864,fy)
    vv=1-max(0,min(fh-1,fy))/fh
    w=smooth(.03,.75,-v.normal.y) if front else 0
   else:
    u=(CX+x/S if front else BX-x/S)/1774;vv=1-(FLOOR-z/S)/887
    w=1-smooth(.50,.97,abs(v.normal.x))
    # Clamp projection to the photographed garment/skin rather than borrowing
    # gray background at silhouette tangents or where the two A-poses differ.
    if mat is None:
     px=max(0,min(1773,int(u*1774)));py=max(0,min(886,int((1-vv)*887)))
     def valid(xx):
      r,g,b=referencePixels.getpixel((xx,py))
      if 'bare' in name.lower():return r>b+17 and r>g+7
      if 'shorts' in name.lower():return r<110 and b>=r
      if any(k in name.lower() for k in ['hoodie','sleeve','pocket']):return r>178 if STYLE=='golf' else b>r+10 and r<135
      if 'polo' in name.lower():return r>175
      return True
     if ('hoodie' in name.lower() and z>1.43):w=0
     elif not valid(px):
      candidates=[x for d in range(1,35) for x in [px-d,px+d] if 0<=x<1774 and valid(x)]
      if candidates:u=(candidates[0]+.5)/1774
      else:w=0
   if STYLE=='golf' and 'bare leg' in name.lower():w*=smooth(.245,.29,z)
   uv.data[li].uv=(u,vv);col.data[li].color=(*(sideColor or ((.085,.049,.029) if group=='hair' else (.58,.33,.225))),1);blend.data[li].value=w
 for i,v in enumerate(verts):
  weights=weight(v) if weight else {bone:1}
  for b,w in weights.items():
   if w>1e-6:(o.vertex_groups.get(b) or o.vertex_groups.new(name=b)).add([i],w,'REPLACE')
 groups[group].append(o);parts.append(o);return o

def ellipsoid(name,c,r,bone='head',group='body',mat=None,segments=28,rings=16,weight=None,face=False,sideColor=None):
 v=[];f=[]
 for j in range(rings+1):
  a=math.pi*j/rings
  for i in range(segments):
   t=math.tau*i/segments;v.append((c[0]+r[0]*math.sin(a)*math.cos(t),c[1]+r[1]*math.sin(a)*math.sin(t),c[2]+r[2]*math.cos(a)))
 for j in range(rings):
  for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;f.append((a,a+segments,b+segments,b))
 return mesh(name,v,f,bone,group,mat,weight,sideColor,face)

def loft(name,rows,bone='root',group='body',mat=None,weight=None,sides=48,steps=3,wrinkle=0,sideColor=None,face=False):
 # z, center x, radius x, radius depth, center depth; C1 interpolation.
 rr=[]
 for k,(a,b) in enumerate(zip(rows,rows[1:])):
  before=rows[max(0,k-1)];after=rows[min(len(rows)-1,k+2)]
  for j in range(steps):
   t=j/steps;rr.append([.5*((2*a[i])+(-before[i]+b[i])*t+(2*before[i]-5*a[i]+4*b[i]-after[i])*t*t+(-before[i]+3*a[i]-3*b[i]+after[i])*t*t*t) for i in range(5)])
 rr.append(rows[-1]);v=[];f=[]
 for j,(z,cx,rx,ry,cy) in enumerate(rr):
  for i in range(sides):
   a=math.tau*i/sides;wave=wrinkle*(.42*math.sin(a*7+z*21)+.3*math.sin(a*11-z*36)+.18*math.sin(a*17+z*71));x=cx+(rx+wave)*math.cos(a);y=cy+(ry+wave)*math.sin(a)
   v.append((x,y,z))
 for j in range(len(rr)-1):
  for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;f.append((a,b,b+sides,a+sides))
 f.extend([tuple(reversed(range(sides))),tuple((len(rr)-1)*sides+i for i in range(sides))])
 return mesh(name,v,f,bone,group,mat,weight,sideColor,face)

def pxrows(rows,center=0):return [((FLOOR-y)*S,(x+center)*S,rx*S,ry*S,depth*S) for y,x,rx,ry,depth in rows]
def tube(name,points,radius,bone,group='body',mat=None,sides=7,weight=None,taper=True,face=False):
 v=[];f=[]
 for j,p in enumerate(points):
  P=Vector(p);tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)]);tangent.normalize();n=tangent.cross(Vector((0,1,0)))
  if n.length<.01:n=tangent.cross(Vector((1,0,0)))
  n.normalize();b=tangent.cross(n).normalized();r=radius*(.38+.62*math.sin(math.pi*(.06+.88*j/(len(points)-1)))**.4) if taper else radius
  for i in range(sides):v.append(tuple(P+r*(n*math.cos(math.tau*i/sides)+b*math.sin(math.tau*i/sides))))
 for j in range(len(points)-1):
  for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;f.append((a,b,b+sides,a+sides))
 f.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+i for i in range(sides))])
 return mesh(name,v,f,bone,group,mat,weight,face=face)

def patch(name,points,depth,bone='chest',mat=None,weight=None,thickness=.002):
 # Polygon face with an actual bevel-like raised center and closed backing.
 center=tuple(sum(p[k] for p in points)/len(points) for k in range(2));n=len(points)
 verts=[(center[0],depth-.002,center[1])]+[(x,depth,z) for x,z in points]+[(x,depth+thickness,z) for x,z in points]
 faces=[]
 for i in range(n):j=(i+1)%n;faces.extend([(0,1+i,1+j),(1+i,1+n+i,1+n+j,1+j)])
 faces.append(tuple(range(n+1,2*n+1)))
 return mesh(name,verts,faces,bone,'body',mat,weight,clothColor)

# Both styles share the photo-aligned facial mesh and curl silhouette.
build_identity(globals())
if '--identity-preview' in sys.argv:
 from mathutils import Vector
 scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.4,.4,.4,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.6
 for position,power in [((-3,-4,5),350),((3,-3,3),220)]:
  d=bpy.data.lights.new('Preview light','AREA');d.energy=power;d.size=4;o=bpy.data.objects.new('Preview light',d);scene.collection.objects.link(o);o.location=position;o.rotation_euler=(Vector((0,0,1.68))-o.location).to_track_quat('-Z','Y').to_euler()
 cd=bpy.data.cameras.new('Preview camera');cam=bpy.data.objects.new('Preview camera',cd);scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO';cd.ortho_scale=.39
 scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.cycles.samples=16
 for view,position in [('front',(0,-3,1.684)),('angle',(1.5,-3,1.684)),('back',(0,3,1.684))]:
  cam.location=position;cam.rotation_euler=(Vector((0,0,1.684))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(DIR/('review/identity-preview-'+view+'.png'));bpy.ops.render.render(write_still=True)
 sys.exit(0)
# Shaped torso. Generated cloth color is projected only onto its corresponding
# 3D garment, with actual seam, pocket, collar and hem surfaces on top.
if STYLE=='normal':
 torso=[(155,0,22,22,2),(166,0,43,30,0),(176,0,76,39,0),(202,0,92,44,0),(244,0,90,47,0),(286,0,86,45,0),(330,0,85,44,0),(365,0,88,44,0),(394,0,91,43,0),(414,0,87,39,0),(426,0,85,38,0),(440,0,84,38,0)]
else:torso=[(154,0,22,22,2),(164,0,43,30,0),(174,0,70,36,0),(198,0,88,41,0),(240,0,83,42,0),(280,0,78,40,0),(323,0,73,39,0),(350,0,76,38,0),(365,0,74,36,0),(371,0,72,35,0)]
loft('Jim / '+('heavyweight raglan hoodie' if STYLE=='normal' else 'tucked pique polo'),pxrows(torso),weight=weights_body,sides=64,steps=3,wrinkle=.0022 if STYLE=='normal' else .0016,sideColor=clothColor)
if STYLE=='normal':
 # A clean soft neckline covers the source photograph's open throat pixels.

 for side in [-1,1]:
  pts=[(side*.050*t,-.052-.012*(1-t*t),1.483+.016*t*t) for t in [i/20 for i in range(21)]]
  tube('Soft overlapping hood neckline',pts,.004,'chest',mat=cloth,taper=False)
 # Back hood volume, open at the neck, attached to shoulder instead of the head.
 hood=[];hf=[]
 for j in range(15):
  t=j/14
  for i in range(33):
   a=math.pi*i/32;hood.append((math.cos(a)*(.075+.035*math.sin(math.pi*t)),.023+math.sin(a)*(.065+.05*math.sin(math.pi*t)*t),1.50-.165*t*(.2+.8*math.sin(a))+.01*math.sin(a)))
 for j in range(14):
  for i in range(32):a=j*33+i;hf.append((a,a+1,a+34,a+33))
 mesh('Jim / draped open hood',hood,hf,'chest',weight=weights_body,sideColor=clothColor)
 for side in [-1,1]:
  pts=[(side*(.045+.045*t),-.042-.030*math.sin(math.pi*t),1.512-.055*t) for t in [i/18 for i in range(19)]]
  tube('Hood opening welt',pts,.005,'chest',mat=cloth,taper=False)
  pix=[(205,178),(207,212),(207,253)] if side<0 else [(252,177),(259,219),(267,270)]
  pts=[]
  for k in range(2):
   A,B=pix[k],pix[k+1]
   for j in range(12):
    t=j/11;xx=A[0]+(B[0]-A[0])*t;yy=A[1]+(B[1]-A[1])*t;pts.append(((xx-225)*S,-.103,(826-yy)*S))
  tube('Cotton drawstring',pts,.0016,'chest',mat=cloth,taper=False)
  end=Vector(pts[-1]);tube('Drawstring metal aglet',[tuple(end+Vector((0,0,.005))),tuple(end-Vector((0,0,.006)))],.0018,'chest',mat=metal,taper=False)
 pts=[(-.119,1.098),(.119,1.098),(.163,.985),(.15,.929),(-.15,.929),(-.163,.985)]
 patch('Jim / raised kangaroo pocket',pts,-.105,weight=weights_body)
 for sign in [-1,1]:
  points=[(sign*(.119+.044*t),-.109,1.098-.114*t) for t in [i/18 for i in range(19)]]
  tube('Pocket double stitched entry',points,.0013,'spine',mat=cloth,weight=weights_body,taper=False)
 # Front raglan seams follow the diagonal shoulder rather than a printed badge.
 for sign in [-1,1]:
  points=[(sign*(.061+.15*t),-.064-.025*math.sin(t*math.pi),1.48-.22*t) for t in [i/22 for i in range(23)]]
  tube('Raglan double seam',points,.0011,'chest',mat=cloth,weight=weights_body,taper=False)
 # Rib waistband (physical grooves at a restrained scale).
 for n in range(0):
  a=math.tau*n/64;points=[(.190*math.cos(a),.086*math.sin(a),z) for z in [.868,.907]]
  tube('Waistband rib',points,.00055,'hips',mat=cloth,taper=False,sides=4)
 label=solid('Tiny woven hem label',(.28,.19,.12),.9)
 patch('Small woven hem tab',[(.125,.927),(.154,.930),(.153,.943),(.124,.941)],-.102,'hips',label)
else:
 # Rolled collar, open throat and folded tips, with a proper raised placket.
 for sign in [-1,1]:
  collar=patch('Polo collar folded point',[(sign*.016,1.456),(sign*.061,1.414),(sign*.091,1.447),(sign*.064,1.498),(sign*.037,1.513)],-.066,'chest',white)
  for vertex in collar.data.vertices:vertex.co.y=-.02-(1.51-vertex.co.z)*.50
  tube('Collar rolled edge',[(sign*.04,-.04,1.51),(sign*.065,-.048,1.496),(sign*.09,-.065,1.449),(sign*.061,-.069,1.417)],.002,'chest',mat=white,taper=False)
 patch('Polo button placket',[(-.010,1.443),(.012,1.443),(.012,1.327),(-.010,1.327)],-.096,'chest',white)
 for z in [1.352,1.39]:ellipsoid('Polo pearl button',(.003,-.100,z),(.003,.0015,.003),'chest',mat=white,segments=12,rings=8)
 # Belt over the tailored waistband, including leather tab and open buckle.
 loft('Golf woven patterned belt',pxrows([(365,0,74,37,0),(390,0,75,38,0)]),'hips',sides=64,steps=2,sideColor=(.20,.18,.16))
 leather=solid('Golf belt brown leather',(.16,.055,.025),.73)
 patch('Golf belt leather tongue',[(-.033,.979),(.049,.979),(.049,1.008),(-.033,1.008)],-.090,'hips',leather)
 tube('Golf belt rectangular buckle',[(-.023,-.095,.979),(.022,-.095,.979),(.022,-.095,1.011),(-.023,-.095,1.011),(-.023,-.095,.979)],.0022,'hips',mat=metal,taper=False)

# Shorts use matched front/back projections; upper pelvis and leg volumes meet
# inside the garment, above the visible crotch. Leg skin is separate beneath.
navy=(.018,.027,.041) if STYLE=='golf' else (.012,.016,.022)
waist=377 if STYLE=='golf' else 431
loft('Jim / shorts pelvis',pxrows([(waist,0,76 if STYLE=='golf' else 84,38,0),(450,0,84,43,0),(475,0,82,42,0),(495,0,66,35,0),(509,0,46,25,0)]),'hips',weight=weights_body,sides=56,steps=3,wrinkle=.0018,sideColor=navy)
for sign,side in [(-1,'L'),(1,'R')]:
 shortrows=[(452,sign*43,42,42,0),(480,sign*45,43,43,0),(510,sign*47,43,42,0),(548,sign*49,44,40,0),(562,sign*49,43,40,0)]
 loft(side+' tailored shorts leg',pxrows(shortrows),'thigh'+side,weight=weights_leg(side),sides=40,steps=3,wrinkle=.0018,sideColor=navy)
 legrows=[(546,sign*50,29,30,2),(577,sign*53,29,29,1),(603,sign*58,25,26,-1),(624,sign*62,23,25,-1),(645,sign*65,26,27,2),(672,sign*67,25,28,3),(709,sign*70,21,22,2),(744,sign*71,16,17,1),(777,sign*72,13,15,0),(791,sign*72,14,16,-1)]
 if STYLE=='golf':legrows=legrows[:8]+[(754,sign*71.5,15,16,0)]
 loft(side+' bare leg anatomy',pxrows(legrows),'thigh'+side,weight=weights_leg(side),sides=40,steps=3,sideColor=(.55,.31,.21))
 # Small patellar volume makes the knee read under real grazing light.
 ellipsoid(side+' patella',(sign*.139,-.051,.476),(.024,.007,.028),'shin'+side,skin,mat=skin,segments=20,rings=12,weight=weights_leg(side)) if False else None
 # Sleeve/body proportions use the same shoulder/elbow pivots in both styles.
 sleeve=[(166,sign*61,7,9,0),(180,sign*78,17,24,0),(195,sign*91,19,28,0),(210,sign*98,19,29,0),(240,sign*104,23,30,0),(270,sign*112,24,28,0),(300,sign*121,25,27,0),(330,sign*130,25,26,0),(360,sign*139,24,25,0),(400,sign*143,21,23,0),(421,sign*157,17,21,0),(435,sign*162,15,18,0),(451,sign*163,15,17,0)]
 if STYLE=='golf':sleeve=sleeve[:5]+[(270,sign*119,25,29,0),(279,sign*120,25,29,0)]
 loft(side+' sleeve',pxrows(sleeve),'arm'+side,weight=weights_arm(side),sides=40,steps=3,wrinkle=.0018,sideColor=clothColor)
 if STYLE=='golf':
  armrows=[(271,sign*119,21,24,0),(310,sign*129,20,22,0),(342,sign*138,18,20,0),(368,sign*145,20,21,0),(405,sign*155,17,18,0),(436,sign*162,14,15,0),(455,sign*164,13,14,0)]
  loft(side+' bare forearm',pxrows(armrows),'forearm'+side,mat=skin,weight=weights_arm(side),sides=32,steps=3,sideColor=(.58,.33,.225))
 handmat=white if STYLE=='golf' and side=='R' else skin
 hx=sign*.366
 loft(side+' anatomical wrist',[(.875,sign*.358,.022,.019,0),(.842,hx,.020,.018,0),(.810,hx,.023,.019,0)],'hand'+side,mat=handmat,weight=weights_arm(side),sides=24,steps=2)
 ellipsoid(side+' anatomical palm',(hx,-.004,.798),(.027,.018,.047),'hand'+side,mat=handmat,segments=24,rings=14)
 # Separate tapered digits and thumb with subtle articulated knuckles/nails.
 for i in range(5):
  start=Vector(joints['finger'+side+str(i)]);length=[.057,.066,.061,.047,.044][i]
  pts=[tuple(start+Vector((sign*(.005*t if i<4 else -.012*t),-.004*t-.010*t*t,-length*t))) for t in [j/10 for j in range(11)]]
  tube(side+' finger '+str(i),pts,.0065 if i<4 else .008,'finger'+side+str(i),mat=handmat,sides=8)
  if handmat==skin:
   end=Vector(pts[-2]);ellipsoid(side+' nail '+str(i),tuple(end+Vector((0,-.005,.002))),(.0045,.0012,.006),'finger'+side+str(i),mat=nail,segments=12,rings=8)
 if STYLE=='golf' and side=='R':
  patch('Golf glove closure',[(.387,.826),(.346,.826),(.346,.852),(.387,.852)],-.024,'handR',white)
  ellipsoid('Golf glove dark emblem',(.370,-.026,.837),(.008,.001,.010),'handR',mat=dark,segments=16,rings=10)
 if STYLE=='golf' and side=='L':
  loft('Golf watch strap',[(.859,-.364,.034,.036,0),(.878,-.359,.034,.036,0)],'forearmL',mat=metal,sides=32,steps=2)
  ellipsoid('Golf wristwatch',(-.36,-.041,.868),(.018,.005,.017),'forearmL',mat=metal,segments=20,rings=12)
  ellipsoid('Golf watch dial',(-.36,-.047,.868),(.014,.001,.013),'forearmL',mat=dark,segments=20,rings=12)
 # Dedicated footwear atlas preserves the small reference details in-game.
 build_footwear(globals(),sign,side)

# Unite the overlapping shorts shells before UV baking, so crotch/hip seams
# do not leave a blocky nested panel. Reapply weights from anatomical positions.
shorts=[o for o in groups['body'] if 'shorts' in o.name.lower()]
bpy.ops.object.select_all(action='DESELECT')
for o in shorts:o.select_set(True)
bpy.context.view_layer.objects.active=shorts[0]
for o in shorts:groups['body'].remove(o);parts.remove(o)
bpy.ops.object.join();o=bpy.context.object;o.name='Jim / continuous tailored shorts';bpy.context.view_layer.objects.active=o
mod=o.modifiers.new('Joined garment volume','REMESH');mod.mode='VOXEL';mod.voxel_size=.004;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=o.modifiers.new('Soft garment join','SMOOTH');mod.factor=.65;mod.iterations=3;bpy.ops.object.modifier_apply(modifier=mod.name)
v=[tuple(v.co) for v in o.data.vertices];f=[tuple(p.vertices) for p in o.data.polygons];bpy.data.objects.remove(o,do_unlink=True)
mesh('Jim / continuous tailored shorts',v,f,mat=shortsMat,weight=lambda v:weights_leg('L' if v[0]<0 else 'R')(v),sideColor=navy)
print('GEOMETRY',STYLE,sum(len(p.data.polygons) for p in parts),flush=True)
# Join by rendering material family and bake the projected color into ordinary
# glTF atlases. The exported asset never needs custom shaders or source photos.
def join_group(key):
 bpy.ops.object.select_all(action='DESELECT')
 for o in groups[key]:o.select_set(True)
 bpy.context.view_layer.objects.active=groups[key][0];bpy.ops.object.join();o=bpy.context.object;o.name='Jim / '+key
 return o
meshes=[join_group(k) for k in ['body','face','hair','footwear']]
cards=join_group('cards')
def bake(o,size):
 bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
 o.data.uv_layers.new(name='Atlas');o.data.uv_layers.active=o.data.uv_layers['Atlas'];o.data.uv_layers['Atlas'].active_render=True
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.006);bpy.ops.object.mode_set(mode='OBJECT')
 atlas=bpy.data.images.new(o.name+' albedo',width=size,height=size,alpha=False)
 for m in o.data.materials:
  node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=atlas;m.node_tree.nodes.active=node
 scene.cycles.samples=1;scene.render.bake.margin=8;scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
 bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'});atlas.pack()
 normalAtlas=None
 if 'footwear' in o.name:
  normalAtlas=bpy.data.images.new('Jim / footwear tangent normal',width=size,height=size,alpha=False);normalAtlas.colorspace_settings.name='Non-Color'
  for source in o.data.materials:
   node=source.node_tree.nodes.new('ShaderNodeTexImage');node.image=normalAtlas;source.node_tree.nodes.active=node
  scene.render.bake.normal_space='TANGENT';bpy.ops.object.bake(type='NORMAL');normalAtlas.pack()
 m=solid(o.name+' / baked PBR',(.5,.5,.5),.72 if 'face' in o.name else .9);bs=m.node_tree.nodes.get('Principled BSDF');tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=atlas;m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 if normalAtlas:
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=normalAtlas;normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.45;m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs[0],bs.inputs['Normal'])
 if 'hair' in o.name:bs.inputs['Specular IOR Level'].default_value=.04
 if 'face' in o.name:bs.inputs['Subsurface Weight'].default_value=.035;bs.inputs['Subsurface Radius'].default_value=(.8,.38,.2)
 o.data.materials.clear();o.data.materials.append(m)
 for p in o.data.polygons:p.material_index=0
 for uv in list(o.data.uv_layers):
  if uv.name!='Atlas':o.data.uv_layers.remove(uv)
 for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
 for name in ['ProjectionWeight']:
  if o.data.attributes.get(name):o.data.attributes.remove(o.data.attributes[name])
 print('BAKED',o.name,size,flush=True)
for m,size in zip(meshes,[2048,2048,1024,2048]):
 bake(m,size)
 bpy.context.view_layer.objects.active=m;mod=m.modifiers.new('Review topology budget','DECIMATE');mod.ratio=.80 if 'face' in m.name else (.60 if 'hair' in m.name else (.60 if 'footwear' in m.name else .34));bpy.ops.object.modifier_apply(modifier=mod.name)
meshes.append(cards)
# The exact game skeleton contract, with anatomy-specific rest positions.
bpy.ops.object.select_all(action='DESELECT');rigData=bpy.data.armatures.new('Jim 32-joint rig');rig=bpy.data.objects.new('Jim '+STYLE,rigData);scene.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,parent in parents.items():
 b=rigData.edit_bones.new(name);b.head=joints[name];b.tail=Vector(joints[name])+Vector((0,0,.035));
 if parent:b.parent=rigData.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for m in meshes:
 m.parent=rig;mod=m.modifiers.new('Ravelfront game skin','ARMATURE');mod.object=rig
# Preserve editable authored geometry, materials and bone weights.
scene.cycles.samples=20 if QUICK else 40
rig['approval']='PENDING — do not deploy';rig['normalStyle']='Sweatshirt';rig['specialStyle']='Golf';rig['source']='User close-up mapped directly; original outfit photographs; authored 3D geometry'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for m in meshes:m.select_set(True)
path=OUT/('jim-'+STYLE+'.glb')
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_skins=True,export_animations=False,export_yup=True,export_image_format='JPEG',export_jpeg_quality=93,export_attributes=False)
def alpha_mask(path):
 import struct
 raw=path.read_bytes();ln,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+ln]);rest=raw[20+ln:]
 for m in doc.get('materials',[]):
  if 'alpha closeup curls' in m.get('name',''):
   m.update(alphaMode='MASK',alphaCutoff=.46,doubleSided=True);m['pbrMetallicRoughness']['baseColorFactor']=[.82,.84,.86,1]
 block=json.dumps(doc,separators=(',',':')).encode();block+=b' '*((-len(block))%4);path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(block)+len(rest))+struct.pack('<II',len(block),0x4e4f534a)+block+rest)
alpha_mask(path)
triangles=sum(sum(len(p.vertices)-2 for p in m.data.polygons) for m in meshes)
# Review lighting is real area lighting over the exported surfaces, no paintover.
world=scene.world;world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.32,.36,.40,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.45
for name,pos,power,size in [('Key',(-3,-4,5),380,4),('Fill',(3,-2,3),220,4),('Rim',(1,3,4),340,3)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;l=bpy.data.objects.new(name,d);scene.collection.objects.link(l);l.location=pos;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
camData=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',camData);scene.collection.objects.link(cam);scene.camera=cam;camData.type='ORTHO';camData.ortho_scale=2.07
scene.render.resolution_x=900;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.film_transparent=True
cam.location=(0,-5,.94);cam.rotation_euler=(Vector((0,0,.94))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('jim-'+STYLE+'.blend')),compress=True)
review=DIR/'review';review.mkdir(exist_ok=True)
for name,pos,target,scale in [('front',(0,-5,.94),(0,0,.94),2.04),('three-quarter',(2.8,-5,1.0),(0,0,.94),2.04),('back',(0,5,.94),(0,0,.94),2.04),('face',(0,-3,1.685),(0,-.015,1.685),.39),('shoes',(.65,-1.3,.65),(0,-.05,.088),.54)]:
 if QUICK and name not in ['face','shoes']:continue
 scene.render.resolution_x=1600 if name=='shoes' else 1000;scene.render.resolution_y=1000 if name=='shoes' else 1200
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();camData.ortho_scale=.66 if name=='shoes' else scale;scene.render.filepath=str(review/(STYLE+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
# One reduced geometry set for distant characters; matching material slots.
for m in meshes:
 bpy.context.view_layer.objects.active=m;mod=m.modifiers.new('Distance mesh','DECIMATE');mod.ratio=.24;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Collapsing small shoe details can leave duplicate corner indices. Remove
 # those degenerate polygons before the glTF exporter triangulates the LOD.
 m.data.validate(clean_customdata=False);m.data.update()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for m in meshes:m.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/('jim-'+STYLE+'-lod.glb')),export_format='GLB',use_selection=True,export_skins=True,export_animations=False,export_yup=True,export_materials='EXPORT',export_image_format='JPEG',export_jpeg_quality=90,export_attributes=False)
alpha_mask(OUT/('jim-'+STYLE+'-lod.glb'))
report={'id':'jim-'+STYLE,'style':'Normal — Sweatshirt' if STYLE=='normal' else 'Special — Golf','status':'AWAITING USER APPROVAL — NOT DEPLOYED','triangles':triangles,'lodTriangles':sum(sum(len(p.vertices)-2 for p in m.data.polygons) for m in meshes),'bones':len(rigData.bones),'materials':5,'bytes':path.stat().st_size,'reference':'Supplied face close-up directly mapped with measured landmarks; two outfit photographs; earlier garment construction sheet','limitations':'Unseen profile/back surfaces are inferred; likeness is subject to user review.'}
(OUT/(STYLE+'-report.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
