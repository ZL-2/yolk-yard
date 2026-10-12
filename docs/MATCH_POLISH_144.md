# Update 144: match polish

The bot-humanization changes shipped in Update 143 remain intact: imperfect
tracking, acquisition delay, bounded flinch, and slower bot burst follow-ups.
Player damage and human weapon cadence have not changed.

## Requested changes

- Lobby rankings have a non-shrinking 365 px card with a 190 px ranking area;
  a visible top-25 personal row is not repeated beneath the list.
- Ground pickup comparisons and the Shield available reminder are removed.
  Deliberate inventory Inspect remains available.
- Each vault guarantees 96 light rounds, 120 medium rounds, 16 shells,
  8 heavy rounds and 4 rockets in ten independent locked stacks.
- Rocket loot weighting increases from 2 to 5; launcher weighting from 2 to 4.
  The rocket carry cap remains 8 and weapon damage is unchanged.
- Rook's hold is level with the salvage deck, with a service catwalk and nautical
  reinforcement. Nyx's reserve is recessed 2.4 m into the woods, approached by
  eight 0.3 m steps. The three vaults retain separate keycards and locked contents.
- Jump Rig: 4 charges, 8 s recharge, 30 m/s directional launch, 26 m/s vertical
  launch. Shadowstep: 6 charges, 7 s recharge, 13.2 m swept dash, 0.85 s recovery.
  Grappler is unchanged. Shared host/guest physics retains collision and landing
  protection; none grants weapon or storm immunity.
- Placeholder `Player` names (trimmed, case-insensitive, NFKC normalized) require
  a nickname before social connection. Saved identity credentials are retained.
  Party hello/profile validation independently rejects placeholder names.
- Original Fortnite-style end-match UI adds a cyan extraction, a 1.25 s camera
  hold, nearest living teammate preference, placement/stats/lobby actions, and a
  #1 Victory Royale banner and winner camera. This is an original implementation,
  not a byte-identical recreation of Fortnite's assets or transitions.

## Asset provenance

`public/art/public-frontier-v144.webp` is original generated artwork requested
for the public-match card: Ravel Coast harbor, coast, airstrip and storm at dusk.
It is resized to 1024 x 512 and compressed to about 61 KB.

The user supplied `Fortnite Death - QuickSounds.com.mp3` and
`Footsteps - Fortnite - QuickSounds.com.mp3`. The shipped field-elimination
sample preserves the supplied death cue with an end fade. Field-footstep crops
one impact at 2.075–2.31 s and band-limits it to suppress background birds.
Field-birds applies a harmonic/percussive spectral mask and a 1.9–9 kHz passband
to the background from 0.85–8.35 s. Separation attenuates overlapping impacts;
it does not claim perfect studio stem recovery. No ownership or additional
third-party distribution license is asserted for the supplied recordings.

`scripts/extract-field-audio.py` reproduces the edits using FFmpeg, NumPy and
SciPy at asset-build time. None of those dependencies ship to the browser.
The three shipped audio assets total about 79 KB.

## Performance and verification

All samples are fetched/decoded once after audio unlock. The existing 56-voice
budget remains, with additional per-sample caps of 8 steps, 2 eliminations and
1 bird clip. No per-step support/box scan is needed. Habitat checks happen only
when the next bird cue is due (11–14 s), not per frame.

Elimination effects are distance-culled at 65 m and capped at four. Each effect
has five draw objects, reuses merged body/beam/drone/ring/point geometry, has no
shadow lights, and releases per-effect materials. A local warm benchmark for
creating four effects measured approximately 0.2–0.4 ms, versus 12–23 ms for
the discarded CPU-skinned mesh-copy approach. Visual slow motion affects only
presentation, never simulation ticks, input cadence or replication.

Focused tests cover stock guarantees, gates, stairs in both directions, charge
state, identity preservation, shared victory, sample caps and effect lifetime.
The existing required build/browser/performance/live-release gates remain.
The match-polish browser scenario covers the laptop/mobile leaderboard,
name selection and saved identity, generated art, decoded audio, elimination
and victory presentation, stats, celebration and lobby return.
