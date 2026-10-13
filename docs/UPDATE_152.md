# Update 152 — Built to Ride

Version 5.8.1, protocol 51. This is an ATV presentation update.

The six gameplay quads now use original detailed 3D models, physically based
materials, clear-coated metallic paint and a shared outdoor reflection capture.
Curved fenders and mud lips surround profiled knobby tires and machined rims.
The model includes a finned engine, crankcase covers, exhaust heat shield,
welded frame, axles, control arms, coil-over suspension, two upholstered seats,
passenger grab rail, cargo racks, recessed grille, brush guard and LED lenses.

Front steering is separate from wheel rotation. Handlebars follow steering;
visual suspension travel and gentle chassis weight shifts follow movement.
Contact shadows remain with ordinary shadows disabled and clear while airborne.
These animations do not change authoritative vehicle physics.

High, medium and distant meshes contain approximately 31,000, 14,000 and 6,600
triangles, respectively, with shared geometry and materials. Low graphics uses
the medium mesh nearby. Distance hysteresis avoids repeated model switching.
Three 128-pixel procedural normal textures and one 128-pixel reflection capture
are reused; no external art download is required.

Controls, two seats, hitboxes, health, boost, collision, guest prediction, host
recovery, vehicle audio and server simulation remain unchanged.

Focused checks cover geometry/draw budgets, finite normals, detail selection,
independent steering/spin, suspension bounds, contact shadows, existing vehicle
driving/boarding/prediction/recovery, production build, actual gameplay
screenshots and two-rider driving. Publication verifies matching website and
relay builds. Only ATV presentation and release bookkeeping qualify for this
shorter workflow; gameplay or dependency changes retain the full release gates.
