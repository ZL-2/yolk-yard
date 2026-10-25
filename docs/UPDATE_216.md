# Update 216 — anatomy and tournament time

Release 6.24.0 / protocol 84 follows the eleven-operator rollout. It addresses the reported small heads, long necks, narrow bodies and movement that did not fit the authored skeletons.

## Anatomy and rendering

Each of the eleven editable Blender sources receives an individual, UV-preserving anatomy pass from the immutable release-215 source commit. Hip, ribcage, shoulder, neck and head proportions differ by character. Rook and Voss retain heavier builds; the other characters retain their own silhouettes. Exposed faces receive cheek/jaw volume and nose-profile adjustments. Hands are shorter and fuller, with relaxed finger curvature. Flexible garment underlayers and continuous knee/elbow weights cover separated construction panels during bends. Existing garment atlases remain packed; both near and distance meshes are regenerated. Pulse also receives a dedicated face/neck atlas with isolated UVs, removing projected facial features from her hair and neck.

Gray studio-background projection on limb sides is replaced by smoothly blended garment color, baked into the body atlas. Front/back detail, armor, skin and cape artwork remain intact. Joint underlayers sample each outfit’s own sleeve and trouser colors.

Imported materials share the same reflection environment as the game's other equipment. This restores metal response without changing painted colors or adding per-player texture copies.

The artwork remains the visual target. Unseen surfaces and three-dimensional depth are authored interpretations, not exact reconstructions of an original source mesh.

## Animation

Captured model-space limb directions are transferred into each operator's actual rest skeleton after source-space blending and before contact/weapon IK. Segment lengths are preserved. Foot reach uses the actual hip spacing. Finger grip is cosmetic; it does not move the gun or crosshair. Existing motion clips already cover the required actions and are reused.

The public roster viewer includes 19 movement/action previews in addition to the modeling pose. Targeted checks exercise every rig through locomotion and action transitions and inspect actual skinned assets in Chromium.

## Tournament clock

The relay already owned UTC scheduling and admission. The client now anchors its calendar, Today control and lobby countdown to relay `serverNow` plus monotonic elapsed time. Device clock changes do not move those displays. Compete shows the current New York date, time and EDT/EST designation. A stale or resumed connection waits for a fresh timestamp before enabling entry. Browsing another calendar week/month is preserved when new timestamps arrive.

The owner-edited event catalog, prizes, results and rewards are untouched. Focused tests cover clock skew, New York midnight and DST changes, exact entry boundaries, spectators, durable awards and matchmaking reopening.

## Gameplay invariants

No physics, hit-volume, combat, stance, movement-speed or weapon-aim definitions change. The roster remains six Shop operators, four Victory Score rewards and free Frontier Scout. Character shape remains cosmetic.

## Authored face asset

Pulse’s face texture was created with the built-in image generation tool from `public/shop/pulse.webp`. The exact prompt and mode are recorded in `art/operators/pulse/face-albedo-216-prompt.txt`, and the source bitmap is `art/operators/pulse/face-albedo-216.png`. Blender UV mapping and material baking integrate it into the editable source and exported game mesh. This is a texture for the actual model, not a replacement promotional image.
