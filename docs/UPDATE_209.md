# Update 209 — Wren model study

Version 6.18.1 / protocol 78. No simulation, networking, purchase, entitlement or hitbox changes.

A separate `wren-study.html` provides the original art beside a rotatable GLB, camera presets, wireframe and seven pose selections. The asset is built and saved in Blender with a custom reference-fitted mesh and a 32-joint skin. The viewer retargets the real game animation functions and keeps the captured clip pelvis offset separate from clip state.

This is a first asset study, not the final Wren replacement. Its projected reference texture, side seams, hair, face and garment deformation have practical limits documented in `art/wren/README.md`. The production outfit remains unchanged. The original request's identical-art goal is not declared complete.

Focused verification loads the actual GLB in desktop WebGL, verifies skin indices and weights, rotates all directions, exercises idle/walk/run/crouch/aim/glide, checks finite deformed vertices and advancing frames, and builds both the normal game and study entries. The normal live multiplayer gate remains in the release workflow. Mobile and broad unrelated performance suites are skipped.
