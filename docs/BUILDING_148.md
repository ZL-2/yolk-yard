# Update 148 — Build Your Way

Version 5.5.0, gameplay protocol 48. Hosts and guests must use the same
movement rules and player collision state.

Placement no longer rejects a supported piece solely because an operator
occupies its volume. After successful placement or an edit, shallow floor/ramp
rises lift a grounded operator only when their complete body fits at the new
height. Other intersecting operators receive a bounded list of those build IDs
to phase out of. This list clears as the operator leaves the volume and on
round reset. It does not remove geometry, change projectile cover, grant other
players permission to walk through the piece, or permit re-entry. Movement,
predicted movement, wire snapshots and recovery carry the same state.

Trees, rocks and parked car props can be intersected by supported pieces;
explicit map build blockers, structural cover, terrain constraints, duplicate
prevention, material costs and the build limit still apply. New Duos/Squads
pieces are marked as team-editable; Solo does not grant opponent editing.
Edits retain ownership, health, construction debt and revision checks.

The build-through/support reference is Epic's February 2018 building note:
https://www.fortnite.com/news/building-improvements?lang=en-US
The actor-specific collision handling is this engine's adaptation, not a claim
of exact current Fortnite engine parity.

Automatic pickup fills only existing matching partial healing/mobility stacks
within ordinary pickup reach and line of sight. It does not create a new stack,
replace a weapon, change the selected slot, or cancel healing/reloading.
Overflow stays on the ground. Locked vaults and deliberate-drop delays remain
enforced. Ammo, materials and crowns retain their existing collection rules.
This extends Epic's documented matching-consumable pickup behavior to the
game's stackable mobility items:
https://www.fortnite.com/patch-notes/v9-40

Mythic Shadowstep remains unlimited, with a one-second cooldown and the same
13.2-metre swept dash, vertical aiming and landing protection. Request a
Feature moves from the footer to its own icon button beneath Your Party;
the existing authenticated submission and owner inbox remain in use.

Regression coverage includes occupied edits, placement over occupants, safe
floor lifting, exit/re-entry, projectile cover, support and structural blockers,
team ownership, detached prediction/wire state, recovery, partial stacks,
overflow, healing/reload preservation, vault/drop constraints, exact cooldown
boundaries, and real private host/guest commands and snapshots. The required
browser gate checks the feature button placement and its real submission flow.
