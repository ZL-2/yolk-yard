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
stored atomically in `RAVEL_SOCIAL_DATA_PATH`. Set this to a file on a persistent
volume. If unset, it uses a sibling of `YOLK_OWNER_DATA_PATH`, or
`/tmp/ravelfront-social.json`; an ephemeral container filesystem cannot preserve
relationships through service replacement. Clearing browser site data also loses
access to that device identity. No secrets, IPs or private match identifiers are
exposed in social lookup cards. Health advertises social revision and party limit.

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
