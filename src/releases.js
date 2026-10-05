export const RELEASE_NOTES = [
  {number:'136',title:'Shadowstep & Field Stability',changes:['Nyx drops her Mythic Shadowstep: three nine-metre directional dashes, one charge recharging every 12 seconds, a one-second activation cooldown, a brief break in bot targeting, collision sweeps, purple phase effects and audio. The item stays in your inventory and uses Jump Rig-style charge rings and countdowns. Nyx can also dash to evade attackers. No invulnerability or fall immunity.','Bots hold chest searches steady until completion, recover around blocked routes and use their pickaxe against a point-blank opponent when unarmed. Buildings have fewer, smaller windows and ground-floor entrances, reducing cross-building fire lanes and collision work.','Fixed terrain-following pulling players inside Nyx’s bunker floor. Lobby characters display an owned Victory Crown. A quiet lobby chime announces actual public-match arrivals, excluding bot fills and initial status refreshes. Boss-defeat banners appear only for the player who defeated that boss.','Removed the centered recording diagnostics, in-match emote button, hotbar Inventory/Map/Drop buttons and Build/Rotate/Edit/Repair buttons. Existing keybinds remain. Restored compact inventory label formatting.','Navigation preparation runs in small warmup slices; unchanged immutable loot records and their wire representations are reused between updates. Avoided redundant support scans at bus departure. Version 4.9.0 / protocol 42.']},
  {number:'135',title:'Boss Awareness & Voices',changes:['Commandant Voss, Marshal Rook and Lieutenant Nyx build visible suspicion, react to nearby gunfire and damage, pursue confirmed targets, search last-known positions, and return to patrol. Yellow question marks fill during detection and red exclamation marks indicate a confirmed threat. Names remain visible above each boss.','Twelve clips extracted from the supplied Foundation-henchman recording play during patrol, detection, combat, pursuit and weapon readiness, with distinct boss playback profiles, shuffled clip bags, cooldowns, priority interruption and overlap protection. Clip assignments are based on visible actions, not a verified speech transcription.','Boss voices pan from the character, fade with distance, and are muffled through solid scenery. They stop on death or leaving a match and never play on Spawn Island or the battle bus. One small voice atlas loads only near bosses.','Awareness and voice decisions run on the existing authority and survive host migration. Fortnite supplies the documented guard-state model; hearing ranges, cooldowns and probabilities are custom Ravelfront tuning, not claimed Battle Royale constants. Version 4.8.0 / protocol 41.']},
  {number:'134',title:'Public Match Lag Diagnostics',changes:['Large centered live diagnostics in official public matches show recent frame spikes, game-loop and render submission timings, snapshot processing, long tasks, draw calls, memory and network queues alongside server phase peaks and hosting throttle counters. F8 hides or shows the panel. Measurements stay local and exclude player identities.']},
  {number:'133',title:'Vaults, Grappler & Rarity Balance',changes:['Public Royale stays open 24/7. Crowns and crown progression work only in the official public match; private matches and Training preserve your saved record.','Rook grapples himself toward distant attackers. His Mythic Grappler fires a visible red plunger and rope, pulls toward a valid surface with swept collision, has unlimited uses and a 1.54-second cooldown. Valid/invalid aiming feedback, launch/latch/return audio and holding animations are shared across clients. It resets fall distance on latch, without granting a glider or permanent fall protection.','Rook’s nearby armored Harbor Hold and Nyx’s Nightglass forest bunker have independent keycards, readers, sealed gates, four chests, ammunition and shield barrels. Equipping each keycard guides you to its own vault.','Regular bots prioritize full health and shield after looting and fights, including collecting recovery supplies and making inventory room while retaining a gun. Immediate fights, rescue and urgent storm movement keep their priorities.','Weapon families use separate Fortnite reference damage, reload and magazine tables, plus matching relative recoil improvements and named-Mythic cadence benefits. Rook’s shotgun now deals 66 close-range body damage at Uncommon and 78 at Mythic, replacing the previous six-point gap. Reference versions are recorded with the tables.','Rare Chests use a 5% ambient upgrade chance, blue armored models and separate directional icons; vault Rare Chests remain guaranteed. Personalized Mythic names wrap fully in inventory and hotbar slots. Removed the in-match emote key hint. Existing collision, world streaming and snapshot optimizations remain. Version 4.7.0 / protocol 40.']},
  {number:'132',title:'Field Movement & Performance',changes:['Full inventories swap the selected slot with one press. Holding Use still searches chests and cannot repeatedly swap dropped equipment.','Landed bots prioritize a gun, engage nearby opponents once armed and continue looting when nobody is in range. Combat movement, distance-dependent aim error, acquisition time and longer burst pauses give opponents time to react.','All three bosses have independent map markers and accurate defeat/reward messages. Directional boss sound indicators use the supplied character icon with a transparent background.','Lobby messages display above menus and modal dialogs. Lobby emotes face the camera; in-game emotes start with the camera behind the character. Removed floating landmark/building names from the 3D world. Map names remain.','Faster collision queries, incremental loot indices, sleeping item physics, cached static world snapshots, shared loot geometry and bounded nearby model creation reduce CPU work and frame spikes. Version 4.6.0 / protocol 39.']},
  {number:'130',title:'Map Studio',changes:['Owner map editing now uses a Studio-style tool ribbon with Select, Move, Scale and Rotate, a Toolbox and a persistent Explorer above Properties.','WASD camera flight, Q/E elevation, right-drag look, Alt-right-drag orbit, middle-drag pan, adjustable speed and F focus. Number keys 1–4 switch tools.','Multi-selection, area selection, shared transform handles, direct selection dragging, copy/cut/paste, locking, configurable snapping and world/local axes. Batch edits undo together; drafts and published maps retain the existing format. Version 4.5.1 / protocol 38.']},
  {number:'128',title:'Owner Map Workshop',changes:['Owner Access now includes a visual map editor for all five maps. Place structures, vehicles, nature, loot chests and spawn points; move, rotate, resize, duplicate and remove existing scenery with handles or numeric controls.','Import embedded GLB models, preview solid collision with Test walk, undo and redo edits, recover browser autosaves, and export or import map files.','Server drafts and publishing are separate. Published layouts apply to new rounds and stay consistent across hosts, guests and host migration. Version 4.5.0 / protocol 38.']},
  {number:'127',title:'Crowns of the Coast',changes:['Marshal Rook commands a salvage ship at Breakwater Docks. Lieutenant Nyx guards the Sable Woods fire lookout. Three named bosses carry personalized Mythic weapons and drop mobility tools, keycards and supplies.','Victory Crowns carry into the next public match, drop on elimination, transfer through pickup and track crowned victories for the season. Crown Record unlocks after a crowned win. Saved crown records use the persistent server disk.','Field Salute, Coast Shuffle, Rally Cheer and the Crown Record display switch to third person; movement, combat, interaction and damage cancel the emote. Emotes are available from O and the lobby.','Ammo quantities appear on world pickup labels and inventory hover. Boss sound indicators use crowns; nearby gunfire uses a rifle silhouette. Sound indicators stay hidden on Spawn Island and aboard the battle bus. Removed the inventory drop-zone text. Version 4.4.0 / protocol 37.']},
 {number:'124',title:'Field Resupply',changes:['Five ammo reserves and eight breakable recovery barrels across Voss Vault, the docks supply room, quarry repair room and Sable field clinic. A raised command walkway restores front-door access over the vault stairs. Every chest includes 30 materials and an Uncommon-or-better gun; Epic Chest guarantees remain. Mini Shield spawns are always three and Shield Flask spawns always one.','Inventory fits without vertical scrolling, including inspection. Drag equipment anywhere left of the slots, including open space beyond the panel, to drop it; drag slot-to-slot to reorder. Full inventories require a deliberate 0.45-second hold to swap. Kestrel Jump Rig is labeled Mythic.','Directional sound arcs for footsteps, gunfire, explosives, gliders and chest hum default on, with a saved Audio toggle. Human spectator eye counts include accepted eliminated-player watching; public spectating selects living real players before bots. Chat channel selection no longer mutates its native popup every HUD refresh and has a visible close control.','The recurring public Spawn Island clock stays unstarted until the first real contestant joins. That player starts a fresh 45 seconds; further players share it, and the last contestant leaving clears the countdown. An empty active round returns to the same waiting state.','Loot cannot spawn or drop within relay access zones. Building or editing fire must be released before a gun can shoot. Royale bots rotate toward safety earlier, preserve urgent movement under pressure, engage within 62 metres and see within 70 metres, with slightly softer aim and renewed combat movement. Bot work remains staggered. All eleven guns have military display names; internal ownership IDs and weapon stats remain intact. Version 4.3.0 / gameplay protocol 36.']},
 {number:'123',title:'Loading, Then Briefing',changes:['The Season 1 update briefing opens only after the initial loading screen has finished, including battlefield/shader preparation. The startup artwork is no longer covered by a premature modal.','Close, browser-specific Do not show again, manual reopening and invite-code continuation retain their existing behavior. Event-driven readiness avoids polling or added simulation work. Version 4.2.2 / gameplay protocol 35.']},
 {number:'122',title:'Field Vistas',changes:['Dedicated Kestrel Forward Airfield startup artwork introduces Season 1 before the game loads. Three new cinematic loading illustrations depict Breakwater Docks, Ironwake Quarry and Sable Woods with distinct operators and military environments.','Match entry, spectating and return-to-lobby screens shuffle the three new locations and the original coastal key art. Every illustration appears once per rotation, with no immediate repeat. Connecting and deployment retain the same image.','Loading status, location titles and cancel controls remain live, readable overlays. Only startup and the currently selected artwork load; optimized WebP files and bounded image preparation avoid adding match simulation work. Version 4.2.1 / gameplay protocol 35.']},
 {number:'121',title:'Wide Horizon',changes:['Ravel Coast retains distant terrain, building shells, trees and landmark silhouettes while detailed 64-metre scenery cells load gradually nearby and unload with a buffer. Scoped views preload detail along the sightline. Destruction survives unloading and reloading; collision and gameplay remain authoritative.','Royale bots now execute aiming and movement between tactical decisions, with continuous fallible aim instead of perfect-or-missed bursts. Shorter deliberate firing pauses, bounded pitch/yaw changes, fair queued route searches and temporary avoidance of unreachable loot reduce long idle retries. Damage and weapon statistics remain identical to players.','Shared player spatial queries reduce repeated bot perception and crowd scans. Route searches share a fixed rate budget and finer collision buckets reduce nearby geometry scans without changing collision or damage. Distant opponent poses use 10 Hz presentation updates with full-rate nearby, aimed, teammate and spectator targets, while health, inventory, shots, projectiles and migration checkpoints remain current.','Distant character and glider animation updates are staggered. HUD text and inventory ammo counts update without rebuilding unchanged slot art; map updates are limited to changed views. Repeated prop templates reuse geometry, and bounded projectile, tracer, smoke and ring pools reduce allocation churn. Distant loot/chest models release after leaving their area.','Version 4.2.0 / gameplay protocol 35. Includes Quality 120 named spectator notices and Social contrast fixes.']},
 {number:'120',title:'Eyes on the Field',changes:['Players receive a named notification when a human begins watching them, plus a persistent list of current spectators. Switching views, respawning, disconnecting and eliminated targets update the list through host-owned spectator intent.','Finished readable Social buttons, active tabs, invitations, player cards and friend-code controls; corrected inventory resource text contrast.','Release activity now distinguishes private pre-match lobbies from active matches and exposes anonymous aggregate counts for safe publishing. Publication is held while any connected player is playing, spectating or has uncertain match status. Version 4.1.2 / protocol 34.']},
 {"number": "119", "title": "Kestrel: Clear Skies", "changes": ["Real inventory images for the Kestrel Jump Rig, Voss keycard, smoke and scanner. The Jump Rig shows a circular next-charge timer in the hotbar and inventory while preserving authoritative charges.", "Independent left/right and up/down camera look aboard the Kestrel for hosts and guests. Guest transport smoothing no longer overwrites your look direction.", "Compact military airfield with about half the land area, full-size parked Kestrel, hangar, observation deck and practice range. All 48 contestant seats remain.", "Reduced repeated collision searches, pathfinding allocation, weapon-selection copies and door-triggered route rebuilding. Distant AI-only encounters use fewer tactical decisions; physics, fire rates, damage and nearby human-facing bot decisions retain their rates. Version 4.1.1 / protocol 33."]},
 {"number": "118", "title": "Season 1: The Fortified Coast", "changes": ["Rebuilt nine major districts, fourteen landmarks and all three arena maps with individual architecture, silhouettes, connecting roads and military evacuation stories. Aster Command gains Voss\u2019s fortified house and underground archive vault.", "Voss patrols his house with slower acquisition, wider aim error and short firing bursts. His keycard guides its carrier to a locked vault with exactly two Epic Chests and two regular chests. The legendary rifle and mythic Jump Rig remain boss rewards.", "Kestrel Forward Airfield replaces Spawn Island with a runway, parked Kestrel, hangar, staging facilities and practice range. Three zip lines and three ascenders connect useful high ground across Command, Quarry and Docks.", "Tactical sprint has stamina, acceleration, distinct strides, lowered weapons and a short weapon-raise delay. Doors open, close, barge and break; damaged walls, props and builds show deterioration before destruction.", "Floor loot is capped at Rare. Scarce armored Epic Chests guarantee Epic or Legendary weapons. Private Royale fills 48 contestant seats, with players replacing bots and manual host starts preserved.", "Readable field UI colors across settings, help, private rooms and dialogs; prominent boss/vault map marker; updated Season 1 briefing and controls. Static batches, cached navigation and bounded damage/route updates limit added rendering work. Version 4.1.0 / protocol 32."]},
 {number:'116',title:'Season 1: Operation Breakwater',changes:['Commandant Voss guards Aster Observatory with 600 health, 400 shield and a standard legendary Sprinter. Defeat him for the legendary rifle and rechargeable three-charge mythic Kestrel Jump Rig. Shield/health bars appear after damage; human combat hitboxes and authoritative weapon rules remain unchanged.','Military operators, fitted armor, facial features, grounded patrols, new equipment silhouettes across every Item Shop set, randomized bot gliders, upgraded Kestrel and free-look, slower descent, improved dive ribbons and crouch-to-slide slopes. Existing purchases and IDs are preserved.','Tactical relays reveal nearby activity and expose the user. Smoke blocks vision, not bullets; Recon Pulses mark last-known contacts. Inventory supports dragging left to drop weapons and half/all ammo and material drops.','Private Zero Build and restricted arena weapon pools, offline field training with moving targets and guided movement/build/edit exercises, Season mastery, weekly assignments and cosmetic service rewards, elimination recaps, clearer field UI and a dismissible illustrated season briefing.','Public Frontier Royale admits players and spectators from 7 AM–7 PM America/New_York, including daylight saving time. Active rounds may finish after closing; private matches are always available. One 48-seat recurring room, manual private starts and empty-round reset remain.','Budgeted boss perception, cached schedule checks, batched cosmetic geometry, fewer local snapshots, throttled minimap updates and steadier adaptive resolution. School laptop graphics preset is available. Version 4.0.0 / protocol 31.']},
  {number:'115',title:'Operator in View: Verified',changes:['Completes the compact public-match banner and shorter-screen operator framing, keeping the character visible beneath the lobby card. Empty public rounds immediately return to a fresh 45-second Spawn Island when every real player and spectator has disconnected. Production verification checks desktop/laptop layout and matching game/service builds. Version 3.8.4.']},
  {number:'113',title:'Operator in View',changes:['The public Royale card is now a compact top-center banner on desktop. Shorter laptop screens frame the lobby operator beneath it, keeping the head and body visible. Player count, countdown, estimated remaining time and Join/Spectate stay available.','If every connected real player and spectator leaves an active public round, the server clears that round and immediately starts a fresh 45-second Spawn Island with 48 bots. Empty waiting rounds keep their normal countdown. Version 3.8.3.']},
  {number:'112',title:'Keep Playing During Updates',changes:['Removed the full-screen updating overlay and its gameplay pause. Old saved update flags are cleared on load. Publishing notices no longer close menus or interrupt private host matches. Background version checks still refresh outside active matches. Version 3.8.2.']},
  {number:'111',title:'One Public Frontier: Hosting Verified',changes:['Completes the recurring 48-contestant public Solo Royale and private manual-start release. The public lobby card tracks human players, Spawn Island Join, later Spectate and estimated remaining time; rounds wait for a real player and repeat automatically.','Free For All and Royale Solo, Duos and Squads remain private player-hosted customs with room codes and manual START MATCH. Team Scramble is retired, with existing Career records preserved. Deployment checks cover every remaining private variant and the server-owned public room. Version 3.8.1 / gameplay protocol 30.']},
  {number:'110',title:'One Public Frontier',changes:['One recurring server-owned Solo Frontier Royale match starts with 48 Intermediate bots. Joining humans replace bots during the full 45-second Spawn Island window. If no real player is present at departure, the window resets to 45 seconds. Later arrivals spectate; connected public spectators enter the next warmup when seats are available. Results restart automatically after 10 seconds.','The top-center lobby card shows the actual real-player count, Join or Spectate based on the server phase, and an estimated round time based on the storm schedule. Joining with a ready party enters the same Solo round as independent opponents.','Every other match runs privately on the player host: Free For All and Frontier Royale Solo, Duos or Squads. The bottom-left panel has only Custom Private Match. All private modes keep their room-code and manual START MATCH screen after loading; code joins and teammate bot support remain available.','Team Scramble has been removed from playable modes. Existing Career totals and archived records remain. The public match cannot be reconfigured or closed by a departing player; clients cannot create another server-run match. Version 3.8.0 / gameplay protocol 30.']},
  {number:'109',title:'Your Host, Your Squad',changes:['All Frontier Royale Solo, Duos and Squads matches now run on the player host. PLAY opens a fresh private room with your ready party, and other players can still join by code. Only public Free For All and Team Scramble use server simulation. The existing relay still connects players; hosted matches keep the existing no-verified-Marks rule.','Royale bot teammates follow the human squad nearby, limit independent looting and combat roaming, and follow human drops. Reviving a downed human takes priority over fighting and looting. Downed bots stay still when a teammate approaches or holds a revive; standard revive duration, damage interruption and health remain.','Bots seek and pickaxe nearby wood, brick and metal through normal harvesting rules, with a larger material target. They aim at the reachable surface of props instead of their collision-blocked centers, then carry and use the materials normally.','Capacity messages suggest Custom Private Match. That button matches the main play button on desktop and mobile. Private Free For All and Team Scramble keep the room code and manual START MATCH screen after loading and party arrival. Version 3.7.0 / gameplay protocol 29.']},
  {number:'108',title:'Menu Scrolling Restored',changes:['Locker, Item Shop and Career now receive pointer input directly instead of passing scrolling through to the gameplay canvas. Mouse wheels, trackpads and vertical touch gestures can scroll their full pages up and down. Gameplay input remains unchanged. Version 3.6.1.']},
  {number:'106',title:'Built-In Menu: Verified Publishing',changes:['Version 3.6.0 keeps Play, Locker, Item Shop and Career integrated under permanent navigation. The expanded Career dossier includes mode statistics, personal grades, recent verified deployments, collection progress and milestones, preserving existing totals and inventory.','The focused live checker now requests the relay readiness endpoint without unsupported query parameters and verifies matching published game and service builds before checking each built-in page.']},
  {number:'105',title:'Your Front, Built In',changes:['Play, Locker, Item Shop and Career now share permanent navigation and built-in pages instead of closeable menu dialogs. Browser Back and direct section links work, while shop filters, purchases, equipment, saved loadouts and existing inventory are preserved.','Career expands into a full personnel screen with mode-specific match totals, wins, eliminations, assists, win rate, eliminations per match, best Royale placement, collection progress and six personal milestones. Career grades are personal progression, not competitive rank.','Recent history records the latest 50 verified reward-eligible matches with result, mode, eliminations, assists and Marks. Existing lifetime totals remain intact; older matches are not fabricated. Stats remain saved on this browser. Version 3.6.0.']},
  {number:'104',title:'Publishing Recovery',changes:['The updating screen verifies the published game when the live connection reports ready, retries on returning to the tab, and clears its saved wait state before loading the verified new build. Temporary status-request failures no longer trap an already published game behind the previous update screen. Version 3.5.2.']},
  {number:'101',title:'Operator Audio Removed',changes:['Removed the Operator Comms voice lines, radio chirps and static, spawn gear rustle and weapon-ready cues. Existing gameplay audio and subsequent updates remain. Version 3.5.1.']},
  {number:'100',title:'Play Together, Keep the Front Open',changes:['Custom matches are always private and run on the player host. Party launches keep ready members together and custom matches do not consume server simulation capacity. Public FFA and Team Scramble consolidate players into existing arenas and open another only when the earlier rooms are full of real players.','Friends can spectate active public or private matches through Social. Spectator admission cannot spawn, replace bots, claim rewards or participate in gameplay, and follows the friend on entry. Settings now has a matching navigation label.','Downed alerts identify teammates only. Fill Duos and Squads reserve human teammates until departure, then assign bots to any remaining teammate slots. No Fill teams remain unchanged.','The updating screen spans publishing and relay restarts, and clears only when the game and relay report the same ready build. Persistent Social identities and friendships are preserved. Refresh for gameplay protocol 28.']},
  {number:'98',title:'Room to Breathe',changes:['Matchmaking now reserves a workload budget based on mode, human players, bots and CPU allocation. Warmup reserves battle-phase cost; simultaneous party launches, spectators, rematches and settings changes share the same admission gate. Sustained measured CPU or throttling pressure pauses new workload until recovery.','Public matchmaking fills compatible rooms first and limits new filler bots when the remaining server budget is small, with a visible notice and unchanged human seats. Custom workloads that cannot fit report a clear capacity message immediately. Party cancellations, expiry and departures release reservations.','Snapshot batches share player normalization, baseline comparisons and wire serialization across compatible recipients while preserving private team markers, independent sequences, backpressure, reconnects and sparse world updates.','Bot tactical decisions are staggered and bounded separately from 60 Hz movement and combat. Cached navigation and weapon selection reduce repeated work; damage interrupts decisions and eliminated targets stop cached firing. Version 3.4.5; server-owned matches and permanent Social storage remain in place.']},
  {number:'97',title:'Bounded Match Input Work',changes:['Fixed a server activity-tracking path that scanned retained match histories for every movement packet. Inputs now update the entrant bound to that authenticated connection; finished and stale matches stop receiving activity.','Reward settlement and reconnect behavior are verified. This reduces a source of CPU pressure as match history grows; hosting capacity and internet latency remain separate limits. Version 3.4.4.']},
  {"number":"96","title":"In-game Issue Notices","changes":["Detected server CPU pressure, slow server updates, low frame rates and connection delays trigger a shared lobby notice after sustained detection affecting at least two connected players. Two affected players in the same match qualify without a majority of reports or a second match.","The shared elapsed clock and recovery behavior remain. External monitoring and performance-alert emails are disabled. Version 3.4.3; gameplay protocol unchanged."]},
  {"number": "95", "title": "Steadier Arena Footwork", "changes": ["FFA and Team Scramble bots keep normal running speed. Combat strafing is calmer: capped lateral input, smooth acceleration through direction reversals, longer commitments to an angle, and smoother aiming turns replace rapid side-to-side twitching.", "Reaching a combat peek no longer triggers a new direction choice every 0.2 seconds. Bots brake into a peek without overshooting and pause at the angle until their next planned decision; normal navigation and all Royale movement retain their existing behavior.", "The prior general arena speed reduction is removed. Focused movement and live deployment checks verify normal player/bot travel speed, constrained lateral movement, smooth reversals, committed combat peeks, unchanged Royale motion and matching frontend/relay builds. Version 3.4.2 / protocol 27."]},
  {"number": "94", "title": "A Calmer Arena Pace", "changes": ["FFA and Team Scramble bots move 20% more slowly during navigation and combat. Their normal arena speed is now 5.92 units/second; aiming and stance penalties still apply on top.", "Player movement and Battle Royale bot movement are unchanged. Weapon damage, firing rates and difficulty accuracy remain unchanged. Focused checks cover all arena weapons, aiming, crouching, diagonal movement, server snapshots and Royale walking/sprinting. Version 3.4.1 / protocol 26."]},
  {"number":"93","title":"Every Weapon, A Purpose","changes":["All eleven firearms now share one central balance system, with distinct roles, smooth range falloff, controlled critical damage, recoil, handling, magazines and rarity scaling tuned for 100-health arenas and 200-health/shield Royale.","Weapon accuracy reacts to walking, crouching, sliding and airborne movement. Crosshairs project the actual firing cone, scoped movement penalties appear inside the existing wide optics, and recoil and reload presentation follow gameplay timing.","The server enforces weapon and shotgun-family cooldowns, buffered semi-auto triggers, burst spacing, ammunition and physical projectile collisions. Precision bolts travel at 330 units/second with a narrow collision radius. Bots select weapons by range and ammunition without extra damage.","Ammo drops and carry limits are rebalanced; structure pressure is independent of player damage. The generated balance matrix compares all 55 rarity variants at five ranges, body/head TTK for both modes, and six movement states. Version 3.4.0 / protocol 25."]},
  {number:'92',title:'Stable Friends',changes:['Friend Codes and relationships use a versioned social store with synced primary/backup snapshots. The relay automatically selects its permanent social file when the configured Render disk is attached; ordinary updates keep the existing browser credential and public code.','Social mutations are acknowledged after persistence. A damaged primary can recover from a validated backup; invalid or newer data cannot be silently replaced with an empty friend list. Unknown browser credentials remain saved and Social offers Retry Restoration or an explicitly confirmed new identity.','A validated migration utility refuses to overwrite existing social data. Activating permanent storage requires the separately approved Render disk; compute upgrades alone do not preserve temporary files. Protocol 24 / version 3.3.1.']},
  {number:'91',title:'Eyes on the Frontier',changes:['Lobby operators now continuously sweep their rifles across a broad, smooth sector-check sequence inspired by the supplied patrol reference. Eyes lead, shoulders and hips follow, and repeated shouldered aiming, cheek tilts and weight shifts give the walk a more alert rhythm.','Rifles pivot around the shoulder with weapon-specific grip tracking. Boots stay planted along the moving road while the upper body scans; all four party members retain independent timing. Four-player mobile framing includes the full rifle sweep.','The full four-operator patrol is integrated with the rebuilt coastal buildings, loading yards and gantries. Focused animation and browser checks cover every firearm, grounded strides, smooth continuous scans, party timing and desktop framing. Version 3.3.1.']},
  {number:'90',title:'The Coastal Front',changes:['Every FFA and Team Scramble arena is rebuilt: Aster Relay, Breakwater Docks and Ironwake Foundry replace the old garden, freight and town layouts with coastal operations compounds, port equipment and a traversable machine hall. New cover, interiors, elevated approaches, pickups and skylines use shared collision geometry.','The lobby patrol road now passes detailed operations buildings, loading yards, trucks, containers, lamps, a utility gantry and a distant radar station. Scenery remains batched into reusable static segments with the existing patrol and music.','Protocol 24 / version 3.3.0 prevents old arena geometry from mixing with the new client and server. Original room map identifiers remain compatible with saved preferences.']},
  {number:'89',title:'One Frontier, One Incident Clock',changes:['Lobby notices now represent widespread incidents only. A server-owned incident ID and start time are shared by every browser, with elapsed time synchronized to the server rather than each device’s wall clock.','A single player’s lag, low FPS or failed status request no longer creates a lobby-wide notice. Player-reported notices require at least three affected reporting players across two matches and at least half of recent reporting players.','The shared timer continues while any confirmed issue remains active, even if individual issue types recover. Refreshing or joining later uses the same start time.']},
  {number:'88',title:'Welcome Back to the Frontier',changes:['Public access and matchmaking are restored. The administrator-only maintenance gate is disabled for normal game and party connections; owner tools remain authenticated.','A new illustrated welcome-back screen summarizes everything since maintenance began, with Close for now and a saved per-browser Don’t show again option.','Ping, traffic, latency graph, WiFi warnings and FPS are more compact. Existing live performance notices, party, friends and Squads remain available.']},
  {number:'87',title:'Friends on the Frontier',changes:['Social now uses separate browser identities, public Friend Codes, server-saved friendships, incoming/outgoing requests and blocking. Friends and paginated Others Online share centralized presence; copy/find codes, invite, accept/decline/cancel and remove controls report errors clearly. Identity credentials remain private and separate from lookup codes.','Parties hold four operators with explicit leadership, readiness, expiring invitations, reliable removal/leaving and 30-second reconnect grace. Leadership transfers to a connected member after genuine disconnection. Lobby parties remain independent of friends and match teams.','Frontier Royale now supports Solo, Duos and Squads. Human Fill reserves whole premade parties before adding teammates; No Fill deploys the existing party, while match population bots occupy separate teams. Exact team IDs survive Spawn Island, Bus and combat.','Squads have multi-player DBNO, independent revives, squad wipes, original knock credit, compact three-teammate HUD, numbered/color-consistent world/map/minimap markers, private team pings/chat, teammate-priority spectating and shared team placement/victory. Server authority and sparse 20 Hz snapshots remain intact.','Focused browser and independent WebSocket checks cover friends, presence, four-player parties, Fill/No Fill, team survival, markers, results, reconnect and host/non-host behavior. Protocol 23 / version 3.2.0. Browser identities survive refresh; server relationships survive restart when the configured social data file is on durable hosting storage. Production maintenance access remains unchanged.']},
  {number:'86',title:'Live Service Notices',changes:['Sustained server delays, CPU pressure and player-reported rendering or connection issues generate lobby notices with elapsed-time clocks. Brief warning flashes are filtered, and notices clear after a recovery window.','A public status feed keeps bounded recent incident history without player names, room codes or credentials. Owner email monitoring checks this history hourly.']},
  {number:'84',title:'Live Performance HUD',changes:['Show FPS in Video and Net Debug Stats in HUD are enabled by default, with saved per-browser toggles. Live ping, traffic, message rates and a latency graph display during matches.','Connection warnings show a yellow arrow for delayed updates and a red X for severe delays or reconnecting. Browser-unavailable packet loss displays a dash instead of an invented percentage.']},
  {number:'83',title:'Consistent Server Snapshots',changes:['Fixed floating-point timing that could delay regular server snapshots from three simulation ticks to four. Matches keep server-owned simulation and the existing CPU optimizations.','Catch-up still sends one fresh snapshot per callback and retains socket backpressure limits instead of bursting stale updates.']},
  {number:'82',title:'Two Seconds on the Front',changes:['Website and match loading screens remain visible for at least two seconds, and continue for longer when preparation is still in progress.','Cancelled connections and errors dismiss the screen immediately. Each new load gets its own timer, so an earlier completion cannot hide a newer loading screen.']},
  {number:'81',title:'Hold the Front',changes:['Original Ravel Coast loading artwork and a full-screen field-operations presentation now greet website startup and match connections.','Battlefield loading remains covered through map construction and shader preparation. Connection loading retains Cancel and error recovery, with responsive layouts and reduced-motion support. Maintenance access remains unchanged.']},
  {number:'80',title:'Arena CPU and Connection Recovery',changes:['FFA and Team Scramble bots use staggered tactical updates while movement and weapon cooldowns continue at 60 Hz. Static arena respawn clearance is prepared before the server accepts matches.','Server catch-up yields after a costly tick so queued socket traffic can run. Short queued traffic bursts no longer use a rigid one-second rate window; sustained message and byte limits remain enforced.']},
  {number:'79',title:'Lower Server CPU Load',changes:['Collision queries avoid temporary allocations while preserving their exact hit distances. Player snapshots reuse their own rows and skip cloning unchanged world collections.','Multiplayer recipients share immutable state-diff work, and writable connections serialize each outgoing packet once. Movement, combat tick rates, socket recovery, lobby animation and music remain intact.']},
  {number:'78',title:'Hosting CPU Limits and Throttling',changes:['Connection reports now include the server’s visible Linux CPU quota and kernel throttling-counter changes. Counters are sampled asynchronously outside the simulation loop and exposed as numeric diagnostics.','Unavailable counters are labeled explicitly. Existing lobby animation, music and maintenance access remain intact.']},
  {number:'77',title:'Coastal Patrol',changes:['The lobby now plays a continuous walking patrol: alternating grounded strides, natural body motion, independent head and rifle scans, and smooth aim/low-ready transitions. Operators remain centered while an original coastal service-road scene moves behind them at their walking speed. Party members have separate stride and scan timing.','The Complex by Kevin MacLeod is the new free CC BY 4.0 lobby soundtrack, with attribution in Update history. Music starts after interaction, follows Master and Music volume, pauses in hidden tabs and gameplay, and restarts on returning to the lobby. The compressed track streams locally without decoding a large audio buffer.']},
  {number:'76',title:'CPU and Elapsed-Time Diagnostics',changes:['The connection report pairs process CPU time with the exact slowest simulation and broadcast samples for each server phase, helping distinguish CPU work from scheduling or other waits.','Process CPU includes runtime threads; the report does not label a delay as confirmed hosting throttling. Maintenance remains enabled.']},
  {number:'75',title:'Server Phase Diagnostics',changes:['Connection reports separate Spawn Island, departure, bus and battle timings, including maximum simulation step, broadcast work and observed callback gap. Exact departure setup time is recorded even when a full room starts early.','Measurements reset for each new round and remain available after leaving the match. Maintenance remains enabled.']},
  {number:'74',title:'Prepare the Match Before Departure',changes:['Server navigation is prepared before matches are accepted, avoiding first-room navigation stalls. Battle loot and collision data are prepared in bounded batches during the countdown, then adopted at departure.','Loot uses a saved independent seed so preparation timing and checkpoint recovery preserve the same results. Maintenance remains enabled.']},
  {number:'73',title:'Faster Match Initialization',changes:['Harvest metadata uses indexed prop lookups, reducing server work at bus departure and during harvesting. Prepared scenery keeps the object IDs needed for destruction.','Connection reports distinguish ordinary bus movement from prediction corrections and include server simulation and scheduling stall measurements. Maintenance remains enabled.']},
  {number:'71',title:'Smoother Island Departure',changes:['Battle-island geometry is prepared in small batches during Spawn Island and shaders are compiled ahead of departure, avoiding the full scene build at countdown zero.','Server loot placement uses nearby collision geometry instead of repeatedly scanning the entire island. Maintenance remains enabled.']},
  {number:'70',title:'Ready on the Front',changes:['Lobby operators now hold a planted, cinematic weapon-ready stance inspired by the supplied motion reference: natural breathing, weight shifts, head scans and occasional smooth sight checks replace continuous walking in place.','Party members share the same articulated weapon grip and idle system with staggered timing. Both boots stay grounded, cosmetics remain equipped, and lobby motion is independent of pointer input and gameplay.']},
  {number:'69',title:'Stall Recovery and Input Continuity',changes:['The authoritative server retains bounded simulation time after short scheduling stalls and catches up over several callbacks instead of discarding elapsed time.','Delayed input bursts can use time already earned on the server. Persistent overload still trims stale controls, and clients cannot gain extra movement time. Maintenance remains enabled.']},
  {number:'68',title:'Large Match Simulation Performance',changes:['Movement collision checks no longer repeatedly copy full operator records or allocate temporary candidate arrays. Stance, stairs and collision rules are preserved.','Loot pickup, chest interaction and nearby bot loot discovery use a shared spatial lookup that refreshes when items change. Server authority, contestant capacity and maintenance access are preserved.']},
  {number:'67',title:'Responsive Server Input',changes:['Overloaded servers now discard stale queued controls instead of replaying seconds of old movement. Movement remains limited by server time, and normal packet jitter retains ordered prediction.','Repeated collision bucket queries are cached and invalidated when geometry changes. Chest proximity scans run only while interacting. Maintenance remains enabled while performance is verified.']},
  {number:'65',title:'Performance and Connection Recovery',changes:['Movement input now runs independently of drawing, with bounded recovery from short stalls and server-enforced timing. Battle Royale broadcasts skip unchanged world collections and backlogged connections; catch-up produces one fresh snapshot instead of repeated stale frames.','Off-screen operators skip animation and model creation. Humanoids use conservative visibility bounds, weapon geometry reuses its baked cache, and lobby entry defers loading unused map geometry. Existing weapon artwork is regenerated from the unchanged designs.','Maintenance remains enabled with the existing server-validated administrator access. Accounts, currency and cosmetics are preserved. Refresh to use protocol 22.']},
  {number:'64',title:'Maintenance: Administrator Access Only',changes:['Public access is paused while performance and connection issues are repaired. The maintenance page offers administrator authentication using the existing server-only owner code. Production game and party connections require a valid, expiring administrator session.']},
  {
    number: "63",
    title: "Fieldcraft & Firepower: Performance Hotfix",
    changes: [
      "Urgent performance pass: bounded render resolution, adaptive GPU load, automatic expensive-shadow reduction on slow devices, and capped secondary scope rendering reduce stalls and input delay. Supersampling and multisample overhead no longer overwhelm high-resolution laptop screens.",
      "Completes the Fieldcraft & Firepower release with a guarded stance transition: entering glide or skydive clears compact crouch collision and restores the correct airborne combat silhouette.",
      "Update 62's server-owned combat, crouch/slide, Duo downing/revives, private danger pings, eleven refreshed weapons and images, original firearm audio, cinematic operator lobby and repaired owner access remain integrated. Focused browser and server checks verify this final build."
    ]
  },
  {
    number: "62",
    title: "Fieldcraft & Firepower",
    changes: [
      "All eleven firearms have refined metal/polymer geometry, one canonical name, and regenerated images projected from the actual model factory. Separate category-tuned viewmodel cameras fix camera clipping across screen sizes. Original firing and handling sound designs distinguish every firearm; short accepted-path tracers replace long yellow beams.",
      "Operators gain fuller heads, fitted clothing detail, articulated gloves and refined stance poses. A shared humanoid rig blends crouching, sliding, crawling, reviving and weapon actions. Decorative equipment never enlarges standardized combat regions. The lobby now uses an independent cinematic walking and scanning loop, with no pointer-following behavior.",
      "Hold Crouch to lower your body, camera and combat hit regions. Sprint into a crouch to slide with bounded momentum, slope response, limited steering and a cooldown. Standing requires overhead clearance. Input prediction and server validation keep movement smooth and fair.",
      "Frontier Royale Duos now supports Downed players, slow crawling, finishing and bleed-out. Hold Interact beside an eligible teammate for ten seconds to restore 30 health. Walls, range, movement and combat damage interrupt revival; abandoned progress decays. Teams with no active survivor resolve immediately, including storm and disconnect cases.",
      "Middle mouse places a world marker and Y marks danger; both controls can be rebound. Your Duo sees ownership, distance, map markers and a short notification. Server validation, replacement, expiry and rate limits prevent marker spam.",
      "Online matches now run on the relay. Browsers submit movement and interaction intent; the server owns hits, critical damage, downing, revives, teams, markers and rewards. Room leadership can transfer without transferring combat authority. The 30-second Spawn Island countdown and existing accounts, cosmetics, Marks and settings are preserved.",
      "Sprinter no longer has an extra ADS dot; intentional reflex optics retain their reticles. Seven presses on the Ravel Front logo open owner authentication correctly, and failed attempts can be retried. The private owner key remains server-only. Refresh to join protocol 21 matches."
    ]
  },
  {
    "number": "51",
    "title": "Ravelfront: A New Frontier",
    "changes": [
      "Ravelfront is an original coastal frontier shooter. A new wordmark, graphite/teal/amber interface, expedition lobby, Kestrel tiltrotor, world signage and match presentation establish its own identity.",
      "Articulated skinned human operators share an anatomical skeleton, blended movement/action states, foot and hand IK, category-specific weapon grips and per-weapon reloads. Humanoid head/body combat regions are independent of outfits. No cosmetic changes combat size.",
      "The rebuilt Outfitter and Locker contain 84 original operator and equipment cosmetics in 12 collections, full character inspection and actual model previews. Existing currency becomes Marks at 1:1 and every purchased item maps to its replacement. Profiles, career history, settings and keybinds stay intact.",
      "The relay settles online rewards from meaningful participation, eligible opponents, bot difficulty, logarithmic population, placement, victory, eliminations and assists. Custom reductions, minimum activity, repeat-opponent limits and match/hour caps reduce farming. Offline practice and Spawn Island award nothing.",
      "Active contestants receive an inactivity warning with 12 seconds left and are removed after 59 seconds without meaningful play. Loading, transport, recovery and spectators are exempt. Idle packets, slot toggles and repeated camera jitter do not qualify.",
      "Online Spawn Island returns to 30 authoritative seconds with existing full-human early departure. Balanced spawn regions spread humans and bots across Relay Cay; local wandering and occasional range practice keep bots distributed.",
      "Original restrained footsteps, landing and equipment cues accompany the human movement pass. Shared geometry/materials, lightweight grip targets and distance-based animation scheduling keep 32-contestant rooms practical. Refresh to join the new game protocol."
    ]
  },
  {
    "number": "50",
    "title": "Better Together",
    "changes": [
      "An original Ravelfront lobby puts customized operators on center stage, with Play, Locker, Item Shop, Career, Updates, Settings and Social. Public matchmaking is the primary action; Custom Match remains available. The separate offline-bot Play flow has been retired.",
      "Relay-backed lobby parties support invitations, acceptance, decline, leader controls, privacy, readiness and reconnects. Party members appear together and enter public or custom matches together, with reserved human seats and bot replacement.",
      "Frontier Royale Duos adds Fill / No Fill, protected teammates, team markers and vitals, bot partners, teammate spectating, shared placement and last-Duo victory. Teams persist through Spawn Island, the Kestrel and host recovery. Existing 32-contestant capacity and the authoritative online countdown are preserved.",
      "Eleven fictional blasters now use centralized, distinct damage falloff, head critical hits, rarity scaling, accuracy recovery, bloom, recoil, pellet patterns and build damage. Bots use the same combat rules. Scoped aiming stays stable and your scope sensitivity is preserved.",
      "Immediate firing feedback pairs with host-confirmed trajectories and damage. Most blasters use authoritative hitscan; Needle bolts and explosive projectiles retain travel. Bounded target-history compensation supports remote hits, and reticles communicate actual spread and first-shot readiness. Native transport heartbeats and authoritative room ownership prevent false host transfers during slow scene loads. Refresh to join updated rooms."
    ]
  },
  {
    "number": "49",
    "title": "Settings, Your Way",
    "changes": [
      "Settings now use a wide category-tab layout with Video, Audio, Mouse, HUD, Gameplay and Keybinds sections, plus contextual descriptions for the selected option.",
      "Ravelfront paper-and-ink styling, gold active tabs, independently scrolling options, a persistent footer and a compact mobile layout keep every control easy to reach. Existing automatic saves, resets and keybind Apply / Discard behavior are preserved."
    ]
  },
  {
    "number": "48",
    "title": "Six Slots, Full Width",
    "changes": [
      "The Battle Royale inventory now reserves one dedicated pickaxe column and the remaining width for five equal item slots.",
      "Equipment cards no longer collapse into narrow strips at laptop or responsive panel sizes; empty and occupied slots keep identical dimensions."
    ]
  },
  {
    "number": "47",
    "title": "Ready for Departure",
    "changes": [
      "Play Offline With Bots uses its own explicit session setting and a full ten-second Spawn Island countdown. Online matches retain sixty seconds, even when only one human is playing with bots.",
      "Online public and custom matches depart immediately when every configured contestant seat contains a connected human. Bots, spectators, stale records and duplicate connections never satisfy the threshold; the existing 32-contestant and 16-human limits are preserved.",
      "Joining players inherit the host's remaining time. Departure finalizes fill bots, locks the roster and resets practice equipment once. The warmup HUD separately reports real players and bots, and late arrivals remain spectator-only."
    ]
  },
  {
    "number": "46",
    "title": "Connected Island — On-Time Departure",
    "changes": [
      "Spawn Island now follows sixty real seconds of host time even when a slow frame drops physics work. The replicated countdown and host-recovery checkpoint keep everyone on the same deadline, without accelerating movement or match physics.",
      "Includes the full Connected Island update: connected building and automatic materials, scroll-wheel reset, repaired map geometry, visible storm, smarter bots, dedicated pickaxe plus five item slots, 32-contestant fill, larger vitals and rebalanced storm phases."
    ]
  },
  {
    "number": "45",
    "title": "Connected Island",
    "changes": [
      "Building automatically continues with the next usable material, while preserving deliberate selections. A shared host/preview solver ranks nearby grid attachments, including ramp-to-floor extensions, with consistent collision and resource validation.",
      "Wheel-up and wheel-down support contextual Edit + Reset edit bindings. Shared reset scrolling confirms in one gesture without switching equipment. A dedicated pickaxe precedes five equal slots numbered 1–5; HUD prompts follow your saved bindings.",
      "Ravel Coast foundations, stair landings, wall corners, roof trim and terrain transitions have been aligned. Roads now use the terrain surface itself. The storm has a clearly visible animated blue-violet wall driven by the actual safe-zone boundary.",
      "Royale now targets 32 contestants with up to 16 humans, bot fill and four separate spectator seats. Forty clear Spawn Island points, distributed bot landings, guaranteed ground-floor weapons, matching ammo and district chest minimums support the larger match.",
      "The host controls a 60-second Spawn Island countdown. Practice bots explore, idle and take limited turns at the range. Match bots can interrupt a distant fight for a much more dangerous nearby attacker, with commitment to prevent target flicker.",
      "Storm movement starts 140 seconds after Bus departure, then tightens through eight phases ending at 8:46. Larger responsive health/shield bars improve combat readability. Narrow collision queries, bounded pathfinding and shared sparse snapshots control browser and network work. Refresh before joining updated rooms."
    ]
  },
  {
    "number": "44",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "43",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "42",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "41",
    "title": "Manual builds, edits & materials",
    "changes": [
      "Crosshair-driven world-space editing with piece-specific grids, stair gestures, roof corner selection, validity feedback, reset/cancel and optional release confirmation.",
      "Forward-facing ramps, persistent deliberate rotation, working edited doors, shared collision and host-validated guest edits.",
      "Object-aware finite harvesting budgets, weak points and material construction health. Player pickaxe damage remains 20. Reference differences are documented in the repository."
    ]
  },
  {
    "number": "40",
    "title": "Outfitter & Locker",
    "changes": [
      "84 new earnable cosmetics across 12 original collections: outfits, pickaxes, blaster wraps, back accessories, gliders and dive trails.",
      "A visual item shop and locker with favorites, previews, saved loadouts and free original customization.",
      "A persistent browser wallet with 300 starter Marks, active-play and elimination rewards, and match completion bonuses. No real-money purchases or gameplay advantages."
    ]
  },
  {
    "number": "39",
    "title": "Private owner overview",
    "changes": [
      "A hidden menu gesture opens a server-verified owner code prompt and an overview of anonymous visits, session activity and live rooms.",
      "Owner analytics stay disabled until a private server code is configured. A persistent relay disk is needed to keep past sessions across restarts; no player names, chat or IP addresses are recorded for analytics."
    ]
  },
  {
    "number": "38",
    "title": "Direct multiplayer relay",
    "changes": [
      "Online rooms now use the replacement persistent WebSocket server, removing database polling from gameplay.",
      "Brief connection interruptions can recover without leaving the match."
    ]
  },
  {
    "number": "37",
    "title": "Leaner multiplayer updates",
    "changes": [
      "Reduced full recovery snapshots and merged queued movement updates while preserving action changes and world data.",
      "Prepared support for the replacement persistent relay and brief connection recovery."
    ]
  },
  {
    "number": "36",
    "title": "Server-connected multiplayer",
    "changes": [
      "Public listings, room codes, and match messages now use secure WebSockets through the shared game server.",
      "Arena and Frontier Royale retain their existing game rules, chat filtering, and host transfer. Direct player-to-player connections are no longer needed for the default online mode.",
      "Refresh before joining a new room. Connection reports now check the game server and shared directory."
    ]
  },
  {
    "number": "35",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "34",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "33",
    "title": "Smooth stairs and better controls",
    "changes": [
      "Consistent stair contact, controlled step-downs and a smoothly eased camera remove stair jitter in arenas and Frontier Royale, including player-built stairs.",
      "Rebuilt keybind editor with primary and secondary slots, automatic reassignment of occupied inputs, mouse and scroll support, searchable actions, clear controls, Apply, Discard and confirmed default reset.",
      "Unsaved bindings stay in a draft; closing asks you to Apply or Discard. Escape remains available for the menu. Updated movement clients use compatible rooms."
    ]
  },
  {
    "number": "32",
    "title": "One place to Play",
    "changes": [
      "Choose Frontier Royale, Free for all or Team scramble from a single Play menu, with public matches, custom rooms, local bots and room codes together.",
      "Removed the left-side Loadout shortcut. New matches fill empty contestant seats with bots by default."
    ]
  },
  {
    "number": "31",
    "title": "Harvest, build and edit in Frontier Royale",
    "changes": [
      "Carry five items plus a permanent sixth-slot pickaxe. Harvest wood, brick and metal from destructible island scenery; aim for weak points for a faster harvest.",
      "Build walls, floors, stairs and roofs with grid previews, material costs, rotation, section editing, repairs and support collapse. Structures block movement and shots and take weapon damage.",
      "A new resource bank, blueprint selector, edit grid and six-slot hotbar bring building controls to keyboard and touch. Materials, world destruction and builds sync across the room and host transfers."
    ]
  },
  {
    "number": "30",
    "title": "Names belong in the yard",
    "changes": [
      "Ordinary names are allowed in chat, player profiles and public room listings, including names that also refer to places.",
      "Contact details, addresses, explicit private-detail disclosures and inappropriate language remain filtered."
    ]
  },
  {
    "number": "29",
    "title": "Try a server connection",
    "changes": [
      "A separate server check tests HTTPS access, secure WebSocket opening and three server replies without a room code.",
      "Open it from Check connection and copy the results. Multiplayer still uses its existing connections."
    ]
  },
  {
    "number": "28",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "27",
    "title": "Connection reports without developer tools",
    "changes": [
      "Check matchmaking and public discovery from the home screen or connection errors.",
      "Room joins record data-channel and host-handshake progress. Copy a report without names, room codes, IP addresses or credentials.",
      "Directory reports distinguish remote responses from this browser acting as coordinator; empty results do not prove remote connectivity."
    ]
  },
  {
    "number": "26",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "25",
    "title": "Ravel Coast rebuilt",
    "changes": [
      "A much denser island: 92 buildings, 560 trees, rolling terrain, distinct district architecture and hundreds of detailed props.",
      "Rebuilt Kestrel, curved gliders, treasure and supply chests, ammo and every utility item. Ground loot uses full blaster models; Sentry, Breach and Comet have distinct new designs.",
      "Royale sprint now matches normal-mode movement speed; walking is slower. Footsteps and button-hover sounds are removed; button clicks retain feedback.",
      "Reset any sensitivity, field-of-view or audio slider—or reset all sliders. Press I or M again to close inventory or map; custom bindings work too."
    ]
  },
  {
    "number": "24",
    "title": "Expanded chat and name filtering",
    "changes": [
      "Merged both supplied profanity lists and canonical forms: 3,717 unique terms, with duplicates removed.",
      "The expanded filter applies to chat and player names, with checks for disguised spellings and safe word boundaries."
    ]
  },
  {
    "number": "23",
    "title": "Frontier Royale: last operator standing",
    "changes": [
      "Drop from the Kestrel onto Ravel Coast, a 512 × 512 island with nine districts, chests and floor loot.",
      "Public matchmaking, private rooms and bot matches support 16 contestants, five inventory slots, eleven blasters and eight utility items.",
      "Skydive, deploy your glider, sprint with stamina, mark the map and outrun eight storm stages. Eliminated players spectate until the rematch.",
      "Original sound bank adds positional combat, transport, wind, footsteps, loot, item use, shields, storm and victory feedback, with separate sound controls."
    ]
  },
  {
    "number": "22",
    "title": "Clear comms, safer conversations",
    "changes": [
      "Room, team and spectator chat with quick messages, desktop shortcuts and touch controls.",
      "Always-on filtering for chat and player names, including disguised language, common personal details and real-name/location detection.",
      "Mute players, choose quick messages only or turn chat off; report to the host, who can silence players or pause room chat.",
      "Host-enforced spam limits and independent recipient checks; chat clears when you leave the room."
    ]
  },
  {
    "number": "21",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "20",
    "title": "Sculpted hands and smooth switches",
    "changes": [
      "Redesigned arms with smooth bends, fuller forearms and tapered wrists instead of sticks and ball joints.",
      "Larger sculpted hands have four curled fingers, defined palms and opposing thumbs for a more convincing grip.",
      "Kept every blaster’s aiming, firing and reload animations in first person and multiplayer.",
      "Blasters lower before switching and rise into a weapon-specific grip when drawn, with synchronized handling and clean rapid-switch transitions."
    ]
  },
  {
    "number": "19",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "18",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "17",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "16",
    "title": "Your match, your rules",
    "changes": [
      "One Create Match flow for public or private matches with configurable bots.",
      "Edit arena, mode, time limit, score target and bot difficulty in the lobby and before every rematch."
    ]
  },
  {
    "number": "15",
    "title": "Open the yard",
    "changes": [
      "Open the game directly without login, browser approval or activation codes.",
      "Restored invite-code multiplayer and local bot practice. Kept the public-match directory and public/private room controls without an access dashboard."
    ]
  },
  {
    "number": "14",
    "title": "Steady scoped accuracy",
    "changes": [
      "Moving and jumping no longer reduce accuracy while aiming through a sight or scope.",
      "Scoping immediately removes movement spread; firing spread still follows each blaster’s stats."
    ]
  },
  {
    "number": "13",
    "title": "Your controls, your way",
    "changes": [
      "Customize keyboard and mouse bindings with two bindings per action, or restore the defaults.",
      "Control hints follow your saved bindings."
    ]
  },
  {
    "number": "12",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "11",
    "title": "Your yard, on the same link",
    "changes": [
      "Added public-match browsing and room visibility controls on the GitHub Pages address."
    ]
  },
  {
    "number": "10",
    "title": "Crosshairs that show your accuracy",
    "changes": [
      "Crosshair arms widen with movement and firing spread, then settle as accuracy recovers.",
      "The indicator uses the match host’s actual weapon spread in practice and multiplayer."
    ]
  },
  {
    "number": "09",
    "title": "Crosshair preferences and ordered updates",
    "changes": [
      "Center Dot and Hit Markers can be switched independently, both enabled by default.",
      "Release history is numbered consecutively; failed builds and retries no longer skip numbers."
    ]
  },
  {
    "number": "08",
    "title": "Readable damage at every distance",
    "changes": [
      "Damage numbers keep the same screen size at every distance, with distinct critical-hit styling."
    ]
  },
  {
    "number": "07",
    "title": "Clearer hits and simpler controls",
    "changes": [
      "Damage numbers are 60% larger, with distinct gold critical hits.",
      "Desktop play always uses mouse lock; removed the drag-to-look setting.",
      "New private rooms start with zero bots selected.",
      "The quality update button automatically follows every published build."
    ]
  },
  {
    "number": "06",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "05",
    "title": "Weapon tuning and spectating",
    "changes": [
      "Revised weapon stats, accuracy, ammunition and reload behavior.",
      "Pause-menu respawn and spectator mode with player switching.",
      "Improved floating damage numbers and critical-hit feedback."
    ]
  },
  {
    "number": "04",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "03",
    "title": "Archived quality update",
    "changes": [
      "Historical improvements to combat, customization and multiplayer. These systems are superseded by Ravelfront: A New Frontier."
    ]
  },
  {
    "number": "02",
    "title": "Quality update",
    "changes": [
      "Improved weapon models, model previews and working optic views.",
      "Expanded arenas and traveling projectiles fired from weapon muzzles."
    ]
  },
  {
    "number": "01",
    "title": "Welcome to Ravelfront",
    "changes": [
      "The original arenas, blasters, practice matches and private multiplayer rooms."
    ]
  }
];
export const RELEASES = typeof __RELEASE_HISTORY__ !== "undefined" ? __RELEASE_HISTORY__ : RELEASE_NOTES;
export const RELEASE = RELEASES[0].number;
