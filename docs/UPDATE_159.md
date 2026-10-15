# Update 159 — Living Terrain

Version 5.12.0, protocol 54 unchanged. Visual-only release on top of Update 158.

## Terrain and scenery

The main island and spawn airfield use a shared layered terrain atlas: grass, soil, sand, stone, asphalt and macro variation. Slope, beach height, quarry position and the existing road/path records select the visible surface. Fine height-derived normals, wet shoreline roughness and existing road markings are shader details, not displaced collision. Indexed chunks preserve every original height and triangle diagonal, with globally calculated seam-free normals.

Coastal water has depth and shoreline color, moving wave normals and a narrow foam wash. A shared environment reflection and small coastline lookup avoid a second render camera or per-frame mesh work.

Oak, autumn, pine, palm and orchard trees have distinct trunks, roots, branches and foliage, using eight deterministic variants and matching near/far models. All 48 authored non-building prop kinds have detailed shells and weathered bark, leaf, stone, wood, metal, paint, rubber, fabric or soil surfaces. The same assets serve arena scenery and the lobby. Building architecture, authoritative colliders, map layout, loot and combat are unchanged.

## Performance controls

- Terrain geometry uses about 73% fewer bytes than the original unindexed grid.
- Shared small texture atlases and two environment surface batches per cell avoid individual leaf or prop draw calls. Foliage is opaque: no alpha sorting or transparent leaf overdraw.
- Static scenery retains Float32 positions for exact destruction ranges, with normalized compact color, normal and UV buffers. Sources are expanded before rebaking to keep mixed cached/fresh geometry compatible.
- Short instanced grass and pebbles occupy at most 16 nearby cells / 32 draws at high detail, or 9 cells / 18 draws at low detail. Roads, water, steep slopes, buildings and colliders remain clear. Only one small cell is built per update; old instance buffers are disposed on travel.
- Grass and water/ground fine relief reduce when average render time exceeds the detail budget. Nearby scenery residency also uses the low-detail radius under pressure while preserving scoped-direction loading. Existing adaptive resolution and shadow controls remain active.
- Tree/prop templates are shared, and cell collider IDs are indexed instead of repeatedly scanned during construction. Shared textures survive map disposal; per-world control textures and owned geometry do not leak.

An identical Node scenery workload against Update 158 measured 24.05 MB distant geometry versus 27.50 MB (12.6% less), 66.38 MB nearby versus 57.16 MB (16.1% more for increased detail), and 428 ms initial construction versus 612 ms (30.1% less). These are construction and geometry measurements, not device FPS or network latency claims. CI repeats the comparison with explicit memory and resumable-construction limits.

## Focused acceptance and publication

Tests cover exact terrain alignment, road masking, normals, shader hooks, every prop kind and tree LOD, finite geometry, destruction/reset, repeated baking, shared-resource lifetime, grass placement/budgets, arena hosting, and streaming. Browser acceptance compiles the actual shaders and captures the real lobby, spawn island, island districts, coast, compact viewport, all tree species and representative props spanning the shared surface types. The full 48-kind geometry sweep remains in the fast Node tests; browser captures are bounded for the software-GPU runner. The release keeps existing build/browser gates and private host/guest live verification. Publication does not wait for an empty public match, as requested.
