# Update 207 — Match entry crash fix

The four Royale Prestige pickaxes were model-based items without a legacy `shape` number. `pickaxeStyle` indexed the shape-family table with `NaN`; `pickaxePose` then read `wind` from `undefined`. `View.update` threw on the first held-tool frame and the next animation frame was never scheduled. A host stopped broadcasting, so guests could also stall during admission. The same error could occur when rendering another player’s equipped tool.

All four rewards now select an explicit swing style. Unknown, incomplete or model-only cosmetic definitions safely fall back to the standard animation. Reach, cadence, damage, rank eligibility and saved claims are unchanged.

Regression coverage exercises every catalog pickaxe through idle, strike and recovery with both first-person and third-person hand placement. The browser check uses the actual lobby Play button, a real relay and guest, claims/equips all four rank rewards, advances both perspectives, reconnects the guest, then starts and advances a Royale battle.

Version 6.17.1; protocol 77 (no wire-format change). The previous focused release checks omitted the existing pickaxe-animation suite and never entered gameplay with an equipped rank reward. This release runs that suite and the actual ranked-loadout match-entry check.
