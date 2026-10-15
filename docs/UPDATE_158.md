# Update 158 — Share the Front

Version 5.11.1, protocol 54.

After the social service accepts any incoming referral and returns the player's own public code, the browser replaces the address bar's `ref` parameter with that code without reloading. Other query parameters, room invitations, hash navigation and browser history state remain intact. Sharing the ordinary address now supplies a valid personal referral. New visitors still must choose a player name; self referrals and returning identities still do not qualify.

New referral credits persist an acknowledgement cursor in the same locked wallet transaction as the currency credit. A small congratulations banner appears after the Season, referral and third-person informational screens, while the player is in the lobby. It stays until dismissed. Refreshing or leaving before dismissal retains it for the next visit. Multiple rewards aggregate; dismissing a displayed total cannot consume a newer reward. Existing historical credits do not announce again, and wallet replay protection is preserved.

Third-person wall editing previously tested the edit plane, which lies inside the wall, against that wall's own collision thickness. At angled views this exceeded the small surface tolerance and prevented tile selection. Edit reach now excludes only the target structure from the player-to-grid check. Other walls and terrain continue to block editing. UI entry, sampling and targeting consistently use the current local camera settings and predicted position for keyboard, scroll-wheel and touch actions.

Focused validation covers URL/history preservation, durable reward acknowledgement and deduplication, grid painting/confirmation/reset across all wall rotations, and intervening cover. Browser acceptance exercises a referral copied from the address bar, offline credit, all three opening screens, banner persistence/dismissal, and host/guest third-person wall paint, confirm and reset. Publication is authorized with active players; unrelated suites are skipped.
