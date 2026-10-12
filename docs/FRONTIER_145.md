# Quality Update 145 — Ride the Frontier

Version 5.4.0, protocol 47.

Six two-seat quads spawn at deterministic, collision-checked locations near
Borough's garage, Northfield's farm road, the Observatory approach, Breakwater's
loading road, Sable Woods' trailhead, and Ironwake's service road. Epic's v6.10
Quadcrasher notes provide the behavioral reference (two seats, charging boost,
boosted structure breaking, aerial boost, and launching rammed opponents):
https://www.fortnite.com/patch-notes/v6-10?lang=en-US
Ravelfront's physics, models, health and speeds are custom tuning.

Move controls drive/reverse/steer; Sprint boosts; Jump brakes; Reload changes
seats; Use enters/exits. Labels follow the player's key bindings. Drivers cannot
fire, passengers can. Any player can take an empty seat; switching never displaces
an occupied seat. Swept vehicle
collision, bounded speed, safe exit probes, damage, destruction, storm exposure,
disconnect cleanup, client prediction and recovery all use shared state. Settled
empty vehicles do no movement work. Vehicle records use ID-based network deltas.

Rook's 0.6-second telegraph needs 125 cumulative damage to interrupt. Visibility
uses the boss eye line rather than the low interaction ray. Rockets have no
silent close-range arming failure; direct hits use their full accepted rarity
damage. Surface explosions offset blast sight rays out of the struck wall. Cover
and normal self-damage remain effective.

Double-tap Jump within 0.4 seconds while airborne to use a mobility item anywhere
in inventory. An equipped rig or Shadowstep wins priority, then inventory order.
Rig has four charges, 15 seconds per replenished charge. Shadowstep is unlimited
with a five-second cooldown and a 13.2-metre three-dimensional swept dash. Both
protect their resulting landing. Prediction copies mutable inventory first.
Uphill slides stop before gravity reverses their original direction.

Vault doors retract bolts and turn a wheel before swinging. A 2.4-second opening
timer keeps collision solid until clearance; snapshots use simulation time for
the pose. Audio combines authorization beeps, bolt release, hydraulic movement
and the final stop. These are original procedural cues, not a extracted Fortnite
vault recording. The sky is a gradient dome with sun and one instanced cloud
mesh: two draw calls, no volumetric or post-processing passes. Footstep playback
and sample loading are removed; death, outdoor birds and landing/fall cues stay.

Presence is per browser tab. All hidden/unfocused tabs produce Away; any visible
tab restores the existing lobby/party/match status. Final socket close records a
last-online timestamp. Saved identities retain the same credential and friends.
Feature requests are 5–1,000 characters, limited to three per 15 minutes. A
bounded 1,000-item inbox shares the existing atomic, backed-up social store. Only
authenticated owner routes can read or mark requests. Rendering escapes text.

The lobby reserves room for Custom Private Match, measures footer height, and
scrolls the rankings themselves. The minimap detects clock rollback and match
changes; the warmup minimap shows Spawn Island while the full map retains
mainland planning. Bot eliminations prioritize living human spectators.

The selected generated poster is `public/season/breakwater-145.webp`. It appears
after initial loading in a full-screen dialog, with three clipped title layers
pounding in sequentially. The bitmap remains intact. The release-specific
`ravelfront-season-1-update-145-dismissed` preference repeats the screen until
the user explicitly opts out. The lobby's Season 1 button reopens it. Animation
respects reduced-motion preferences. The other two generated options were
delivered as previews.

Validation includes full unit/socket regressions and focused checks for parking,
seats, thin cover, boost/braking, prediction, host recovery, vertical dashes,
unequipped double Jump, uphill slides, rocket damage/cover, vault timing,
spectator priority, away tabs, persistence and owner-only feature inbox access.
The required browser gate checks the opening preference, actual wheel/scrollbar
input, Private Match at three laptop sizes, feature submission, driving/camera,
minimap clock reset and the existing death/victory flows. Existing performance
and multiplayer publication gates remain in place.
