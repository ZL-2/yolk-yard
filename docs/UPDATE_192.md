# Update 192 — Squad up. Speak up.

Version 6.9.0, compatible protocol 69. Publication is authorized even with active matches. Desktop-only targeted verification; no mobile sweep.

## Lobby and announcement

- Bring Your Crew / +1,000 Marks is immediately left of Request a Feature with the same button styling. Opens the existing personal referral screen. No dismissal checkbox and no referral carousel entry.
- Voice-chat key art leads the news carousel and opens automatically after loading and required name entry. Play/close returns to the lobby; the independent browser preference suppresses subsequent automatic presentations. Carousel replay ignores that preference without resetting it.
- The existing Voice control moves beside Chat in a centered container. It remains the same control/session; opening it does not enable the microphone. In-match positioning is retained. The announcement accurately lists Party/Team and the three eligible Game-channel modes.

## Field rules

- Spawn Island roster caching includes session type and local identity, avoiding a stale offline label after switching to an online session with the same roster.
- All visible equipment pickups receive rarity-colored floor glow and surrounding haze, including Zone Wars lanes. Ammo/materials do not masquerade as equipment tiers.
- Natural medkit quantities are exactly one; Restoration Capsules exactly two. This includes floor/chest/high-tier/supply rolls and Zone Wars spawn lanes. Inventory stack limits and player-dropped quantities remain inventory-driven.
- Each capsule restores 20 total health/shield points, health first and remaining points to shield, with existing range, obstruction and vital caps.
- Damage does not cancel item use. Incidental pickups/auto-stacking preserve the active item, use timer and consumed state. Deliberate replacement/equipment changes, sprinting/building, reviving and elimination retain their cancellation rules. Replacing a fully consumed medkit slot works on the first interaction without duplicating a kit.
- Idle bots navigate toward the closest eligible hostile player after existing survival, combat, loot and squad priorities. Ordinary visual perception still gates aim/fire. Dead players, spectators, transport passengers, teammates, protected cloaking targets and boss NPCs are excluded. Squad pursuit respects the combat leash.

## Performance and verification

- Rarity auras use one instanced GPU draw and one scene node, two quads per item, growing reusable buffers and no dynamic lights. Only visible equipment contributes instances.
- Nearest-player scans are cached for 750 ms between strategic decisions, immediately invalidated for departed/dead targets and changed rosters. Pickup culling compares squared distances.
- Lobby comms polls at 10 Hz and only changes DOM attributes/unread labels when values actually change. This removes stable-chat DOM churn from the render loop.
- `tests/crew-field.test.js` covers drop counts, healing/damage/pickup conservation, deliberate swaps, elimination, 20-point capsules, bot priority/caching and aura buffer growth. Existing affected healing/perception/tactics tests remain gates.
- `scripts/crew-field-browser-check.mjs` exercises the actual desktop announcement, preference/replay, referral access, centered controls and voice enablement; unchanged-roster session labeling; stable chat mutation count; and 512 instanced auras with shader errors captured. Screenshots and measurements are saved under `test-results/crew-field/` by CI.
- The publication workflow limits this release to an explicit file set, runs the focused unit/desktop checks and production build, then verifies the matching live website/relay release and private rooms.

## Artwork provenance

Created with the built-in imagegen tool. Asset: `public/season/voice-192.webp` (1672 × 941, WebP quality 86). The original generated PNG remains outside the repo; the optimized production asset is tracked here.

Final prompt:

> Create a premium landscape 16:9 promotional key art for an original multiplayer action videogame called RAVEL FRONT. Cinematic polished stylized 3D game illustration, sophisticated crisp art direction, rich midnight navy, turquoise radio light and warm amber sunset, not cartoon stickers. On the right two-thirds: a diverse squad of three original adult tactical operators on a coastal city rooftop, each with a clearly visible headset and boom microphone; foreground operator is a confident woman in a dark teal technical jacket touching her headset, beside a male operator in charcoal armor with amber accents and a third teammate farther back. Communicating and coordinating, not firing weapons. Turquoise luminous sound-wave arcs and a subtle frequency waveform weave between their headset microphones, forming an elegant dynamic visual of team voice communication. Mediterranean coastal battle-town rooftops, distant mountains, small twin-rotor helicopter, sunny horizon, atmospheric depth. Left third is very dark navy fading naturally into the scene for incredibly legible giant typography, not a separate card. Exact readable typography only: small white 'RAVEL FRONT' at upper left; huge condensed bold white title 'VOICE CHAT' split across two lines mid left; a bold vivid yellow line 'IS HERE' below it. Smaller white tagline near bottom left 'SQUAD UP. SPEAK UP.' Do not add buttons, menus, badges, tiny text, watermarks, vendor logos, or any other wording. Keep all title text within generous safe margins and readable when scaled down to a 320px-wide carousel. Make it feel like professional AAA game launch artwork, with deliberate composition and highly detailed but uncluttered visuals. No Fortnite logos or characters.
