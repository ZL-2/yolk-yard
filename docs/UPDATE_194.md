# Update 194 — Keep the rounds rolling

Version 6.10.0 / protocol 70. Publish immediately, including while matches are occupied, as requested. Protocol 70 keeps old browser hosts from interpreting the new unlimited-round target as a one-win series. Players refresh to join the updated rooms.

- Settings → Player → Change Name uses the existing validated profile and live roster update path, preserving identity, progress and friend code.
- Match connection warnings, error dialogs and error toasts display F8 → Report Problem. F8 releases capture and opens the real support form, whose existing identity and deduplication path delivers the report to the owner inbox.
- Fixed the browser host command allowlist rejecting all guest emote actions. Starting an emote clears old queued commands; Box Fights and Zone Wars now preserve dancing orientation during remote movement processing. Toggle input resets when selecting a dance. Eliminated winning teammates can be rendered during round celebrations too.
- Public Zone Wars uses scoreLimit 0 for unlimited rounds. Private settings expose 0 / Infinite plus finite targets. Existing round-specific reward frames and durable per-round score records credit every public round once, including repeat frames and host transfer. The new real-socket test wins seven rounds and transfers the host without awarding an extra win. Box Fights keeps its five-win public series.
- Mouse capture is checked even when a browser omits pointer-lock-change events. The explicit Enter Game button requests native capture. Deliberate menus, chat, spectators, results and pending requests suppress the prompt; Game Menu remains accessible from it.
- Public join notices include the server-supplied team size/format. Exact-match admission is retained. Private rooms are excluded from mode populations without concealing their friend presence. Connected training is still reported separately.
- Match invite links validate the current room code and strip stale page parameters/hash. Clipboard denial displays a selected text field for manual copy. Missing rooms never generate an undefined invite.
- Removed the entire Access & Security owner tab and its UI handlers. Existing owner sign-in and header Lock remain.

## Performance evidence

Identical workloads compared with the published Update 193 checkout (71cac23). Each workload includes player-built structures; Royale Duos includes 48 contestants and 15 world NPCs. Isolated process benchmark medians:

| Workload | Previous ms/snapshot | Updated ms/snapshot | Reduction |
|---|---:|---:|---:|
| Zone Wars, 16 players / 500 builds | 0.290 | 0.180 | 38% |
| Box Fights, 8 players / 220 builds | 0.138 | 0.088 | 36% |
| Royale Duos, 48 contestants / 500 builds | 1.135 | 0.760 | 33% |

Box Fights movement plus sight queries fell from 0.911 ms to 0.084 ms (91%) after routing that arena through the existing spatial collision index. Snapshot construction uses a stable field layout instead of repeated computed-key dictionary allocations. These measure CPU work, not device FPS or network ping.

## Targeted verification

- Real relay: guest emotes while fighting, intermission, results and cancel; unlimited rounds and exactly-once round rankings through migration; private code joins, name propagation and private population exclusion.
- Simulation: round reset, random spawn loot, city collision/storm, late admission, box series/forfeits, collision/build edits, snapshot round trips and remote inputs.
- Desktop: Settings name change, removed owner section, Infinite option autosave, format-aware exact join notifications, actual guest emote wheel and spectator rendering, native pointer capture recovery, menu preservation, copied invite, and F8 report delivery.
- Production build and post-publication website/relay commit verification. No mobile suite or full unrelated regression suite.
