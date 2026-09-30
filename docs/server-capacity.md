# Ravelfront workload admission and simulation optimization

Quality Update 98 / version 3.4.5 / gameplay protocol 27. Server simulation stays authoritative. No hosting, disk, identity, or payment configuration changes are required.

## Admission policy

* Use the observed cgroup CPU allocation, capped at one core for this single-process server. Reserve 65% of that allocation for estimated match work. The current half-core service therefore has a 325 CPU-ms/s admission budget, leaving headroom for sockets, Social, persistence, GC and workload bursts.
* Weighted estimates: arena = 30 + 8 × humans + 11 × bots; Royale = 52 + 9 × humans + 7 × bots. Spectators reserve 4 units each. These are conservative local workload estimates, not certified hardware capacity or actual CPU readings.
* Reserve peak playing cost during lobby/warmup; results reserve 40% with a minimum 22-unit floor. Recheck before starts, rematches, mode changes and new arrivals. Existing contestants are never kicked or removed to make room.
* Sample actual process CPU and cgroup throttle deltas each second. Three seconds above 85% of the available core allocation or 20% throttled periods pauses additional workload. Five seconds of recovery reopens admission. Reservations in existing rooms can complete when their work is already included in the room budget; uncreated rooms still recheck current pressure.
* Public matchmaking prefers a compatible populated room. If a new public room cannot fit its normal fill, lower its initial server-owned bot limit, preserve human seats and retain enough opponents for the team format. Show an explicit bot-fill notice. Custom requests get an immediate capacity explanation instead of a 20-second initialization timeout.
* Party reservations are atomic and account for the whole party, including late spectator parties. Claims do not double-count members. Cancellation, expiry and an empty room release reserved capacity. Spectators cannot masquerade as bot replacements.
* RAVEL_CPU_BUDGET_MS can explicitly lower or tune the budget, capped at 90% of detected allocation. It is not needed for the existing service. Further hosting capacity increases still require measured validation.

## Optimizations

* SnapshotBatch normalizes shared players once per broadcast, shares object-pair comparisons between compatible baselines and serializes compatible state payloads once. Each recipient retains its own sequence, baseline, event cursor, private markers and backpressure state. Omitted world data remains in its immutable baseline. There is no quantization or loss of physics/combat values.
* Bot tactical inputs are staggered with four ordinary decisions per simulation tick per match. Arena combat planning runs at about 16.7 Hz and roaming at 10 Hz; Royale combat planning is about 6.25 Hz and roaming 4 Hz. New actors and damage interrupt the normal budget; repeated damage refresh is bounded to 80 ms. Movement, cooldowns, gravity and combat execution remain 60 Hz. Dead targets stop cached firing, and build/grenade pulses are not repeated on every physics tick.
* Navigation ray results are briefly reused only while actor/goal positions remain within 0.5 units and map geometry/revision stay unchanged. Weapon choice uses the central cached rarity stats and a single scoring pass. Perception skips already-consumed events and avoids teammate scoring allocations in Solo.
* The newer arena footwork, combat braking, two-player service notices and authenticated entrant activity tracking are preserved.

## Validation

Focused Node tests cover capacity, atomic/cancelled reservations, spectator costs, overload/recovery, immediate socket rejection, rematch/configuration rejection, exact/staggered snapshot reconstruction, private markers, independent baselines, backpressure, rate bursts, input clocks, bot scheduling/footwork, rewards, friend persistence and service notices. Real socket scripts cover Social/parties/Squads/reconnects and all eleven weapons. Production build succeeds.

Two older combat-overhaul roster fixtures already fail on the unmodified baseline because their admission objects omit the current teamSize contract. The focused command selects the relevant combat/perception tests; current party ticket and team survival integration checks remain enabled.

## Local capacity comparison

Baseline: Update 97, a1dda3958b873d4783bc2ef7335ec39590dd7eb2. Each server ran in its own child process with actual sockets; client CPU is excluded. Twelve-second measured samples follow setup. Damage work remains active but health/shield is replenished before accepted hits to keep the advertised population alive. Royale fixtures are moved to active play and supplied rifles. These are synthetic sustained-population fixtures, not ordinary match/drop/building gameplay or Render hardware benchmarks. Match/map loot seed and bot decisions can vary between runs. The local quota exposes multiple cores; two full rooms are used for measurement locally and are rejected by the separate half-core admission checks.

| Mode | Humans / bots per room | Rooms | Before CPU ms/s | After CPU ms/s | After updates/s |
|---|---:|---:|---:|---:|---:|
| idle | 0 / 0 | 0 | 9.0 | 8.4 | 0.0 |
| ffa | 2 / 0 | 1 | 66.1 | 63.7 | 20.1 |
| ffa | 2 / 6 | 1 | 105.4 | 97.0 | 20.0 |
| teams | 2 / 6 | 1 | 112.5 | 92.1 | 20.1 |
| royale | 2 / 30 | 1 | 305.8 | 292.2 | 20.0 |
| royale | 16 / 16 | 1 | 337.2 | 327.0 | 19.9 |
| royale | 2 / 30 | 2 | 492.4 | 491.2 | 20.0 |

The final short comparison shows about 36% less broadcast time with 16 human sockets (106.8 → 68.8 ms/s), 16% less bot-input time in the single 2-human/30-bot room (85.7 → 72.2 ms/s), and varied total CPU savings. Two full rooms still approach a half-core budget: admission protection is therefore essential, and optimization alone is not advertised as unlimited capacity. All measured active fixtures delivered approximately 20 updates/s without connection errors.

Run `npm run test:capacity` for focused checks. Run `npm run test:capacity-load` for local active load. Optional RAVEL_COMPARE_ROOT points to an unmodified source tree; RAVEL_CAPACITY_SECONDS controls sample duration, RAVEL_CAPACITY_CASE selects mode:humans:bots:rooms, and RAVEL_CAPACITY_OUTPUT saves raw JSON. Live verification uses one private room, closes all probe sockets and never bypasses admission.
