# Private customs, friend spectating and coordinated updates

Version 3.7.0 / gameplay protocol 29. Published update numbers are assigned by the release history.

## Match ownership

All Royale matches and Custom Private Matches run on the player host and are private. Royale's PLAY button creates a new room for the ready party instead of searching public matches. The leader's browser runs simulation, bots and combat; the existing relay transports messages, authenticates party admission and provides invite-code rendezvous. These matches create no server simulation room or workload reservation. Code joins and host migration continue between connected contestants. Friend spectators cannot become a host. Keep the host tab open. Hosted results retain the existing rule: no verified Marks or career progression from unchecked host-reported outcomes.

Public FFA and Team Scramble fill the existing compatible arena before creating another. Connected real contestant counts come from the authority roster, with unclaimed party tickets reserving seats. Bots and friend spectators do not count toward the eight real seats. Concurrent queues join a pending launch; cancelling its creator cancels the waiting reservations immediately. If a party is larger than the remaining seats, matchmaking explains the wait instead of opening a partly filled second arena. Public arena results restart after ten seconds.

Royale retains the Spawn Island/departure cutoff: code arrivals after departure spectate. In Fill Duos/Squads, human teammates get warmup priority. At departure, bots take missing team positions within the configured contestant limit. No Fill keeps the invited party alone. Server authority rejects Royale and private simulation even through direct room requests, and public arena settings cannot change to Royale. Capacity warnings suggest player-hosted Custom Private Match.

Private FFA and Team Scramble stop in the room lobby after loading. Party readiness acknowledges arrival without automatically starting those rounds. Both host and code guests see the room code; only the host starts the match. Public arenas retain automatic start. Custom Private Match shares the primary button's dimensions and visual styling without overlapping loadout controls on mobile.

## Bot teammates

`ROYALE_TEAM_BOT` in `src/bot-config.js` centralizes squad spacing and material goals. Bots keep a persistent active human teammate as their anchor, follow an approximately eight-unit offset, regroup beyond 28 units, and restrict loot to 24 units and combat destinations to 42 units from the anchor. Immediate danger and storm escape still matter. Human air drops update the bots' landing goal.

Rescue is checked before cached tactical input. Downed humans are selected before downed bots, and combat, reloading and item use stop during rescue. Downed bots crawl toward a teammate until within four units, then remain still; an active reviver also freezes them. The ordinary ten-second, line-of-sight revive applies, with the same damage interruption and 30-health result.

Bots value material pickups until 180 of a type and proactively harvest until 300 total, using reachable nearby props within 20 units. Wood, brick and metal come from actual pickaxe hits and the existing yields. No materials or combat advantages are granted directly.

## Friends and UI

Accepted, unblocked friends with a live match expose Spectate Friend in Social. Admission is checked again when connecting. The watcher joins as a permanent spectator, including before the match starts, without displacing contestants or bots. Spectators cannot enter, respawn, attack, drop items or earn rewards. The watched friend's player ID is retained across snapshots and host migration. Both public and private matches support up to eight spectators, subject to public server workload limits.

SETTINGS appears beside the gear wherever the adjacent SOCIAL label is visible. Royale downed notices name only the local player's teammate.

## Publishing lifecycle

The current Render persistent-disk service requires a relay restart during a deployment; active matches cannot be guaranteed to survive it. The full-screen Updating view covers coordinated releases instead. It blocks play until the frontend and relay report the exact same published commit and application version and Social storage is available.

The relay checks main's package version and the deployed Pages version every ten seconds. Versioned changes announce updating before deployment, while shutdown also announces it. A small durable deployment latch survives the relay restart. Browsers receive the announcement on gameplay and Social sockets and poll `/deployment` every four seconds. A pending browser session restores the screen after reload. Failed network probes never clear an announced update. There is no timeout that hides it. Once both published builds match, an old browser reloads automatically.

Future coordinated releases must continue bumping the application version. Cached clients from before version 3.5.0 need one refresh to acquire this screen. This release changes no service plan, disk, environment secrets or billing settings.

## Verification

`npm run test:host-royale` checks actual follow movement, complete human/bot revives, normal wood/brick/metal harvesting, real party/code sockets under server capacity, public arena authority, and browser flows for Royale PLAY and private arena loading/start screens. The browser checker verifies identical primary buttons at desktop and mobile widths. CI runs this focused suite for `[host-royale]` releases before publishing Pages, then verifies matching live builds, live Royale party hosting and live private arena code/start flows. The broader private-social suite remains available for Social changes.
