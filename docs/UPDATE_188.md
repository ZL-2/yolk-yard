# Update 188 — Persistent round rooms

Version 6.7.1 / protocol 69.

Public Box Fights and Zone Wars fill the busiest compatible room with capacity, without a room-age or round-stage cutoff. Player reservations, eliminated contestants and mid-round arrivals count toward capacity. New rooms open only when existing compatible rooms cannot fit the party. Box Fights team-size pools stay separate.

The same admission applies to normal Play and exact-room notification joins. Mid-round arrivals are contestants waiting to spawn, not permanent friend spectators. Preparation, combat, intermission and results preserve their place; the next round supplies fresh health and gear. Waiting entrants are excluded from rewards until they actually play. Checkpoints retain their waiting state.

A temporarily recovering host keeps its room and queued entrants. A fresh host state dispatches them once recovery completes, rather than creating a parallel room. Existing timeout/cancel behavior remains available.

Focused coverage includes old rooms, all stages, reservations, full-room overflow, reopened slots, observers, recovery, actual Play/notification sockets and automatic next-round spawning. Desktop deployment checks retained; no mobile changes.
