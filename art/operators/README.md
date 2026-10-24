# Ravelfront production character roster — release 215

The playable roster contains six Item Shop characters, four Victory Score rewards,
and the free Frontier Scout default: 11 outfits. Other playable outfits and
alternate variants are retired. Saved ownership is archived; Marks, equipment,
receipts and progression are preserved. An alternate purchase retains its
signature outfit. Ranked unlock rules are unchanged.

## Reviewed assets

| Character | Asset | Near triangles | Distance triangles |
| --- | --- | ---: | ---: |
| Wren | `wren` | 64,774 | 15,544 |
| Tempest Sentinel | `rank-25` | 21,882 | 6,126 |
| Rift Revenant | `rank-10` | 23,130 | 6,475 |
| Solar Imperator | `rank-5` | 26,926 | 7,526 |
| Apex Sovereign | `rank-1` | 26,382 | 7,377 |
| Commandant Voss | `voss` | 23,850 | 5,957 |
| Marshal Rook | `rook` | 34,880 | 9,766 |
| Lieutenant Nyx | `nyx` | 19,408 | 5,434 |
| Pulse | `pulse` | 31,236 | 8,746 |
| Morrow | `morrow` | 21,958 | 6,147 |
| Frontier Scout | `scout` | 41,854 | 11,688 |

Each character has a texture-packed editable Blender source, game GLB, reduced
distance GLB and actual mesh renders. `reviews.json` records export SHA-256 and
review evidence. Original covers remain the design targets; unseen surfaces are
interpretations. Scout's portrait is rendered from the final model. Generated
construction sheets are references, not renders of completed models.

The approved Wren mesh and source were recovered from the October 23 review
package. Geometry and textures are preserved; runtime packaging compresses maps
and adds a distance mesh. The four ranked replacements and remaining Shop
characters were built and reviewed sequentially, followed by Scout.

## Build and inspect

Authoring uses Blender 4.3's Python module, Python 3.11 and NumPy 1.26.
`scripts/art/build-<name>.py` rebuilds each packed source, near/distance GLBs and
front, side, back and three-quarter renders. `prepare-wren.py` packages the
approved Wren source. The common builder is `scripts/art/operator_builder.py`.

All assets use the 32-joint game rig, with one material each except Wren's two.
Geometry, textures and materials are shared between instances. The runtime uses
the reduced mesh at distance and retains the existing gameplay hitboxes.

Open `operators.html` for the actual game-mesh viewer: character selector, six
animated poses, rotation, wireframe and downloadable GLBs. Per-character checks:
`node scripts/operator-browser-check.mjs <id>`. Full lobby/Locker/local-match check:
`node scripts/roster-browser-check.mjs`. Browser evidence is written to
`test-results/roster215` and retained by the release workflow.
