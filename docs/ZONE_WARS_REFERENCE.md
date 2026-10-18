# Tilted Zone Wars: dry reference reconstruction

Reviewed October 18, 2026. Target: Prettyboy's original solo island **3729-0643-9775**, using the user's 17.691-second H.264/MP4 screen recording and both supplied reference stills. The full recording was decoded and reviewed at four frames per second, with larger views of the aerial and street sequences. The video is a trailer, not a complete match or an export of the original map.

## Visual evidence

| Trailer section | Visible evidence used |
| --- | --- |
| 0–3.3 s | Dry aerial orbit: four clock towers surrounding one stepped central high-rise, corner apartments, split low courtyard block, elevated fenced basketball court, tight orange rock bowl. |
| 3.3–5.7 s | Builds extend across rooftops; storm wall moves through the city; overhead view confirms the clock cross and corner building footprints. |
| 5.7–7.5 s | Enterable gray interiors, blue floor covering, multiple windows and randomized equipment. |
| 7.5–10.5 s | Street-level masonry, arched shop openings, green/striped awnings, street tree planters, the clock's bell openings and circular faces. |
| 10.5–12.9 s | High view of the same street plan, then the shop/replay area. |
| 12.9–16.5 s | Flood event and building combat above water. Flooding is deliberately excluded; roof positions remain useful visual evidence. |
| 16.5–17.69 s | Title card and island code confirm the reference. |

The stills provide higher-resolution evidence of tile sidewalks, flat dark roofs, rooftop vents, four clocks, yellow/turquoise/dark/pink cars, rounded tree canopies, exterior court stairs and blue bounce pads. The older still includes pitched clock caps; the uploaded trailer's flat copper-colored clock roofs are the implementation target.

## Additional primary research

- [Official island listing](https://www.fortnite.com/@prettyboy/3729-0643-9775): identifies the solo, free-for-all, name-tags-on island and its changing loot pool.
- [Prettyboy: Original Version of Tilted Zone Wars](https://communities.epicgames.com/thread/original-version-of-tilted-zone-wars/ymnq/1?lang=en-US): distinguishes the original name-tags-on rules from names-off, all-weapons and team variants. Those separate variants are not combined into this map.
- [Prettyboy: Shop Events](https://communities.epicgames.com/thread/tilted-zone-wars-shop-events/IkYj): identifies flooding and mass destruction as separate events. The user requested the dry city; neither event is enabled here.
- [Fortnite's earlier promotion](https://www.youtube.com/watch?v=6GFbSjJrp2k): corroborating official reference identity. Public page metadata was available; the uploaded local trailer supplies the actual visual evidence for this update.
- [Epic: Zone Wars design](https://dev.epicgames.com/documentation/en-us/fortnite/zone-wars-in-fortnite-creative): supports randomized room spawns/gear, phased moving storms, rising storm damage and a final zero-radius circle. This is general design guidance, not Prettyboy's private numerical settings.
- [Epic: Trap Items](https://dev.epicgames.com/documentation/fortnite/using-trap-items-in-fortnite-creative) and [Bouncer API](https://dev.epicgames.com/documentation/fortnite/verse-api/fortnitedotcom/devices/bouncer_device?lang=en-US): distinguish bouncers from launch pads and describe traversal launch behavior. Launch velocity here is adapted to Ravelfront's physics.

## Implemented map

The previous nine generic city landmarks are replaced. Ten authored structures form the dry layout: a seven-storey central core and three-storey shop wing, two four-storey corner apartment buildings, two three-storey L-shaped courtyard buildings, four narrow clock towers, and a one-storey elevated basketball court. The central facade has tall arched window strips, green storefronts, roof parapets and ventilation equipment. Clock chambers, roofs and apartment floors are reachable by actual stairs.

The road and pale sidewalk network, court markings/hoops/fencing, external court staircase, car colors, circular and square tree planters, orange cliff enclosure and ridge pines follow the supplied views. Six fixed bouncers occupy street and roof positions. Shared host/guest movement triggers them on contact, grants safe landing for that jump, and does not force a glider. Rooftop pads disappear with their supporting roof tile; a new round restores the full map. Minimap footprints match the stepped and L-shaped collision geometry.

Sixteen separate interior spawn cells span several floors. All sixteen possible spawns, occupied or empty, have five fresh randomized items laid in a straight line in the spawn-facing direction: assault rifle nearest, shotgun next, then a third weapon/utility, shields and healing/utility. Players start with their pickaxe, 100 health, 100 shield, ammunition and 500 of each building material. Walking over the line collects the kit; normal interaction also works. Preparation movement includes the entire line. Enemy names are outlined, consistently sized and visible through structures in Zone Wars; eliminated players and the local operator are not labeled. The existing one-life rounds, 50 siphon, elimination spectators, build edits, damage, round reset, first-to-five public series and configurable private target remain. Public and private matches require human opponents; bots are never admitted or spawned.

Storm radii remain 94 → 62 → 40 → 24 → 13 → 7 → 0 with six moving phases. Centers are confined to ±38 metres so the final zone cannot settle inside the new perimeter cliffs. The circle closes at 186 seconds; the hard round limit is 210 seconds. Storm damage is 5, 5, 8, 10, 10 and 15 per second. These are explicit Ravelfront tuning values.

## Accuracy limits

This is a reference-based reconstruction within Ravelfront's existing engine, not an asset-identical Fortnite port. The reference establishes the visible arrangement and architecture; it does not provide exact coordinates, complete hidden interiors, server scripts, loot probabilities or a complete match's timings. Dimensions and hidden interior connections are authored to remain playable at the game's movement/building scale. Existing Ravelfront weapon models, items, UI and supported mobility remain; the trailer's Fortnite-specific Baller and event shop are not imported. No flooded variant is included.

## Verification and rankings

The map preview script renders eight desktop views using the actual map builder and game materials. Tests cover sixteen clear spawns, every building's stair-to-roof route, exterior court access, bouncer prediction, damage/reset, storm paths, human-only public/private admission, real guest synchronization and host transfer. Desktop match checks cover building/editing, moving storm, results and rematch.

Public rankings remain separate per mode: Zone Wars wins count rounds; Box Fights wins count series. Kills and Wins share the same rankings mode. Selecting a Play mode resets that filter; manually choosing another rankings mode persists until the next Play mode selection. There is no Follow Play button. Private matches remain outside competitive public rankings.
