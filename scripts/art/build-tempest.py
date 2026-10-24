from operator_builder import Builder

C=327
j={'root':(C,958,0),'hips':(C,420,0),'spine':(C,327,0),'chest':(C,230,0),'neck':(C,158,0),'head':(C,82,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',103,203,0),('arm',126,215,0),('forearm',166,347,0),('hand',204,477,0),('thigh',52,433,0),('shin',80,641,-4),('foot',109,865,0),('toe',119,925,-75)]:j[name+side]=(C+sign*x,y,d)
b=Builder('rank-25','Tempest Sentinel',C,1210,757,958,1.82/930,j)
def body_weights(v):
 y=v[1]
 if y<270:return {'chest':1}
 if y<327:return {'chest':(327-y)/57,'spine':(y-270)/57}
 if y<395:return {'spine':(395-y)/68,'hips':(y-327)/68}
 return {'hips':1}
b.loft('Fitted stormcloth torso',[(168,C,39,32,0),(194,C,73,47,-5),(232,C,87,59,-8),(278,C,77,49,-6),(312,C,59,38,-3),(352,C,55,35,0),(380,C,68,40,0),(415,C,79,42,0),(445,C,70,35,0),(461,C,42,23,0)],'hips',weights=body_weights)
b.loft('Scarf collar',[(137,C,27,25,0),(151,C,43,31,0),(169,C,56,38,0),(182,C,46,38,0),(195,C,43,34,0)],'neck')
b.loft('Faceted helmet',[(27,C,12,19,4),(32,C,30,32,1),(47,C,43,41,0),(68,C,49,46,-1),(88,C,47,48,-1),(108,C,37,40,-1),(127,C,23,31,-2),(143,C,11,20,-2)],'head','metal',sides=40,steps=2)
# The cheek/chin wedge, brow and split cyan visor are modeled in relief.
b.plate('Faceplate wedge',[(306,98),(327,108),(348,98),(342,124),(327,141),(312,124)],-45,'head',4,'metal',7)
b.plate('Cyan visor left',[(290,78),(326,92),(326,102),(294,87)],-47,'head',2,'glow',1)
b.plate('Cyan visor right',[(328,92),(365,78),(361,87),(328,102)],-47,'head',2,'glow',1)
b.plate('Left chest cuirass',[(272,181),(302,187),(311,205),(304,226),(311,246),(299,271),(280,280),(248,263),(239,227),(251,198)],-61,'chest',7,'metal',12)
b.plate('Right chest cuirass',[(382,181),(403,198),(415,227),(406,263),(374,280),(355,271),(343,246),(350,226),(343,205),(352,187)],-61,'chest',7,'metal',12)
b.plate('Sternum plate',[(313,251),(327,269),(341,251),(352,275),(327,296),(302,275)],-54,'chest',5,'metal',4)
b.sphere('Reactor bezel',C,224,-70,23,23,10,'chest','darkmetal',28,14)
b.sphere('Stormglass core',C,224,-80,15,16,5,'chest','glow',28,14)
b.loft('Waist utility belt',[(363,C,69,40,0),(374,C,81,44,0),(393,C,78,43,0),(400,C,67,39,0)],'hips','leather',steps=2)
b.plate('Angular belt buckle',[(302,371),(327,379),(351,371),(345,413),(328,441),(310,414)],-45,'hips',6,'metal',5)
for side,sign in [('L',-1),('R',1)]:
 def mirror(points):return [(C+sign*(C-x),y) for x,y in points]
 def rows(data):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in data]
 def plate(name,points,depth,bone,thickness=5,surface='metal',bulge=5):return b.plate(side+' '+name,mirror(points),depth,bone+side,thickness,surface,bulge)
 x=lambda a:C+sign*a
 b.sphere(side+' helmet temple',x(50),86,0,10,19,27,'head','darkmetal')
 b.plate(side+' aerial fin',[(x(40),74),(x(75),16),(x(58),72),(x(51),89)],-2,'head',6,'metal',2)
 b.loft(side+' shoulder underlayer',rows([(191,220,31,35,0),(215,204,34,36,0),(248,188,30,32,0),(277,181,26,27,0)]),'arm'+side)
 b.loft(side+' upper sleeve',rows([(238,190,28,29,0),(270,180,29,29,0),(290,174,25,27,0),(308,169,27,27,0),(334,161,25,26,0),(352,157,22,22,0)]),'arm'+side,weights=b.chain('arm'+side,'forearm'+side,238,352))
 b.loft(side+' forearm undersuit',rows([(340,157,23,23,0),(366,149,23,23,0),(391,140,21,21,0),(421,132,17,18,0),(452,123,14,15,0),(479,117,12,12,0)]),'forearm'+side,weights=b.chain('forearm'+side,'hand'+side,340,479))
 plate('shoulder blade upper',[(226,150),(190,155),(158,179),(131,216),(185,191),(220,175)],-23,'arm',7,'metal',5)
 plate('shoulder blade middle',[(218,183),(186,190),(155,225),(125,263),(184,228),(208,209)],-28,'arm',7,'metal',6)
 plate('shoulder blade lower',[(206,217),(181,228),(157,260),(130,296),(182,263),(199,242)],-24,'arm',6,'metal',5)
 b.sphere(side+' shoulder circular pivot',x(92),197,-35,14,14,6,'chest','metal')
 plate('gauntlet shell',[(136,332),(166,351),(154,383),(141,411),(132,445),(105,449),(116,416),(125,380)],-19,'forearm',7,'metal',10)
 plate('wrist cuff',[(106,435),(133,444),(137,459),(107,452)],-17,'forearm',5,'metal',3)
 # Eight cross-sections follow the trouser folds, not a straight cylinder.
 b.loft(side+' trouser thigh',rows([(425,274,47,39,1),(455,269,48,41,0),(490,263,46,39,0),(527,258,43,36,0),(560,252,38,34,0),(589,248,37,33,0),(614,246,35,31,0),(641,247,30,29,0)]),'thigh'+side,weights=b.chain('thigh'+side,'shin'+side,425,641))
 b.loft(side+' trouser calf',rows([(627,247,31,29,0),(658,242,32,29,0),(691,236,29,28,0),(730,229,28,26,0),(765,224,25,23,0),(799,219,23,22,0),(836,217,20,20,0),(866,218,18,18,0)]),'shin'+side,weights=b.chain('shin'+side,'foot'+side,627,866))
 plate('hip blade',[(243,404),(265,413),(244,463),(213,512),(201,531),(213,468)],-35,'thigh',7,'metal',6)
 plate('knee shell',[(226,604),(256,598),(279,621),(269,670),(248,696),(221,675),(210,635)],-33,'shin',9,'metal',10)
 plate('shin armor',[(206,689),(229,713),(248,705),(244,748),(230,799),(230,833),(202,838),(186,817),(193,761),(184,726)],-25,'shin',8,'metal',10)
 b.loft(side+' articulated boot',rows([(835,217,20,23,0),(855,217,21,23,0),(880,213,23,27,-8),(902,207,27,44,-20),(920,197,33,60,-38),(938,191,37,69,-43),(951,190,38,70,-43),(957,190,38,70,-43)]),'foot'+side,'leather',sides=28,steps=2)
 plate('ankle silver cuff',[(205,837),(230,842),(233,860),(222,880),(200,871),(194,852)],-24,'foot',6,'metal',4)
 b.fingers(side,(x(209),492,-2),[(x(223),522),(x(221),536),(x(209),545),(x(201),542),(x(184),514)])
cape=b.cape([(175,100,47),(215,170,62),(310,220,70),(420,285,77),(535,350,84),(650,410,89),(745,465,95),(810,488,100)])
# Sample an unobscured strip of actual cape cloth, keeping legs out of its UVs.
for loop in cape.data.loops:
 v=cape.data.vertices[loop.vertex_index].co;y=b.floor-v.z/b.scale;t=(v.x/b.scale+244)/488;yy=620+(y-175)/635*60;px=156+t*13
 for uv in cape.data.uv_layers:uv.data[loop.index].uv=(px/b.image.size[0],1-yy/b.image.size[1])
for top,bottom in [(710,722),(740,752)]:
 for offset in [-1,1]:
  band=b.cape([(y,410+(y-650)/95*55,89+(y-650)/95*6+offset) for y in [top,bottom]],drape_range=(175,810))
  band.name='Sewn silver cape stripe'
  for loop in band.data.loops:
   v=band.data.vertices[loop.vertex_index].co;t=(v.x/b.scale+244)/488
   for uv in band.data.uv_layers:uv.data[loop.index].uv=((120+t*25)/b.image.size[0],1-(713+(b.floor-v.z/b.scale-top)*.4)/b.image.size[1])
b.finish()
