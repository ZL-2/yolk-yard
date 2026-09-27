# Connected Island — Quality Update 55

This update supersedes the old pickaxe numbering, 16-contestant target and
30-second warmup described in earlier historical release notes. The publishing
pipeline derives the displayed update number from the live release history;
the source note number is not the deployment counter. Network protocol is 17.

## Population and pacing

Sunnybreak is 512 × 512 units, with nine major districts, 17 smaller landmarks,
61 buildings, 100 interior floors, 603 floor-loot sockets and 170 chest sockets.
The target is **32 contestants**, including **at most 16 human contestants**.
The existing relay has 20 connection seats; four remain separate observers.
Bots have no individual relay connections. Public directory counts describe
human seats, while the in-match alive/contestant counters include bots.

Thirty-two permits roughly two or three scheduled bot landings per major POI
and additional quiet landmark landings. Humans remain free to choose their
drop. This doubles the old population without requiring six or more opponents
per main district or increasing the deployed relay connection limit. The
35-second Bus route covers the island; bots leave at the route projection
nearest their assigned landing area. Each building guarantees an accessible
ground-floor weapon and matching ammo. Each major district has at least three
usable chests; the existing sockets already supply many more in typical rolls.

Fill creates bots in all unoccupied contestant seats. Humans replace those bots
during the host's 60-second warmup. Departure closes admission. Observers do not
affect placements, victory, fill, or alive counts, including after migration and
rematches. Forty separated, collision-free warmup points support the roster.

Normal storm schedule, seconds since Bus departure:

| Phase | Target radius | Movement starts | Movement ends | Damage/second |
|---|---:|---:|---:|---:|
| 1 | 225 | 140 | 205 | 1 |
| 2 | 160 | 240 | 290 | 2 |
| 3 | 108 | 315 | 355 | 3 |
| 4 | 68 | 375 | 405 | 5 |
| 5 | 40 | 420 | 445 | 7 |
| 6 | 20 | 457 | 477 | 9 |
| 7 | 7 | 485 | 503 | 12 |
| 8 | 0 | 508 | 526 | 20 |

The opening radius of 365 contains the whole island. The first hold leaves time
to land, find equipment and start an outer-island rotation. Shortening later
holds and closures increases encounters without lengthening every phase. The
final closure ends at 8:46 from Bus departure, or 9:46 including warmup. Quick
storm retains its existing 0.55 timing multiplier. Bots estimate travel time to
the next safe circle and begin rotating before its movement forces them out.

## Connected building and controls

The material bank is consulted before placement and immediately after a spend.
The current usable selection wins. Otherwise the order wraps from the current
selection through wood → brick → metal; banks below the 10-unit cost are skipped.
No usable bank means no placement. Host spending and fallback are atomic, even
while a remote client's input still requests the previous material.

The shared solver enumerates nearby terrain and structural support surfaces,
existing piece edges, levels above/below the player, and explicit ramp-top
connections. It ranks camera aim, forward alignment, proximity and connected
support, then validates candidates. A small preference window keeps the preview
in its current valid cell. The host treats that cell as a preference among its
own generated candidates, never an arbitrary client-supplied position. Major
solids, characters, buried floors and unsupported cells remain invalid. Tiny
decorations and pickup objects do not veto construction. Manual rotation stays
relative to the shared forward-facing orientation.

Wheel directions are distinct inputs. Edit and Reset edit may share a wheel
direction with item scrolling. On an owned editable build, a shared notch resets
and confirms; later notches on the full piece are consumed without reopening
the editor. In an active edit, wheel bindings operate on that edit. Away from an
editable target, the configured item-scroll action applies. Other unrelated
bindings remain exclusive.

Storage indices stay stable: index 0 is the permanent pickaxe, and indices 1–5
are the five item slots. The pickaxe uses its own binding (P by default); the
number keys address items 1–5. Only the pickaxe is separated visually. Hotbar,
inventory, pickup, swap/drop, and remote inventory commands use those same
indices. Labels are read from current bindings, including both wheel directions.

## Geometry and presentation

The previous terrain-pad blending could let a neighboring pad tilt terrain into
an interior floor, and the terrain surface met the floor plane exactly. The
nearest foundation now owns its flat pad, with terrain below the structural
floor. Stair strips and landings meet adjacent tiles without overlapping. Wall
corners meet rather than occupy the same plane; roof caps sit on their rails.
Road color is part of the terrain's own triangles, so no road ribbon can cross
through the terrain or another ribbon at a junction. These are geometry changes,
not depth-bias or renderer settings.

The storm is one 256-segment cylinder and a ground ring. Its center and scale
come from the same circle used for damage. An inexpensive shader supplies
blue/violet coloration, drifting bands and bright veins at a see-through base
opacity; the storm side gets a stronger purple tint. The wall is not hidden by
distance fog. Enlarged health/shield bars, numerals and icons scale down on
compact screens and sit above the item bar when horizontal room is insufficient.

## Bots and performance

Warmup has a separate exploration/idle schedule. At most three bots get brief
practice windows at once, with short bursts and natural pauses. Practice damage,
loadout changes and building never carry into the match or persistent rewards.
Combat target scoring accounts for recent damage, aimed incoming fire, distance,
visibility, observation age, weapon range, health, allied focus and the storm.
A close active threat can break a distant commitment; a small score difference
cannot. The shared brain applies in arena modes as well as Royale.

Collision broad-phase searches use actual swept buckets instead of repeatedly
visiting nine full neighboring buckets. Pathfinding shares one search budget per
simulation tick, including stuck recovery; long searches return useful partial
routes and extend them later. Non-engaged Royale bots think less often, while
damage and utility action transitions remain responsive. Static scenery and AI
search caches are excluded from recovery payloads. Sparse world/build updates
use keyed deltas, and recipients with the same cursor share normalization work.

The focused 32-contestant run simulates actual movement, landings, loot, combat,
and 20 Hz snapshot encoding. In the implementation workspace the 95th-percentile
simulation tick fell from roughly 63 ms to 11 ms after the collision/path work;
median active ticks were roughly 6.6 ms. These are CPU measurements, not a claim
of a particular GPU frame rate on every device. GitHub browser artifacts record
draw calls, software-GPU frame samples, and screenshots at each major district.

The completed GitHub run measured active tick medians of 3.52–4.25 ms and
95th percentiles of 6.60–6.85 ms. Average 20 Hz state deltas were 4,917 bytes
(96 KiB/s per guest), including periodic recovery checkpoints. Its seeded
district rolls contained 12–31 weapons and 7–15 chests per major POI. The browser
run passed the shared wheel and moving-ramp interactions, all 18 district views,
storm alignment and desktop/compact inventory/vitals checks without page errors.

## Essential verification

- `tests/royale-systems.test.js`: turbo material spending and exhaustion,
  connected attachment combinations, host/guest solver equality, wheel contexts,
  threat hysteresis, all foundations/floor overlaps, 32-seat fill, 60-second
  departure, observer rematches, item slot 5, storm nesting and broad-phase parity.
- `scripts/building-network-check.mjs`: real WebSocket guest placement and edits,
  32-player snapshot acceptance, stale input material fallback, resource
  replication and fifth-slot swap/drop commands.
- `scripts/royale-flow-check.mjs`: early joining, cutoff, spectators, Bus/glider
  controls, physics, loot and host recovery.
- `scripts/connected-island-browser-check.mjs`: real keybind capture, shared wheel
  reset, resource HUD/preview, moving ramp extension, nine POI interiors and roofs,
  storm geometry and responsive vitals/item layout.
- `scripts/royale-population-check.mjs`: actual 32-contestant CPU/replication
  workload and district loot counts, written to `test-results/connected-island`.

The existing Pages pipeline also requires its unit, relay, realtime, Royale
lifecycle and deployed-relay checks before publication.
