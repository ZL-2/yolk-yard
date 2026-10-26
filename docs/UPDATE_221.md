# Update 221 — automatic Cup fair play

Automatic enforcement runs on the trusted server simulation, never player reports or client-hosted snapshots. Opposing pairs are checked once per simulated second. Only grounded, living, connected human competitors outside storm pressure are eligible. Legitimate teammates in Duos, Trios and Squads, warmup, transport, cover-separated players, crowded final circles and telemetry gaps are excluded. Hits or aimed shots between the pair veto enforcement. The existing match tick and inputs remain unchanged.

A pair must sustain visible close co-travel, avoid attacking one another and repeatedly damage the same opposing teams in separate fights. Enforcement requires either reciprocal supply transfers with this combat evidence, or a longer, stronger multi-fight pattern. Every punished player must independently satisfy a qualifying pair; graph neighbours are never banned by association. Ambiguous patterns are recorded without punishment. There is no owner approval step. Reports are authenticated, match-scoped and rate-limited, and cannot cause a vote ban.

The server atomically saves the decision and each player's one-hour suspension before removing them. One player receives at most one penalty per match. Re-entry and all public/private mode admissions are rejected server-side. Connected training also respects the restriction. The affected players retain social connectivity to see their status and request review. The client shows a removal dialog, a persistent countdown with the end time, and the excluded Cup in the lobby and other open panels. Refreshing or opening another tab does not clear the server record.

Next-Cup eligibility is independent of the one-hour timer. A restriction retains the event ID when the owner edits its dates or format; cancellation moves it to the next available event. With no future event, it waits for a manually scheduled Cup. Completion consumes the event restriction. Removed players receive no current-Cup prize. Owner Access → Fair play retains evidence and permits an audited reversal. It cannot put someone back into a Cup that has already started.

Limitations: these conservative rules have scenario-test coverage, not a measured production precision rate. No claim of perfect detection is made. Some teamers will evade the required evidence, particularly in small or short matches. Player-hosted modes cannot provide trusted simulation evidence for automatic teaming verdicts. Browser identities are not verified human accounts; a new browser/device identity and modified offline code cannot be reliably blocked without an account system. Shared IP addresses and Wi-Fi are deliberately not used to punish people.

References researched October 26, 2026:
- PUBG's report-system developer letter: https://pubg.com/en/news/1529 (reports plus gameplay/ML analysis; false-positive controls).
- Greige et al., Collusion Detection in Team-Based Multiplayer Games: https://arxiv.org/abs/2203.05121 (multiple behavioural features; false positives; its model flags candidates rather than automatic sanctions).
- Epic reporting policy: https://safety.epicgames.com/policies/reporting-misconduct (evidence and reporting support).

The automatic policy here is an original conservative implementation, not a reproduction of proprietary Fortnite or PUBG anti-cheat or the paper's model.

Validation: detector scenarios cover three solo teamers, cross-team Duos/Trios/Squads, supply corroboration, aggression including missed shots, ordinary third parties, proximity, cover, storm, final circles and sample gaps. Integration checks cover removal, all-mode admission, reservation rechecks, hour expiry, schedule changes, manual future events, persistence, reward exclusion, owner authentication, idempotency and reversal. Browser checks cover 48-row Cup scrolling (wheel, drag and keyboard), update stability and persistent restrictions.
