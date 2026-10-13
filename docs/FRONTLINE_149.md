# Update 149 — Frontline Operations

Version 5.6.0 · gameplay protocol 49.

The design goal is to give each round useful decisions between landing and the
final fight: where to risk landing, when to contest a broadcast objective, when
to recover, and which achievable assignment to finish next. Rewards come from
playing the match; no purchases, streak penalties, or timed login requirements.

## Match changes

- One gold district on the map contains two upgraded Epic Chests, each with an
  extra Shield Flask. Authored loot sockets and the Rare floor-weapon ceiling
  remain in force.
- The first uplink activates 75 seconds after departure. Up to three can appear,
  normally 105 seconds apart. Quick storm objectives use shorter intervals.
  Grounded, living contestants within eight metres and line of sight capture in
  14 seconds. Opposing teams pause capture. Taking over an enemy's progress
  drains it first; leaving the area eventually decays it. Squads capture at the
  same speed and everyone inside at completion receives credit.
- The uplink spawns one premium cache with extra recovery supplies. Nearby,
  equipped bots sometimes pursue it; combat, recovery and storm needs take
  precedence. No hidden enemy information is supplied.
- Orders: open three chests, deal 250 opponent damage, visit three districts.
  Each pays 150 Service XP, capped ammunition/material supplies and recovery
  loot. Completing all three adds a premium weapon and a 250 XP medal.
- First Strike, Double/Triple Elimination, Long Shot, Against the Odds,
  Sharpshooter, Back in the Fight, Signal Secured and Mission Complete medals
  appear in the HUD and report. Each elimination grants 75 Service XP; repeat
  medals have per-match caps. Service levels are browser-local records,
  separate from the existing persistent Marks economy.
- Trauma Kits use one second of setup, then recover 100 health over five
  seconds. Shield Flasks use 0.8 seconds of setup, then recover 50 shield over
  3.2 seconds. Cancel before recovery to keep the item. Cancel afterward to keep
  the recovery already applied, spending exactly one item. Caps stop use early.
- Eliminations restore 35 stamina. Supply drops account for storm movement
  during descent and looting, and stop spawning when no safe area remains.
- Field Menu and Island Map link to orders and the report. Results include
  damage, assists, completed orders and Service XP. Accuracy counts triggers,
  deduplicating shotgun pellets, bursts and shield/body damage portions.

## Audio and movement presentation

An original A-minor score uses a sparse exploration motif, deployment melody,
objective pulse and combat/final-fight percussion. Music ducks when the local
player fires, receives damage or hears a true near miss. It pauses with offline
play, mute, death, hidden tabs and leaving the game. Existing licensed lobby
music remains; the Music slider controls both lobby and match music.

Weapon synthesis includes quiet early reflections and distinct mechanical
transients. Bounded cover tests attenuate/filter distant gunshots. Flybys require
a shot trajectory passing the listener, with hitscan wall endpoints respected.
Metal, wood, glass and water impact cues have separate designs. Shield breaks,
medals, orders, uplinks and recovery have distinct cues. Vehicle engine pitch
now changes with speed. Footsteps remain disabled.

First-person weapons use turn inertia, velocity-driven stride, strafe cant,
gentle breathing and a damped landing spring. ADS strongly suppresses these
motions; Reduced Motion removes them. Character turns, landings and transitions
are smoothed; utility use has preparation, hold and return phases. Existing
lobby boot planting and weapon grips are preserved. Hitboxes and firing rays
are unaffected.

## Runtime and validation

- At most one uplink and four extra world meshes; occupancy sampled at 4 Hz.
- Score capped at 12 voices, skipping notes when 36 shared voices are in use;
  the existing global 56-voice cap remains. No audio scheduling catch-up bursts.
- Gunshot cover checks are capped at 25 per second with a bounded cache.
- Per-player trigger history capped at 64; medals, orders and visits are small,
  detached snapshot data. Host checkpoints retain in-progress item consumption.
- `tests/frontline-operations.test.js` covers contest/takeover, teams, obstruction,
  inactive players, storm safety, rewards, real consumption, deduplication,
  checkpoint restoration, music budgets and motion comfort.
- `scripts/frontline-network-check.mjs` checks three independent sockets.
- `scripts/frontline-browser-check.mjs` checks the actual objective HUD, report,
  medal, pause/resume, weapon movement and a rendered Web Audio mix. Both are
  release gates alongside the existing suite and performance comparisons.

Design references: [Fortnite Chapter 4's hot spots and capture objectives](https://www.fortnite.com/news/welcome-to-fortnite-battle-royale-chapter-4-season-1)
and [Apex Breakout's action-based progression](https://www.ea.com/games/apex-legends/apex-legends/news/breakout-season-game-updates).
The implementation, music and effects are original to Ravelfront.
