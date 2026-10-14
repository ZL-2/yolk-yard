# Update 154 — Kestrel: Built for the Sky

Version 5.8.2, protocol 51. The actual parked and flying aircraft now use the
twin-rotor cargo silhouette shown in the game's existing artwork.

Original lofted fuselage geometry replaces the previous baked boxes. Framed
reflective cockpit glass surrounds seats and instrument panels. The cargo bay
has benches, a marked deck, amber lamps and a sliding side door. Two detailed
engine nacelles include intake grilles, exhausts, maintenance panels and rotor
heads. Swept wings, twin tail fins, antennas, rivets, serial markings and wheel
landing gear complete the aircraft.

Physically based weathered paint, metal, glass and rubber use shared textures
and the ATV's existing outdoor reflection capture. No illustration is substituted
for the model. High and low graphics use about 19,200 and 7,600 triangles,
respectively. Material batches and shared template geometry bound draw work.

Two rotors counter-rotate with subtle flight blur; engines tilt forward and
landing wheels retract after takeoff. Parked gear returns to the existing runway
height, and contact shadows remain available without ordinary shadow mapping.

Routes, altitude, departure timing, 48-seat spawning, collision, free-look,
jumping, gliders, server snapshots and the gameplay protocol remain unchanged.
The shared Royale view is guarded so only aircraft construction and animation
qualify for the focused release path. Dependency or other view changes retain
the full gates. Focused checks cover model budgets, finite attributes, landing
support, geometry sharing, isolated beacon materials, flight animation, parked
gameplay screenshots, high/low graphics, host/guest free-look and guest deployment.
Publication still verifies matching website/relay builds and live private traffic.
