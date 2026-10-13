# Update 150 — Make It Yours

Version 5.7.0 · gameplay protocol 50.

The Item Shop now opens as a collection storefront with large original character
cards, category navigation, search, favorites and price sorting. Selecting an item
opens a full-size inspector with the actual in-game model, rotation, included
styles, a separate character-art view, and a clear purchase confirmation.

## New collection

| Character | Identity | Included second style | Signature equipment |
| --- | --- | --- | --- |
| Commandant Voss | Gold crown helmet, command armor, split mantle | Frost Regent | Sovereign Halberd, Command Mantle, Crownwing |
| Marshal Rook | Sealed amber visor, navy dive armor, anchor insignia | Rescue Watch | Undertow Anchor, Abyss Tanks, Manta Subwing |
| Lieutenant Nyx | Angular hood, violet mask, split scout coat | Ghost Signal | Crescent Edge, Nightglass Shards, Eclipse Raven |
| Pulse | White crest, teal utility jacket, wrist terminal | After Hours | Circuit Breaker, Relay Drone, Signal Kite |
| Wren | Flight goggles, ponytail, shearling collar, scarf | Blue Horizon | Propeller Pick, Flight Recorder, Barnstormer |
| Morrow | Ivory mask, olive hood, asymmetrical poncho | Ashwalker | Rootsplitter, Seed Vault, Leafwing |

Each collection also has its own patterned weapon wrap and dive trail. There are
six new outfits, six included alternate styles, thirty equipment pieces and six
bundles. The three world bosses use the corresponding playable character and
back accessory. A boss outfit grants no boss powers or special hit regions.

## Ownership and purchases

- Outfits cost 1,200–1,600 earned Marks and include both styles.
- Bundles cost 2,500–3,200 Marks before ownership credits. Already-owned
  components subtract their individual value from the bundle, down to zero.
  A zero-price remainder is explicitly claimed; it is never charged.
- The browser lock re-reads storage, validates the confirmed price and balance,
  and grants missing components in one write. Duplicate purchases, stale
  confirmations and unavailable storage fail without a second debit. Rejected
  operations release the lock before raising the error.
- All 84 previous item IDs, prices, ownership, balances, favorites and loadout
  presets are preserved. These saves remain browser-local. Marks still come
  from the existing game rewards and are not sold for money.
- Equip an individual item or the complete owned set, save it in a preset,
  and retain the same profile through lobby, gameplay and multiplayer snapshots.

## Art and performance

The revised `public/season/breakwater-150.webp` preserves the existing hero scene
and animated title positions. Panels 04, 06 and 07 now show Hot Drops & Uplinks,
Orders & Medals and the new Item Shop. The updated briefing appears until the
player chooses its browser-local dismissal option.

Original character artwork is in `public/shop/{voss,rook,nyx,pulse,wren,morrow}.webp`.
The built-in image-generation tool produced the artwork; exact prompts are in
`docs/shop-150-art-prompts.md`. Images load lazily in the shop and are not loaded
by the combat renderer. Optimized character images are each under 150 KB.

Each character remains one skinned mesh with the same 32 bones. Unique rigid
equipment and new trails merge into one mesh each. Inspector images render on
demand, use the existing bounded cache, and use 600-pixel renders for the full
character. No extra continuous 3D scene or animation loop runs for the shop.

## Essential verification

- Purchase, duplicate request, partial-bundle ownership, included style,
  insufficient-balance, stale confirmation, storage-failure and migration tests.
- Actual model geometry, material patterns, draw-call bounds, finite animation,
  hitbox invariance, profile validation and simulation snapshots.
- Browser checks for promo replacement, six character cards and actual models,
  rotate/style/art controls, cancellation, purchase, bundle completion, equip,
  presets, search, small-screen layout and persistence after reload.

Design references: [Fortnite Item Shop](https://www.fortnite.com/item-shop) and
[ownership-aware Fortnite bundles](https://www.fortnite.com/news/all-item-shop-bundles-sold-for-v-bucks-eligible-for-fortnite-gifting).
Ravelfront's characters, artwork, equipment and currency are original.
