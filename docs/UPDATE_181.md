# Update 181 — Human-only competition

Version 6.5.0, protocol 65.

Zone Wars and Box Fights always normalize public/private settings to zero bots, no bot fill, and no bot teammates. Bot skill is not an option. Direct bot admission is rejected, old checkpoint bots are discarded, and both mode-specific AI implementations are removed. Battle Royale, FFA and Training retain their existing rules.

Rounds wait for at least two eligible human opponents (opposing teams in team Box Fights). The matchmaking countdown starts only when opponents exist; it resets if they leave. A departure during preparation returns the room to waiting without awarding a free round. Late arrivals spectate the active round and use vacant seats in the next round. Public summaries report real population and zero bots. Private start buttons require opponents. Both public and private rematches and host recovery follow these rules.

Kills and Wins share a mode filter. Play mode choices reset that filter automatically. A manual ranking choice remains while the Play mode stays the same, including tab changes and refreshes. Follow Play is removed.

## Reference video status

The user supplied a temporary Googlevideo MP4 URL for a complete Zone Wars map/gameplay rebuild. It returned an inaccessible-site response from this environment. No video frames were retrieved or reviewed; this release does not claim to recreate the video map. A direct MP4 upload is still needed for that work.

## Focused validation

Gameplay and real-socket regressions cover settings normalization, bot admission, legacy checkpoints, no-opponent waiting, preparation cancellation, late joins, rematches, build/edit sync, parties, host migration and rankings. Existing desktop Box Fights and Zone Wars acceptance scripts now check the absent bot controls and shared rankings mode. Mobile checks are excluded from this scoped release.
