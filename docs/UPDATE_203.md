# Update 203 — Deep water and tactical leaning

Version 6.15.0 / protocol 75.

Existing wet terrain is excavated by up to three metres without moving the shoreline or dry foundations. Both Royale islands share a water surface at 0.5 m. Players are buoyant in deep water, move at 65% speed, and can jump toward shore. Water contact cancels fall damage; bridges above the surface retain normal fall damage. Dry arena maps never become water implicitly.

Hold Q/E for left/right leaning while grounded, standing or crouching. Camera, hitscan and projectile origins, upper-body animation, rotated anatomical hit regions, prediction, snapshots and lag compensation share the same bounded lean. Head/shoulder sweeps retract lean against solids. Sprinting, swimming, vehicles, traversal and incompatible actions reset it. This is original tuning inspired by free-lean mechanics, not a claim to duplicate another game's implementation.

Untouched old swap/popper defaults migrate to backtick/G. Custom bindings take precedence; Movement settings expose both lean bindings. No external assets or dependencies were added.

Focused validation: water/deck landing, shore exit, dry arenas, lean collision and exposed hit regions, input migration, prediction and snapshots; three connected peers; desktop first-person, scoped and third-person leaning plus a water fall. No mobile or unrelated performance sweep.
