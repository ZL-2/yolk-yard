# Update 155 — Field Detail: Operators & Equipment

Version 5.9.0, protocol 51. This upgrades the real gameplay asset factories,
not the loading illustrations. The surrounding map and its lighting style are
unchanged; matching the artwork's design does not imply identical cinematic
render quality on every browser.

All 36 saved outfit variants, starter operators, three bosses and their themed
guards use one shared anatomical rig with more detailed faces, fitted folds,
seams, glove protection and boot treads. Signature characters have redesigned
masks, visors, hoods, capes, hair and armor. Live encounter outfits are no longer
covered by old block-based boss decorations.

All 11 held/ground firearm models have genuine barrel recesses, machined
hardware, ribbed reload assemblies, improved optics and distinct wood, rubber,
polymer, paint and metal. Original sight/muzzle sockets and reload timelines
remain unchanged. First-person sleeves/gloves, grenades, rockets and crowns
also receive physically based surfaces.

All gameplay consumables, tools, boss mobility gear, keycards, five ammunition
families, resource pickups, chest variants, default parafoil and launch pad are
upgraded. All 72 shop equipment/trail models and 18 patterned wraps inherit
the new surfaces; signature gliders retain six distinct designs. Real glass
can require a small separate draw, while opaque assemblies remain batched.

| Asset | Maximum triangles | Draw budget |
| --- | ---: | --- |
| Operator/outfit/guard | Below 14,000 | One skinned mesh |
| Held firearm | 11,564 | 20 meshes, including moving/optic parts |
| Ground firearm | 11,564 | One atlas mesh |
| Standard pickup/launch pad | 4,592 | 1–4 meshes; crowns are batched |
| Chest with opening lid | 6,404 | Separate lid pivot preserved |
| Default parafoil | 5,028 | Batched |
| Shop equipment | 4,220 | 1–4 opaque/glass meshes |

Nine original surface kinds share a 512×384 atlas and 128px detail maps.
A small HDR reflection source works in both gameplay and portrait GPU contexts.
Shared texture disposal is protected when previews or equipment are replaced.
Inventory thumbnail generation uses the actual WebGL PBR model factories.

Focused validation covers finite geometry, normalized skin weights, all outfit
and gear variants, unchanged rig/sockets/hitboxes, reloads, actual Royale baking,
shared texture lifetime, all thumbnail decodes, live lobby/shop/first-person
presentation and complete model catalogs. The presentation-only release path
guards shared view/world code and skips unrelated simulation/network suites.
Publication still confirms matching website/relay builds and live private traffic.
