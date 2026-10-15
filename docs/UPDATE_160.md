# Update 160 — Built World

Version 5.13.0, gameplay protocol 55.

All 61 island buildings receive original PBR surfaces and architectural details: brick, plaster, concrete, timber, roofing, metal, glass on sealed fixtures, tile, fabric and paint. Window reveals and sills preserve the authored clear openings. Roof edges, gutters, downpipes, vents, plinths and tread nosings add depth. Structural collision, navigation and layout remain intact. Arenas, lobby architecture, interactive doors, traversal hardware and player builds share the surface upgrade.

Rounded rocks fix reversed triangle winding and seam normals. Static architecture uses one shared atlas batch per resident cell; far shells retain inexpensive silhouettes. Geometry uses compact normals, colors and material identifiers; repeated surfaces retain metre-scale UVs. Existing streaming and adaptive rendering remain enabled.

Gameplay and social changes:

- Separate FOV sliders preserve the saved first-person value and default third person to 65 degrees.
- Forty-eight original, unique bot callsigns persist through fills, rounds and migration; human names remain available.
- Name forms give specific rejection reasons and retain editable rejected input.
- Friend nicknames are private to the owner, persisted on the relay and removable. Actual player names remain visible.
- Bosses and henchmen are rejected by spectator selection, the camera and authoritative watcher requests.
- Step-up collision anticipates crouching/compact clearance beneath a floor. Edited corner passages work in all rotations; retained cover stays solid.
- Public recovery reconnects to the canonical room. Simulation promotion requires a relay-authorized host alias. Stale public members cannot receive public joins. Private room election remains independent.

Focused validation includes real socket joins, guest-channel isolation, graceful/abrupt/frozen host transfers, persisted nickname privacy, ramp prediction parity, building/window collision, actual browser shader rendering, UI controls and identical-workload memory/construction comparison with Update 159. Publication is explicitly authorized without waiting for empty matches.
