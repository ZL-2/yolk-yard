# Update 223 — Live owner tools, fair play evidence and Cup spectating

Version 6.30.0, protocol 87. Optional relay messages remain compatible with older clients; recordings require an updated host in player-hosted matches.

## In-match owner tools

Type `/` immediately followed by the existing numeric owner key, then Enter. Slash text is intercepted before chat, masked while typing, and rejected by lobby chat, match chat and relay forwarding. Authentication uses the existing owner HTTPS endpoint and a short-lived in-memory session. The key is not placed in chat, logs, URLs or browser storage. `/owner` reopens that session; `/lock` revokes it.

The movable, touch-friendly panel supports player search, multi-selection, private warnings, removal, 1-hour/24-hour/7-day suspensions, text mutes and reversals, teaming/cheating penalties, announcements, case reversals and ending the current match. Actions show their exact targets and consequences before submission. Match IDs and authenticated roster identities are rechecked server-side. Request IDs make retries idempotent. A cancelled Cup has no fabricated winner or Cup payout. The owner remains vulnerable while using the panel.

Affected players receive persistent notices and restriction end times. Suspended identities may reconnect to read or acknowledge restrictions and submit an appeal, while gameplay and chat remain blocked. Acknowledging a notice does not remove its active restriction banner.

## Option 3 teaming conditions

Every suspected pair qualifies independently; membership in a larger group is not guilt by association. A 180-second observation window excludes teammates, bots, loading/dead/downed/flying players, spawn/transport stages, storm escape and the small final circle. Proximity alone never qualifies.

A shared encounter requires both players to deal at least 15 damage to a common opposing human within 8 seconds. A qualifying episode includes at least 12 seconds and 12 metres of parallel travel together after that encounter. A continuous fight is grouped as one encounter.

- Strong path: at least 45 observed nearby seconds, 20 metres of parallel travel, one qualifying episode and substantial reciprocal supplies (two distinct picked-up drops in each direction across two item types).
- Repeated path: at least 60 nearby seconds, 35 metres of parallel travel and two qualifying episodes. Supplies and three distinct victims are not mandatory.
- A minor hostile signal requires a third episode; short separation or a token shot does not clear evidence. Sustained mutual combat vetoes enforcement in that window.
- Cup evidence is server-observed. Public Battle Royale requires the elected host plus two non-accused observers with agreeing movement and encounters. No owner review gate is required.

Removal denies final match rewards and suspends all modes for one hour. **Only a violation during a Cup also excludes the next scheduled Cup.** Older normal-match penalties no longer produce a Cup exclusion. Existing Cup exclusions still follow cancellation/rescheduling rules.

## Reports and recorded evidence

Death screens offer a report for the recorded human eliminator, with teaming/cheating categories and optional details. Requests are tied to the match and authenticated reporter. Duplicate reports are collapsed, submissions are rate limited, and reports never lower the punishment threshold. A valid report immediately raises monitoring priority and samples involved pairs more frequently. Owner Detection History includes these unverified reports and their recordings.

Replays capture the match from the beginning of recording through its completion, retaining footage before and after a removal. They are tactical playback of player positions/aim, health, combat events, builds and storm state, sampled at 2 Hz; they are not screen videos. The viewer offers scrubbing, speed control, player focus, zoom and report/removal markers. Gaps and interrupted recordings are labeled, and missing movement is not interpolated. Old matches without recordings cannot be reconstructed.

Server-run recordings and elected-host recordings are labeled separately. A client-hosted recording is not authoritative proof against its host. Match data is compressed into bounded SQLite chunks, with periodic cleanup independent of whether a Cup is running; flagged/reported recordings are retained, while unflagged temporary recordings expire after 24 hours. Replays contain no chat, owner keys or authentication tokens. Owner authentication is required to view them.

## Integrity controls and limits

The relay rejects unauthorized authoritative-state messages, forged damage/reward messages and malformed controls. Inputs retain only allowed control fields; position, health, inventory and client elapsed time are discarded. Movement uses fixed simulation steps, bounded input queues, server/host collision and weapon cooldowns. Input floods are dropped without banning ordinary packet bursts or reconnect jitter.

Three authenticated non-host authoritative-state forgery attempts across at least two seconds within a 30-second window trigger immediate cheating removal and the same context-sensitive penalties. Invalid input/rate signals are recorded without punishment on their own. Legitimate host state, fast aim changes and player reports do not meet this rule.

These controls do not establish complete aimbot, wallhack or malicious-host detection. Public matches still run on a player host, and browser identities are not verified human accounts. Eliminating those trust limits requires a separate authoritative-server/account architecture; this release does not claim otherwise.

## Validation

Coverage includes Cup versus normal-match penalties, owner authentication and stale actions, retries, notifications and reconnects, manual Cup disqualification/rewards, private commands, forged-state attacks, input tampering/floods, false-positive cases, report abuse, replay persistence/privacy/retention, complete and interrupted recordings, UI playback controls, large build-heavy recordings, fully reserved queues and legitimate replacement-host traffic.

The full game browser check creates a Cup through the authenticated website schedule API, clicks the lobby Spectate button, verifies full-seat feedback, watches a live opponent, switches targets, leaves/rejoins without duplicate seats, opens the owner panel as a spectator and cancels the Cup with no payout. Separate checks cover the actual match owner panel and death-report submission.
