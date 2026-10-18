# Owner history operations and recovery

The relay runs Node 24 and uses its built-in SQLite API; no additional database service is required. The default database is `owner-history.sqlite` beside `socialDataPath()`. Production resolves that location inside the existing mounted `/var/data/ravelfront` disk. `RAVEL_OWNER_DB_PATH` may explicitly configure another file. Local loopback test servers use an in-memory store unless an `ownerPath` fixture is supplied.

`YOLK_OWNER_DATA_PATH` remains the source for a one-time legacy JSON migration. Do not delete it until the migration has been reviewed. The importer keeps surviving sessions and a baseline for all-time visits whose detailed rows no longer exist. An unreadable legacy file prevents owner history startup rather than silently resetting counts.

The initial owner code still comes from `YOLK_OWNER_CODE`. Changing the code in Owner Access writes a salted scrypt hash into SQLite, overriding the environment value across restarts. No plaintext code is persisted. In disaster recovery, a database snapshot also restores the access hash that existed when the snapshot was made.

## Normal protection

1. Confirm **Storage & recovery** reports a verified persistent file and a successful integrity check. `/health` exposes only the owner revision, availability and persistent-disk status, never private records.
2. Daily and manual backups use SQLite's online backup API, verify `PRAGMA quick_check`, and retain 14 snapshots in `<database>.backups`. All histories in the live database remain unbounded.
3. Download periodic full database snapshots to a separate location. Snapshots on the same disk cannot recover a destroyed disk.
4. For portable history reconciliation, use the JSON export and previewed **Merge earlier history** workflow. It adds absent history IDs and never replaces current records, grants, sanctions, controls, or access settings. The browser import limit is 25 MB. For larger disaster recovery, use a full database snapshot.

## Full database recovery

This is an operator recovery procedure, not a browser action. Stop the relay before touching SQLite files. Preserve the current database **and** any `-wal` / `-shm` sidecars outside the active database location; do not discard a recoverable journal. Verify the candidate snapshot by opening it read-only and checking `PRAGMA quick_check` and `PRAGMA user_version`. Schema 1 is supported by Update 178.

Copy the verified snapshot into the configured database path with owner-only file permissions. Do not leave old WAL/SHM sidecars beside a replacement database. Restart the relay. Check `/health`, owner storage status, known history counts, the access code corresponding to that snapshot, and expected policy/grant state. Keep the displaced files until the recovery is confirmed. Restoring a full older snapshot rolls all owner state back to its snapshot time; prefer an append-only history merge when the current database is healthy.

Production's game identities/progression and map layouts remain in their existing persistent stores. Owner database backups cover owner history/control data, not an entire social/progression/map-disk backup. Map and identity credentials never appear in history exports.

## Retained data and cost

Owner data has no automatic history deletion. Session and audit indexes keep filtered pages bounded, telemetry is aggregated into one row per minute, and existing receipts are imported once at startup. New receipts and support mutations archive immediately. As history grows, watch the database size in Storage & recovery and the existing Render disk capacity. The console does not resize paid services or disks automatically.
