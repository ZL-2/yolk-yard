# Season 1 — Operation Breakwater

Version 4.0.0 / gameplay protocol 31. Initial Quality Update 116.

## Implemented requests

- Season launch illustration, original coastal military art, responsive six-section briefing, Close and browser-specific Don't show again. Lobby Season 1 button reopens it.
- Existing 84 shop item IDs/purchases retained. All 12 sets receive military silhouettes: fitted operator uniforms, breaching/entrenching tools, radio/medical/drone/cylinder packs, field wraps, parafoils/rigid wings and ribbon trails. Alternates use field palettes.
- Operators: shaped adult proportions, cheek/eyelid/nose detail, layered plate carriers, MOLLE rows, magazine pouches, belts, helmet rails/headsets/straps, boots and knee panels. Voss has an armored hood/visor. One shared anatomical hitbox contract remains cosmetic-independent.
- Reference video comparison: our previous upright repetitive sweep vs the reference's head-led sector scans, weighted stride, shoulder aim and low-ready transitions. Updated the layered patrol timeline, torso lag, weight transfer, stride sway, grip and airborne hand/foot poses. Original animation; no reference assets copied.
- Aster Observatory boss: Commandant Voss, 600 health + 400 shield. Overhead bars after damage. Standard legendary Sprinter; ordinary ammo, reload, spread, cooldown and projectile rules. 0.8-second acquisition delay, burst pauses, bounded perception and 70m home leash. Not a contestant or player-kill reward. One-time drops: legendary Sprinter, 60 medium rounds, mythic rig.
- Kestrel Jump Rig: three charges, one charge per 12 seconds, 1.2-second use cooldown, directional 18m/s boost plus 19m/s vertical launch, protected landing. Item charge state persists when dropped/transferred; host owns activation and recharge. Ground/ordinary airborne use; cannot activate during transport/dive/glide.
- Improved Kestrel cockpit, structural details, lights, rear ramp and nacelles. Mouse/touch orbit while aboard. Bot gliders/trails randomized from all 12 military sets.
- Glide horizontal 24→16m/s, dive 17→13m/s, glide descent 6→4.8m/s, dive descent 25→20m/s. More natural dive limbs and ribbon trails. Launch-pad air control 26→20m/s.
- Hold crouch on terrain slope >=0.2 to start sliding without sprint; steeper slopes accelerate faster, capped at 10.5m/s. Level-ground sprint slides retained.
- Drag equipment left out of inventory to drop, including unselected slots; touch drag and keyboard/drop buttons remain. Ammo/material half/all drops are validated on the host, conserve quantities and block immediate self pickup for two seconds.
- Public Solo admission and spectating: 7am–7pm America/New_York (DST-aware). Existing rounds may finish after 7pm. Private FFA/Solo/Duos/Squads stay available; manual starts, codes, party readiness and empty-public reset preserved. Team Scramble remains retired.
- Legacy active field dialogs, pause/results/room code treatments and weapon terminology refreshed. Built-in Locker/Shop/Career scrolling retained.

## Implemented earlier improvement ideas

- Performance: opaque shop equipment batched to one mesh, shared operator geometry, distant pose budgets retained, minimap limited to 10Hz, offline snapshots capped to 30Hz (host network cadence retained), cached public-hours checks, idle closed-room preparation avoided, boss perception at 5Hz, 12 smoke volumes maximum, steadier adaptive-resolution updates. Existing Low graphics is labeled School laptop. Frame/network diagnostics, spatial audio, hitmarkers, shield breaks, directional hit cues and reconnection system retained; stronger torso hit reactions added.
- Bots: bounded Royale turning and committed combat angles; existing cover, retreat, pursuit, range/ammo weapon choice, teammate following/revival/material policies retained. Smoke blocks their line of sight. No damage bonus.
- BR pacing: first storm wait +10s to accommodate slower descent. Chests containing tactical utility also supply two small shields. Existing distributed bot landings and guaranteed POI weapon sockets retained.
- POIs: Observatory defensive approach cover, boss encounter, and three functional relay stations differentiate contested locations.
- Tactical relay: hold interact three seconds; 60-second station cooldown; nearby last-known contacts exposed for 12s AND public transmission marks the user. Recon Pulse: 55m/8s contacts. Smoke: 12s visual cover with normal bullet passage.
- Offline field training: persistent Spawn Island, moving bot targets, every gun available in inventory selector, free materials/ammo, rig/smoke/scanner and six tracked move/fire/slide/build/edit/boost exercises. No currency/mastery rewards.
- Personal Season Career: all 11 weapons, five mastery levels, damage/elimination/critical counters, weekly elimination/relay/boost assignments. Cosmetic-only unlocks: Aster wrap, Heat Exchanger pack, Relay trail, Hydrofoil. Browser-local records; no power advantage or cross-device sync.
- Private room presets: Quick Royale, Zero Build, Precision Arena; configurable build toggle and close/precision/all arena pools; one-click rematch using existing rules, or change rules.
- Elimination recap: finishing weapon, final-hit damage, distance and critical/body/environment indication. Full match replay/killcam remains a future feature, as originally described.

## Essential verification

- Season simulation checks: boss spawn/collision/loot once/checkpoint, shared weapon stats, rig cooldown/recharge/fall immunity, quantity-conserving supply drops, relay risk/reward, smoke, wire roundtrip, reduced flight, true downhill sliding, training, private restrictions.
- Recurring authority checks: 48 contestants + 16 spectators + separate NPC, player replacement, empty reset, manual private starts, 7pm admission and ticket cutoff, no spectator rewards.
- Existing weapon checks: all firearms body/head/falloff, stance accuracy, cooldown/swap/reload, structure pressure and bots.
- Real three-socket host/guest checks: all 11 firearms, damage consistency, duplicate inputs, forged damage, supply actions and mythic charge synchronization.
- Browser: first/reopened/dismissed briefing, desktop/mobile scrolling, operator render, Season Career, training, inventory supply controls and real drag/drop, Kestrel free look, boss bars and loot. Screenshots captured in CI.
- Published gate: matching exact frontend/relay commit + version/protocol/history, season art, four private mode variants/manual starts, public schedule enforcement, live browser UI.

The artwork establishes the visual direction. Browser characters are optimized procedural 3D models, not photoreal assets. Automated software-rendered browser FPS is not a hardware performance benchmark. Full live 48-human load and school Wi-Fi latency are not claimed by these tests.
