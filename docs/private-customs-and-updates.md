# Private customs, friend spectating and coordinated updates

Version 3.5.0 / gameplay protocol 28. Published update numbers are assigned by the release history.

## Match ownership

Custom matches are always private. The leader's browser runs simulation, bots and combat; the existing relay transports messages, authenticates party admission and provides invite-code rendezvous. These matches create no server simulation room or workload reservation. Host migration continues between connected contestants. Friend spectators cannot become a host. Host performance and connectivity therefore affect custom matches. Keep the host tab open. Private host results do not award verified Marks or career progression.

Public FFA and Team Scramble fill the existing compatible arena before creating another. Connected real contestant counts come from the authority roster, with unclaimed party tickets reserving seats. Bots and friend spectators do not count toward the eight real seats. Concurrent queues join a pending launch; cancelling its creator cancels the waiting reservations immediately. If a party is larger than the remaining seats, matchmaking explains the wait instead of opening a partly filled second arena. Public arena results restart after ten seconds.

Public Royale retains the existing phase cutoff and server workload gates. In Fill Duos/Squads, human teammates get warmup priority. At departure, existing bots take the missing team positions; additional bots may be created within the contestant and workload limits. No Fill keeps the invited party alone. Teams, slots, drops and revival behavior use the shared team simulation.

## Friends and UI

Accepted, unblocked friends with a live match expose Spectate Friend in Social. Admission is checked again when connecting. The watcher joins as a permanent spectator, including before the match starts, without displacing contestants or bots. Spectators cannot enter, respawn, attack, drop items or earn rewards. The watched friend's player ID is retained across snapshots and host migration. Both public and private matches support up to eight spectators, subject to public server workload limits.

SETTINGS appears beside the gear wherever the adjacent SOCIAL label is visible. Royale downed notices name only the local player's teammate.

## Publishing lifecycle

The current Render persistent-disk service requires a relay restart during a deployment; active matches cannot be guaranteed to survive it. The full-screen Updating view covers coordinated releases instead. It blocks play until the frontend and relay report the exact same published commit and application version and Social storage is available.

The relay checks main's package version and the deployed Pages version every ten seconds. Versioned changes announce updating before deployment, while shutdown also announces it. A small durable deployment latch survives the relay restart. Browsers receive the announcement on gameplay and Social sockets and poll `/deployment` every four seconds. A pending browser session restores the screen after reload. Failed network probes never clear an announced update. There is no timeout that hides it. Once both published builds match, an old browser reloads automatically.

Future coordinated releases must continue bumping the application version. Cached clients from before version 3.5.0 need one refresh to acquire this screen. This release changes no service plan, disk, environment secrets or billing settings.

## Verification

`npm run test:private-social` exercises real sockets for private party hosts, friend admission, spectator actions and migration, public arena consolidation, launch cancellation, bot teammate commitment, Social persistence and authoritative gameplay. Capacity and performance checks run separately. `node scripts/private-social-browser-check.mjs` starts its relay, Vite and two browser contexts together and verifies the actual party creation, spectating and update screen flows. CI runs these checks for `[private-social]` releases before publishing Pages.
