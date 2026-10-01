# Ravelfront

[Play Ravelfront](https://zl-2.github.io/yolk-yard/) — an original browser multiplayer shooter set on Ravel Coast, a storm-struck communications frontier. The existing deployment address stays stable so players keep their browser profiles and saved collections.

Play the one recurring public Solo Frontier Royale, or create a player-hosted Custom Private Match in Free For All or Royale Solo, Duos or Squads. Team Scramble is retired. The lobby supports four-person parties, invitations and private room codes. All private matches wait at a manual Start Match screen after loading. Royale supports up to 48 contestants and sixteen separate spectators; Free For All supports eight contestants.

The server-owned recurring public match starts with **48 Intermediate bots**. Each joining human replaces one bot during the full **45-second Spawn Island** window. With no connected human at departure, the server resets that window to 45 seconds. After departure the lobby offers Spectate; connected public spectators enter the next warmup when seats are available. Results restart automatically after ten seconds. The top-center card shows real human count and estimated round time; the bottom-left panel has only Custom Private Match. Private Royale keeps its 30-second warmup after the host presses Start, with early departure when its human seats are full. Humans and bots spread across Relay Cay. The Kestrel tiltrotor carries contestants to the 512 × 512 Ravel Coast, with nine districts, smaller landmarks, connected buildings, loot, harvesting, building and editing. Late arrivals spectate. Offline development practice uses its existing ten-second warmup and awards no currency.

Human operators use original sculpted skinned meshes, shared 32-bone anatomical rigs, blended locomotion/action states and analytic hand/foot IK. Outfits never alter head/body combat regions or movement dimensions. The Outfitter offers 84 original cosmetics across outfits, tools, wraps, back equipment, gliders and dive trails. Locker inspection shows the complete equipped operator and actual slot previews.

**Marks** replace the previous currency at **1:1**. Existing item IDs map one-to-one to replacement cosmetics at unchanged prices. Browser profile, balances, ownership, settings, keybinds and historical statistics retain their existing storage keys. No real-money transactions, account requirement or cross-device synchronization.

Rewards for the recurring public match are calculated and settled by the persistent relay. Meaningful participation, legitimate opposition, bot difficulty, population, placement, victory, eliminations and assists determine a capped budget. Player-hosted customs do not award verified Marks. Brief matches, AFK participation and repetitive elimination trading do not receive normal rewards. Active contestants receive an inactivity warning at 12 seconds remaining and removal after 59 seconds without meaningful input. Loading, transport, recovery and eliminated spectators are exempt.

## Development and deployment

```bash
npm ci
npm run dev -- --host 127.0.0.1
npm test
npm run test:relay
npm run test:realtime
npm run build
```

GitHub Actions tests the game and publishes `dist` to the existing Pages site. The persistent Node/WebSocket relay is a separate deployment using `server/realtime/Dockerfile`; frontend and relay protocol versions must agree. A successful frontend push alone does not verify the live game.

See [the rebrand implementation and verification notes](docs/RAVELFRONT.md), [relay operations](server/realtime/README.md), and [building reference](docs/BUILDING_REFERENCE.md).

The game uses Three.js (MIT), PeerJS (MIT, optional direct transport), WebSockets, and original procedural artwork and sounds. All source is in this repository. Browser WebGL2, keyboard/mouse and touch are supported. No camera or microphone is used.
