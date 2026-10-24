from operator_builder import Builder
import math
import numpy as np
C=308
j={'root':(C,978,0),'hips':(C,425,0),'spine':(C,315,0),'chest':(C,219,0),'neck':(C,151,0),'head':(C,89,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',104,183,0),('arm',127,216,0),('forearm',170,341,0),('hand',220,469,0),('thigh',53,424,0),('shin',92,644,-4),('foot',122,869,0),('toe',139,942,-74)]:j[name+side]=(C+sign*x,y,d)
b=Builder('rank-5','Solar Imperator',C,1234,775,978,1.84/958,j,side_direction=-1)
def weights(v):
 y=v[1]
 if y<270:return {'chest':1}
 if y<315:return {'chest':(315-y)/45,'spine':(y-270)/45}
 if y<395:return {'spine':(395-y)/80,'hips':(y-315)/80}
 return {'hips':1}
b.loft('Tailored black leather torso',[(165,C,42,35,0),(193,C,71,46,-3),(225,C,83,60,-7),(265,C,75,51,-5),(300,C,58,40,0),(340,C,56,38,0),(379,C,72,43,0),(420,C,77,42,0),(448,C,64,34,0),(461,C,38,24,0)],'hips','leather',weights=weights)
b.loft('Brown neck cowl',[(134,C,29,26,0),(150,C,47,37,-2),(166,C,59,43,-2),(182,C,48,37,0),(194,C,40,31,0)],'neck','fabric')
b.loft('Segmented gold helmet',[(26,C,7,16,0),(32,C,24,29,0),(43,C,34,37,0),(59,C,40,42,-1),(78,C,41,44,-4),(98,C,37,42,-4),(116,C,29,34,-3),(134,C,18,27,-3),(143,C,9,19,-3)],'head','metal',sides=40,steps=2)
b.plate('Gold jaw left',[(273,91),(302,102),(302,139),(284,124)],-43,'head',5,'metal',6)
b.plate('Gold jaw right',[(314,102),(344,91),(333,124),(314,139)],-43,'head',5,'metal',6)
b.silhouette('Amber visor',[(275,76),(308,86),(340,76),(335,89),(308,99),(280,88)],-49,'head',2,'glow')
b.plate('Helmet central ridge',[(297,31),(308,26),(319,31),(318,65),(308,78),(298,65)],-40,'head',5,'metal',6)
for sign in [-1,1]:
 def p(points):return [(C+sign*(C-x),y) for x,y in points]
 b.sphere('Helmet rotary earpiece',C+sign*42,82,0,10,18,22,'head','metal',24,16)
 b.silhouette('Gold helmet side blade',p([(250,21),(261,76),(270,91),(267,55)]),-1,'head',7)
 b.plate('Gold breastplate',p([(242,183),(277,187),(292,203),(279,228),(292,246),(274,265),(244,256),(227,231),(232,204)]),-61,'chest',7,'metal',6)
b.plate('Sternum diamond',[(290,246),(308,259),(326,246),(338,272),(308,302),(278,272)],-52,'chest',6,'metal',5)
for k in range(12):
 a=k*math.tau/12;x=C+math.sin(a)*29;y=214+math.cos(a)*29
 b.silhouette('Sun reactor ray '+str(k),[(x+math.cos(a)*4,y-math.sin(a)*4),(C+math.sin(a)*45,214+math.cos(a)*45),(x-math.cos(a)*4,y+math.sin(a)*4)],-72,'chest',3)
b.sphere('Sun reactor gold casing',C,214,-73,28,28,10,'chest','metal',32,16)
b.sphere('Solar core',C,214,-84,21,21,4,'chest','glow',32,16)
b.loft('Heavy utility belt',[(351,C,67,40,0),(365,C,80,44,0),(379,C,78,43,0),(388,C,68,38,0)],'hips','leather',steps=2)
b.plate('Gold belt buckle',[(294,358),(322,358),(320,380),(308,394),(296,380)],-46,'hips',6,'metal',4)
b.silhouette('Long gold edged tabard',[(281,384),(334,384),(339,557),(277,520)],-50,'hips',3,'fabric')
for side,sign in [('L',-1),('R',1)]:
 def mirror(points):return [(C+sign*(C-x),y) for x,y in points]
 def rows(data):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in data]
 def plate(name,p,depth,bone,thick=6,surface='metal',bulge=6):return b.plate(side+' '+name,mirror(p),depth,bone+side,thick,surface,bulge)
 x=lambda a:C+sign*a
 b.loft(side+' leather upper sleeve',rows([(184,204,32,35,0),(215,184,32,35,0),(245,172,29,32,0),(274,161,27,29,0),(306,148,25,27,0),(342,138,23,24,0)]),'arm'+side,'leather',weights=b.chain('arm'+side,'forearm'+side,184,342))
 b.loft(side+' leather forearm',rows([(329,141,23,24,0),(354,126,24,25,0),(381,115,22,23,0),(411,104,19,20,0),(442,94,17,18,0),(470,88,13,14,0)]),'forearm'+side,'leather',weights=b.chain('forearm'+side,'hand'+side,329,470))
 rays=[[(184,164),(142,97),(190,132),(209,165)],[(207,161),(183,91),(217,132),(225,165)],[(225,166),(218,113),(237,146),(238,176)],[(181,176),(119,130),(177,147),(198,173)],[(180,185),(89,182),(152,164),(191,178)],[(188,195),(113,217),(159,187),(191,181)],[(195,205),(92,246),(155,205),(192,185)],[(202,214),(109,284),(158,221),(194,195)],[(216,217),(139,294),(181,224),(205,194)],[(222,224),(169,303),(196,246),(217,208)]]
 for i,p in enumerate(rays):plate('sunray '+str(i),p,-28-i*.15,'arm',6,'metal',5)
 b.sphere(side+' shoulder hub',x(107),179,-44,22,25,12,'arm'+side,'metal',28,16)
 b.sphere(side+' shoulder solar jewel',x(107),179,-56,13,15,5,'arm'+side,'glow',24,12)
 plate('forearm gold shell',[(110,324),(126,351),(155,365),(144,386),(121,408),(102,433),(75,449),(84,416),(96,373)],-23,'forearm',8,'metal',9)
 plate('wrist cuff',[(72,437),(96,431),(110,451),(77,462)],-19,'forearm',6,'metal',4)
 b.loft(side+' black trouser thigh',rows([(415,255,43,40,0),(450,248,44,40,0),(487,238,41,38,0),(523,230,38,35,0),(559,223,35,33,0),(594,218,33,31,0),(625,216,31,30,0),(645,216,29,28,0)]),'thigh'+side,'leather',weights=b.chain('thigh'+side,'shin'+side,415,645))
 b.loft(side+' black trouser calf',rows([(628,216,29,29,0),(662,211,30,29,0),(700,205,28,27,0),(740,199,26,25,0),(783,193,23,23,0),(824,187,20,21,0),(869,186,19,19,0)]),'shin'+side,'leather',weights=b.chain('shin'+side,'foot'+side,628,869))
 plate('hip blade upper',[(220,380),(244,384),(235,415),(218,434),(192,458),(181,453),(198,411)],-37,'thigh',7,'metal',6)
 plate('hip blade lower',[(209,430),(224,433),(214,454),(195,476),(180,497),(181,468)],-39,'thigh',7,'metal',6)
 plate('long thigh edge',[(199,456),(220,451),(207,479),(198,514),(182,548),(178,584),(171,579),(178,535),(190,497)],-33,'thigh',4,'metal',3)
 plate('gold knee shield',[(187,598),(210,591),(239,605),(243,638),(229,670),(211,696),(192,689),(177,655),(175,624)],-34,'shin',9,'metal',12)
 plate('shin carapace',[(171,691),(192,715),(209,731),(231,701),(236,732),(222,769),(212,809),(205,839),(175,845),(157,812),(154,772),(157,728)],-28,'shin',9,'metal',10)
 b.loft(side+' strapped combat boot',rows([(838,186,21,23,0),(863,186,23,24,0),(887,179,26,31,-10),(911,173,29,47,-24),(936,164,35,63,-39),(956,157,38,72,-47),(970,156,39,73,-47),(978,156,39,73,-47)]),'foot'+side,'leather',sides=28,steps=2)
 plate('ankle plate',[(148,855),(179,848),(187,875),(168,895),(141,886)],-28,'foot',8,'metal',5)
 b.fingers(side,(x(225),490,-1),[(x(244),521),(x(234),537),(x(222),550),(x(210),541),(x(197),515)])
outer=b.cape([(168,146,51),(220,194,68),(305,250,76),(400,308,85),(510,366,93),(620,429,102),(725,486,110),(801,538,118)],columns=128)
outer.name='Sun embroidered umber cape'
inner=b.cape([(168,146,50),(220,194,67),(305,250,75),(400,308,84),(510,366,92),(620,429,101),(725,486,109),(801,538,117)],columns=128)
inner.name='Umber cape lining'
pixels=np.empty(len(b.image.pixels),dtype=np.float32);b.image.pixels.foreach_get(pixels)
for mesh in [outer,inner]:
 for v in list(mesh.data.vertices)[-129:]:
  px=round(b.bx-v.co.x/b.scale);edge=740
  for y in range(730,851):
   k=((b.image.size[1]-1-y)*b.image.size[0]+px)*4;r,g,blue=pixels[k:k+3]
   if r-g>.03 and g-blue>.015:edge=y
  v.co.z=(b.floor-edge)*b.scale
 for loop in mesh.data.loops:
  v=mesh.data.vertices[loop.vertex_index].co;px=b.bx-v.x/b.scale;y=b.floor-v.z/b.scale
  for uv in mesh.data.uv_layers:uv.data[loop.index].uv=(px/b.image.size[0],1-y/b.image.size[1])
# Gold border is embroidered through both faces.
b.finish()

