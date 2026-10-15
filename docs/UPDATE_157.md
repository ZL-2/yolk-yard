# Update 157 — A New Perspective

Version 5.11.0, protocol 53.

Settings → Gameplay → Camera perspective offers First person (the default) and Third person, saved per browser and switchable during a match. Third person uses a right-shoulder camera with a closer aiming position. The boom sweeps against terrain, buildings and player builds, retracts immediately at obstructions, and recovers smoothly. Its near plane stays within the collision volume; the local body fades when space becomes too tight. Scopes use first-person optics and return to the selected perspective. Existing transport, diving, gliding, vehicle, downed, emote, spectator and victory cameras keep their appropriate contextual views.

The local operator uses the shared full-body rig: walk/run/strafe, sprint, crouch, slide, jump/fall, mantle, aiming/recoil, reload, swap, harvesting, blueprints, edit, healing and revive poses. Pelvis/chest counterrotation supports strafing, and a full-body throw gesture supplements the hand animation. The local model uses predicted movement, hides its own nameplate, and retains equipped cosmetics. First-person arms are suppressed in third person, including outgoing weapons during swaps.

The shared camera geometry feeds rendering, prediction and host authority. Reticle acquisition converges onto the physical weapon muzzle, with an additional body-side cover check. Seeing around cover does not permit firing through it. Build placement, harvesting, edit selection, edit-grid strokes, grappling and markers use the camera ray while preserving player-origin range and line-of-sight checks. Loot ranking uses the camera view, with player distance retained for interaction. Grenade and smoke previews use the same body-origin launch direction and collision physics as the actual projectiles. Camera blend and collision fractions are bounded remote inputs; clients cannot provide arbitrary camera origins or hit points. Snapshots and checkpoints preserve perspective through host migration.

The third illustrated briefing follows the Season 1 and Invite & Earn screens. It has an independent Do not show again preference and a permanent THIRD PERSON lobby button. Artwork is original AI-generated Ravel Front art.

The Hot Drop is the named POI closest to the Kestrel route's starting point, stable from the warmup map through departure. New default controls are Shift or right mouse to aim, Left Ctrl to sprint, Left Alt to crouch, and U for private host Start Now. Start Now is rebindable and works while pointer locked; the existing host, warmup and opposing-player rules still apply. Existing custom bindings are preserved; only the former default aim/sprint/crouch group migrates together.

## Research and design basis

Epic's public documentation describes the relevant behavior but does not publish the complete Battle Royale camera, animation graph or numerical tuning. This implementation recreates the documented interaction pattern with original Ravel Front tuning and assets. It does not claim an exact reproduction of proprietary Fortnite internals.

- [Orbit Camera devices](https://dev.epicgames.com/documentation/fortnite/using-orbit-camera-devices-in-fortnite-creative?lang=en-US): player-following orbit, camera distance and offsets, boom collision, crouching and camera transitions. These Creative settings establish the design principles, not exact Battle Royale constants.
- [Third Person Controls devices](https://dev.epicgames.com/documentation/fortnite/using-third-person-controls-devices-in-fortnite-creative?lang=en-US): camera-relative facing/movement, aiming behavior and line-of-sight requirements.
- [Fortnite Ecosystem v28.00](https://www.fortnite.com/news/fortnite-ecosystem-v28-00-update): standard third-person movement is tied to camera direction, with camera and control devices allowing alternate configurations.
- [First Person Camera devices](https://dev.epicgames.com/documentation/fortnite/using-first-person-camera-devices-in-fortnite-creative): contextual perspective transitions and compatibility across actions require explicit handling.

Original default shoulder tuning is 3.15 m back / 0.62 m right, aiming at 1.65 m / 0.48 m, with a 0.18 m swept camera radius. The first-person player capsule, hit regions and movement rules remain shared across views. Scoped optics intentionally return to the established first-person sight system.

## Focused validation and publication

Targeted tests cover camera collision at extreme pitch and under ceilings, default/special view transitions, close and distant reticle convergence, blocked shots behind shoulder-visible cover, build/edit reach, throwable preview parity, grappling, prediction/snapshots/checkpoints, control migration and route-based Hot Drops. Existing relevant combat, building, rig, keybind and remote-input checks run with them. Browser acceptance covers the three-screen introduction and its persistence, saved settings, host and guest third person, shoulder aim, crouch/sprint, scope transitions, building/utility presentation, keyboard host start and restoration of first person.

Publication is authorized while players are in matches. The release uses focused checks and verifies matching published website and relay versions after deployment.
