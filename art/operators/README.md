# Ravelfront production character roster

Scope authorized 24 October 2026: six Item Shop characters (Commandant Voss,
Marshal Rook, Lieutenant Nyx, Pulse, Wren, Morrow), four Victory Score characters
(Tempest Sentinel, Rift Revenant, Solar Imperator, Apex Sovereign), and one new
free default character. Retire all other playable outfit entries, including
alternate styles. Preserve unrelated equipment and player progression.

Work proceeds one character at a time. Compare the actual exported mesh with
the original cover, inspect front/side/back, and exercise the game animation
rig before proceeding. Generated construction views are references, never
presented as renders of completed models. Unseen surfaces are interpretations.

## Recovery

The approved Wren review and editable Blender source were recovered from the
23 October review package. That package also contained the four ranked cover
targets; it did not contain completed replacement models for those characters.
The current Wren source and GLBs preserve that approved geometry and textures.
Runtime packaging compresses textures and supplies a reduced distance mesh.

## Build

Blender 4.3 Python module, Python 3.11, NumPy 1.26. Production files retain
packed textures in editable `.blend` sources. Exported GLBs use the shared
32-joint game rig. Actual animation, hitboxes and matchmaking are independent
of the cosmetic mesh.
