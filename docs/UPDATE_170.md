# Update 170 — Continuous Motion & Clean Floors

Review of IMG_0627 and IMG_0628 identified remaining temporal motion defects and
coplanar terrain/slab flicker in Nightglass Bunker.

- Spread source loop endpoint correction over each full cycle instead of replacing
  the last four frames with the opening pose (a quarter of a short running cycle).
- Keep legs in a phase-compatible directional family regardless of the held item;
  non-gun upper-body and idle poses remain separate. Previously a tiny sideways
  input could switch a tool user between unrelated axe and rifle strides.
- Smooth movement direction and gait changes, pelvis support height and the
  release of a world-locked support boot. Preserve exact planted contact.
- Put reserve-room earth 20 cm below the slab, matching the existing Aster
  approach. Solid floor collision still defines the walking surface.
- Add continuous frame-to-frame motion and small-direction-input regressions,
  vault clearance checks, and an eight-second desktop motion recording.

No new animation assets, mobile changes or changes to weapon hit detection.
