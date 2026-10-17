# Update 172 — Field Repair

Version 5.18.0. Desktop gameplay, presentation and lobby repairs. Protocol 58 remains compatible. No mobile work or new voice service is included.

## Gameplay defects and fixes

- **Arena camera:** a stale Royale `buildMap` made camera collision use coastal terrain inside Arena. Both chase and spectator camera paths now resolve the active map. A sensible world-camera near plane also improves depth precision.
- **Last human death:** the recurring Royale reset treated an eliminated, connected human as an abandoned round. The reset now distinguishes a spectator from a disconnected participant. Death presentation and killer spectating continue until the round finishes.
- **Crouch jump:** a fresh jump press while crouched consumes the press to stand, including toggle crouch. A second press jumps; blocked ceilings still prevent standing.
- **Storm bots:** escape takes priority over cached healing, combat, building and reviving. After reaching safety, critically damaged bots prioritize recovery. Stuck navigation can identify and pickaxe nearby destructible obstructions.
- **Terrain contact:** grounded feet sample the actual terrain beneath their soles. ATV support uses all four wheels with pitch and roll, and riders follow the same vehicle transform.
- **Arena parties:** real socket tests cover a complete four-person party entering both public and private FFA, including replacing fill bots without exceeding capacity.

## Presentation

- **Spawned operator legs:** foot-contact history from the initial origin pose survived placement, teleportation and lobby scaling. The contact cache now resets on those changes so it cannot pull the legs toward the old world location. Regression coverage checks the first frames at distant map positions and scaled party positions.
- Reduced walk bob, roll, landing bounce and sway while keeping aiming and motion settings functional.
- Separate magazine, bullpup, pistol, bolt rifle, break-action, tube-fed, rocket and energy-cell reload mechanisms, using custom animation matched to the existing models. Magazine pivots rotate around the magazine itself; visible feed lips and rounds improve close-up detail. Reload completion and cancellation still follow the authoritative weapon clock.
- Rounded road corners, continuous markings and intersection masking. A 2048-pixel packed road control map improves definition at a bounded additional 4 MiB per active terrain.
- Duplicate static surfaces are removed during batching; decorative surfaces use a depth offset and stair nosings have physical clearance.
- Higher desktop resolution limits, antialiasing outside low quality, and sustained-load adaptation replace overly eager quality drops. Quality can recover after load falls.
- Three new Season One loading illustrations feature Ravelfront human operators. All boot and match-loading selections use the new art, with live loading text and progress controls preserved.

## Lobby and owner tools

- Top-center lobby chat offers universal lobby, party and private party-member channels. The relay validates identity, membership, blocks, message length and rate limits; histories expire and are bounded.
- Owner feature-request replies and completion notices persist in the social store. Only the submitting player receives or acknowledges them. Offline players receive unread notices after reconnecting. Notices wait for the lobby and avoid other modal or referral presentation.
- Voice-chat feasibility and remaining service requirements are documented in `VOICE_CHAT_RESEARCH.md`.

## Focused verification

Regression coverage includes actual party/chat sockets, private-message isolation, persistent acknowledgements, camera-map selection, crouch clearance, death/spectating continuity, storm intent, obstruction breaking, wheel contact, reload reset, terrain alignment and shader resource budgets. Desktop Chromium captures the actual lobby, notifications and Arena cameras plus rendered reloads, terrain and loading art. No mobile checks are added.

An isolated-process comparison against Update 171 on the same local runtime measured warmed terrain construction at 23.7 ms versus 146.3 ms (84% less), 12-character reload updates at 0.21 versus 0.28 ms, and 63-actor simulation p95 at 0.26 versus 0.47 ms. These are CPU fixture measurements, not claims about player hardware FPS. Cold terrain creation rose from 387 to 665 ms because the road texture has four times the texels; subsequent builds reuse cached data. Geometry remained 131,072 triangles / 3,853,056 vertex bytes; packed road data rose from 4 to 8 MiB. CI repeats the bounded comparison and saves machine-readable results.
