# Update 180 — Visit history accuracy

Version 6.4.1 / protocol 64. Owner revision 3; visit analytics revision 2.

The total is now labelled **Recorded visits**, with the earliest dated record, number of detailed records, recovered older visits whose dates are unavailable, and the saved-file recovery result. The application cannot verify visits that were never stored or were lost before durable storage existed. It does not invent a lifetime count.

A visit is a browser-tab session. Returns after 30 minutes without foreground observation start a new visit. Refreshes and the regular heartbeat continue the current visit. Page opens are counted separately from this release onward; past page-open counts are unknown. Hidden tabs stop regular heartbeats and do not count as active online visitors. The server also expires inactive sessions from older clients that continue sending hidden-tab heartbeats.

Each page sends an idempotent page identifier and ordered sequence numbers, so duplicate heartbeats or a delayed close from an earlier page cannot end the current session. Idle gaps no longer spread active-time estimates over long empty intervals.

On startup, the relay checks known owner JSON files, `.bak` / `.backup` copies, owner SQLite files, and the latest 14 native backups in the current history backup directory. Recovery reads only bounded, recognized owner-history files beside the configured database/legacy file. It preserves the original files and merges missing visit records, without restoring a disk or rolling back current controls, restrictions or grants. Invalid candidates are reported in the private coverage information. No private counts are exposed through `/health`.

A historical counter is a floor for its corresponding legacy records: when dated records are recovered, they replace the undated portion instead of being added to it a second time. Duplicate backups do not multiply totals. SQLite recovery preserves the visitor hashing salt if the new store had no visits, retaining comparable anonymous visitor identifiers.

Focused verification covers older overlapping counter snapshots, retained SQLite backups, restart persistence, idempotent page opens, delayed events, hidden-tab inactivity, ordinary owner authentication, real-socket controls, and the affected social/progression paths. Desktop owner acceptance checks the actual dashboard and full game entry.

Historical request logs require access to the correct Render workspace; request totals alone are not website visits, because a visit emits many requests and heartbeats. GitHub repository traffic is also not a reliable measure of GitHub Pages game visits.
