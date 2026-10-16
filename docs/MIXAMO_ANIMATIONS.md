# Adobe Mixamo motion integration

Source: https://www.mixamo.com/ (downloaded through the owner's signed-in account).
Usage information: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
Adobe assets retain their own terms; they are not covered by an open-source license
for this game's code. Original FBX downloads and the X Bot model are not shipped in
this repository. The packed, retargeted motion is part of the Ravelfront game and
must not be extracted or redistributed as an animation library or asset pack.

`scripts/mixamo-manifest.json` records every selected source and adaptation.
`scripts/bake-mixamo.mjs <source-folder>` converts account-downloaded files offline:
FBX Binary, X Bot skeleton, 30 FPS, no keyframe reduction. Packs include a T-pose
reference; individual motions use Without Skin. No runtime FBX parser is shipped.

| Game state | Source |
| --- | --- |
| Eight-way walk/run/sprint/crouch, aim, jumps, death | Pro Rifle Pack |
| Unarmed movement, harvesting, shoulder/hip draw/holster | Pro Melee Axe Pack |
| Fall/skydive base | Falling Idle, Action Adventure Pack; game controls dive orientation |
| Slide | Running Slide; hold middle pose for extended slides |
| Mantle/vault | Freehang Climb; gameplay controls height and duration |
| Downed/crawl | Crawling; stationary downed holds a sampled pose |
| Revive | Kneeling Inspecting |
| Glide/zipline/ascender | Hanging Idle; game hand targets keep handles aligned |
| Vehicle | Sitting Idle; game hand targets keep controls aligned |
| Salute | Salute, with wrist correction for wider Ravelfront shoulders |
| Coast Shuffle | Step Hip Hop Dance |
| Rally Cheer | Cheering (two fists) |
| Crown Record | Being Cocky base; original crown display hand targets |
| Reload | Reloading standing torso; weapon-specific hand/magazine mechanics retained |
| Grenade | Throw torso; shared authoritative release/hand path retained |
| Drink/heal | Drinking torso adapted to each consumable's exact hand placement |
| Build/edit | Thoughtful Head Shake base adapted to blueprint/tool hand placement |

Packed samples use signed 16-bit quaternions and root offsets, decoded once per
clip and shared. Retargeting converts +Z to -Z and accounts for the game's lowered
arm bind pose. Source horizontal root motion is removed and loop ends are blended.
Physics, shot origins, hitboxes, networking and authoritative action clocks never
read animation bones. The earlier HY-Motion draft is not part of this release.
