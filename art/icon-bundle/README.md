# Jim's equipment review

Status: unpublished approval study, based on `fc7d32a`. No outfit or character
asset is included or modified. The outfit work remains in its separate branch.

## Equipment

| Slot | Stable ID | Model |
| --- | --- | --- |
| Pickaxe | `pickaxe-jim-sixty` | Sixty Degrees: a 60-degree lofted wedge with ten face grooves, stepped shaft, ferrule, grip rings and back engraving. |
| Wrap | `wrap-jim-watermelon` | CUBA Watermelon: branded can-lid and red/green/cream fruit graphics, consistently sized across weapon parts. |
| Back accessory | `backbling-jim-keepsake` | Crown Russe Vodka: a clear bottle with red cap, red-and-white label, animated liquid, leather cage, buckles and stitches. |
| Glider | `glider-jim-sleepingbag` | Bedtime Flight: a sleeping bag that unfolds into quilted wings, with a hood, pillow, foot-box, zipper teeth, fluttering ties and eight suspension lines. |
| Dive trail | `trail-jim-whiteout` | White Goo: four tapered flowing strands and 28 recycled droplets. |

The requested CUBA Watermelon and Crown Russe branding is included as a fan concept;
no brand affiliation is implied. The mannequin is a size reference, not Jim's outfit.

`src/icon-bundle-models.js` supplies the actual game geometry through the existing
shop builders. Pickaxe animation uses the existing 0.45-second harvest cadence
and hand-attachment path. Glider/trail animation runs in RoyaleView; bottle
animation runs with actor poses and lobby movement. No movement, combat, loot,
collision or reward balance is changed.

Approval protection: `reviewOnly` entries resolve for rendering but are absent
from public shop listings, have no purchase offer, and are rejected by live
cosmetic profile validation. Release approval must precede catalog activation,
pricing/grants, version changes and deployment.

## Native asset budgets

Counts exclude the review mannequin and its separate meshes.

| Asset | Triangles | Meshes |
| --- | ---: | ---: |
| Pickaxe | 17,612 | 10 |
| Back accessory | 13,520 | 13 |
| Glider | 21,278 | 16 |
| Trail, including instanced droplets | 7,504 | 5 |

Static geometry and textures are shared. Cloth is batched with vertex colors.
Each trail owns its shader uniforms and particle matrices. Animation does not
rebuild geometry. New projected weapon UV geometry is owned and disposed with
its wrapped weapon; shared weapon templates remain unchanged.

## Reproduce the review

```sh
node scripts/package-icon-bundle-review.mjs
BROWSER_EXECUTABLE=/path/to/chromium node scripts/icon-bundle-review-check.mjs
```

The standalone output is `art/icon-bundle/Jim-Bundle-Review.html`. It includes
Three.js and all artwork; it runs without a server or network access in a
WebGL-capable browser. Tabs support mouse and keyboard selection. Hero, back,
detail, turntable, pause, playback speed, deployment replay, bottle scale and
four weapon previews are available.

## Validation

- 18 targeted bundle, vote-retirement and pickaxe-animation tests passed.
- 44 existing shop, private-party, tournament-team and tournament-clock tests passed.
- The standalone browser check passed for all five models, four wrapped weapon
  types, stable geometry, finite transforms, animation controls, bottle fitting,
  glider deployment, narrow layout and zero JavaScript/renderer errors.
- The full Vite production build passed. No production deployment was requested.
- `tests/cosmetics.test.js` has an existing legacy expectation failure for the
  default outfit and `royaleRank`. The identical failure was reproduced on the
  unchanged `fc7d32a` baseline; it is unrelated to this review.

## Voting retirement

The separate preceding commit removes the lobby shortcut and client gate. The
server reports the vote closed, admits players without voting, rejects stale
writes, and leaves existing ballots and original nomination history intact.
Owner Access displays read-only archived results. Even damaged voting storage
cannot block match admission. Client and relay changes must be released together
when deployment is approved.
