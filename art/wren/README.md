# Wren model study 01

The original `public/shop/wren.webp` remains the visual target. `turnaround.png` is a generated front/side/back construction reference, not proof of a finished 3D model. Its unseen sides are interpretations.

The editable `wren-prototype.blend` contains a custom mesh fitted to those proportions, anatomical face displacement, garment surfaces, scarf, tapered hair locks, separate curved shoulder and knee shells, finger geometry, boots and a 32-bone skin. `public/models/operators/wren-prototype.glb` is the actual exported asset. It has approximately 35,000 triangles and one material. The current albedo is baked into a separate UV atlas from projected reference detail and blended side material colors. It includes painted light and is not a finished physically based texture set.

`wren-study.html` is a separate comparison page. It loads the GLB into Three.js, converts its orientation and bone indices to the game's rig, and exercises the existing character animation code. It deliberately does not replace the production cosmetic. Remaining work includes side UV seams, hair volume and silhouette, facial likeness, garment deformation, foot texture wrapping and final neutral-light PBR textures. A stronger frontal likeness does not establish fidelity from every view.

Build using Blender 4.3 or the Python module:

```sh
python3.11 -m venv /path/to/wren-env
/path/to/wren-env/bin/pip install bpy==4.3.0 'numpy<2'
/path/to/wren-env/bin/python scripts/art/build-wren.py
```

The script writes the GLB, editable Blender source, front/side/back review renders and `report.json`. Original artwork and turnaround generation used OpenAI image tools. No external character asset was used. The turnaround prompt is in `prompt.txt`.
