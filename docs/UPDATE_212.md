# Update 212 — Owner-managed Compete schedule

Owner Access → Compete schedule now supports create, inspect, edit, duplicate,
cancel, remove from public Compete and export. Fields include title, description,
region label, matchmaking closure, entry opening and match start, 2–48 competitors,
0–16 extra late-spectator seats, three podium Marks awards, optional Frontier
Champion and configurable repeat-winner Marks. The supported match rules remain
one Render-authoritative Solo Royale with building and no bots.

All input dates mean America/New_York regardless of the browser's local timezone.
EDT/EST conversion is explicit; missing and ambiguous daylight-saving times are
rejected. Lobby visibility remains one hour before entry through two hours after
completion. Ordinary matchmaking still reopens after durable results or safe
cancellation. A 32-minute reservation after start prevents concurrent matches.

The server stores the catalog, revision, audit entry and idempotent request receipt
in the existing durable SQLite transaction. Live clients receive updated summaries.
Defaults seed only a previously unconfigured schedule: removed events do not return
on restart. Metadata can be corrected after start, but competitive rules, placement
results and paid awards cannot be rewritten. Cancellation does not fabricate or
pay a winner. Removed events remain in the owner's history and disk backups.

No new production event, manual award, active-match test entrant, character change,
hosting-plan change or simulation migration is part of this release. October 23's
real result and October 26's scheduled Frontier Cup remain unchanged.

Verification: owner authentication/origin enforcement; CRUD/replay/conflicts;
disk restart; overlap and malformed input rejection; real-socket cancellation and
reopening; frozen archive; zero-Marks winner entitlement; dynamic public rendering;
desktop owner browser forms, confirmation, export and America/Los_Angeles versus
New York DST behavior; existing tournament and Compete regression coverage.
