# Ravelfront

[Play Ravelfront](https://zl-2.github.io/yolk-yard/) — an original browser multiplayer shooter set on Ravel Coast, a storm-struck communications frontier. The existing deployment address stays stable so players keep their browser profiles and saved collections.

Choose Frontier Royale Solo or Duos, Free for All, or Team Scramble. The lobby supports parties, invitations, public matchmaking and configurable custom rooms. Royale supports 32 contestants, up to 16 connected humans, with four separate spectator positions. Arena modes support eight contestants. Human players replace fill bots.

Online Spawn Island lasts **30 authoritative seconds**, with early departure when the configured human capacity is genuinely full. Humans and bots spread across Relay Cay. The Kestrel tiltrotor carries contestants to the 512 × 512 Ravel Coast, with nine districts, smaller landmarks, connected buildings, loot, harvesting, building and editing. Late arrivals spectate. Offline development practice uses its existing ten-second warmup and awards no currency.

Human operators use original sculpted skinned meshes, shared 32-bone anatomical rigs, blended locomotion/action states and analytic hand/foot IK. Outfits never alter head/body combat regions or movement dimensions. The Outfitter offers 84 original cosmetics across outfits, tools, wraps, back equipment, gliders and dive trails. Locker inspection shows the complete equipped operator and actual slot previews.

**Marks** replace the previous currency at **1:1**. Existing item IDs map one-to-one to replacement cosmetics at unchanged prices. Browser profile, balances, ownership, settings, keybinds and historical statistics retain their existing storage keys. No real-money transactions, account requirement or cross-device synchronization.

Online rewards are calculated and settled by the persistent relay. Meaningful participation, legitimate opposition, bot difficulty, population, placement, victory, eliminations and assists determine a capped budget. Custom matches are reduced; brief matches, AFK participation and repetitive elimination trading do not receive normal rewards. Active contestants receive an inactivity warning at 12 seconds remaining and removal after 59 seconds without meaningful input. Loading, transport, recovery and eliminated spectators are exempt.

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
