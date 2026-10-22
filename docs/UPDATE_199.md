# Update 199 — Stormspike & Kestrel

Version 6.13.0, protocol 71. Desktop update; no mobile-specific changes or checks.

Stormspike uses one model factory for first-person, other players, world loot,
inventory and announcement art. `scripts/render-update-199.mjs` renders the two
actual gameplay models into transparent cutouts and the diagonal news poster.
The illustrated scenic background was generated separately with OpenAI tools.
The opening announcement replaces Voice Chat; voice remains in the carousel.
The third-person carousel story is removed. Camera settings remain available.

| Stormspike tier | Body | Head | Magazine | Reload | Direct build | Fuse burst |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rare (blue) | 58 | 92.8 | 4 | 3.4 s | 40 | 150 |
| Epic | 61 | 97.6 | 4 | 3.2 s | 42.07 | 157.76 |
| Legendary | 64 | 102.4 | 4 | 3.0 s | 44.14 | 165.52 |
| Nyx's Mythic | 67 | 107.2 | 4 | 2.8 s | 46.21 | 173.28 |

All tiers use heavy ammunition, 0.9-second shot intervals, 155 m/s projectiles,
300 m range and 1.6× headshots. Direct damage falls off after 85 m. The 1.15 s
burst damages its attached player build and up to four physically touching
neighbors at 55% strength. It does not perform a player explosion or propagate
through architecture. If the attached build is destroyed first, its spike is
removed. World spawns are Rare–Legendary, with no Common/Uncommon rolls, even at
an exact-zero RNG boundary. Nyx's guaranteed Mythic replaces her old Mythic DMR;
ordinary DMRs remain. Training uses the minimum legal tier.

Kestrel Forward Station is at (158, 74) between Voss and Rook. A flattened,
collision-backed apron, painted H, inset perimeter lamps, drainage channels,
barriers, floodlights, windsock, fuel cabinets, a signed hangar, two-storey
operations building and loot sockets form the area. One Kestrel spawns per
Ravel Coast match; it does not spawn on Spawn Island or in arena maps.

Kestrel has 1,500 HP and five seats: one pilot and four armed passengers. Main
and tail rotors spool up; throttle, hover, directional flight, altitude control,
burst boost/cooldown, fuel, pilot exposure, a 2.25× tail weak point, swept
collision, ramming, engine failure, crash explosion and fall damage on exit
are simulated by the authority and shared with guest prediction. No mounted
weapon or free glider on exit. Fuel is finite; no refueling interaction is
advertised. The station's cabinets are environmental dressing.

Desktop defaults: WASD movement and mouse heading; Left Mouse/Space ascend;
Right Mouse descend; Left Shift boost; Left Ctrl next empty seat; B loudspeaker;
hold E to exit. F boards. Passengers can aim, shoot and reload. All helicopter
bindings are configurable and context-separated from on-foot actions.

The helicopter follows the classic Fortnite transport design, not the newer
redeploy-enabled Hammerhead configuration. Documented references:
- https://www.fortnite.com/news/it-is-not-a-fortnite-helicopter-it-is-a-choppa
- https://dev.epicgames.com/documentation/fortnite/using-helicopter-spawner-devices-in-fortnite-creative

Epic's proprietary source, full tuning curves and sound assets were not supplied.
Exact parity is not asserted. Original tuning: 25 m/s cruise (90 km/h), 35 m/s
boost (126 km/h), 6 m/s climb/descent, 155 m world ceiling, 3-second rotor startup,
1.5-second boost with 5-second cooldown. Original Web Audio layers provide
pulsed rotor noise, turbine whine, airflow, warning tones and a four-note
loudspeaker. Position and rotor speed drive attenuation, pan and modulation.

ATV cruise is 8.5 m/s (previously 17), boost 15.5 m/s (previously 31), and reverse
3.5 m/s (previously 7). Acceleration and seat behavior are retained.

Settings now group identity, graphics/camera, audio volume, mouse, HUD,
accessibility, gameplay, social and categorized keybinds. Every existing row is
retained; unknown future rows get an explicit fallback instead of disappearing.
The Social category opens the existing voice-device/channel panel.

Credits & About derives the app and dependency versions from package.json.
`prebuild` regenerates all 13 production/transitive software license notices.
The shipped CREDITS.txt documents Kevin MacLeod, Adobe Mixamo, Quaternius,
artisticdude, existing user-supplied Fortnite recordings, original synthesis,
generated art and independently authored geometry. Supplied recording licenses
are accurately marked as unverified rather than being covered by game MIT.
Obsolete About claims about version 6.2.0 and 30-day analytics retention are
removed in favor of the actual current implementation.

Validation is limited to the changed desktop/gameplay paths: focused unit
contracts, existing ATV checks, a real three-socket flight/projectile test, a
desktop UI/gameplay pass and the production build. The existing unrelated vault
collision-removal assertion in frontier-145.test.js also fails on unchanged
ba077911; it is not used as evidence for this update. The release workflow
retains build and browser gates with a file-scoped update classification.
