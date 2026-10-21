# Operation Blackglass — first playable mission

Version 6.11.0 / Update 197. The only application entry is **Owner Controls → Campaign lab → Open Blackglass**. Launch rechecks the existing server-authenticated owner session. It has no public mode, queue, room link, reward or leaderboard entry. The JavaScript and artwork are static website assets; this is an owner-gated application feature, not encrypted content distribution.

The player infiltrates Station Seven, cuts its security feed, clears the yard, breaches operations, recovers civilian evacuation routes from the archive, disables the uplink and extracts by helicopter. Five objectives, four encounter groups, 16 original patrol operators and a finite debrief. Difficulty, volume, device radio voice, resolution and sensitivity are configurable. Subtitles remain available without speech synthesis.

WASD move, mouse look, left click fire, right click aim, Shift sprint, C/Ctrl crouch, Space jump, R reload, 1/2 swap, hold E interact, G grenade, X dressing, F flashlight, N night vision, Escape pause. Health recovers after breaking contact. Cover blocks shots, enemy vision and blast damage. Crouching reduces detection. Enemies patrol, acquire targets and pursue with a shared navigation field.

The mission has separate original geometry, weapons, UI and sound presentation. It dynamically imports only after owner launch, pauses the existing lobby render loop, and disposes its scene, audio, listeners and GPU resources on exit. A party match launch closes it cleanly. Simulation and progress are local: relay lag does not drive this mission. Checkpoints capture objective progress and defeated patrol members; continuing reloads that checkpoint with a fresh field loadout. Storage failures retain an in-session checkpoint. A completed mission clears its checkpoint.

Performance work: static props merge by material and spatial section; repeated operators share mesh geometry; particles use a fixed pool; all pursuers reuse one navigation field; perception and HUD update at bounded rates; desktop rendering resolution is capped. No mobile controls or multiplayer systems were added to the campaign. This is a compact proof of a campaign, not a claim of AAA cinematic or photorealistic production parity. Procedural character animation and device-generated radio speech remain visible limitations.

## Artwork

`public/campaign/blackglass.webp` is original mission key art generated with the built-in image generation tool, then converted to WebP for delivery. It is used for briefing/owner presentation, not substituted for the playable 3D environment.

Prompt: “Atmospheric, highly realistic cinematic coastal relay station at night in heavy rain, an original setting for Operation Blackglass. A narrow asphalt service road leads between weathered concrete seawalls and a dark industrial compound toward a massive parabolic communications dish, antenna masts and a low operations building. Wet surfaces catch warm amber security lights, cool moonlight and the faint red mast beacon. Mountains and a dark rough sea beyond. Real-world human scale, credible brutalist architecture, cables, fences, puddles, restrained film grain. Photographic materials, moody desaturated steel blue and amber. Wide establishing shot; compound occupies the right half with darker negative space on the left. No text, logos, watermark, people or identifiable existing franchise assets.”

## Focused acceptance

`tests/campaign.test.js` covers save validation, restored patrol state, objective blockers, extraction timing, ballistic cover, collision substeps and owner entry integration. `scripts/campaign-browser.mjs` uses an isolated local owner service to exercise real login, expired-session rejection, pointer capture, movement, aiming, interaction, shooting, reload, pause, death/retry, every mission objective, ending and resource cleanup/reopen. Desktop screenshots are retained for visual review. Software-renderer timing is not treated as representative hardware performance.
