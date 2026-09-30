# Ravelfront weapon balance — 3.4.0

All values come from `src/weapon-balance.js`. These are original values for the 512-unit island, walk speed 5, sprint speed 7.4, 100 arena health and 100 health + 100 shield in Royale. Epic’s [weapon/build balance principles](https://www.fortnite.com/news/weapon-and-building-balance-8-9) and [first-shot accuracy design](https://www.fortnite.com/news/shooting-test-1) inform roles and counterplay; seasonal numerical statistics are not copied.

| Weapon | Body / critical | Rounds/s | Mag | Reload / empty | Full damage → max range | 200 TTK @ 12, body / head | Purpose | Disadvantage |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Sprinter | 24 / 42 | 6.67 | 30 | 2.15 / 2.45 | 32 → 240 | 1.2 / 0.6 | Mobile medium-range all-rounder | Bloom and recoil limit distant sustained fire |
| Scatter | 96 / 144 | 1 | 5 | 2.8 / 3.1 | 7 → 50 | 2 / 1 | Deliberate close-range burst and cover peeks | Slow follow-ups and steep range loss |
| Needle | 95 / 204.25 | 0.56 | 1 | 3 / 3 | 500 → 500 | 6.07 / 0.04 | Earned long-range headshot eliminations | Single round, slow handling, travel and poor airborne/hip accuracy |
| Zipper | 16 / 24 | 12 | 36 | 2.2 / 2.55 | 12 → 140 | 1 / 0.67 | Close-range tracking and mobile pressure | Rapid ammo use, horizontal recoil and severe falloff |
| Thumper | 85 / 85 | 0.63 | 1 | 3.1 / 3.1 | 240 → 240 | 6.48 / 6.48 | Telegraphed explosive cover-breaking pressure | Six-unit arming distance, slow flight/reload and self-damage |
| Anchor | 51 / 102 | 1.54 | 7 | 2.3 / 2.6 | 100 → 380 | 1.95 / 0.65 | High-impact controlled precision and ammo efficiency | Slow follow-ups, hip fire and heavy ADS handling |
| Duet | 26 / 46.8 | 5 | 24 | 2.4 / 2.7 | 42 → 280 | 1.28 / 0.68 | Accurate three-shot windows at medium range | A missed burst leaves a distinct recovery gap |
| Pip | 26 / 52 | 5 | 14 | 1.35 / 1.6 | 18 → 150 | 1.4 / 0.6 | Quick-draw, mobile backup with rewarding controlled headshots | Lower sustained body DPS and limited range |
| Sentry | 39 / 64.35 | 3 | 12 | 2.15 / 2.4 | 60 → 360 | 1.67 / 1 | Reliable scoped follow-ups and distant body-shot pressure | Slower ADS and less close-range mobility than rifles |
| Breach | 70 / 94.5 | 2 | 8 | 2.55 / 2.9 | 5 → 45 | 2 / 1.5 | Forgiving follow-up shots and moving close-range fights | Lower burst/headshot ceiling and shorter full-damage range |
| Comet | 27 / 44.55 | 5 | 24 | 1.85 / 2.15 | 48 → 320 | 1.4 / 0.8 | Low-recoil, controlled medium-to-long-range rifle fire | Lower close-range pressure and smaller magazine than Sprinter |

Damage for shotguns is all ten pellets. Rocket damage is maximum explosion-center damage; its six-unit arming distance, radial falloff, cover and travel time make actual damage lower. No explosion critical hits.

TTK starts at the first accepted shot and includes subsequent burst spacing, reloads (including the next 60 Hz tick) and projectile travel. It excludes initial ADS/equip time, cover, misses, latency and deliberate trigger pauses. Null means outside range, below rocket arming distance, no expected contact, or insufficient maximum carried ammunition. Ideal head/body values assume every shot or pellet hits the chosen region. Estimated values use 192 deterministic shots at the standardized humanoid hitboxes, continuous ADS and full player recoil compensation; they include spread misses and mixed pellet regions. They are spread-limited estimates, not guaranteed elimination times. Controlled first-shot-accurate taps can outperform continuous spray at distance.

The CSV has 275 rows: eleven weapons × five rarities × five ranges (2, 12, 40, 100 and maximum range minus one). JSON also includes 198 stance comparisons at close, medium and long range. No weapon damage bonus is applied to bots. Arena killstreak bonuses remain earned gameplay modifiers and are excluded from base metrics.

Rarity improves damage by 0/2.5/5/7.5/10%, reload speed by 0/2/4/6/8%, and structure damage by 0/1.25/2.5/3.75/5%. Cadence, magazine, critical multiplier, projectile size, recoil and handling remain consistent.

Falloff interpolates linearly between each weapon’s configured points. Shotgun fixed pellet patterns reduce roll-to-roll randomness. Non-scoped rifles and pistols gain stationary, settled-ADS first-shot accuracy; SMGs emphasize tracking. Existing grounded scope stability and wider zoom are retained, with explicit slide/air penalties. Hip, ADS, movement, crouch, sprint, slide and air spread, bloom/recovery, learnable recoil patterns, ADS movement and equip times all live in the central profiles.

Wood/brick/metal construction health remains 150/300/500 (starting 90/100/110); guns use separate structure values and close-range structure falloff. Rockets retain cover-breaking purpose at 230 structure damage with only 85 player damage. Pickaxe remains 20 player damage and has no critical hits. Grenade is 85 player / 130 structure damage.

Ammo caps: light 300, medium 300, shells 48, heavy 36, rockets 8. Matching chest ammo remains guaranteed; light/medium stacks are 24–36, shells 4–8, heavy 3–5 and rockets 1–2. Sentry uses medium ammo, Anchor and Needle heavy ammo.

Weapon selection uses effective damage, cadence, range, reload availability and inventory ammo. Bots replan after swapping, use the same central statistics, and maintain sniper/marksman engagement distances. Authoritative cooldowns persist across swaps/checkpoints, shotguns share pump lockout, semi-auto input edges have a 120 ms buffer, duplicate sequences are rejected, projectiles use swept anatomical collision, and predicted effects never apply damage or decrement inventory.
