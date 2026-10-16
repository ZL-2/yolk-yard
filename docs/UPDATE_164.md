# Update 164 — Your Next Deployment

Version 5.15.0, protocol 58.

The lobby now follows the supplied reference: a cycling image news tile at top left, a bottom-left mode/options/Play stack, the party panel directly below the navigation on the right, and its leaderboard below it. Quality Update is in the footer; Request a Feature sits between Career and Marks. Briefings open from news instead of blocking every visit. The singleton public-match card and arrival banner are absent.

Mode discovery contains Frontier Royale, Free For All and solo offline Training. Box Fights, Zone Wars and Zombies are visibly disabled and marked Coming Soon. All seven new images use human Ravelfront operators; the rejected egg artwork is not included. Asset prompts and reference files are recorded in LOBBY_ART_164.json. Compressed project assets live in public/modes/.

Public Play reserves the whole party in the busiest compatible open room, counting pending tickets and disconnected members. Royale Solo, Duos, Squads and Arena are independent pools. Full rooms, departing rounds and rooms in recovery do not receive new queued contestants. New rooms receive unique reserved RF addresses. Friend spectating targets the friend's actual room. Public rules are fixed on the server; private settings persist through selection and launch.

Issues corrected:

- Singleton global host/state/reservations could not safely represent the newly requested multiple rooms. Every room now owns its membership, clock lease, admission and host election.
- A host-ready event could dispatch parties waiting in other public rooms; dispatch is now scoped by room code and idempotent.
- Admission and election could reuse global membership or tickets across public rooms. Room-bound credentials and membership prevent that.
- Temporarily disconnected members could disappear from capacity accounting; their seats remain held through reconnect grace.
- Private Royale capacity, bot count and fill were overwritten with 48/47/fill. User-selected private rules now survive.
- Parties could partly enter combat at a public departure cutoff. Incomplete parties spectate together and return for the following round.
- Arena lacked recurring round identity, restart timing and generic public-state publication. Public Arena now restarts after ten seconds and preserves its checkpoint identity and spectator roles.

Focused verification covers real socket concurrent admissions, separate pending hosts, room fill and overflow, multiple simultaneous rooms, cross-room ticket rejection, cancellation isolation, all Royale party sizes, private rules, fixed public rules, late parties, friend spectators, Arena restart, grace periods, host migration, six-player checkpoint congestion and existing reconnect regressions. Browser coverage exercises news, mode discovery, public/private forms, desktop layout, four-party readiness, actual browser hosting and a real relay guest reconnect. No simulation or infrastructure scaling is moved to Render.

Publication proceeds even if players are active, as explicitly requested. Remaining mobile checks were skipped.
