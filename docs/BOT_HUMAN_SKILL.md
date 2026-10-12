# Human execution for bots — Quality Update 143

Intermediate bots previously reduced their configured aim error to 36%, then
halved it again for precision weapons. Execution extrapolated observed target
velocity through the exact observation age. Deliberately slow trigger pulls let
weapon recoil and bloom recover, and native three-round bursts bypassed that
trigger pacing. A Rare burst rifle could therefore apply 102 body damage in
approximately 167 ms when its rounds connected.

The execution model now has ordinary reaction time, physical aim error at close
range, partial rather than exact motion anticipation, and held observations that
take time to correct after a reversal. Scopes improve angular accuracy modestly
without eliminating physical aim error. Intermediate acquisition takes at least
0.78 seconds; high-impact initial handling takes at least 1.35 seconds before
identity variation. Damage causes a 0.36-second flinch at most once per 0.9 seconds.

Each Intermediate bot burst follow-up takes at least 0.28 seconds. It therefore
needs at least 0.56 seconds between the first and third rounds, and loses pending
rounds if damage disrupts it or it loses a valid firing intent. This alters bot
execution only. Player damage, normal player bursts, rarity stats, hitboxes, and
actual world collision remain authoritative. A legitimate high-damage hit can
still eliminate an unshielded player; the fix makes those hits less automatic.

The four-job/2.5 ms tactical budget, sight-ray limits, pathfinding work, and network
rate are unchanged. Aim tracking keeps scalar values and reuses its result object.
There are no additional world searches, target histories, or network packets.

Validation: `npm run test:bots`, the ordinary full regression suite,
`BOT_VALIDATE=1 node scripts/bot-behavior-check.mjs`, and publication gates.
CPU workload timings are comparison evidence, not a guarantee of FPS or network
latency on every device.
