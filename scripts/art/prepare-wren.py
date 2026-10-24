"""Package the user-approved Wren Blender source for the production roster."""
import bpy, pathlib, sys, json, struct

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = pathlib.Path(sys.argv[-1]).resolve()
OUT = ROOT / 'public/models/operators'
EDIT = ROOT / 'art/operators/wren'
OUT.mkdir(parents=True, exist_ok=True)
EDIT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for o in meshes:
    o['production_roster'] = 'Wren / user-approved 2026-10-23'
    o['source_reference'] = 'public/shop/wren.webp'
    for m in o.data.materials:
        m.use_backface_culling = False
# The review GLB is self-contained. Recover the one externally linked face
# image from that exact approved asset before resaving its editable source.
raw = (SOURCE.parent/'Wren-review.glb').read_bytes()
length = struct.unpack_from('<I',raw,12)[0]
document = json.loads(raw[20:20+length])
binary = raw[28+length:]
for im in bpy.data.images:
    if not im.size[0] or im.name == 'Render Result' or im.packed_file: continue
    name = {'face-reference.png':'face-reference','Wren baked albedo':'wren-albedo','Wren surface properties':'wren-surface'}.get(im.name)
    source = next((i for i in document['images'] if i['name']==name), None)
    if source:
        view = document['bufferViews'][source['bufferView']]
        data = binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        im.pack(data=data, data_len=len(data))
bpy.ops.wm.save_as_mainfile(filepath=str(EDIT / 'wren.blend'), compress=True)
bpy.ops.object.select_all(action='DESELECT')
for o in [rig] + meshes: o.select_set(True)
def export(name, materials='EXPORT'):
    bpy.ops.export_scene.gltf(filepath=str(OUT/name), export_format='GLB', use_selection=True,
        export_skins=True, export_animations=False, export_yup=True,
        export_image_format='JPEG', export_jpeg_quality=90, export_materials=materials)
export('wren.glb')
for o in meshes:
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('Distance topology', 'DECIMATE')
    mod.ratio = .24
    bpy.ops.object.modifier_apply(modifier=mod.name)
export('wren-lod.glb', 'NONE')
report = {'name':'Wren', 'source':'Wren-editable.blend from approved review',
    'sourceTriangles':64774, 'lodTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
    'files':{n:(OUT/n).stat().st_size for n in ['wren.glb','wren-lod.glb']},
    'reference':'public/shop/wren.webp', 'unseenSurfaces':'Inferred in the approved construction sheet'}
(EDIT/'production.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report), flush=True)
