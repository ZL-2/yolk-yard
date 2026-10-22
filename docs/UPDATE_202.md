# Update 202 — Vehicle impacts and field fixes

Version 6.14.2 / protocol 74. Based on Update 201, 5b27e5992c2323e8c451e9365029a83549bc41c1.

- Shared vehicle hull probes drive movement, actual structural contacts and swept character hits. Both normal and boosted motion can ram. Damage increases with incoming speed, capped at 40 for ATVs and 50 for Kestrel. Launch strength scales with speed. A 0.75-second per-target authority cooldown prevents rapid duplicate hits; riders, teammates, stationary/departing contacts and targets behind solid cover are excluded. Vehicle launch fall protection remains intentional; ordinary falls use the usual fall rules.
- Structural damage occurs before collision damping and only on hull contacts. Normal-speed impact damage scales up to 250/300 for ATV/Kestrel; boost scales up to 800/900. Fast boosted impacts can destroy a completed metal build and continue through the opening in the same swept movement step. Surviving obstructions still stop the craft. Multiple collision fragments belonging to one structure are deduplicated. Protected world pieces retain immunity. Guests predict the same hull against their latest world; only authority destroys structures and applies damage, with normal snapshot reconciliation.
- Boss and henchman fall damage now bypasses shield, matching contestants. Distant sentinels do not sleep while falling, while a landing is pending, or after losing their floor. This uses nearby collision queries and retains the existing distant-guard pacing while supported.
- A shared breakability predicate gates world damage, bot harvesting, stuck-bot breaches and retained tasks. Bots can still pickaxe breakable cover but abandon protected targets and resume route planning.
- The flight deck terrain is graded 0.32 m below its walking surface throughout the apron, including border triangles. The deck markings sit above the collision deck with an explicit polygon offset. Building pads, loot and helicopter spawn remain aligned.
- Twin orange/blue exhaust flames animate from the modeled Kestrel nozzles during boost and stop on engine failure. Two shared mesh batches add no particles, dynamic lights or per-frame geometry allocations.
- ATV passengers use the same weapon-camera path as helicopter passengers. Selected perspective, optic transition, aim and shot origins agree between authority and guest prediction; the HUD exposes the aim/scope binding.

## Reference and attribution

Epic's [v6.10 patch notes](https://www.fortnite.com/patch-notes/v6-10), Gameplay / Quadcrasher, document boost through buildings and launching players on impact. Epic's [Hammerhead Choppa device documentation](https://dev.epicgames.com/documentation/fortnite/using-hammerhead-choppa-spawner-devices-in-fortnite) documents squad transport and configurable health/fuel, but does not publish an exact collision-damage curve for the classic Choppa. The numbers above are explicit Ravel Front tuning, not a claim of identical unpublished Fortnite internals. Existing normal/boost vehicle speeds remain unchanged from Update 199.

All new code, geometry and exhaust effects are original procedural work. No external assets or dependencies were added; existing procedural model/effects credits apply.

## Focused verification

New regressions exercise ordinary/boosted rams, launch and cooldown, friendly/cover exclusion, completed-metal breakthrough, protected objects, real NPC falling, full-apron terrain clearance, stuck-bot decisions, passenger prediction/camera agreement and exhaust state. Existing vehicle, perspective, building, bot and snapshot contracts cover the touched shared paths. Desktop keyboard/mouse scenarios cover ATV boarding, seat switching, both scope perspectives, helipad appearance and exhaust rendering. A three-client WebSocket scenario covers remote ATV rams, passenger aiming, helicopter wall breakthrough and replicated impact damage. Production build and the existing live release gate remain required. No mobile work or unrelated mode sweeps.
