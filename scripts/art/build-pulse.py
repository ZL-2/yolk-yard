from operator_builder import Builder
from mathutils import Vector
import math
C=298
j={'root':(C,968,0),'hips':(C,411,0),'spine':(C,302,0),'chest':(C,224,0),'neck':(C,160,0),'head':(C,101,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',69,192,0),('arm',80,220,0),('forearm',135,337,0),('hand',196,438,0),('thigh',52,419,0),('shin',84,637,-2),('foot',101,869,0),('toe',127,939,-68)]:j[name+side]=(C+sign*x,y,d)
b=Builder('pulse','Pulse',C,1232,770,968,1.78/950,j)
def weights(v):
 y=v[1]
 if y<265:return {'chest':1}
 if y<300:return {'chest':(300-y)/35,'spine':(y-265)/35}
 if y<355:return {'spine':(355-y)/55,'hips':(y-300)/55}
 return {'hips':1}
b.loft('Fitted engineer tank and waist',[(176,C,37,30,0),(198,C,67,41,-3),(227,C,74,49,-6),(252,C,70,47,-5),(276,C,57,36,-2),(309,C,50,31,0),(337,C,56,33,0),(367,C,68,40,0),(405,C,66,42,0),(436,C,75,40,0),(460,C,45,27,0)],'hips',weights=weights)
b.loft('Neck and collarbone',[(133,C,17,20,1),(151,C,19,21,1),(171,C,22,23,1),(187,C,35,28,0),(205,C,40,31,-1),(211,C,37,30,-1)],'neck','skin')
head=b.loft('Sculpted human face',[(55,301,22,26,1),(64,301,30,31,0),(77,300,33,34,-1),(91,299,33,35,-2),(105,298,32,35,-3),(118,298,29,32,-2),(129,299,24,28,0),(140,299,16,20,1),(146,300,8,13,1)],'head','skin',sides=64,steps=4)
# Shape the nose bridge, tip, cheeks, brow and mouth into the face itself.
for v in head.data.vertices:
 x=C+v.co.x/b.scale;y=b.floor-v.co.z/b.scale;d=v.co.y/b.scale
 if d<-15:
  nose=15*math.exp(-((x-298)/7)**2-((y-111)/13)**2)
  bridge=5*math.exp(-((x-299)/5)**2-((y-97)/13)**2)
  brow=3*sum(math.exp(-((x-a)/10)**2-((y-91)/5)**2) for a in [282,315])
  mouth=3.5*math.exp(-((x-299)/13)**2-((y-127)/5)**2)
  cheek=2*sum(math.exp(-((x-a)/9)**2-((y-110)/9)**2) for a in [279,319])
  v.co.y-=(nose+bridge+brow+mouth+cheek)*b.scale*max(0,min(1,(-d-15)/16))
for sign in [-1,1]:b.sphere('Ear',C+sign*36,109,0,5,12,8,'head','skin',24,16)
b.sphere('Turquoise communicator ring',C+42,110,-1,7,13,9,'head','metal',24,16)
b.sphere('Turquoise communicator light',C+45,109,-5,4,7,5,'head','glow',20,12)
# White asymmetric crest: solid crown mass, falling sweep and individual curved locks.
b.loft('White crest crown',[(21,306,12,17,4),(31,299,32,31,3),(42,294,45,39,0),(52,290,49,42,-1),(62,287,42,39,0)],'head','fabric',sides=40,steps=2)
b.loft('White side sweep',[(48,261,16,19,-20),(63,254,17,19,-24),(81,250,13,16,-24),(99,255,8,11,-23),(116,265,1,4,-22)],'head','fabric',sides=28,steps=2)
def lock(name,points,radius):
 v=[];f=[];steps=16;sides=8
 for i in range(steps+1):
  t=i/steps;p=[Vector(q) for q in points]
  pos=(1-t)**3*p[0]+3*(1-t)**2*t*p[1]+3*(1-t)*t*t*p[2]+t**3*p[3]
  tangent=(-3*(1-t)**2*p[0]+(3*(1-t)**2-6*(1-t)*t)*p[1]+(6*(1-t)*t-3*t*t)*p[2]+3*t*t*p[3]).normalized()
  a=tangent.cross(Vector((0,0,1))).normalized();other=tangent.cross(a).normalized();r=radius*(math.sin(math.pi*(t*.88+.06))**.7)*(1-t*.65)+.15
  for q in range(sides):
   aa=q/sides*math.tau;z=pos+a*math.cos(aa)*r+other*math.sin(aa)*r*.6;v.append(tuple(z))
 for k in range(steps):
  for q in range(sides):a=k*sides+q;f.append((a,k*sides+(q+1)%sides,(k+1)*sides+(q+1)%sides,a+sides))
 o=b.mesh(name,v,f,'head','fabric',side_blend=False)
 for uv in o.data.uv_layers:
  for q in uv.data:q.uv=(290/1536,1-42/1024)
for k in range(13):
 xx=252+k*7
 lock('Swept white crest lock',[(xx,59,-20),(xx-14,40,-30),(xx+15,34,-17),(xx+8,14+abs(k-7)*2,-4)],5.5)
for k in range(6):
 lock('Falling white fringe',[(277+k*3,47,-34),(250,50+k*6,-36),(240+k*3,83,-30),(263-k*2,111-k*3,-25)],5)
# Jacket is open over the tank top and has a high orange-lined collar.
for sign in [-1,1]:
 def mirrored(p):return [(C+sign*(C-x),y) for x,y in p]
 b.silhouette('Teal cropped jacket panel',mirrored([(250,177),(236,184),(216,201),(224,248),(225,279),(225,310),(245,316),(248,270),(252,226),(260,201)]),-44,'chest',5,'fabric')
 b.silhouette('Raised orange-lined collar',mirrored([(273,139),(256,144),(245,157),(254,182),(262,197),(270,187),(270,164)]),-28,'neck',8,'fabric')
b.silhouette('Orange tool harness',[(253,211),(266,216),(318,270),(332,287),(324,302),(309,288)],-57,'chest',3,'leather')
b.plate('Harness metal clasp',[(303,264),(324,278),(316,295),(296,278)],-61,'chest',5,'metal',2)
b.loft('Utility tool belt',[(341,C,62,36,0),(352,C,76,43,0),(373,C,74,41,0),(384,C,68,38,0)],'hips','leather',steps=2)
b.plate('Steel belt buckle',[(279,350),(310,350),(313,373),(280,374)],-47,'hips',5,'metal',2)
for side,sign in [('L',-1),('R',1)]:
 def mirror(p):return [(C+sign*(C-x),y) for x,y in p]
 def rows(r):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in r]
 def plate(name,p,depth,bone,thick=5,surface='darkmetal',bulge=5):return b.plate(side+' '+name,mirror(p),depth,bone+side,thick,surface,bulge)
 x=lambda a:C+sign*a
 b.loft(side+' rolled teal sleeve',rows([(182,237,15,24,0),(205,218,27,31,0),(232,210,28,33,0),(262,197,33,33,0),(288,188,32,32,0),(309,177,32,30,0),(331,164,32,29,0),(345,155,31,28,0)]),'arm'+side,weights=b.chain('arm'+side,'forearm'+side,182,345))
 b.loft(side+' rolled cuff',rows([(318,171,31,30,0),(329,166,33,32,0),(347,155,30,29,0),(359,151,28,27,0)]),'arm'+side,'fabric',steps=2,weights=b.chain('arm'+side,'forearm'+side,300,350))
 b.loft(side+' bare forearm',rows([(350,157,23,23,0),(370,145,22,23,0),(390,129,19,21,0),(410,116,16,18,0),(436,103,13,15,0)]),'forearm'+side,'skin',weights=b.chain('forearm'+side,'hand'+side,350,436))
 plate('Shoulder protective plate',[(196,195),(207,207),(201,230),(187,246),(177,238),(181,217)],-29,'arm',5,'darkmetal',5)
 plate('Black shoulder harness',[(234,181),(248,176),(252,196),(240,218),(225,213)],-39,'chest',4,'leather',3)
 # Harness pieces belong to the shared chest, not an arm-specific chest name.
 o=b.parts[-1];vg=o.vertex_groups[0];vg.name='chest'
 plate('Harness buckle',[(229,188),(244,184),(249,199),(234,205)],-44,'arm',3,'metal',1)
 plate('Sleeve cargo pocket',[(164,254),(182,251),(188,268),(171,284),(154,280)],-31,'arm',8,'fabric',2)
 plate('Black wrist strap',[(90,412),(112,418),(121,432),(99,440),(85,431)],-17,'forearm',4,'leather',2)
 b.loft(side+' navy cargo trouser thigh',rows([(408,252,34,37,0),(444,249,42,40,0),(480,255,35,38,0),(519,244,38,36,0),(554,231,37,34,0),(592,218,33,31,0),(628,214,32,29,0),(650,214,31,29,0)]),'thigh'+side,weights=b.chain('thigh'+side,'shin'+side,408,650))
 b.loft(side+' navy cargo trouser calf',rows([(632,214,32,30,0),(667,211,35,30,0),(701,205,42,33,0),(734,200,42,32,0),(768,198,36,29,0),(793,199,28,25,0),(816,199,24,23,0),(868,197,20,21,0)]),'shin'+side,weights=b.chain('shin'+side,'foot'+side,632,868))
 plate('Teal kneepad',[(191,597),(220,595),(244,615),(242,654),(226,681),(191,680),(180,653),(182,621)],-34,'shin',9,'darkmetal',9)
 plate('Thigh tool case',[(181,450),(203,446),(218,462),(215,514),(203,559),(180,560),(177,533)],-34,'thigh',14,'leather',3)
 plate('Orange case latch',[(188,495),(201,494),(203,530),(190,533)],-50,'thigh',3,'metal',1)
 plate('Calf tool pouch',[(169,678),(187,687),(190,728),(159,733),(156,716)],-20,'shin',10,'leather',2)
 b.plate(side+' Belt equipment case',mirror([(218,344),(240,344),(248,363),(239,390),(216,389),(207,371)]),-43,'hips',14,'leather',3)
 def boot_w(v):
  t=max(0,min(1,(v[1]-840)/28));return {'shin'+side:1-t,'foot'+side:t}
 b.loft(side+' Black orange expedition boot',rows([(796,199,26,26,0),(819,199,29,28,0),(842,198,25,25,-1),(867,197,23,26,-3),(891,187,28,35,-14),(916,175,36,52,-32),(941,170,44,67,-44),(959,170,46,70,-47),(968,170,46,70,-47)]),'foot'+side,'leather',weights=boot_w,sides=32,steps=2)
 plate('Boot top strap',[(169,812),(222,814),(226,837),(173,840)],-27,'shin',5,'leather',2)
 plate('Boot lower strap',[(170,853),(202,862),(222,886),(215,901),(186,879),(161,871)],-34,'foot',6,'leather',3)
 b.loft(side+' glove wrist',rows([(420,109,14,15,0),(435,104,14,15,0),(451,99,14,13,0),(467,97,13,11,0)]),'hand'+side,'leather',steps=2)
 b.fingers(side,(x(201),465,-1),[(x(217),495),(x(211),514),(x(204),523),(x(197),508),(x(182),486)],size=.95)
# The bright terminal is only on her left arm (viewer right in front view).
b.plate('Orange wrist terminal housing',[(484,361),(499,366),(517,421),(508,432),(487,424),(473,383)],-25,'forearmR',11,'metal',4)
b.plate('Cyan terminal display',[(488,375),(496,377),(508,413),(501,419),(488,412),(480,385)],-37,'forearmR',2,'glow',0)
for o in b.parts:
 if o.name=='Fitted engineer tank and waist':
  for q in o.data.uv_layers['Side'].data:
   y=(1-q.uv.y)*1024
   if y>330:q.uv.x-=18*min(1,(y-330)/45)/1536
 if any(n in o.name.lower() for n in ['sleeve','cuff','forearm','finger','palm','glove wrist','neck']):
  for a in o.data.attributes['SideBlend'].data:a.value=0
 if any(n in o.name.lower() for n in ['sleeve','cuff','forearm','finger','palm','glove wrist','neck']):
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv.x=(C-abs(q.uv.x*1536-b.bx))/1536
 if 'trouser thigh' in o.name.lower():
  for q in o.data.uv_layers['Reference'].data:
   y=(1-q.uv.y)*1024;px=q.uv.x*1536
   if y<465:
    center=b.bx if px>970 else C;offset=abs(px-center);q.uv.x=(center+(1 if px>center else -1)*(48+(offset-48)*.65))/1536
 if o.name=='Fitted engineer tank and waist':
  for q in o.data.uv_layers['Reference'].data:
   y=(1-q.uv.y)*1024
   if y>390:
    center=b.bx if q.uv.x*1536>970 else C;q.uv.x=(center+(q.uv.x*1536-center)*.88)/1536
 if 'boot' in o.name.lower():
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv.x=(b.bx+(q.uv.x*1536-b.bx)*.85)/1536
b.finish()

