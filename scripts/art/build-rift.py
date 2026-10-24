from operator_builder import Builder
import math
import numpy as np
C=309
j={'root':(C,966,0),'hips':(C,410,0),'spine':(C,315,0),'chest':(C,222,0),'neck':(C,151,0),'head':(C,91,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',99,183,0),('arm',123,201,0),('forearm',164,324,0),('hand',229,447,0),('thigh',51,416,0),('shin',92,640,-4),('foot',110,869,0),('toe',124,932,-73)]:j[name+side]=(C+sign*x,y,d)
b=Builder('rank-10','Rift Revenant',C,1230,758,966,1.82/952,j)
def weights(v):
 y=v[1]
 if y<270:return {'chest':1}
 if y<315:return {'chest':(315-y)/45,'spine':(y-270)/45}
 if y<385:return {'spine':(385-y)/70,'hips':(y-315)/70}
 return {'hips':1}
b.loft('Fitted graphite torso',[(162,C,38,33,0),(191,C,70,47,-4),(225,C,82,59,-8),(266,C,70,48,-5),(301,C,55,37,-2),(338,C,55,36,0),(374,C,72,42,0),(412,C,78,42,0),(440,C,67,34,0),(454,C,40,24,0)],'hips',weights=weights)
b.loft('Wrapped neck scarf',[(135,C,27,27,0),(150,C,45,37,-2),(163,C,56,40,-2),(179,C,45,35,0),(187,C,38,30,0)],'neck')
b.loft('Enclosed graphite mask',[(53,C,12,22,0),(62,C,29,34,0),(77,C,35,40,-5),(93,C,34,42,-5),(112,C,27,35,-5),(131,C,16,27,-5),(141,C,9,19,-5)],'head','darkmetal',sides=40,steps=2)
b.plate('Silver jaw wedge',[(290,99),(309,109),(328,99),(324,125),(309,142),(294,125)],-45,'head',5,'metal',9)
b.silhouette('Violet visor left',[(278,76),(307,91),(307,104),(283,88)],-49,'head',2,'glow')
b.silhouette('Violet visor right',[(311,91),(341,76),(336,88),(311,104)],-49,'head',2,'glow')
b.loft('Hood crown',[(15,C,9,17,7),(18,C,23,29,7),(30,C,33,40,5),(43,C,42,46,3),(53,C,47,50,3)],'head',sides=40,steps=3)
rows=[(42,42,48,3),(59,49,52,4),(81,54,55,5),(105,61,58,7),(128,72,58,8),(142,78,54,7),(153,64,42,5)]
verts=[];faces=[];sides=36
for y,rx,rz,cy in rows:
 for i in range(sides+1):
  a=-2.45+i/sides*4.9;verts.append((C+rx*math.sin(a),y,cy+rz*math.cos(a)))
for row in range(len(rows)-1):
 for i in range(sides):a=row*(sides+1)+i;faces.append((a,a+1,a+sides+2,a+sides+1))
b.mesh('Open violet hood',verts,faces,'head','fabric')
b.plate('Chest left alloy rim',[(258,181),(284,187),(293,201),(285,218),(292,241),(280,261),(248,260),(233,230),(241,201)],-61,'chest',6,'metal',2)
b.plate('Chest right alloy rim',[(360,181),(377,201),(385,230),(370,260),(338,261),(326,241),(333,218),(325,201),(334,187)],-61,'chest',6,'metal',2)
b.plate('Sternum crest',[(297,238),(309,253),(321,238),(328,258),(309,284),(290,258)],-53,'chest',6,'metal',4)
b.sphere('Singularity rim',C,215,-70,23,23,9,'chest','metal',28,14)
b.sphere('Violet singularity',C,215,-80,16,17,5,'chest','glow',28,14)
b.loft('Utility belt',[(342,C,64,39,0),(355,C,79,43,0),(375,C,77,42,0),(385,C,67,38,0)],'hips','leather',steps=2)
b.plate('Angular silver buckle',[(289,353),(309,361),(329,353),(322,380),(309,399),(296,380)],-45,'hips',6,'metal',5)
b.silhouette('Embroidered waist tabard',[(283,377),(338,377),(338,528),(281,557)],-48,'hips',2,'fabric')
for side,sign in [('L',-1),('R',1)]:
 def mirror(points):return [(C+sign*(C-x),y) for x,y in points]
 def rows(data):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in data]
 def plate(name,p,depth,bone,thick=6,surface='metal',bulge=6):return b.plate(side+' '+name,mirror(p),depth,bone+side,thick,surface,bulge)
 def crescent(name,p,depth):return b.silhouette(side+' '+name,mirror(p),depth,'arm'+side,6)
 x=lambda a:C+sign*a
 b.loft(side+' shoulder sleeve',rows([(179,206,30,34,0),(201,189,33,36,0),(231,181,29,31,0),(263,166,26,28,0),(292,155,25,27,0),(321,144,22,23,0)]),'arm'+side,weights=b.chain('arm'+side,'forearm'+side,179,321))
 b.loft(side+' forearm sleeve',rows([(313,145,22,23,0),(338,132,23,23,0),(365,118,21,21,0),(392,104,18,19,0),(420,89,15,16,0),(450,78,12,13,0)]),'forearm'+side,weights=b.chain('forearm'+side,'hand'+side,313,450))
 crescent('upper crescent',[(231,151),(207,151),(179,162),(158,179),(149,197),(168,185),(191,184),(215,204),(224,185)],-27)
 crescent('middle crescent',[(215,190),(192,191),(169,204),(150,225),(141,241),(161,229),(181,222),(207,239),(214,219)],-30)
 crescent('lower crescent',[(202,223),(181,227),(162,246),(151,273),(171,257),(193,248),(205,262),(207,243)],-27)
 plate('gauntlet shell',[(119,316),(142,340),(131,367),(113,393),(95,421),(70,429),(86,389),(100,357)],-20,'forearm',7,'metal',10)
 plate('wrist cuff',[(73,414),(98,425),(100,438),(73,433)],-17,'forearm',5,'metal',3)
 b.loft(side+' trouser thigh',rows([(407,258,43,39,0),(440,250,43,39,0),(475,241,41,37,0),(512,231,37,34,0),(548,223,34,32,0),(580,218,33,31,0),(611,216,32,30,0),(641,217,28,28,0)]),'thigh'+side,weights=b.chain('thigh'+side,'shin'+side,407,641))
 b.loft(side+' trouser calf',rows([(625,217,29,28,0),(658,214,30,29,0),(691,211,28,27,0),(728,206,27,26,0),(765,201,24,23,0),(800,198,22,22,0),(840,198,19,20,0),(870,199,18,18,0)]),'shin'+side,weights=b.chain('shin'+side,'foot'+side,625,870))
 plate('hip segmented blade',[(233,380),(258,384),(245,411),(231,432),(213,464),(193,458),(204,427),(216,403)],-36,'thigh',7,'metal',7)
 plate('thigh holster',[(198,467),(213,476),(207,516),(197,555),(181,551),(182,507)],-4,'thigh',12,'leather',2)
 plate('knee shell',[(198,610),(226,602),(249,622),(243,658),(218,690),(193,674),(181,639)],-32,'shin',8,'metal',10)
 plate('long shin shell',[(183,689),(207,712),(231,692),(240,718),(225,758),(219,799),(217,833),(184,836),(174,805),(177,755),(163,720)],-26,'shin',8,'metal',9)
 b.loft(side+' layered boot',rows([(835,198,20,23,0),(859,198,21,24,-1),(881,194,23,29,-9),(903,188,27,44,-22),(924,177,33,61,-39),(943,171,37,70,-45),(958,170,38,71,-45),(966,170,38,71,-45)]),'foot'+side,'leather',sides=28,steps=2)
 plate('ankle plate',[(183,844),(208,849),(215,869),(203,887),(180,879),(173,858)],-26,'foot',6,'metal',4)
 b.fingers(side,(x(233),470,-1),[(x(246),503),(x(247),517),(x(237),527),(x(227),523),(x(211),493)])
outer=b.cape([(169,126,49),(205,186,63),(290,226,73),(395,290,80),(510,352,87),(625,414,95),(724,476,102),(789,508,108)],columns=128)
outer.name='Weathered outer cape'
inner=b.cape([(169,126,48),(205,186,62),(290,226,72),(395,290,79),(510,352,86),(625,414,94),(724,476,101),(789,508,107)],columns=128)
inner.name='Violet cape lining'
pixels=np.empty(len(b.image.pixels),dtype=np.float32);b.image.pixels.foreach_get(pixels)
for mesh in [outer,inner]:
 for v in list(mesh.data.vertices)[-129:]:
  px=round(b.bx-v.co.x/b.scale);edge=760
  for y in range(735,843):
   k=((b.image.size[1]-1-y)*b.image.size[0]+px)*4;r,g,blue=pixels[k:k+3]
   if blue-r>.025 and r-g>.008:edge=y
  v.co.z=(b.floor-edge)*b.scale
 for loop in mesh.data.loops:
  v=mesh.data.vertices[loop.vertex_index].co;px=b.bx-v.x/b.scale;y=b.floor-v.z/b.scale
  for uv in mesh.data.uv_layers:uv.data[loop.index].uv=(px/b.image.size[0],1-y/b.image.size[1])
for loop in inner.data.loops:
 v=inner.data.vertices[loop.vertex_index].co;y=b.floor-v.z/b.scale;t=(v.x/b.scale+260)/520
 for uv in inner.data.uv_layers:uv.data[loop.index].uv=((293+t*24)/b.image.size[0],1-(575+(y-169)/620*160)/b.image.size[1])
b.finish()

