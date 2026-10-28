# Replay storage recovery

October 28 incident: match_replay_chunks occupied 676,614,144 bytes. The persistent 974 MiB filesystem was full; daily full-database backups and failed partial backups amplified the footage growth. Social writes failed. Process restart reduced anonymous memory from about 358 MiB to 115 MiB; failed writer tasks had retained their frame buffers.

Policy: ordinary footage expires after 24 hours or earlier under the 96 MiB compressed-footage budget. Active recent recordings and retained moderation evidence are protected. When protected data fills the budget, new footage is skipped with explicit metadata gaps and an owner warning. Player accounts, progression, friendships and sanctions are never pruned by replay rotation. A single oversized chunk is rejected before insertion.

The writer performs rotation and guarded compaction off the game thread. Old SQLite allocation is compacted only when at least 128 MiB is reclaimable and free space covers twice the compact database plus 32 MiB. Failed queued tasks release memory; queue accounting is capped at 16 MiB and errors back off before retry.

Daily backups retain at most two verified copies within a 256 MiB total budget, check free space before copying, and remove failed temporary files. Oversized databases skip backup until compaction; automatic failures retry at most hourly. Backup success is verified with SQLite quick_check.

Validation: node --test tests/replay-storage-budget.test.js exercises busy-day rotation, age expiry, evidence protection, active recording protection, real worker writes and failed-task memory release, plus verified backup rotation and temporary-file cleanup.
