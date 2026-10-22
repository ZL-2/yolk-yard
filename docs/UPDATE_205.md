# Update 205 — Royale Prestige

Version 6.17.0 / protocol 77.

Public Battle Royale now has a Victory Score leaderboard: `1,000 × wins + round(100 × sqrt(kills))`. Existing verified all-time public totals are retained. Wins have constant value, while kill points have diminishing returns. Other modes keep their independent kills and wins boards. Score ties use wins, kills, then a stable identity order; renames cannot change the last tiebreak. Zero-score entrants cannot receive a rank reward.

The four exclusive pickaxes are cumulative, conditional entitlements:

| Place | Pickaxe | Design |
| --- | --- | --- |
| Top 25 | Tempest Talon | Hooked stormglass blade, silver armor and cyan inlays |
| Top 10 | Rift Reaver | Twin violet crescents around a suspended core |
| Top 5 | Solar Dominion | Gilded executioner blade and solar engravings |
| #1 | Apex Sovereign | Ivory edge wings, black titanium and floating gold crown |

The server stores eligibility and claims on the authenticated social identity. Dropping below a cutoff removes both access and that item's claim; returning offers it again. Claims and equips are revalidated against current rankings, and equipped rewards are removed from connected players when revoked. The local currency wallet cannot buy or grant these tools, and loadout presets are revalidated. All tools retain standard pickaxe gameplay stats.

Newly earned rewards appear together with Claim, Equip and Claim All. During combat, a notification announces them without taking the player's controls; the Field Menu can open the reward screen. The full popup appears automatically in the lobby. The Locker shows the collection and live access, and the Royale board opens a formula/scaling explanation with worked examples.

Models use original beveled geometry, physical rank seals, textured metal, grips and luminous inlays. Gameplay, reward portraits and Locker previews use the same models. Cached geometry is shared and each tool uses two batched draws; no lights or particle systems are attached to players. Credits identify the new original work. No external assets, dependencies or mobile work.

Focused validation covers score weighting and ties, all four cutoffs, claim authorization, active-match revocation, wallet/preset bypasses, bounded model geometry, existing scoring/identity/shop compatibility, production build, and the desktop flow against a real relay. The browser check earns four rewards, claims/equips them, reloads, connects a second authenticated session, drops to #2 and #26, rejects an invalid claim/profile, then regains and reclaims all four. CI retains screenshots and the result report and runs the normal published website/relay gate.
