# Update 176 — Blacktide Field Operations

Version 6.2.1 · protocol 62 · desktop release

This release recovers and finishes the unpublished Zombies continuation from Update 175. The mode-selection artwork now clearly says **IN MAJOR DEVELOPMENT**. The mode remains playable, with the same main goal: complete three contracts, then extract. Optional operations are separate from that goal.

## Included changes

- Backpack DROP creates a recoverable, single-claim world pickup. A full backpack cannot consume the pickup, and abandoned supplies expire within a bounded pool.
- The field journal shows each operator's personal recording progress. The live HUD preserves its DOM nodes while updating values.
- Terrain has hills and slopes between the roads; foundations, stations and extraction zones stay level. Warehouses, clinics, homes, offices and research buildings have distinct interior furniture and partitions with collision.
- Infected gain distinct silhouettes, turning and authored special-action poses. Mimics reveal and telegraph their grasp; mercenaries aim, move laterally and retreat at close range. Their weapon is attached to the hand grip.
- The optional Lattice operation requires two stabilizers, a three-symbol cipher and three defended resonators before the breach. The final Bellwether encounter stops damage at two phase boundaries until a squad member grounds the corresponding shield anchor.
- Twelve attachment choices occupy five separate slots, with mechanical tradeoffs and visible weapon additions. Calibration and resonance have distinct presentation. Suppressors alter the weapon report without changing PvP tuning.
- Creature vocals use separate sample pairs per archetype. Field records have optional device narration with the written transcript retained. Ambient particles remain bounded.
- Four-seat rovers support a driver and three armed passengers, acceleration, braking, terrain alignment, impact/infected damage, fuel use and repairs. Chase camera and seated operator presentation are integrated. Downed or disconnected occupants release their seats and riding state.
- Active extraction always takes marker priority over a tracked optional operation, matching the objective text.

## Verification

- Focused simulation, real socket co-op, snapshot, character-motion, Box Fights and release-history checks pass.
- The production build passes.
- Desktop acceptance covers mode selection and the development banner, private trio deployment, purchases, contracts, stable HUD nodes, actual supply sharing, rover camera/seating, attachment purchases, a 32-infected crowd, independent extraction, replay and return to lobby.
- The recovered continuation also completed an accelerated 1,801-second test of two authoritative worlds and 24 operators, decoding 864,480 client frames. It measured 171.81 ms server CPU per simulated second and 3.18 MiB retained heap growth. This measurement preceded the final seat-cleanup and marker-priority fixes; it is not a hardware FPS claim.
- The normal GitHub pipeline runs the relevant Zombies and shared-mode checks before Pages publication, followed by matching frontend/server build verification and live private-mode smoke checks.

## Development status

These changes improve the original browser mode; they do not establish parity with a native Call of Duty release. Art remains stylized, the world and enemy budget are limited, and field-record narration uses available device voices rather than an actor-recorded cast. Mobile expansion is outside this desktop release. The development label deliberately remains visible.
