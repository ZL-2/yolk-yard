# Icon Series community vote

Closes October 27, 2026 at 15:15 America/New_York (19:15 UTC).
Server time controls writes. Each existing authenticated browser identity gets
one replaceable vote. Clearing browser data or using another browser can create
another identity; this is not verified one-person-one-vote.

The initial lobby prompt requires a vote while voting is open. A shortcut beneath
the news carousel reopens nominations, counts and vote changes. After closing,
results remain available and unvoted players can play. The queue checks every
party member; local training is gated too. No candidate is pre-seeded and no
photo-derived prototype is published by this change.

First/last names each require at least three letters, maximum 40 characters.
Unicode normalization, diacritic/case/punctuation folding, reversed full names
and one-edit near matches prevent duplicate nominations. Close matches are
conservatively rejected rather than silently creating separate options.
Maximum five nominations per identity and 500 per poll; mutations rate limited.
Concurrent writes are serialized and atomically persisted before acknowledgement.

Storage: icon-vote-2026-10.json alongside the existing social identity database.
Production must use the configured persistent data mount. No real-name signup,
photo upload or automatic winning-skin release is introduced. Candidate likeness
and assets will need a separate review before that character is published.

Validation: rules/service tests cover boundary, duplicates, concurrency, vote
replacement and restart. Browser check covers required modal, Escape handling,
cast/unlock, shortcut and vote changes. Production Vite build passes.

Owner controls → Icon Series allows renaming and deleting nominations with audited, authenticated requests. Renames retain votes and use the same three-letter and duplicate checks. Deletion clears associated votes; affected players must choose again while voting remains open. Stale edits are rejected. Owner moderation remains available after closing.
