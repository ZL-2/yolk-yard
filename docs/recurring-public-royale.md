# Quality Update 110 — One Public Frontier

Version 3.8.1 / gameplay protocol 30. Quality Update 111 completes live hosting verification for this release.

The relay creates exactly one server-owned Solo Royale room at boot. Its 48 contestant seats start as Intermediate bots. Every admitted human replaces one bot, with no additional public-room creation or workload-based bot trimming. The full 45-second Spawn Island window remains open even when every seat is human. The server repeats that window if no connected human contestant is present at departure. A ticket issued before the cutoff cannot admit a late-arriving contestant after departure.

After departure, the lobby offers Spectate. Public spectators have no combat, inventory, harvesting or building authority. They enter the next Spawn Island when a contestant seat is available. Friend spectators retain their deliberate observer role across rounds. A ready party can enter the public Solo match together, as independent opponents. Its private-mode selection is preserved.

Results remain visible for ten seconds before the server creates the next round, fills bot seats and starts a fresh 45-second window. The room survives the last player's departure, has no human room leader, and rejects client configuration, visibility, start and kick commands.

The lobby receives a compact summary over its existing social connection once per second. Counts separate connected human contestants from bots and late spectators. Join availability is advisory; server admission checks the current phase and seat reservations again. Remaining time is an estimate from the actual storm schedule plus a twenty-second final-storm allowance, rather than a guaranteed ending time. The server skips idle warmup bot movement when nobody can observe the room, while keeping the authoritative countdown and preparing the battle map.

Free For All and Royale Solo/Duos/Squads custom matches all run on the player host. Every one opens its room-code and manual Start Match screen after loading. Code joins, host migration, bot teammate follow/revives/materials and centralized weapon balance remain. The bottom-left lobby panel contains only Custom Private Match. Team Scramble is no longer selectable or accepted by matchmaking; archived Career records remain.

Shared contestant/human limits are 48, with sixteen additional spectator connections. Snapshot and verified progression limits cover the full 64-row roster. Public progression retains the existing activity requirements and economy, including its controlled population reward scale. Player-hosted games retain their existing no-verified-Marks behavior.

Essential verification: recurring timer/reset/cutoff/restart, all 48 human replacements, party reservations, spectator isolation, room ownership and persistence, 64-row wire encoding, public progression identity, retained teammate behavior, desktop/mobile card placement, private code joins and manual starts in all four remaining mode variants. CI also checks the published frontend and relay build together and exercises live admission and private hosting.
