from operator_builder import Builder
import math
C=309
j={'root':(C,966,0),'hips':(C,468,0),'spine':(C,360,0),'chest':(C,251,0),'neck':(C,174,0),'head':(C,91,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',117,217,0),('arm',145,244,0),('forearm',188,365,0),('hand',218,488,0),('thigh',57,472,0),('shin',102,687,-3),('foot',112,862,0),('toe',141,934,-83)]:j[name+side]=(C+sign*x,y,d)
b=Builder('rook','Marshal Rook',C,1245,753,966,1.88/946,j)
def weights(v):
 y=v[1]
 if y<295:return {'chest':1}
 if y<360:return {'chest':(360-y)/65,'spine':(y-295)/65}
 if y<425:return {'spine':(425-y)/65,'hips':(y-360)/65}
 return {'hips':1}
b.loft('Broad padded navy torso',[(185,C,52,41,0),(213,C,85,58,-2),(254,C,97,66,-4),(292,C,93,62,-3),(334,C,81,54,0),(373,C,75,50,0),(416,C,79,49,0),(454,C,83,47,0),(490,C,72,37,0),(510,C,43,27,0)],'hips',weights=weights)
b.loft('Accordion sealed neck',[(135,C,37,35,0),(151,C,50,41,0),(165,C,56,44,0),(179,C,60,47,0),(192,C,57,46,0),(207,C,48,37,0)],'neck','leather',sides=40,steps=2)
b.loft('Round navy dive helmet',[(21,C,8,14,2),(25,C,26,28,1),(36,C,43,40,0),(52,C,54,48,0),(76,C,59,54,-1),(101,C,58,55,-1),(125,C,47,47,-2),(145,C,31,34,-2),(154,C,16,25,-2)],'head','darkmetal',sides=48,steps=3)
b.sphere('Curved amber visor',C,97,-45,48,31,22,'head','glass',40,24)
b.plate('Silver lower visor frame',[(264,119),(284,132),(309,136),(336,131),(356,119),(356,141),(334,154),(286,154),(264,142)],-48,'head',6,'metal',6)
b.plate('Front respirator',[(300,130),(319,130),(329,143),(323,155),(295,155),(289,144)],-61,'head',8,'darkmetal',6)
b.plate('Helmet center spine',[(302,21),(317,21),(324,62),(299,62)],-31,'head',5,'metal',6)
for sign in [-1,1]:
 b.sphere('Helmet earpiece',C+sign*65,96,0,12,30,31,'head','metal',28,18)
 b.sphere('Cyan earpiece glass',C+sign*73,96,0,5,18,20,'head','glow',24,16)
# Silver perimeter follows the navy armor, with the anchor raised above it.
b.plate('Blue breastplate',[(238,204),(278,213),(309,220),(344,211),(379,204),(397,261),(373,307),(349,317),(268,317),(243,302),(219,260)],-66,'chest',8,'darkmetal',9)
for sign in [-1,1]:
 def p(pts):return [(C+sign*(C-x),y) for x,y in pts]
 b.silhouette('Silver chest frame',p([(233,206),(252,209),(248,248),(266,270),(263,298),(271,314),(257,329),(245,301),(229,285),(216,258),(222,231)]),-74,'chest',5,'metal')
b.plate('Silver abdominal plate',[(277,311),(341,311),(355,330),(340,366),(279,366),(263,334)],-57,'spine',7,'metal',7)
b.silhouette('Raised silver anchor',[(305,232),(305,249),(297,267),(283,273),(277,263),(284,259),(274,250),(267,270),(273,267),(282,283),(307,299),(313,299),(338,283),(347,268),(353,272),(347,250),(337,258),(344,263),(336,274),(323,269),(314,248),(314,239),(332,239),(332,232),(314,232)],-82,'chest',4,'metal')
# The anchor's ring is genuinely open.
v=[];f=[];n=32
for radius in [9,5]:
 for k in range(n):
  a=k/n*math.tau;v.append((C+radius*math.sin(a),221+radius*math.cos(a),-82))
for k in range(n):f.append((k,(k+1)%n,(k+1)%n+n,k+n))
b.mesh('Anchor open ring',v,f,'chest','metal',side_blend=False)
b.loft('Broad utility belt',[(389,C,79,50,0),(404,C,86,53,0),(419,C,84,50,0),(428,C,76,45,0)],'hips','leather',steps=2)
b.plate('Silver belt buckle',[(289,387),(330,387),(333,418),(289,418)],-56,'hips',7,'metal',2)
for side,sign in [('L',-1),('R',1)]:
 def mirror(points):return [(C+sign*(C-x),y) for x,y in points]
 def rows(data):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in data]
 def plate(name,p,depth,bone,thick=6,surface='metal',bulge=6):return b.plate(side+' '+name,mirror(p),depth,bone+side,thick,surface,bulge)
 x=lambda a:C+sign*a
 b.loft(side+' padded upper sleeve',rows([(213,190,43,43,0),(244,166,44,43,0),(273,159,39,40,0),(306,149,37,37,0),(335,137,32,33,0),(365,121,28,29,0)]),'arm'+side,weights=b.chain('arm'+side,'forearm'+side,213,365))
 b.loft(side+' padded forearm',rows([(352,125,29,30,0),(378,115,31,31,0),(406,100,28,28,0),(438,91,24,25,0),(469,89,20,21,0),(490,91,17,18,0)]),'forearm'+side,weights=b.chain('forearm'+side,'hand'+side,352,490))
 b.loft(side+' rounded marine pauldron',rows([(174,189,14,26,0),(182,176,31,38,0),(201,162,40,47,0),(228,156,44,49,0),(253,151,42,43,0),(275,152,29,32,0)]),'arm'+side,'darkmetal',sides=32,steps=2)
 plate('Silver pauldron rim',[(122,247),(145,264),(173,249),(190,228),(193,179),(210,177),(208,231),(183,267),(150,285),(126,278),(116,264)],-42,'arm',7,'metal',4)
 b.sphere(side+' shoulder bearing',x(130),240,-47,13,14,6,'arm'+side,'metal',24,12)
 plate('Silver curved forearm shell',[(77,350),(107,362),(143,387),(147,405),(125,411),(105,454),(60,463),(61,436),(67,398)],-31,'forearm',11,'metal',12)
 b.sphere(side+' wrist bearing',x(242),437,-32,10,15,8,'forearm'+side,'metal',20,12)
 plate('Silver glove plate',[(68,476),(84,471),(89,489),(86,516),(59,524),(57,500)],-21,'hand',5,'metal',3)
 b.loft(side+' baggy navy trouser thigh',rows([(457,252,51,47,0),(490,245,53,48,0),(528,235,52,47,0),(566,225,49,43,0),(600,218,48,41,0),(632,210,43,38,0),(660,207,37,33,0),(688,207,33,31,0)]),'thigh'+side,weights=b.chain('thigh'+side,'shin'+side,457,688))
 b.loft(side+' baggy navy trouser calf',rows([(671,207,34,33,0),(702,202,37,34,0),(730,197,41,36,0),(752,195,39,34,0),(779,195,31,30,0),(815,197,27,27,0),(862,197,23,23,0)]),'shin'+side,weights=b.chain('shin'+side,'foot'+side,671,862))
 plate('Cargo pocket',[(174,502),(215,510),(207,601),(151,603),(158,551)],-43,'thigh',16,'fabric',4)
 plate('Cargo flap',[(172,499),(214,504),(210,532),(165,536),(158,527)],-59,'thigh',4,'fabric',3)
 plate('Large kneepad',[(184,644),(224,641),(243,663),(241,702),(226,724),(185,719),(171,696),(170,668)],-39,'shin',13,'metal',10)
 plate('Navy kneepad insert',[(190,656),(220,657),(228,669),(225,702),(193,705),(181,686)],-53,'shin',5,'darkmetal',4)
 def boot_weights(v):
  t=max(0,min(1,(v[1]-810)/52));return {'shin'+side:1-t,'foot'+side:t}
 b.loft(side+' heavy black boot',rows([(762,195,28,30,0),(779,195,30,31,0),(819,197,26,27,0),(854,196,24,27,-3),(878,188,29,35,-15),(903,177,36,52,-31),(932,161,44,73,-51),(952,156,47,80,-57),(966,156,48,81,-57)]),'foot'+side,'leather',weights=boot_weights,sides=32,steps=2)
 plate('Boot top strap',[(160,762),(207,764),(238,782),(235,799),(204,789),(157,783)],-27,'shin',6,'leather',2)
 b.sphere(side+' ankle bearing',x(79),874,-1,13,20,25,'foot'+side,'metal',24,16)
 b.fingers(side,(x(216),515,-1),[(x(235),546),(x(223),563),(x(210),573),(x(200),562),(x(182),534)],size=1.25)
 b.sphere(side+' belt valve',x(90),316,-59,21,25,11,'chest','metal',28,16)
 b.plate(side+' belt equipment pouch',mirror([(205,344),(245,341),(259,358),(252,389),(212,391),(200,374)]),-56,'hips',15,'leather',4)
# Two distinct compressed-air vessels, straps and valve stems on the back.
for sign in [-1,1]:
 x=C+sign*43
 b.loft('Back air cylinder',[(149,x,18,21,97),(156,x,28,30,97),(170,x,34,35,97),(195,x,35,36,97),(320,x,35,36,97),(346,x,30,32,97),(362,x,18,21,97)],'chest','metal',sides=32,steps=2)
 for top,bottom in [(204,225),(283,309)]:
  b.loft('Cylinder retaining band',[(top,x,37,38,97),(bottom,x,37,38,97)],'chest','leather',sides=32,steps=2)
 b.loft('Regulator neck',[(116,x,10,11,97),(149,x,12,14,97)],'chest','darkmetal',sides=20,steps=2)
 b.loft('Regulator wheel',[(111,x,15,15,97),(124,x,15,15,97)],'chest','darkmetal',sides=16,steps=1)
# Ribbed pressure hoses follow a 3D curve around each shoulder.
for sign in [-1,1]:
 v=[];f=[];n=48;sides=8
 for k in range(n):
  t=k/(n-1);x=C+sign*(45+42*math.sin(t*math.pi));y=135+41*t;d=97-130*t;r=5.5+(k%2)*1.2
  for q in range(sides):
   a=q/sides*math.tau;v.append((x+r*math.cos(a),y+r*math.sin(a),d))
 for k in range(n-1):
  for q in range(sides):a=k*sides+q;f.append((a,k*sides+(q+1)%sides,(k+1)*sides+(q+1)%sides,a+sides))
 o=b.mesh('Ribbed collar pressure hose',v,f,'chest','leather')
 for uv in o.data.uv_layers:
  for q in uv.data:q.uv=(292/1536,1-165/1024)
for o in b.parts:
 if o.name.startswith('R '):
  for p in o.data.uv_layers['Reference'].data:
   if C<p.uv.x*1536<630:p.uv.x=(2*C-p.uv.x*1536)/1536
 if any(n in o.name for n in ['sleeve','forearm','finger','palm']):
  for a in o.data.attributes['SideBlend'].data:a.value=0
 if 'finger' in o.name or 'palm' in o.name:
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv.x=(C-abs(q.uv.x*1536-b.bx))/1536
 if 'boot' in o.name or 'ankle bearing' in o.name:
  for p in o.data.uv_layers['Reference'].data:
   if p.uv.x*1536>970:p.uv.x=(b.bx+(p.uv.x*1536-b.bx)*.82)/1536
b.finish()

