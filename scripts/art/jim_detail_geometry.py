"""Reference-driven identity and footwear for the private Jim approval assets.

Facial coordinates are measured in the user's close-up. Shoe pieces are actual
surfaces: openings, separate sole layers, overlay panels, straps and hardware.
"""
import json
import math

import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon


def mix(a, b, t):
    return a + (b - a) * t


def interpolate(points, x):
    for a, b in zip(points, points[1:]):
        if a[0] <= x <= b[0]:
            return mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]))
    return points[0][1] if x < points[0][0] else points[-1][1]


def silhouette_curve(points, x):
    """Smooth profile through measured silhouette samples."""
    for k, (a, b) in enumerate(zip(points, points[1:])):
        if a[0] <= x <= b[0]:
            before, after = points[max(0, k - 1)], points[min(len(points) - 1, k + 2)]
            t = (x - a[0]) / (b[0] - a[0])
            m0 = (b[1] - before[1]) / (b[0] - before[0]) * (b[0] - a[0])
            m1 = (after[1] - a[1]) / (after[0] - a[0]) * (b[0] - a[0])
            return (2*t**3-3*t*t+1)*a[1] + (t**3-2*t*t+t)*m0 + (-2*t**3+3*t*t)*b[1] + (t**3-t*t)*m1
    return points[0][1] if x < points[0][0] else points[-1][1]


def build_identity(api):
    mesh, loft, tube, ellipsoid, solid = [api[k] for k in ('mesh', 'loft', 'tube', 'ellipsoid', 'solid')]
    face_mat, face_image, skin = [api[k] for k in ('faceMat', 'faceImage', 'skin')]
    spec = api['FACE_SPEC']
    scale = spec['metersPerPixel']
    origin_x, origin_y = spec['originPixel']
    chin = spec['chinHeight']
    image_width, image_height = spec['imageSize']
    def xyz(px, py, depth=0):
        return ((px - origin_x) * scale, depth, chin + (origin_y - py) * scale)
    def gaussian(x, z, px, py, sx, sz):
        xc, _, zc = xyz(px, py)
        return math.exp(-((x - xc) / sx) ** 2 - ((z - zc) / sz) ** 2)

    # Uniform pixel scale is important: the first draft stretched facial height
    # relative to width. The jaw contour now follows the supplied close-up.
    outline = [
        (848, 628, 3, .027), (842, 628, 45, .042),
        (831, 628, 87, .050), (810, 628, 124, .060),
        (781, 626, 155, .069), (752, 623, 178, .076),
        (716, 620, 199, .081), (675, 620, 218, .085),
        (628, 620, 232, .088), (579, 620, 241, .090),
        (535, 620, 244, .090), (490, 621, 244, .090),
        (447, 625, 239, .089), (408, 630, 229, .087),
        (367, 630, 223, .086), (320, 630, 216, .082),
        (264, 630, 203, .077), (210, 630, 184, .068),
        (163, 630, 148, .054), (131, 630, 90, .035),
        (115, 630, 10, .010),
    ]
    neck = loft('Neck / continuous tapered anatomy', [
        (1.475, 0, .049, .043, .012), (1.515, 0, .044, .043, .017),
        (1.552, 0, .045, .045, .020), (1.587, 0, .050, .049, .022),
    ], 'neck', 'face', mat=solid('Jim / neck skin', (.60, .37, .28), .7), steps=4, sides=48)
    rows = [(xyz(cx, py)[2], xyz(cx, py)[0], width * scale, depth, .012)
            for py, cx, width, depth in outline]
    head = loft('Jim / landmark fitted facial anatomy', rows, 'head', 'face',
                face=True, sides=128, steps=4)
    for v in head.data.vertices:
        x, y, z = v.co
        front = api['smooth'](.014, -.048, y)
        g = lambda px, py, sx, sz: gaussian(x, z, px, py, sx, sz)
        # Bridge, tip and individual alae use the measured feature locations.
        d = .014 * g(627, 520, .010, .025) + .024 * g(625, 564, .012, .012)
        d += .008 * g(599, 581, .008, .006) + .008 * g(657, 578, .008, .006)
        d -= .003 * g(599, 590, .004, .0028) + .003 * g(658, 585, .004, .0028)
        # Shallow orbital sockets and a curved visible corneal surface.
        for px, py in [(517, 476), (734, 470)]:
            d -= .006 * g(px, py, .021, .010)
            d += .0036 * g(px, py, .011, .005)
            d += .0035 * g(px, py - 48, .024, .008)
        d += .004 * (g(473, 585, .024, .024) + g(764, 581, .024, .024))
        d += .0035 * g(624, 676, .023, .0045) + .0045 * g(625, 704, .025, .005)
        d -= .0018 * g(626, 690, .027, .0017)
        d -= .002 * g(625, 636, .005, .009)
        d += .0045 * g(628, 796, .028, .012)
        v.co.y -= d * front
    head.data.update()
    # Do not fade the actual photographed cheek and jaw into a generic color.
    for p in head.data.polygons:
        for li in p.loop_indices:
            v = head.data.vertices[head.data.loops[li].vertex_index]
            head.data.attributes['ProjectionWeight'].data[li].value = api['smooth'](.030, .010, v.co.y)

    # Ears retain the photo placement; relief is visible from oblique angles.
    for side, px, py in [('L', 352, 597), ('R', 876, 589)]:
        center = xyz(px, py, -.004)
        ellipsoid(side + ' ear / photo aligned', center, (.012, .011, .026),
                  'head', 'face', face=True, segments=32, rings=20)

    # Register the extracted hair to the original close-up with measured image
    # features, so the new cutout cannot silently shift the eyes or forehead.
    registration = json.loads((api['DIR'] / 'hair-registration.json').read_text())
    matrix = registration['sourceToCutout']; cw, ch = registration['cutoutSize']
    cutout = bpy.data.images.load(str(api['DIR'] / 'textures/hair-closeup-cutout.png')); cutout.pack()
    def hair_uv(px, py):
        return ((matrix[0][0] * px + matrix[0][1] * py + matrix[0][2]) / cw,
                1 - (matrix[1][0] * px + matrix[1][1] * py + matrix[1][2]) / ch)
    front_mat = solid('Jim / alpha closeup curls', (.5, .5, .5), .94)
    nodes, links = front_mat.node_tree.nodes, front_mat.node_tree.links
    bs = nodes.get('Principled BSDF'); bs.inputs['Specular IOR Level'].default_value = .08
    texture = nodes.new('ShaderNodeTexImage'); texture.image = cutout
    tone = nodes.new('ShaderNodeMixRGB'); tone.blend_type = 'MULTIPLY'; tone.inputs[0].default_value = 1
    tone.inputs[2].default_value = (.82, .84, .86, 1)
    links.new(texture.outputs['Color'], tone.inputs[1]); links.new(tone.outputs[0], bs.inputs['Base Color'])
    threshold = nodes.new('ShaderNodeMath'); threshold.operation = 'GREATER_THAN'; threshold.inputs[1].default_value = .46
    links.new(texture.outputs['Alpha'], threshold.inputs[0]); links.new(threshold.outputs[0], bs.inputs['Alpha'])
    front_mat.surface_render_method = 'DITHERED'; front_mat.use_transparency_overlap = False
    # Horizontal silhouette measurements keep every view inside the source
    # head outline; a larger generic sphere would make a second rim around it.
    envelope = [(18, 640, 675), (40, 490, 730), (70, 430, 775),
                (110, 370, 855), (150, 340, 880), (200, 290, 925),
                (260, 250, 960), (320, 225, 980), (380, 195, 970),
                (440, 195, 960), (500, 220, 940), (550, 250, 915),
                (610, 285, 895), (670, 315, 875), (720, 340, 850),
                (765, 380, 820)]
    verts, faces, uvcoords = [], [], []
    columns, count = 112, 56
    for j in range(count + 1):
        py = mix(18, 765, j / count)
        left = silhouette_curve([(a, b) for a, b, c in envelope], py)
        right = silhouette_curve([(a, c) for a, b, c in envelope], py)
        cx = (left + right) / 2; radius = (right - left) / 2 * scale
        z = xyz(cx, py)[2]
        front_depth = min(.112, radius * .88)
        head_depth = interpolate([(r[0], r[3]) for r in rows], z)
        back_depth = max(radius * .91, head_depth + .018) if py > 80 else radius * .91
        for i in range(columns + 1):
            phi = math.tau * i / columns; front = max(0, -math.sin(phi))
            bump = 1 + .009 * math.sin(phi * 13 + j * .8)
            x = xyz(cx, py)[0] + radius * math.cos(phi) * bump
            y = .012 + (front_depth if math.sin(phi) < 0 else back_depth) * math.sin(phi)
            if front > 0:
                y = mix(y, .024, api['smooth'](550, 750, py) * front)
            rear = max(0, math.sin(phi))
            zz = z - .006 * rear * api['smooth'](1.72, 1.81, z)
            zz += (.003 * math.sin(phi * 11) + .002 * math.cos(phi * 17)) * api['smooth'](.70, 1.0, j / count)
            source_x = origin_x + x / scale
            # Front is the registered photograph, back is a crown-only sample.
            if i >= columns / 2:
                uvcoords.append(hair_uv(source_x, py))
            else:
                back_px = 405 + 400 * i / (columns / 2)
                back_py = 150 + 150 * (1 - abs(2 * j / count - 1))
                uvcoords.append(hair_uv(back_px, back_py))
            verts.append((x, y, zz))
    for j in range(count):
        for i in range(columns):
            a = j * (columns + 1) + i; faces.append((a, a + 1, a + columns + 2, a + columns + 1))
    cap = mesh('Jim / continuous photo curl volume', verts, faces, 'head', 'cards', front_mat)
    for p in cap.data.polygons:
        for li in p.loop_indices: cap.data.uv_layers['Projection'].data[li].uv = uvcoords[cap.data.loops[li].vertex_index]

    # A shallow rear support closes the measured curl volume without placing
    # any additional opaque surface across the photographed face or ears.
    support_mat = solid('Jim / underlying curl volume', (.075, .045, .029), .98)
    nodes, links = support_mat.node_tree.nodes, support_mat.node_tree.links
    texture = nodes.new('ShaderNodeTexImage'); texture.image = face_image
    uv_node = nodes.new('ShaderNodeUVMap'); uv_node.uv_map = 'Projection'
    links.new(uv_node.outputs[0], texture.inputs['Vector'])
    tone = nodes.new('ShaderNodeMixRGB'); tone.blend_type = 'MULTIPLY'; tone.inputs[0].default_value = 1
    tone.inputs[2].default_value = (.82, .84, .86, 1)
    links.new(texture.outputs['Color'], tone.inputs[1]); links.new(tone.outputs[0], nodes.get('Principled BSDF').inputs['Base Color'])
    support_verts = [(-.011 + (x + .011) * .985, mix(y, .015, .045), 1.687 + (z - 1.687) * .99) for x, y, z in verts]
    support_faces, support_uv = [], []
    for j in range(count + 1):
        py = mix(18, 765, j / count)
        for i in range(columns + 1):
            index = j * (columns + 1) + i; x, y, z = verts[index]
            px = origin_x + x / scale
            px = 405 + 400 * (i % (columns // 2 + 1)) / (columns / 2); yy = 150 + 150 * (1 - abs(2 * j / count - 1))
            support_uv.append((px / image_width, 1 - yy / image_height))
    for j in range(0, count, 2):
        py = mix(18, 765, (j + 1) / count)
        for i in range(0, columns, 2):
            a = j * (columns + 1) + i; ids = (a, a + 2, a + 2 * (columns + 1) + 2, a + 2 * (columns + 1))
            if py > 80 and i < columns / 2: support_faces.append(ids)
    support = mesh('Jim / measured curl support', support_verts, support_faces, 'head', 'hair', support_mat)
    for p in support.data.polygons:
        for li in p.loop_indices: support.data.uv_layers['Projection'].data[li].uv = support_uv[support.data.loops[li].vertex_index]
    # The dense crown has volume beneath the fine strands. Without this core,
    # grazing views see the unlit inside of the opposite alpha surface.
    core = solid('Jim / dense brown crown', (.080, .047, .030), .98)
    ellipsoid('Jim / dense crown core', (-.010, .025, 1.741), (.080, .066, .047),
              'head', 'hair', core, segments=32, rings=18)


def textured_material(solid, name, color, variation=.08, frequency=180, roughness=.9):
    """Small real material variation; color is baked into the footwear atlas."""
    m = solid(name, color, roughness)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bs = nodes.get('Principled BSDF')
    noise = nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = frequency
    noise.inputs['Detail'].default_value = 2.5; noise.inputs['Roughness'].default_value = .72
    ramp = nodes.new('ShaderNodeValToRGB')
    for e, f in zip(ramp.color_ramp.elements, [1 - variation, 1 + variation]):
        e.color = (*[min(1, c * f) for c in color], 1)
    links.new(noise.outputs['Fac'], ramp.inputs[0]); links.new(ramp.outputs[0], bs.inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .23
    bump.inputs['Distance'].default_value = .0004
    links.new(noise.outputs['Fac'], bump.inputs['Height']); links.new(bump.outputs[0], bs.inputs['Normal'])
    return m


def build_footwear(api, sign, side):
    group = 'footwear'; bone = 'foot' + side; x = sign * .164
    def mesh(name, verts, faces, mat):
        return api['mesh'](side + ' / ' + name, verts, faces, bone, group, mat)
    def tube(name, points, radius, mat, sides=6, taper=False):
        return api['tube'](side + ' / ' + name, points, radius, bone, group, mat, sides=sides, taper=taper)
    def ellipsoid(name, center, radii, mat, segments=24, rings=12):
        return api['ellipsoid'](side + ' / ' + name, center, radii, bone, group, mat, segments=segments, rings=rings)
    def loft(name, rows, mat, sides=32, steps=3):
        return api['loft'](side + ' / ' + name, rows, bone, group, mat, sides=sides, steps=steps)
    solid = api['solid']; is_clog = api['STYLE'] == 'normal'
    suede = textured_material(solid, 'Jim / taupe suede nap', (.24, .16, .09), .18, 530)
    strap_mat = textured_material(solid, 'Jim / dark suede strap', (.18, .11, .059), .13, 480)
    cork = textured_material(solid, 'Jim / cork granules', (.29, .17, .083), .58, 140)
    footbed = textured_material(solid, 'Jim / shaped suede footbed', (.24, .16, .095), .18, 380)
    rubber = textured_material(solid, 'Jim / outsole brown rubber', (.115, .082, .052), .12, 170)
    seam = solid('Jim / tan topstitch', (.48, .36, .24), .94)
    cream = textured_material(solid, 'Jim / worn warm ivory leather', (.67, .64, .55), .04, 270)
    meshmat = textured_material(solid, 'Jim / cream woven mesh', (.57, .55, .47), .22, 460)
    overlay = textured_material(solid, 'Jim / chalk suede overlays', (.49, .47, .38), .11, 360)
    green = textured_material(solid, 'Jim / reference sage green', (.12, .20, .17), .04, 260)
    midsole = textured_material(solid, 'Jim / aged ivory EVA', (.63, .59, .48), .10, 185)
    midsole_band = solid('Jim / heel stabilizer', (.28, .31, .27), .82)
    lace = textured_material(solid, 'Jim / cotton laces', (.80, .78, .69), .06, 500)
    stitch = solid('Jim / cream stitching', (.83, .80, .72), .95)
    recess = solid('Jim / stitch and perforation recess', (.28, .27, .23), .93)
    hardware = solid('Jim / dark nickel buckle', (.18, .16, .13), .31, .75)
    sock = textured_material(solid, 'Jim / off white knit socks', (.79, .79, .73), .08, 580)
    widths = [(-.211, .004), (-.201, .031), (-.184, .046), (-.157, .052),
              (-.12, .052), (-.075, .046), (-.02, .041), (.035, .040), (.062, .028), (.071, .003)]
    def width(y): return interpolate(widths, y)
    def lift(y): return .007 * max(0, min(1, (-y - .16) / .05)) ** 1.4
    # A footprint with flat sidewalls and a rounded last, not stacked ellipsoids.
    outline = []
    for i in range(65):
        y = mix(-.211, .071, i / 64); outline.append((width(y), y))
    for i in range(64, -1, -1):
        y = mix(-.211, .071, i / 64); outline.append((-width(y), y))
    def sole(name, levels, mat):
        verts, faces = [], []; count = len(outline)
        for z, scale in levels:
            for xx, y in outline: verts.append((x + xx * scale, y, z + lift(y)))
        for j in range(len(levels) - 1):
            for i in range(count):
                a = j * count + i; b = j * count + (i + 1) % count
                faces.append((a, b, b + count, a + count))
        faces += [tuple(reversed(range(count))), tuple((len(levels) - 1) * count + i for i in range(count))]
        return mesh(name, verts, faces, mat)
    sole('separate rubber outsole', [(.004, .95), (.007, 1.015), (.011, 1.015), (.013, .99)], rubber)
    if is_clog:
        sole('cork footbed sidewall', [(.012, .98), (.016, 1), (.026, .98), (.030, .93)], cork)
        sole('contoured suede insole', [(.028, .93), (.032, .91)], footbed)
        tube('raised insole perimeter', [(x + xx * .925, y, .033 + lift(y)) for xx, y in outline + outline[:1]], .002, footbed)
        ellipsoid('exposed bare heel', (x, .024, .083), (.030, .037, .050), api['skin'])
        ellipsoid('bare instep', (x, -.006, .068), (.032, .064, .040), api['skin'])
        heights = [(-.211, .032), (-.200, .049), (-.183, .064), (-.15, .073),
                   (-.11, .084), (-.075, .096), (-.035, .105), (.025, .066)]
        def point(u, t, offset=0):
            end = -.043 + .060 * abs(u) ** .8
            y = mix(-.210, end, t)
            z = .032 + (interpolate(heights, y) - .032) * max(0, 1 - u * u) ** .40
            return (x + width(y) * .97 * u, y, z + lift(y) + offset)
        verts, faces = [], []
        for j in range(41):
            for i in range(41): verts.append(point(-1 + i / 20, j / 40))
        for j in range(40):
            for i in range(40):
                a = j * 41 + i; faces.append((a, a + 1, a + 42, a + 41))
        mesh('open heel closed toe suede shell', verts, faces, suede)
        tube('curved vamp opening binding', [point(-1 + i / 40, 1, .0008) for i in range(81)], .0016, strap_mat)
        # Strap lies on the sloping instep rather than standing like a plaque.
        verts, faces = [], []
        for j in range(5):
            for i in range(49): verts.append(point(-1 + i / 24, .79 + j * .033, .0020))
        for j in range(4):
            for i in range(48):
                a = j * 49 + i; faces.append((a, a + 1, a + 50, a + 49))
        mesh('wide sloping adjustable suede strap', verts, faces, strap_mat)
        for row in [.805, .908]:
            tube('strap parallel embossed edge', [point(-.98 + i * 1.96 / 60, row, .0028) for i in range(61)], .00055, suede, sides=4)
        # Outside buckle with open center, pin and a leather keeper loop.
        u = sign * .96
        buckle = [point(u, t, .0038) for t in [.785, .925]]
        bx = x + sign * .047; by = sum(p[1] for p in buckle) / 2; bz = .061
        tube('open rectangular metal buckle', [(bx, by - .011, bz - .008), (bx, by + .011, bz - .008),
             (bx, by + .011, bz + .008), (bx, by - .011, bz + .008), (bx, by - .011, bz - .008)], .0014, hardware)
        tube('buckle pin', [(bx - sign * .001, by, bz - .008), (bx + sign * .001, by, bz + .006)], .00065, hardware, sides=5)
        for n in range(4):
            p = point(-sign * (.1 + n * .11), .855, .0032)
            ellipsoid('strap adjustment hole', p, (.0007, .0010, .00055), recess, segments=8, rings=4)
        for i in range(48):
            u = -.94 + 1.88 * i / 47
            tube('vamp short stitch', [point(u, .965, .001), point(u + .014, .965, .001)], .00038, seam, sides=4)
        # Visible underside tread chevrons and a defined flat contact patch.
        for y in [-.175 + i * .021 for i in range(11)]:
            w = width(y) * .87
            tube('outsole chevron tread', [(x - w, y - .005, .004), (x, y + .005, .003), (x + w, y - .005, .004)], .0018, rubber, sides=4)
        return

    # The photographed sneakers are cream running shoes with a green N-shaped
    # side mark, mesh toe, layered mudguard and brown tread rolling up the toe.
    sole('sculpted ivory running midsole', [(.011, 1), (.020, 1.015), (.030, .98), (.035, .93)], midsole)
    heights = [(-.211, .036), (-.199, .052), (-.177, .069), (-.144, .078),
               (-.11, .091), (-.075, .111), (-.035, .124), (.005, .124), (.045, .113), (.071, .053)]
    def top(u, y, offset=0):
        z = .034 + (interpolate(heights, y) - .034) * max(0, 1 - u * u) ** .48
        return (x + width(y) * .94 * u, y, z + lift(y) + offset)
    def shell(name, ya, yb, ua, ub, mat, rows=30, columns=32, offset=0):
        verts, faces = [], []
        for j in range(rows + 1):
            for i in range(columns + 1): verts.append(top(mix(ua, ub, i / columns), mix(ya, yb, j / rows), offset))
        for j in range(rows):
            for i in range(columns):
                a = j * (columns + 1) + i; faces.append((a, a + 1, a + columns + 2, a + columns + 1))
        return mesh(name, verts, faces, mat)
    shell('continuous cream mesh upper', -.210, .070, -1, 1, meshmat)
    # A U shaped mudguard runs around the mesh toe without covering it.
    verts, faces = [], []
    for j in range(7):
        for i in range(65):
            a = math.pi * i / 64; y = -.098 - (.104 - j * .003) * math.sin(a)
            u = math.cos(a) * (.96 - j * .015)
            verts.append(top(u, y, .0018))
    for j in range(6):
        for i in range(64):
            a = j * 65 + i; faces.append((a, a + 1, a + 66, a + 65))
    mesh('layered suede toe mudguard', verts, faces, overlay)
    for n in [1, 5]:
        pts = []
        for i in range(65):
            a = math.pi * i / 64; pts.append(top(math.cos(a) * (.96 - n * .015), -.098 - (.104 - n * .003) * math.sin(a), .0024))
        tube('toe mudguard stitched edge', pts, .00048, stitch, sides=4)
    # Heel counter and stabilizer stay distinct from the soft quarter panels.
    shell('rear leather heel counter', .015, .069, -1, 1, cream, rows=12, offset=.0015)
    for edge in [-1, 1]:
        verts = [(x + edge * width(y) * 1.008, y, z) for y, z in
                 [(-.020, .024), (.058, .024), (.063, .041), (.018, .046), (-.026, .037)]]
        mesh('heel stability insert', verts, [(0, 1, 2, 3, 4)], midsole_band)
        # Quarter leather overlay and the exact recognizable angular mark.
        side_points = [(-.120, .052), (-.093, .086), (-.038, .102), (.021, .097), (.036, .056), (-.025, .039)]
        def sidepoint(y, z, off=0):
            height = interpolate(heights, y); k = max(0, min(.98, (z - .034) / (height - .034)))
            u = math.sqrt(max(.02, 1 - k ** (1 / .48)))
            return (x + edge * (width(y) * .94 * u + .0007 + off), y, z)
        def curved_patch(name, points, mat, off=0):
            # A single nonplanar polygon cuts through the curved last when
            # triangulated. Subdivide in the pattern plane, then fit every
            # vertex to the upper so both side marks remain fully visible.
            pattern = [Vector((y, z, 0)) for y, z in points]
            verts, faces, lookup = [], [], {}
            steps = 8
            for triangle in tessellate_polygon([pattern]):
                a, b, c = [pattern[k] for k in triangle]
                def index(i, j):
                    p = a + (b - a) * (i / steps) + (c - a) * (j / steps)
                    key = (round(p.x, 9), round(p.y, 9))
                    if key not in lookup:
                        lookup[key] = len(verts)
                        verts.append(sidepoint(p.x, p.y, off))
                    return lookup[key]
                for i in range(steps):
                    for j in range(steps - i):
                        faces.append((index(i, j), index(i+1, j), index(i, j+1)))
                        if i + j < steps - 1:
                            faces.append((index(i+1, j), index(i+1, j+1), index(i, j+1)))
            return mesh(name, verts, faces, mat)
        curved_patch('cream side quarter panel', side_points, cream)
        tube('quarter overlay stitched outline', [sidepoint(y, z, .0006) for y, z in side_points + side_points[:1]], .0005, stitch, sides=4)
        # Mark follows the sloping quarter, with a cream outline underneath.
        shape = [(-.095, .051), (-.082, .083), (-.069, .086), (-.054, .063),
                 (-.045, .091), (-.030, .093), (-.044, .053), (-.058, .051),
                 (-.073, .074), (-.081, .049)]
        center = (-.063, .071)
        for mat, factor, off in [(stitch, 1.13, .0007), (green, 1.0, .0011)]:
            pts = [(mix(center[0], y, factor), mix(center[1], z, factor)) for y, z in shape]
            if edge < 0: pts = [(2 * center[0] - y, z) for y, z in pts]
            curved_patch('green N side mark' if factor == 1 else 'side mark ivory border', pts, mat, off)
        # Four side ventilation holes are recessed disks, not painted stripes.
        for j in range(4):
            y = -.111 + j * .008; z = .051
            p = sidepoint(y, z, .0003)
            ellipsoid('quarter ventilation perforation', p, (.0006, .00085, .00085), recess, segments=8, rings=5)
    # Padded collar is an actual ring with an open center around the sock.
    collar = []
    for i in range(65):
        t = i * math.tau / 64
        collar.append((x + .039 * math.cos(t), .017 + .038 * math.sin(t), .115 + .006 * math.sin(t)))
    tube('padded open ankle collar', collar, .0050, cream, sides=8)
    tube('inner collar lining', [(p[0], p[1], p[2] - .003) for p in collar], .003, meshmat, sides=6)
    loft('white ankle sock', [(.103, x, .040, .045, .004), (.150, sign * .161, .040, .045, .003), (.187, sign * .1595, .039, .043, .002)], sock)
    # Knit relief comes from the baked normal texture. Separate tangent tubes
    # intersected the cuff and made dark stripes in the game renderer.
    # Independent tongue, six paired eyelets, crossing laces and tied bow.
    shell('padded suede tongue', -.134, -.004, -.38, .38, overlay, rows=24, columns=16, offset=.004)
    for edge in [-1, 1]:
        shell('leather eyelet facing', -.143, -.013, edge * .40, edge * .64, cream, rows=26, columns=8, offset=.005)
    for n in range(6):
        y = -.135 + n * .020
        for edge in [-1, 1]:
            p = top(edge * .51, y, .006)
            ellipsoid('eyelet punched hole', p, (.0015, .0015, .0006), recess, segments=10, rings=5)
            loop = [(p[0] + .0016 * math.cos(t), p[1] + .0016 * math.sin(t), p[2] + .0002) for t in [j * math.tau / 12 for j in range(13)]]
            tube('eyelet stitched ring', loop, .0004, stitch, sides=4)
        for direction in [-1, 1]:
            points = []
            for i in range(17):
                t = i / 16; u = direction * mix(-.51, .51, t)
                yy = y + .014 * t; p = top(u, yy, .008 + .0015 * math.sin(math.pi * t))
                points.append(p)
            tube('crossed cotton lace', points, .00155, lace, sides=6)
    for edge in [-1, 1]:
        points = []
        for j in range(33):
            a = j * math.tau / 32
            points.append((x + edge * (.012 + .017 * math.cos(a)), -.027 + .011 * math.sin(a), .139 + .004 * math.sin(a)))
        tube('tied lace bow loop', points, .0014, lace, sides=6)
        tube('loose lace end', [(x + edge * .004, -.028, .138), (x + edge * .024, -.062, .125), (x + edge * .031, -.097, .101)], .0014, lace)
    # Small tongue label, with only visible color blocking (unreadable photo
    # lettering is not fabricated), and sage rear tab.
    shell('ivory tongue label', -.022, -.003, -.27, .27, cream, rows=5, columns=8, offset=.006)
    shell('sage heel tab', .043, .064, -.50, .50, green, rows=7, columns=12, offset=.004)
    # Brown outsole rises at the front exactly as in the worn photo shoes.
    verts, faces = [], []
    for j in range(4):
        for i in range(25):
            u = -1 + i / 12; y = -.213 + .012 * abs(u) ** 1.8
            verts.append((x + u * .027, y, mix(.010 + lift(y), .018 + .018 * (1 - u * u), j / 3)))
    for j in range(3):
        for i in range(24):
            a = j * 25 + i; faces.append((a, a + 1, a + 26, a + 25))
    mesh('brown tread toe bumper', verts, faces, rubber)
    for i in range(10):
        y = -.185 + i * .024; w = width(y) * .9
        for edge in [-1, 1]:
            tube('segmented outsole grip lug', [(x + edge * .005, y, .003), (x + edge * w, y - .004, .004)], .0032, rubber, sides=4)
    for edge in [-1, 1]:
        points = [(x + edge * width(y) * 1.006, y, .020 + lift(y)) for y in [-.19 + i * .244 / 55 for i in range(56)]]
        tube('midsole molded dividing seam', points, .00065, midsole, sides=4)
