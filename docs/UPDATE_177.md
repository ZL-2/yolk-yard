# Update 177 — Zone Wars and command menus

Version 6.3.0 / protocol 63.

Zone Wars is now playable in public matchmaking and private rooms. Tilted District provides nine multi-storey landmarks, randomized interior spawns, fresh five-slot loadouts, six moving storm phases, building/editing, siphon, round wins, series results, spectator play, rematches and host recovery. Public parties compete as solo rivals; private rooms support 2–16 contestants with optional bot fill. See [reference notes and differences](ZONE_WARS_REFERENCE.md): this is a researched, original implementation, not a verified identical Fortnite replica.

The Choose menu order is Frontier Royale, Box Fights, Zone Wars, Zombies, Free For All, Training. Menus now share consistent panels, typography, controls and spacing, including Social, feature requests, waiting rooms, pause screens, emotes and career mastery. The lobby has a separate Public/Private switch below the Build/Solo row. Match Options retains its privacy selector, and switching back restores customized private settings.

Frontier Leaders now has a mode selector for each statistic. Kills and Wins follow Play independently until overridden. Competitive public totals persist separately for Royale, Box Fights, Zone Wars, Zombies and Free For All. Training shows local practice progress. Zone Wars counts round victories, Box Fights counts series victories, and Zombies counts successful extractions. Existing Royale scores remain intact.

Lobby chat is raised and displays an unread count. Opening a channel marks that channel read, while unseen messages in other channels retain their count. Own messages, duplicate deliveries and historical messages do not inflate the badge.

Box Fights resets camera facing at every round boundary and rejects stale input packets from the previous round, keeping players pointed toward the barrier on spawn.

Verification includes simulation lifecycle, randomized kits and spawns, actual staircase traversal, preparation prediction, build edits, storm completion, per-mode persistence/deduplication, ten real participants, party admission, active host migration and desktop browser flows. Sixteen-seat simulation p95 was approximately 1.1 ms locally, with a 30 Hz tick budget. CI runs the focused gameplay/socket suites and both Zone Wars and Box Fights browser acceptance. Live verification requires matching website/relay commits before testing private rooms and the lobby.
