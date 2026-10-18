# Update 178 — Owner Control Room

Version 6.4.0 / game protocol 64. Owner API revision 2.

Owner Access is now a dedicated twelve-section workspace. Open it from the game menu by typing **RAVELFRONT** or tapping the logo seven times, then enter the existing private numeric code.

- **Overview:** authenticated players online, preserved all-time visits, visits in range, live rooms, mode population, service health, and backup status.
- **Analytics:** date and mode filters; daily visits, anonymous browser visitors, new/returning visitors, foreground time, mode engagement, concurrency, reported client FPS, recorded public outcomes, and paginated session history.
- **Players:** search by name, Friend Code, or identity; online/restricted filters; persistent public statistics for each competitive mode; notes, recent outcomes, grants, and restriction history.
- **Matches:** live roster, capacity, host type, stage/round and recovery state; close a selected room; retained historical room records.
- **Moderation:** temporary or indefinite identity suspensions and lobby chat mutes, revocation, disconnection, notes, and universal chat clearing.
- **Support:** searchable conversations, status filters, replies, completion notices, archive and restore. The archive retains replies even when the active notification inbox is compacted.
- **Marks & rewards:** public reward summaries, match receipts, a permanent grant ledger, and grants to connected or offline identities. Client credits use cumulative server totals, so duplicate delivery does not grant twice.
- **Worlds:** published map revisions, drafts, object totals, model assets, and the existing world editor. Saves, publishing, and imports enter the audit trail.
- **Service:** pause new matchmaking, control public/private availability per mode, pause lobby chat, set slow mode, and schedule timed announcements. Accepted matches can continue during a matchmaking pause.
- **Storage:** verified daily SQLite backups, manual backup downloads, complete portable history exports, filtered CSVs, and previewed append-only history merging.
- **Audit:** searchable action, access, deployment, incident, error and connection events, with detail inspection and exports.
- **Access:** code rotation persisted as a salted hash, other-session revocation, and explicit locking. Owner tokens remain only in memory and expire after 30 idle minutes.

## History that survives deployments

The former owner JSON store discarded sessions after 30 days or 1,000 records. The new indexed SQLite store has **no automatic age or count deletion** for visits, activity segments, results, matches, audit events, telemetry samples, tickets, restrictions or grants. Surviving legacy records and the legacy visit total migrate once. Previously deleted details cannot be recovered.

Production uses the existing mounted Render data disk. History writes use SQLite WAL with full synchronous commits. Corrupt, unsupported, or unreadable legacy data fails closed instead of being replaced with empty history. A heartbeat can resume the same browser visit across reloads or short deployments without duplicating the visit count.

Daily consistent backups are verified before publication; the latest 14 snapshots are retained. This snapshot retention does not trim the live database. Download backups for protection against loss of the disk itself.

## Measurement boundaries

Visitors are anonymous browser identifiers, not unique people. Foreground time is estimated from heartbeats; hidden periods and long idle gaps are excluded. Dates in charts use UTC. Session filters select visits started in the range, and a selected mode matches any segment of that visit. Rooms are observed every 15 seconds. Performance figures cover only clients reporting telemetry. Receipt kills reflect reward eligibility; player directory counters use the persistent public ranking totals.

Training remains local practice and has no server-verified competitive outcome ledger. Connected clients respect its availability switch. Identity restrictions operate on authenticated browser identities, not IP addresses. No raw IPs, private chat content, social credentials, plaintext owner codes, or owner tokens are included in analytics or audit exports. Marks wallets and purchases remain local to the player's browser.

## Focused release verification

- SQLite restart/migration, more than 1,000 records older than 30 days, mode segments and idle time, corruption preservation, backup integrity, append-only merge validation, support archive retention, grants, auth expiry, code rotation and cross-origin denial.
- Real sockets: public mode gates, private-code mode gates, admission reopening, accepted match continuity, chat slow mode/muting, restriction revocation, grants, support replies, and room closure.
- Desktop browser: all twelve sections, search and pagination, complete filtered CSV, player grants, control review, support archive, verified backup download, import preview/merge, locking, and actual game console integration.
- Existing social persistence, private/public admission, reward, ranking and map editor regressions. No unrelated game load or mobile suite is required for this scoped release.
