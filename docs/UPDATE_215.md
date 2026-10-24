# Update 215 — eleven playable operators

Ravelfront uses authored, rigged game meshes for the six Shop characters and four
Victory Score outfits. The free Frontier Scout is available to everyone and is
equipped by new players. The playable roster is exactly 11 outfits.

- Shop: Commandant Voss, Marshal Rook, Lieutenant Nyx, Pulse, Wren and Morrow.
- Victory Score: Tempest Sentinel, Rift Revenant, Solar Imperator, Apex Sovereign.
- Default: Frontier Scout.

The other 24 legacy outfits and six alternate variants are removed from playable
selection. Marks, equipment, receipts and progression remain intact. Retired
ownership is archived; alternate owners retain the signature character. An
equipped retired outfit falls back to Scout. Ranking rewards retain their existing
qualification and claim rules.

## Rendering and review

Packed editable Blender sources, actual mesh renders and final SHA-256 review
records are in `art/operators`. All 11 assets use the game's 32-joint skeleton,
reduced distance meshes and shared GPU resources. Existing hitboxes and camera
behavior are retained. Integral Voss/Rook attachments and ranked capes avoid
duplicate accessory geometry. `operators.html` presents actual models, poses and
downloadable GLBs; original cover art is identified as reference.

## Validation

The bounded release suite covers roster/default migration, balances and ownership,
shop purchases, ranking eligibility, mesh structure, animation, arms, hitboxes,
perspective and release numbering. Per-model browser reviews exercise idle, walk,
run, crouch, weapon aim, glide and distance topology. The integration browser check
covers a retired-outfit save, Scout lobby, Wren equip, six-item Shop and first/third
person rendering in a local match. CI retains the browser evidence.

## Publication

Version 6.23.0, protocol 83. Publish the complete batch after focused CI; check
live tournament status before merging. Verify Pages and the existing Render
service report the same merged build. This release changes no tournament schedule,
awards or server event policy. The previous release remains in git for rollback;
archived outfit ownership remains available for migration recovery.
