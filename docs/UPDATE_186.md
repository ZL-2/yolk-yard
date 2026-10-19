# Update 186 — Service, joins and action responsiveness

Version 6.7.0 / protocol 68.

- Error dialogs, service-error toasts and match reconnect banners offer a report action. Reports go through the authenticated support inbox, with bounded diagnostics and optional notes. Failed submissions keep the form and retries reuse a report ID. Existing support replies and archival apply.
- Public join notices follow a confirmed actual admission, excluding private matches, spectators, duplicate join acknowledgments, the joining player and blocked relationships. Notices expire after 20 seconds and appear between the lobby character and name.
- Targeted joins carry room code and match ID. Party readiness, size, capacity (including reservations), visibility, host recovery and entry phase are validated. Both admission and the player host recheck cutoffs. No new-room fallback or silent spectator admission. Public Zombies uses its existing server room.
- Social refresh retains scrolling and does not reopen a dialog closed while a request was in flight.
- Baseline host snapshots and transmission run at 30 Hz (previously snapshots 60 Hz / transmission 20 Hz); important action events may flush at 60 Hz. Structural, pickup and result checkpoints remain immediate; build-health-only updates no longer copy the whole recovery world. Routine checkpoints remain every three seconds. Backpressure and reliable ordering remain intact.
- Build-preview position changes reuse geometry; edit hover changes only colors. Geometry still updates for actual shape/selection changes.
- Leaving an active 1v1 Box Fights series awards the rival the series exactly once, with no fabricated elimination. Works during preparation, fighting and intermission, for private/public matches and host migration. Waiting lobbies, observers, larger teams and Zone Wars are excluded. Explicit departure is sent before transport shutdown; temporary loss keeps reconnect grace.

Validation focuses on exact-room races, capacity and cutoff edges, support persistence, forfeit recovery, snapshot transactions and desktop flows. No mobile work.
