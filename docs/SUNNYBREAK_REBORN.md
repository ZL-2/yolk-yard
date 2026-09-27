# Quality Update 42 — Sunnybreak Reborn

The 512 × 512 island is rebuilt in the existing Royale mode. It retains the egg world, sixteen-player capacity, host simulation, building/editing, harvesting, inventory, storm and spectator systems. Network protocol 15 separates this terrain and snapshot format from older clients.

## Island and landing choices

| POI | Identity and combat routes |
| --- | --- |
| Shellside Borough | Three-storey apartments, shops, bakery and clock plaza; balconies, alleys and roof access |
| Cornflake Commons | Barns, silos, stable, crop field, farmhouse, orchard and greenhouse |
| Albumen Observatory | Ridge campus, telescope dome, research rooms, solar arrays and radio mast |
| Sunny Docks | Freight warehouses, containers, cranes and three piers over a tidal inlet |
| Whisker Woods | Pine forest, lodges, cabins and a central campfire |
| Yolkworks Quarry | Excavation bowl, refinery, tanks, drill and exposed quarry rotations |
| Toast Terraces | Hillside villas, hotel, pergolas, balconies and garages |
| Hatchery Heights | Raised hatchery campus, egg incubator and greenhouse structures |
| Crater Conservatory | Lake, crystal outcrops, lodges and research garden structures |

Fourteen outlying buildings plus three bridge landmarks provide quieter landings and rotation stops. There are 61 searchable buildings, 100 interior floors, connected stairs to every roof, furniture, window and door openings, room partitions and selected balconies. Heightfield terrain, render geometry, minimap shading, collision and projectile intersections share the same triangulation. Two-metre terrain samples represent the hills, valley river, lake, quarry, beaches and inlet. The full map shows the current roads, buildings, landmarks, bus route, storm, supplies, marker and waypoint. The compass names nearby POIs.

## Loot and authority

`royale-map.js` authors 603 floor sockets and 170 possible chest sockets. Each socket includes its floor/room, district, role, source and activation chance. `royale-loot.js` centralizes all eleven weapon weights, rarity distributions, source restrictions, eight utilities and five ammo types. Ground sockets roll by role; chests bundle a weapon, compatible ammunition and a utility. Launcher rarities start at rare. High-value roofs and supply drops improve rarity odds without guaranteed top-tier equipment. Each structure has a fallback weapon socket for a viable initial loadout.

Only `RoyaleSimulation.startRound` activates sockets and rolls contents. Chest contents remain in the authoritative checkpoint, not the presentation snapshot. Pickup membership, health, grounded state, range and cover are validated before transfer; opened chests cannot be reopened. New clients get the current state, and a new round replaces it. Loot placement samples nearby supported, unobstructed positions on the same floor, with separation and line-of-sight checks. Destroyed supporting floors lower loot and chests to the remaining support. Player-built pieces never recreate loot.

World ownership changes send a recovery checkpoint in the same broadcast instead of waiting for the normal three-second recovery interval. Sparse snapshot dictionaries retain loot/chest baselines across movement-only updates, so collecting one item transmits its removal rather than the full island inventory. Static scenery is authored identically on each client and is absent from gameplay network updates; only destruction changes travel.

## Equipment and controls

All eleven guns use remodeled shared factories in held, third-person, preview and ground views: tapered barrels and muzzles, rounded receivers, distinct stocks/grips, curved or rear magazines, trigger guards, sights and weapon-specific pumps, bolts, energy coils, launcher tube and precision bipod. Existing muzzle and hand anchors, switching and reload parts remain integrated. Ground weapons use a cached merged mesh with per-weapon scale, yaw, pitch and lift, gentle float and a small yaw sway; they do not roll sideways.

Light, medium and heavy cartridges, red shotgun shells and finned rockets have separate silhouettes, sizes and bundles. The pickup/inventory ammo categories and caps are unchanged.

| Optic | Magnification | Per-optic sensitivity | Reticle |
| --- | --- | --- | --- |
| Needle | 4.5× | 0.72 | Mil-dot |
| Peeper | 3.5× | 0.80 | Mil-dot |
| Anchor | 3.25× | 0.84 | Chevron |
| Duet | 1.8× | 1.00 | Chevron |

`weapon-presentation.js` exposes model radius/objective/length, magnification (or FOV override), sensitivity, transition speed, overlay and reticle. The player's saved scope sensitivity multiplies the optic value. Magnification derives from the selected base FOV; unscoped FOV stays unchanged. The reticle is centered on the actual magnified camera. Fully scoped overlays render the world once rather than running a second scene render into a lens texture.

**L — Close** dismisses the transport, dive and glide information for the current round. `Close flight tips (Royale)` is rebindable and its hint follows the saved binding. It changes only presentation state, keeps mouse lock and flight actions intact, and resets with the next match/round. Touch players can use the close button.

## Performance and verification

Static geometry is merged into 64-metre spatial chunks with vertex colors and shared materials. Weapon and primitive geometry is reused. Ground loot and chests are created nearby and distance-culled. Minimap backgrounds are cached. Collision uses spatial buckets; layered navigation uses local construction buckets, bounded nearest-node searches and a heap-based path search. Bots consider vertical loot, compatible ammo, smaller stair waypoints and short recovery detours; ground decisions are capped at roughly twelve per second.

Focused checks live in:

- `tests/island-overhaul.test.js`: every anchor, every roof route, representative physical stair traversal, loot variation/recovery, compatible chest ammo, destruction and small sparse deltas.
- `scripts/island-network-check.mjs`: real WebSocket host/guest search and pickup, duplicate rejection, immediate recovery, late spectating and synchronized rematch.
- `scripts/island-browser-check.mjs`: actual flight dismissal, dive/glide, map/waypoint, chest loot, each optic and eleven held weapon firing paths.
- `scripts/royale-art-check.mjs`: all nine districts, weapon/item gallery and transport using production factories.

Browser screenshots and reports are written to ignored `test-results/` paths. Synthetic local checks do not claim a sixteen-player internet hardware/FPS benchmark.
