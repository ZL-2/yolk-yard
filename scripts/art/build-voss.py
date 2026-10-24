from operator_builder import Builder
import math,random,bmesh
C=315
j={'root':(C,939,0),'hips':(C,416,0),'spine':(C,308,0),'chest':(C,231,0),'neck':(C,167,0),'head':(C,104,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',99,207,0),('arm',125,225,0),('forearm',170,343,0),('hand',211,456,0),('thigh',50,419,0),('shin',92,622,-3),('foot',121,831,0),('toe',137,908,-72)]:j[name+side]=(C+sign*x,y,d)
b=Builder('voss','Commandant Voss',C,1227,753,939,1.92/924,j)
def weights(v):
 y=v[1]
 if y<270:return {'chest':1}
 if y<308:return {'chest':(308-y)/38,'spine':(y-270)/38}
 if y<387:return {'spine':(387-y)/79,'hips':(y-308)/79}
 return {'hips':1}
b.loft('Fitted black leather torso',[(174,C,42,34,0),(201,C,72,48,-2),(232,C,84,59,-5),(269,C,73,49,-3),(306,C,58,39,0),(345,C,58,37,0),(383,C,73,43,0),(419,C,78,43,0),(448,C,65,34,0),(461,C,38,24,0)],'hips','leather',weights=weights)
b.loft('Black throat guard',[(138,C,27,28,0),(153,C,34,31,0),(170,C,37,32,0),(188,C,42,33,0)],'neck','leather')
b.loft('Golden crowned helmet',[(48,C,22,28,0),(59,C,34,37,0),(77,C,43,44,0),(95,C,42,46,-1),(114,C,34,40,-2),(135,C,23,31,-2),(152,C,8,21,-2)],'head','metal',sides=40,steps=2)
b.plate('Long golden left faceplate',[(278,97),(309,108),(313,151),(285,130)],-45,'head',5,'metal',5)
b.plate('Long golden right faceplate',[(321,108),(352,97),(345,130),(317,151)],-45,'head',5,'metal',5)
b.silhouette('Cyan eye left',[(287,91),(307,97),(306,102),(288,97)],-49,'head',2,'glow')
b.silhouette('Cyan eye right',[(324,97),(343,91),(342,97),(324,102)],-49,'head',2,'glow')
for i,points in enumerate([[(264,32),(280,69),(278,85),(268,78)],[(284,27),(300,64),(294,80),(284,69)],[(315,15),(330,70),(315,88),(301,70)],[(346,25),(346,70),(336,81),(332,66)],[(370,31),(365,78),(354,85),(355,67)]]):
 b.plate('Integral crown peak '+str(i),points,-30,'head',9,'metal',4)
for i,a in enumerate([-.9,0,.9]):
 x=C+43*math.sin(a);d=40*math.cos(a);v=[(x-5,77,d-4),(x+5,77,d-4),(x+5,77,d+4),(x-5,77,d+4),(C+48*math.sin(a),28+i%2*8,45*math.cos(a))]
 o=b.mesh('Rear crown peak '+str(i),v,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],'head','metal',smooth=False,side_blend=False)
 for uv in o.data.uv_layers:
  for p in uv.data:p.uv=(309/1536,1-239/1024)
for sign in [-1,1]:
 def p(points):return [(C+sign*(C-x),y) for x,y in points]
 b.plate('Gold upper cuirass',p([(244,207),(281,216),(313,231),(313,285),(276,259),(251,275),(230,247)]),-60,'chest',8,'metal',9)
 b.plate('Gold lower chevron',p([(252,280),(276,269),(314,295),(314,314),(282,296),(259,297)]),-50,'spine',5,'metal',4)
 b.sphere('Mantle fur volume',C+sign*72,155,0,43,34,59,'chest','fabric',24,14)
 b.sphere('Gold cape clasp',C+sign*68,203,-48,19,19,7,'chest','metal',24,14)
b.sphere('Rear mantle volume',C,158,43,93,42,30,'chest','fabric',32,16)
b.plate('Belly gold chevrons',[(288,304),(315,321),(342,304),(338,333),(315,354),(292,333)],-43,'spine',6,'metal',5)
b.plate('Sternum diamond',[(315,187),(333,207),(315,230),(296,207)],-66,'chest',5,'metal',5)
# Short solid fur tufts give the mantle volume and an irregular silhouette.
rng=random.Random(215)
for centre,axes in [((C-72,155,0),(43,34,59)),((C+72,155,0),(43,34,59)),((C,158,43),(93,42,30))]:
 for i in range(240):
  angle=rng.random()*math.tau;z=rng.uniform(-1,1);s=math.sqrt(1-z*z);nx=s*math.cos(angle);ny=z;nz=s*math.sin(angle)
  x=centre[0]+axes[0]*nx;y=centre[1]+axes[1]*ny;d=centre[2]+axes[2]*nz;length=rng.uniform(5,12)
  o=b.mesh('Ivory fur tuft',[(x-2,y,d),(x+2,y,d),(x,y+3,d-2),(x+nx*length,y+ny*length+3,d+nz*length)],[(0,1,3),(1,2,3),(2,0,3),(0,2,1)],'chest','fabric')
  for uv in o.data.uv_layers:
   for q in uv.data:q.uv=((236+rng.uniform(-5,5))/1536,1-(147+rng.uniform(-8,8))/1024)
for o in b.parts:
 if 'fur volume' in o.name or 'mantle volume' in o.name:
  for uv in o.data.uv_layers:
   for k,q in enumerate(uv.data):
    v=o.data.vertices[o.data.loops[k].vertex_index].co;q.uv=((236+math.sin(v.x*51)*10)/1536,1-(147+math.sin(v.z*57)*14)/1024)
b.loft('Command belt',[(347,C,64,39,0),(360,C,80,44,0),(378,C,77,43,0),(387,C,66,37,0)],'hips','leather',steps=2)
b.plate('Diamond command buckle',[(315,346),(334,368),(315,390),(295,368)],-47,'hips',7,'metal',5)
b.silhouette('Long black gold tabard',[(278,382),(352,382),(363,552),(315,595),(267,552)],-49,'hips',3,'fabric')
for side,sign in [('L',-1),('R',1)]:
 def mirror(points):return [(C+sign*(C-x),y) for x,y in points]
 def rows(data):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in data]
 def plate(name,p,depth,bone,thick=6,surface='metal',bulge=6):return b.plate(side+' '+name,mirror(p),depth,bone+side,thick,surface,bulge)
 x=lambda a:C+sign*a
 b.loft(side+' upper leather sleeve',rows([(203,210,34,36,0),(230,191,34,36,0),(264,176,31,33,0),(292,163,28,30,0),(321,151,25,27,0),(346,145,23,24,0)]),'arm'+side,'leather',weights=b.chain('arm'+side,'forearm'+side,203,346))
 b.loft(side+' forearm sleeve',rows([(334,148,24,25,0),(362,134,25,25,0),(390,121,22,23,0),(420,111,19,20,0),(446,104,16,17,0),(465,104,13,14,0)]),'forearm'+side,'leather',weights=b.chain('forearm'+side,'hand'+side,334,465))
 plate('Large angular pauldron',[(148,186),(208,169),(223,204),(214,231),(179,230),(132,253)],-25,'arm',12,'metal',20)
 plate('Middle pauldron tier',[(142,252),(185,237),(190,254),(135,280),(131,290)],-25,'arm',8,'metal',7)
 plate('Lower pauldron tier',[(147,285),(178,271),(179,291),(139,315),(137,305)],-23,'arm',7,'metal',6)
 plate('Sculpted gold gauntlet',[(126,326),(144,355),(155,374),(139,392),(124,415),(114,435),(94,438),(104,399),(105,366)],-24,'forearm',8,'metal',12)
 plate('Wrist diamond cuff',[(92,421),(115,434),(128,451),(105,449),(83,455)],-21,'forearm',7,'metal',5)
 b.loft(side+' black trouser thigh',rows([(412,265,44,40,0),(450,255,44,40,0),(489,245,41,37,0),(529,237,37,34,0),(565,230,34,31,0),(596,225,31,30,0),(624,223,29,28,0)]),'thigh'+side,'leather',weights=b.chain('thigh'+side,'shin'+side,412,624))
 b.loft(side+' black trouser calf',rows([(610,223,29,29,0),(649,216,29,29,0),(688,208,27,27,0),(728,201,25,25,0),(768,196,23,23,0),(806,194,21,22,0),(835,194,19,20,0)]),'shin'+side,'leather',weights=b.chain('shin'+side,'foot'+side,610,835))
 plate('Hip gold blade',[(237,372),(262,380),(250,398),(216,423),(218,410)],-40,'thigh',7,'metal',6)
 plate('Lower hip plate',[(232,415),(247,406),(237,438),(210,475),(197,488),(204,459)],-38,'thigh',6,'metal',5)
 plate('Gold knee carapace',[(209,582),(236,581),(256,603),(259,633),(242,661),(216,670),(198,650),(194,614)],-33,'shin',10,'metal',13)
 plate('Long gold greave',[(184,669),(208,689),(232,678),(248,688),(244,724),(221,755),(211,808),(180,810),(174,764),(173,722)],-28,'shin',9,'metal',11)
 b.loft(side+' black strapped boot',rows([(807,194,21,23,0),(831,194,23,25,0),(856,188,25,31,-9),(880,182,28,46,-23),(904,173,33,61,-38),(925,170,36,70,-45),(939,170,37,71,-45)]),'foot'+side,'leather',sides=28,steps=2)
 plate('Gold ankle cuff',[(171,819),(197,820),(211,839),(204,853),(180,847),(166,846)],-27,'foot',7,'metal',6)
 b.fingers(side,(x(211),481,-1),[(x(228),515),(x(218),529),(x(205),538),(x(195),529),(x(183),506)])
cape=b.cape([(179,130,53),(224,166,65),(320,210,76),(420,251,86),(510,292,95),(600,340,105),(625,350,110),(705,378,118)],columns=128)
for v in list(cape.data.vertices)[-129:]:
 t=abs(v.co.x/b.scale)/189;y=705-t*74;v.co.z=(b.floor-y)*b.scale
bm=bmesh.new();bm.from_mesh(cape.data)
for f in list(bm.faces):
 p=f.calc_center_median();y=b.floor-p.z/b.scale;gap=max(0,(y-490)/215*30)
 if y>490 and abs(p.x/b.scale)<gap/2:bm.faces.remove(f)
bm.to_mesh(cape.data);bm.free()
for loop in cape.data.loops:
 v=cape.data.vertices[loop.vertex_index].co;px=b.bx-v.x/b.scale;y=b.floor-v.z/b.scale
 for uv in cape.data.uv_layers:uv.data[loop.index].uv=(px/1536,1-y/1024)
for o in b.parts:
 if o.name.startswith('R '):
  for p in o.data.uv_layers['Reference'].data:
   if C<p.uv.x*1536<630:p.uv.x=(2*C-p.uv.x*1536)/1536
 if any(n in o.name for n in ['sleeve','finger','palm']):
  for a in o.data.attributes['SideBlend'].data:a.value=0
 if 'finger' in o.name or 'palm' in o.name:
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv.x=(C-abs(q.uv.x*1536-b.bx))/1536
 if 'boot' in o.name or 'ankle cuff' in o.name:
  for p in o.data.uv_layers['Reference'].data:
   if p.uv.x*1536>970:p.uv.x=(b.bx+(p.uv.x*1536-b.bx)*.87)/1536
b.finish()

