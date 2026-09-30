# Persistent gameplay relay

Protocol 21 also owns the actual online Simulation/RoyaleSimulation instances.
Browsers submit bounded input and interaction intent, including the room leader.
Clients cannot publish authoritative combat snapshots or reward frames. The
server validates stance movement, hits, DBNO, revives and private Duo markers.
Room leadership transfer does not move simulation into a browser. Use
`npm run test:field` for the current authority and feature release checks.

Replaces the D1-polling relay with **one persistent Node process**, direct WebSocket delivery, bounded queues, public/private listings, authenticated 10-second resume windows, and sequenced replay in both directions. No game data is written to a database. Client recovery lasts 8 seconds, then normal host-transfer/error handling resumes.

## Deploy

Use a host supporting a continuously running Node 24 process and HTTPS/WebSockets. Build with `server/realtime/Dockerfile` (repository root as build context), or run `npm ci --omit=dev` then `npm run start:relay`. Set `PORT` to the provider's assigned port. Set `ALLOWED_ORIGINS=https://zl-2.github.io` (comma-separated exact origins if needed). Use one instance: independent replicas do not share rooms. `/health` returns `yolk-realtime-v2`; `/game` is the WebSocket endpoint. Do not use a static host, request-scoped serverless function, or idle-sleeping service.

Before switching, run `YOLK_RELAY_URL=wss://YOUR-HOST/game node scripts/relay-live-check.mjs`, then test two real school computers in both modes for several minutes. Change `public/network-config.js` to the verified endpoint and update the live-check endpoint in `.github/workflows/pages.yml` in the same commit. The original endpoint is retained until the new server is hosted and verified. GitHub Pages cannot run this server.

`npm run test:realtime` runs real Arena and Royale simulations, room discovery, late join, 16-player capacity, host transfer, forced socket interruption, and 65 seconds of sustained gameplay per mode. `RELAY_SOAK_MS` changes only the sustained phase. Local checks do not establish latency on school Wi-Fi.

Server restarts lose rooms; reconnect recovery covers transient socket/network failures within the same process. No user login is added. Origin checks restrict browser use but are not user authentication. This private-alpha service targets modest player counts; multiple instances require a shared routing/room-owner architecture.

## Social, parties and match teams (protocol 23)

`/social` authenticates a durable browser identity using a random 256-bit private
credential stored in localStorage; the server stores its SHA-256 hash. A separate
50-bit, collision-checked public Friend Code allows case-insensitive lookup and
never grants access. Tabs sharing a browser identity consolidate into one online
player. This is a device identity, not an account with cross-device recovery.

Friendships, requests, block relationships, display profiles and public codes are
stored in synced schema-versioned primary/backup files. An explicit
`RAVEL_SOCIAL_DATA_PATH` takes precedence. Otherwise, a verified mounted disk at
`/var/data/ravelfront` selects `social.json` there; without it, the legacy owner-file
sibling or `/tmp/ravelfront-social.json` remains ephemeral on Render. Paid compute
does not attach this disk. See `docs/social-storage.md` for the approved migration
order and no-overwrite utility before deploying over temporary social data.
Clearing browser site data loses access to that device identity. Unknown saved
credentials now stay saved and are refused instead of being silently reset; Social
offers retry or an explicitly confirmed new code. Corruption can recover a valid
backup, while unreadable or newer snapshots cannot initialize an empty replacement.
Friend-action success and identity handshakes follow completed persistence. No
secrets, IPs or private match identifiers are exposed in social lookup cards. Health
reports actual mount durability, social availability, social revision and party limit.

Presence is centralized in PartyService, combining authenticated socket heartbeats,
server-owned party state and claimed match peer/contestant state. Browser and
native WebSocket heartbeats run every 15 seconds (native pong keeps background
tabs alive even when JavaScript timers are throttled); unresponsive social sockets expire after 45 seconds. Membership
gets a 30-second reconnection grace, then roster cleanup/leadership transfer selects
the first connected member. Live game sockets retain the existing 10-second relay
resume window and keep their authoritative team. Persistent relationships survive
ephemeral party and match cleanup. A second tab cannot clear another tab's match.

Parties contain up to four members. Mode, Fill, readiness, leadership, invites,
removal and seat reservations are validated server-side. Invites expire in 60
seconds. Requests reconcile crossed submissions into one friendship. Blocking
removes friendship/pending requests and prevents invitations and online discovery;
it does not alter an already active match. Social browse is paginated (25 entries),
with action-specific rate limits. Party removal and leaving never disconnect the
website or unfriend the member.

Match teams are contestant records with stable team IDs and numbered member slots,
separate from lobby party IDs. Premade sizes reserve team seats, human Fill only
joins compatible human teams, and bots fill other match-level teams. Solo/Duos/
Squads have sizes 1/2/4. Squad survival supports multiple DBNO and independent
revives, squad wipes, team placement/victory and teammate-priority spectating.
Markers are recipient-filtered, private to teams, expire, and permit at most three
pings per player in six seconds with an 800ms minimum gap. Snapshot cadence, sparse
world deltas, bounded catch-up and socket backpressure remain unchanged.

Run `node scripts/social-squads-check.mjs` and
`node scripts/social-squads-browser-check.mjs` for the focused release checks.


## Performance incidents and owner email monitoring

`GET /status` provides a cache-disabled, CORS-readable feed of current incidents
and the last 100 incidents from seven days. It exposes predefined messages and
start/detection/end timestamps, never player names, session credentials or room
codes. Confirmed incidents retain their start time through lobby refreshes.
Numeric, rate-limited reports are accepted only from connected match members.
Client-reported low FPS or update delays are labeled as reports rather than as
proof of a server fault. Server CPU incidents use recent kernel counter deltas.

Problems must persist for 15 seconds; notices clear after 60 seconds without
further evidence. Client reports expire after 45 seconds of silence. A cleared
notice means the problem is no longer being observed, not a claim that a repair
was deployed. The public lobby asks players to allow the team time to restore
smooth gameplay.

Incident history is stored in `RAVEL_STATUS_PATH` (default
`/tmp/ravelfront-status.json`). This survives ordinary process restarts in the
same filesystem but Render's ephemeral filesystem can be wiped by redeploys.
No paid disk is provisioned automatically. For durable history, set that variable
to an already-provisioned persistent mount.

Owner email alerts are a separate hourly ChatGPT monitoring automation using the
connected Resend account. Recipient and sender are held in its private task, not
in browser code or this public endpoint. It checks active incidents and recent
history, deduplicates against sent email subjects, and uses incident idempotency
keys. Email can arrive up to an hour after detection. A complete outage is checked
externally by the automation; a sleeping free service is given a cold-start retry
before being classified as unavailable. The server itself does not contain a
Resend credential or send emails. Deploys that erase incident history between
checks can prevent short resolved incidents from being emailed.


## Public reopening

The client now opens the public lobby directly. Game and Social WebSockets default to public access with the existing origin, version, identity, rate and authority checks. Owner endpoints still require owner authentication. An explicit `RAVEL_MAINTENANCE=true` restores the server maintenance gate if needed; normal operation leaves it unset or false. The Render $7 instance was verified active (0.5 CPU / 512 MB). Runtime CPU monitoring reads the actual container allowance without a plan-specific code change. Keep one instance because live matches and parties are held in memory; independent instances would need coordinated routing and shared state. Paid compute does not make ephemeral files durable.


### Shared lobby clock
The lobby renders only `/status.notice`, scoped `widespread`. Its ID and `startedAt` are server-owned and retained until every confirmed issue recovers, including transitions between issue types. Browsers estimate current server time using a monotonic clock and half of the polling round-trip time; device wall-clock changes cannot restart or shift an incident. Clients resync every five seconds (small network-latency differences remain possible). One player’s measurements or failed fetch cannot create a shared notice. Player reports require at least three affected reporting peers across two matches, representing at least 50% of fresh reports. Server-side CPU/delay observations do not require a player quorum. Existing ephemeral-file durability limits still apply.


## Coastal arena revision
Protocol 24 / version 3.3.0 rebuilds every FFA/Team Scramble arena. Saved IDs (`yard`, `depot`, `courtyard`) resolve to Aster Relay, Breakwater Docks and Ironwake Foundry. Both server physics and client visuals consume the same immutable `ravel-arenas.js` solids. Real-socket checks cover all six map/mode combinations, and navigation checks verify bases and pickups from both sides. Frontier scenery bakes vertex-coloured static geometry into one opaque mesh per arena plus signage; the lobby reuses four batched road sections with the existing patrol distance. Royale gameplay and its terrain are unchanged.
