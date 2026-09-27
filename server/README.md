# Shared game and party relay

The active production service is `server/realtime/`, a persistent Node 24
WebSocket process. GitHub Pages serves the game; `public/network-config.js`
selects the existing Render relay. `/game` carries authoritative host gameplay
and `/social` owns lobby sessions, parties, invitations and admission tickets.

Build with `server/realtime/Dockerfile` from the repository root, or install
production dependencies and run `npm run start:relay`. The container includes
the shared profile moderation and match-option modules. Use one instance and
the exact allowed browser origin. Read [realtime deployment details](realtime/README.md)
before changing the service configuration.

`npm run test:realtime` checks actual WebSockets, Arena/Royale sessions, capacity,
host transfer, socket recovery and sustained delivery. `node scripts/party-duos-check.mjs`
checks real party admission, invitations, public/custom matchmaking, Duos and
host/non-host combat confirmation. The release workflow verifies the live
relay's protocol and party features before publishing the game.

`server/service/` and `npm run test:relay` retain the former D1 transport's
compatibility fixtures. They are not a second active lobby or party service.
Reconnect credentials are opaque bearer tokens; never log or publish them.
