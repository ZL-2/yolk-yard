# Update 168 — Motion Captured Operators

Replaces procedural character base motion with Adobe Mixamo clips retargeted to
Ravelfront's existing 32-bone human characters. All outfits use the same animation
contract. The game includes 65 rig-specific tracks: directional walk, run, sprint
and crouch; idle/aim; jump, fall and landing; slide; crawling and revive; mantle;
airborne, hanging and seated bases; emotes; and upper-body action layers.

The game still controls exact weapon grips, magazine/shell alignment, throw release,
glider handles, building/editing tools, consumables, crown display and vehicle controls.
These are deliberate adaptations of the source motion to game-specific objects, not
claims that Mixamo supplies an exact animation for every Ravelfront interaction.
First-person weapon mechanisms and their shared gameplay clocks remain intact.

Movement trajectories and hitboxes remain owned by gameplay. Clip root travel is
removed offline; directional animation follows actual speed. Short transition blends,
loop seam correction and foot-contact IK preserve continuity. No inference model,
GPU generation service, geographic gate or HY-Motion asset is included.

Validation: anatomy/finite transforms, 8-way coverage, frame-independent clocks,
gameplay immutability, floor contact, equipment/weapon timing, cosmetics, hitboxes
and camera checks; 16 desktop rendered poses. No mobile work. Local animation-only
48-actor CPU sample: median 1.63 ms / p95 2.03 ms (not total rendering or match cost).
Packed animation samples occupy about 621 KB decoded and are shared across actors.

Version 5.17.0, protocol 58. Publishing does not wait for matches to empty.
