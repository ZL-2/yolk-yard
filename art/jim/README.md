# Jim: outfit approval study

**Approval pending. Do not deploy or register these cosmetics until the user approves the likeness and outfits.**

The sweatshirt outfit is Jim's normal style. Golf is the special style. Both use the same face, hair, body proportions, and 32-joint skeleton.

## Review

Open `review/Jim-Outfit-Review.html` in a modern browser. The file includes the models, textures and game animation code, so it works without hosting or a network connection. Compare the styles, rotate to the side or back, use the Face and Footwear close-up cameras, expand the supplied face reference, and select a game animation. The modeling pose shows the exported geometry before animation.

These are actual skinned 3D meshes, not painted preview images. The revised face uses the supplied frontal close-up directly, with a uniform scale and measured feature positions. Photographs cannot establish unseen anatomy or clothing details exactly. Profile and rear surfaces are inferred; the user's approval is still needed for facial likeness, hair shape, body proportions, and clothing fit.

## Included details

- Normal: faded blue-gray hoodie, raglan seams, hood, drawstrings and aglets, raised kangaroo pocket, hem label, black shorts, bare lower legs, taupe closed-toe suede clogs with exposed heels, a curved opening, separate cork footbed and rubber outsole, wide sloping straps, stitched edges, adjustment holes, and open outside buckles with pins.
- Special: white polo, collar and placket, buttons, navy shorts, patterned belt with brown leather and buckle, white ankle socks, worn cream sneakers with green N-shaped side marks, separate quarter panels and toe mudguards, crossed laces, eyelets and bows, padded collars, heel stabilizers, brown toe tread and outsole grip, left-hand glove and right-wrist watch.
- A shared facial sculpt with shaped nose, cheeks, chin and ears; frontal albedo mapped directly from `IMG_0708.jpeg`; the new curl cutout is registered to the same reference and wraps a continuous 3D scalp. A dedicated footwear color and normal atlas preserves small shoe details.
- Distance meshes with the same materials and skeleton. Skinning, retargeting and game animations are exercised by the review viewer.

## Source and reproduction

- `models/jim-normal.blend`, `models/jim-golf.blend`: editable Blender sources with packed textures, skeleton and review lighting.
- `models/*.glb`: self-contained full-detail and distance assets.
- `../../scripts/art/build-jim.py`: deterministic Blender authoring, skinning, texture baking, export and rendering script. Requires Blender's Python `bpy` 4.3, Pillow and NumPy. Run `python scripts/art/build-jim.py normal` and `python scripts/art/build-jim.py golf` from the repository root.
- `../../scripts/art/jim_detail_geometry.py`: facial landmark fitting, continuous hair volume, and authored footwear construction.
- `face-landmarks.json`: measured reference image coordinates, uniform projection scale and anatomical feature positions.
- `hair-registration.json`: source-to-cutout registration (104 matching feature inliers; median error under one pixel).
- `../../scripts/art/render-jim-details.py`: arranges unretouched model renders into the face and footwear approval sheet.
- `viewer/model.js`: isolated review loader matching the production rig conversion. It does not add Jim to the production cosmetic list.
- `viewer/review.js`: the actual game animation functions in a dedicated review scene.
- `../../scripts/jim-browser-check.mjs`: bind-pose equality, skin weights, 19 animations per style, weapon grips, distance meshes, footwear textures, close-up cameras and mobile controls.
- `../../scripts/package-jim-review.mjs`: builds the standalone review; it does not publish anything.

From the repository root, use `node scripts/package-jim-review.mjs` to package the viewer. To run the browser checks, set `BROWSER_EXECUTABLE` to an available Chromium and run `node scripts/jim-browser-check.mjs`. A working Fontconfig configuration is required on Linux.

No production source files, operator roster, shop entries, release number, network protocol or deployment workflow are changed by this study. Integration into the cosmetic selector is deliberately pending approval.

## Image provenance and construction prompts

The user supplied golf and sweatshirt photographs, most recently `IMG_0703(2).jpeg` and `IMG_0705(2).jpeg`, and the new close-up `IMG_0708.jpeg`. The clothing and likeness were interpreted from those photographs. No external character mesh was used.

The built-in OpenAI image tool produced neutral references and texture inputs. They are not a scan or additional photographic evidence. The original face and garment request wording is summarized here:

1. **Face construction reference:** neutral frontal head and neck of the same person, preserving facial identity, fair skin, blue-gray eyes and loose medium-brown curls, with even lighting suitable for face texture projection.
2. **Clothing construction reference:** front and back A-pose views of both outfits; faded blue-gray hoodie and black shorts with tan clogs for normal, white polo and navy shorts with patterned belt, white socks and sneakers for golf; preserve the same person's build and facial identity.
3. **Hair silhouette extraction:** extract only the complete brown curly hairstyle from the frontal reference, preserving its curls and uneven fringe; remove face, skin, ears, neck, clothing and background to true transparency. This texture is wrapped around authored 3D scalp geometry.

The earlier generated face reference, old hair silhouette and individual curl-card experiment are no longer used by the revised assets. Current inputs are `textures/face-closeup-reference.jpeg` (the supplied close-up, unchanged), `textures/clothing-reference.png`, and `textures/hair-closeup-cutout.png`. No replacement face was generated for this revision.

The built-in image tool was used only to extract the new hair cutout. The exact prompt is retained in `revision-provenance.json`. A similarity registration of the original image to the extracted curls found 104 inlier features with a median error of 0.89 pixels in the output. That measures texture alignment; it is not a measure or guarantee of 3D likeness.

The face and shoe details remain subject to the user's approval. The normal photograph cuts off the lower part of the clogs, and hidden shoe/back/profile surfaces remain inferred. No production performance claim is made by this isolated review.

Editable Blender sources are stored losslessly as `.blend.gz.part1`, `.part2` and `.part3` to fit release transport limits. Reconstruct each with `cat art/jim/models/jim-normal.blend.gz.part* | gzip -d > jim-normal.blend` (replace normal with golf for the other source). Production GLBs are unchanged.
