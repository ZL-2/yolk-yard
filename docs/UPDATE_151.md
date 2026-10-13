# Update 151 — Sentinels & Steadier Matches

Version 5.8.0 · protocol 51.

- Four sentinels accompany each boss. Their uniforms follow the boss palette
  and helmet or hood, with distinct guard geometry. Each carries an Uncommon
  Service Rifle, has 100 health and 25 shield, and fires short staggered bursts.
  Guards share sight, hearing, suspicion markers and spatial voice clips, with
  a district voice budget. They carry no boss abilities or keycards and grant
  no contestant, placement or leaderboard credit. Rifle and ammunition drop once.
- A shared district check lets distant guards sleep. Their active movement uses
  staggered 10 Hz updates while players keep their existing 60 Hz simulation.
  Guard state, damage, loot,
  perception and voice schedules survive snapshots and host restoration.
- The uplink capture HUD appears at the top center when the server lists the
  operator inside the capture area. It distinguishes capture, contested progress
  and clearing an enemy signal. The operations panel moves to the left, away
  from building controls; narrow viewports reserve space below the minimap.
- Spawn Island displays connected human contestant names and the actual count.
  Bot fills, spectators and NPCs cannot inflate it. Human departures use their
  original name in the “checked out” feed. Royale hides arena streak notices.
- Presence uses separate icons and colors for Away, In Lobby, In Match,
  matchmaking, spectating, reconnecting and offline. Actual public contestant
  arrivals produce a bold lobby notification and join action. Initial status
  sync, repeated admissions, bot fills and spectator entries remain quiet.
- A host that leaves sends a final checkpoint. A failed candidate connection
  advances the election immediately. A visible reconnecting or host-waiting
  banner explains recovery and clears once updates resume. Existing host leases
  still protect against competing hosts during a slow frame or brief reconnect.
- Pending snapshots retain exact queue measurements but share sizing and
  normalization across recipients. Delta baselines and event cursors remain
  independent. The focused local benchmark measured about 10% less transport
  CPU work with two players and 41% less with three; this does not measure or
  guarantee device FPS or Internet ping.
- Owner feedback tickets can be cleared from the active inbox. The choice
  persists after restart. A separate Cleared view permits explicit restoration
  while keeping all original ticket content and existing owner authentication.

Validation covers guard counts and loadouts, support and hitbox-compatible
geometry, sleep and awareness, single loot drops, NPC restoration, truthful
rosters, original departure names, status escaping, exact snapshot sizes,
independent delta decoding, stale candidate recovery and durable ticket clearing.
Real socket checks cover three players, brief reconnects, graceful and abrupt
handoffs, world transactions, inventory and authenticated public statistics.
Browser evidence covers the owner inbox, presence, arrivals, Spawn Island,
guard models, top-center capture progress, building clearance and recovery UI.
