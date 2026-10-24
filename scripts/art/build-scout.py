from operator_builder import Builder
import bpy,math,random,json
from mathutils import Vector
C=300
j={'root':(C,970,0),'hips':(C,453,0),'spine':(C,346,0),'chest':(C,246,0),'neck':(C,179,0),'head':(C,103,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',99,217,0),('arm',122,245,0),('forearm',168,366,0),('hand',211,480,0),('thigh',49,456,0),('shin',87,690,-2),('foot',105,887,0),('toe',126,949,-69)]:j[name+side]=(C+sign*x,y,d)
b=Builder('scout','Frontier Scout',C,1235,765,970,1.80/950,j,reference=True)
colors={'jacket':'#466d7b','trim':'#c5a675','pants':'#36444f','patch':'#2d3c46','skin':'#a57753','lip':'#88523f','hair':'#28211d','leather':'#594136','edge':'#86654b','sole':'#20272b','metal':'#b7ae92','dark':'#252e35'}
def linear(x):return x/12.92 if x<.04045 else ((x+.055)/1.055)**2.4
def paint(o,color):
 color=colors.get(color,color);rgb=[linear(int(color[i:i+2],16)/255) for i in [1,3,5]]
 a=o.data.color_attributes.new(name='OperatorColor',type='FLOAT_COLOR',domain='CORNER')
 for q in a.data:q.color=(*rgb,1)
 return o
def loft(name,rows,bone,color,surface='fabric',**kw):return paint(b.loft(name,rows,bone,surface,**kw),color)
def sphere(name,x,y,d,rx,ry,rz,bone,color,surface='fabric',segments=20,rings=12):return paint(b.sphere(name,x,y,d,rx,ry,rz,bone,surface,segments,rings),color)
def plate(name,points,depth,bone,color,thickness=4,surface='fabric',bulge=4):return paint(b.plate(name,points,depth,bone,thickness,surface,bulge),color)
def silhouette(name,points,depth,bone,color,thickness=2,surface='fabric'):return paint(b.silhouette(name,points,depth,bone,thickness,surface),color)
def weights(v):
 y=v[1]
 if y<284:return {'chest':1}
 if y<346:return {'chest':(346-y)/62,'spine':(y-284)/62}
 if y<414:return {'spine':(414-y)/68,'hips':(y-346)/68}
 return {'hips':1}
loft('Petrol canvas field jacket',[(184,C,42,31,0),(205,C,74,44,0),(235,C,89,53,-2),(268,C,85,51,-2),(307,C,74,45,-1),(346,C,70,42,0),(383,C,78,45,0),(401,C,83,46,0),(418,C,76,41,0)],'hips','jacket',weights=weights,sides=36)
loft('Pants waist and hips',[(422,C,75,39,0),(443,C,81,42,0),(469,C,78,40,0),(490,C,62,33,0),(503,C,30,22,0)],'hips','pants')
loft('Neck and clavicles',[(139,C,18,21,0),(158,C,20,23,0),(178,C,23,25,0),(194,C,34,28,0),(203,C,37,30,0)],'neck','skin','skin')
head=loft('Sculpted Scout face',[(39,C,25,27,2),(54,C,35,34,1),(73,C,40,38,0),(94,C,39,39,-1),(114,C,36,35,-1),(132,C,29,30,0),(145,C,20,25,1),(153,C,10,17,1)],'head','skin','skin',sides=64,steps=5)
for v in head.data.vertices:
 x=C+v.co.x/b.scale;y=b.floor-v.co.z/b.scale;d=v.co.y/b.scale
 if d<-12:
  a=12*math.exp(-((x-C)/7.5)**2-((y-112)/12)**2)+5*math.exp(-((x-C)/5.5)**2-((y-98)/15)**2)
  a+=3*sum(math.exp(-((x-t)/11)**2-((y-84)/6)**2) for t in [C-17,C+17])
  a+=3*sum(math.exp(-((x-t)/10)**2-((y-116)/10)**2) for t in [C-23,C+23])
  a-=2.5*sum(math.exp(-((x-t)/9)**2-((y-94)/7)**2) for t in [C-16,C+16])
  a+=2*math.exp(-((x-C)/13)**2-((y-133)/7)**2)
  v.co.y-=a*b.scale*max(0,min(1,(-d-12)/18))
for sign in [-1,1]:
 sphere('Sculpted ear',C+sign*41,108,0,8,16,8,'head','skin','skin',24,16)
 sphere('Ear concha',C+sign*44,108,-5,4,10,2,'head','#84553e','skin',20,12)
 ex=C+sign*16
 sphere('Warm eye white',ex,98,-35.4,7.3,3.6,3.3,'head','#d7cdbc','glass',28,16)
 sphere('Dark brown iris',ex,98,-38.5,3.0,3.1,.7,'head','#403025','glass',24,14)
 sphere('Pupil',ex,98,-39.1,1.4,2.1,.35,'head','#15181b','glass',20,12)
 sphere('Eye highlight',ex-1,96.8,-39.4,.7,.7,.2,'head','#ede6d7','glass',12,8)
 silhouette('Upper eyelid',[(ex-8,96),(ex-4,93),(ex+3,93),(ex+8,96),(ex+5,95.2),(ex-4,95.2)],-38.1,'head','#69432f',1,'skin')
 silhouette('Lower eyelid',[(ex-7,100),(ex-3,102),(ex+3,102),(ex+7,100),(ex+4,103),(ex-4,103)],-37.2,'head','skin',1,'skin')
 silhouette('Dark brow',[(ex-10,86),(ex-5,82),(ex+5,82),(ex+10,85),(ex+7,87),(ex-5,85)],-37,'head','hair',1)
 sphere('Nostril',C+sign*4.3,119,-43,1.9,1.1,.55,'head','#68432e','skin',16,10)
silhouette('Upper lip',[(288,133),(296,131),(300,132),(304,131),(312,133),(307,135),(294,135)],-33.8,'head','lip',1,'skin')
sphere('Lower lip',C,136,-33.1,9.5,1.5,1.4,'head','#a36b50','skin',28,12)
silhouette('Mouth line',[(289,134),(300,135),(311,134),(307,135.1),(300,136),(293,135.1)],-35,'head','#5f3c2e',.5,'skin')
# Close-cropped sides and individually shaped curls distinguish the free Scout.
loft('Dark hair crown',[(20,C,8,12,3),(26,C,25,27,2),(37,C,37,35,1),(50,C,41,39,1),(58,C,38,37,2)],'head','hair',sides=40,steps=3)
v=[];f=[];n=32
for y,rx,rz in [(49,41,39),(69,41,40),(92,38,38),(115,28,30)]:
 for i in range(n+1):
  a=i/n*math.pi;v.append((C+rx*math.cos(a),y,2+rz*math.sin(a)))
for k in range(3):
 for i in range(n):a=k*(n+1)+i;f.append((a,a+1,a+n+2,a+n+1))
paint(b.mesh('Tapered dark hair sides',v,f,'head','fabric'),'hair')
rng=random.Random(215)
for k in range(86):
 a=k*2.399963;t=math.acos(1-(k+.5)/86);rx=36*math.sin(t);yy=51-30*math.cos(t)
 x=C+math.cos(a)*rx;d=1+math.sin(a)*rx*.93;r=rng.uniform(4,6)
 sphere('Short sculpted curl',x,yy,d,r,r*.8,r*.85,'head',['#28211d','#302720','#352a22'][k%3],segments=10,rings=6)
loft('Standing canvas collar',[(164,C,29,25,0),(175,C,36,31,0),(193,C,40,34,0),(204,C,38,32,0)],'neck','jacket',steps=2)
silhouette('Slate undershirt neckline',[(276,193),(325,193),(302,239)],-54,'chest','dark',3)
silhouette('Left sand collar lining',[(269,166),(279,173),(285,199),(299,224),(287,214),(272,193)],-32,'neck','trim',3)
silhouette('Right sand collar lining',[(327,165),(318,175),(315,198),(303,224),(318,212),(333,187)],-32,'neck','trim',3)
# A weighted diagonal zipper follows the jacket through the game poses.
v=[];f=[]
for y,d in [(219,-55),(255,-55),(292,-49),(332,-45),(373,-48),(418,-49)]:
 xx=318-(y-219)*.14;v.extend([(xx-1.6,y,d),(xx+1.6,y,d)])
for k in range(5):a=k*2;f.append((a,a+1,a+3,a+2))
paint(b.mesh('Diagonal jacket zipper',v,f,'chest','metal',weights=weights,side_blend=False),'metal')
for y in range(228,414,9):
 xx=318-(y-219)*.14;d=-55 if y<280 else -48
 plate('Zipper teeth',[(xx-2,y),(xx+2,y),(xx+2,y+2),(xx-2,y+2)],d,'chest' if y<284 else 'spine' if y<365 else 'hips','metal',1,'metal',0)
plate('Zipper pull',[(311,238),(319,238),(319,253),(312,254)],-60,'chest','metal',2,'metal',1)
plate('Left chest pocket',[(240,258),(277,258),(279,309),(242,312)],-51,'chest','jacket',6,'fabric',2)
plate('Chest pocket flap',[(239,255),(278,255),(279,269),(260,275),(240,270)],-58,'chest','patch',3,'fabric',2)
sphere('Pocket snap',260,267,-62,2.5,2.5,1,'chest','metal','metal',12,8)
silhouette('Brown crossbody strap',[(237,190),(247,186),(373,370),(363,379)],-59,'chest','leather',4,'leather')
silhouette('Strap stitched edge',[(239,191),(241,190),(368,375),(366,377)],-64,'chest','edge',1,'leather')
plate('Strap buckle',[(301,283),(311,276),(327,299),(317,307)],-66,'chest','metal',4,'metal',1)
loft('Canvas jacket lower hem',[(401,C,82,46,0),(411,C,81,45,0),(419,C,76,42,0)],'hips','patch',steps=2)
loft('Brown utility belt',[(420,C,79,43,0),(433,C,84,46,0),(445,C,79,43,0)],'hips','leather','leather',steps=2)
plate('Plain field belt buckle',[(285,422),(315,422),(315,444),(285,444)],-50,'hips','metal',5,'metal',1)
for side,sign in [('L',-1),('R',1)]:
 def mirror(p):return [(C+sign*(C-x),y) for x,y in p]
 def rows(r):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in r]
 def armplate(name,p,depth,bone,color,thick=4,surface='fabric',bulge=3):return plate(side+' '+name,mirror(p),depth,bone+side,color,thick,surface,bulge)
 x=lambda a:C+sign*a
 loft(side+' shaped jacket sleeve',rows([(204,211,29,32,0),(232,185,32,34,0),(263,175,32,33,0),(295,163,30,31,0),(326,149,28,29,0),(367,132,25,26,0)]),'arm'+side,'jacket',weights=b.chain('arm'+side,'forearm'+side,204,367))
 loft(side+' shaped lower sleeve',rows([(354,137,26,27,0),(383,124,27,28,0),(413,112,25,26,0),(443,100,21,22,0),(475,90,16,17,0)]),'forearm'+side,'jacket',weights=b.chain('forearm'+side,'hand'+side,354,475))
 loft(side+' sand rolled cuff',rows([(442,101,23,24,0),(450,98,24,24,0),(465,94,21,21,0)],),'forearm'+side,'trim',steps=2)
 armplate('Shoulder yoke',[(202,204),(225,207),(211,229),(187,245),(179,230)],-32,'arm','trim',3)
 armplate('Elbow reinforcement',[(121,350),(148,361),(145,383),(121,395),(107,378)],24,'forearm','patch',4)
 # Small raised seams and folds around the elbows and sleeves.
 for y,xx,rr in [(290,165,30),(324,150,28),(399,117,26),(435,103,23)]:
  loft(side+' stitched sleeve fold',rows([(y-2,xx,rr,rr+1,0),(y,xx,rr+1.1,rr+2,0),(y+2,xx,rr,rr+1,0)]),'arm'+side if y<350 else 'forearm'+side,'jacket',sides=24,steps=1)
 loft(side+' glove wrist',rows([(472,91,17,18,0),(485,87,17,16,0),(504,85,15,12,0)]),'hand'+side,'leather','leather',steps=2)
 before=len(b.parts);b.fingers(side,(x(215),502,-1),[(x(231),533),(x(226),546),(x(216),555),(x(206),548),(x(195),527)],size=1)
 for o in b.parts[before:]:paint(o,'leather')
 armplate('Glove back panel',[(75,491),(98,493),(103,514),(92,526),(73,520)],-12,'hand','edge',3,'leather',2)
 for q in range(3):sphere(side+' glove knuckle',x(223-q*7),512,-13,3,4,2,'hand'+side,'edge','leather',12,8)
 loft(side+' cargo trouser thigh',rows([(451,251,42,39,0),(483,247,45,40,0),(526,239,43,38,0),(566,230,40,35,0),(607,222,37,33,0),(648,215,33,30,0),(690,213,29,28,0)]),'thigh'+side,'pants',weights=b.chain('thigh'+side,'shin'+side,451,690))
 loft(side+' cargo trouser calf',rows([(674,214,30,29,0),(705,211,31,30,0),(745,204,31,28,0),(780,198,28,25,0),(820,195,24,23,0),(853,195,21,21,0),(887,195,19,20,0)]),'shin'+side,'pants',weights=b.chain('shin'+side,'foot'+side,674,887))
 armplate('Canvas reinforced knee',[(191,668),(218,665),(239,681),(232,713),(210,730),(186,709)],-31,'shin','patch',5,'fabric',7)
 armplate('Cargo pocket',[(195,514),(222,516),(232,541),(223,595),(191,597),(184,573)],-37,'thigh','patch',11,'fabric',3)
 armplate('Cargo flap',[(193,511),(223,513),(232,530),(213,540),(190,533)],-49,'thigh','pants',3,'fabric',2)
 sphere(side+' cargo snap',x(93),530,-53,2.5,2.5,1,'thigh'+side,'metal','metal',12,8)
 for y,xx,rx in [(596,224,38),(643,215,34),(758,202,31),(807,195,27)]:
  loft(side+' trouser fold',rows([(y-3,xx,rx,27,0),(y,xx,rx+1,29,0),(y+3,xx,rx,27,0)]),'thigh'+side if y<670 else 'shin'+side,'pants',sides=24,steps=1)
 def bw(v):
  t=max(0,min(1,(v[1]-858)/29));return {'shin'+side:1-t,'foot'+side:t}
 loft(side+' brown expedition boot',rows([(830,195,26,27,0),(850,195,28,28,0),(874,195,24,25,-1),(895,191,26,31,-10),(919,181,32,46,-25),(944,174,40,65,-44),(960,172,43,70,-49),(970,172,43,71,-49)]),'foot'+side,'leather','leather',weights=bw,sides=32,steps=2)
 loft(side+' tan boot cuff',rows([(823,195,27,28,0),(835,195,29,30,0),(846,195,27,28,0)]),'shin'+side,'trim','leather',steps=2)
 loft(side+' rubber tread sole',rows([(958,172,44,71,-49),(966,172,45,72,-49),(970,172,45,72,-49)]),'foot'+side,'sole','leather',steps=1)
 armplate('Boot toe cap',[(137,934),(158,925),(187,933),(207,952),(204,960),(142,960)],-102,'foot','edge',4,'leather',4)
 for yy,dd in [(876,-30),(893,-37),(909,-49)]:
  armplate('Boot laces',[(176,yy),(207,yy+5),(205,yy+8),(174,yy+3)],dd,'foot','trim',1,'fabric',0)
 plate(side+' belt pouch',mirror([(220,423),(242,423),(249,438),(246,465),(220,464),(211,451)]),-46,'hips','leather',13,'leather',3)
 plate(side+' pouch flap',mirror([(218,421),(243,421),(248,433),(229,441),(216,433)]),-61,'hips','edge',3,'leather',1)
# Original compass badge on the left upper sleeve, no third-party logo.
sphere('Compass sleeve patch',C+112,262,-35,13,16,2,'armR','patch','fabric',28,16)
for sign in [-1,1]:
 silhouette('Compass needle',[(C+112,248),(C+112+sign*6,262),(C+112,276),(C+112-sign*3,262)],-38,'armR','trim',1)
# Refine the original sculpt against the enhanced construction reference.
# Preserve the actual facial planes while the original reference supplies fine features.
remove=['Warm eye white','Dark brown iris','Pupil','Eye highlight','Upper eyelid','Lower eyelid','Dark brow','Nostril','Upper lip','Lower lip','Mouth line','Boot toe cap']
for o in list(b.parts):
 if any(n.lower() in o.name.lower() for n in remove):b.parts.remove(o);bpy.data.objects.remove(o,do_unlink=True)
for o in b.parts:
 for q in o.data.uv_layers['Reference'].data:
  q.uv.x+=(32 if q.uv.x*1536<700 else -30)/1536
 if o.name.startswith('R '):
  for q in o.data.uv_layers['Reference'].data:
   if 332<q.uv.x*1536<700:q.uv.x=(664-q.uv.x*1536)/1536
 if o.name=='Petrol canvas field jacket':
  for a in o.data.attributes['SideBlend'].data:a.value=0
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536<700:q.uv.x=(332+(q.uv.x*1536-332)*.94)/1536
 if 'shaped jacket sleeve' in o.name.lower():
  centers=[(204,243),(232,217),(263,207),(295,195),(326,181),(367,164)]
  for q in o.data.uv_layers['Reference'].data:
   y=(1-q.uv.y)*1024;px=q.uv.x*1536
   if px>970:px=332-abs(px-1205)
   for (a,cx),(z,zx) in zip(centers,centers[1:]):
    if a<=y<=z:
     cx=cx+(zx-cx)*(y-a)/(z-a);q.uv.x=(cx+(px-cx)*.85)/1536;break
 if 'hair' in o.name.lower() or 'curl' in o.name.lower():
  for uv in o.data.uv_layers:
   for q in uv.data:q.uv=(332/1536,1-42/1024)
 if any(n in o.name.lower() for n in ['sleeve','glove','finger','palm']):
  for a in o.data.attributes['SideBlend'].data:a.value=0
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv.x=(332-abs(q.uv.x*1536-1205))/1536
b.finish()
# The new default portrait is a render of this exact authored game mesh.
bpy.ops.wm.open_mainfile(filepath=str(b.directory/'scout.blend'))
scene=bpy.context.scene;scene.render.film_transparent=True;cam=scene.camera
cam.location=(2.1,-5,1.05);cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(b.directory/'cover.png');bpy.ops.render.render(write_still=True)

