# Update 211 — Compete

Compete precedes Career and provides event discovery, weekly/monthly calendars,
status filters, local bookmarks, event details, placement rewards and searchable
live/final standings. The event UX follows Epic's documented Compete flow:
https://www.fortnite.com/news/fortnite-br-c6s2-competitive-details-new-and-improved-compete-tab

The relay owns two independent dated Frontier Cup lifecycles. October 23's
persisted result and entitlements remain unchanged. October 26 entry opens at
12:00 EDT, closes at 12:01, and other matchmaking closes at 11:57. Same 48-player
Solo Royale rules, no filler bots, late/after-elimination spectating and safe
automatic reopening. There is no recurring or second concurrent tournament.

Podium: 5,000 / 2,500 / 1,000 Marks. New champions receive Frontier Champion;
previous owners receive 10,000 additional Marks instead. Result, award amounts,
duplicate bonus and entitlements commit in one transaction using event+identity
grant keys. Every future competitor's final placement is saved, including zero
prize placements. The legacy event exposes only the podium it actually saved.

The lobby spotlight uses server time: entry minus one hour through completion
plus two hours. Expired cards disappear; archives remain in Compete. Live ranks
are provisional and never label surviving players as final winners.

`public/compete/frontier-champion.png` is a capture of the unchanged production
`makeShopPickaxe('pickaxe-frontier-champion')` mesh, not a concept image.

Verification: original tournament socket lifecycle; two-event archive isolation;
all placements; duplicate winner once-only award; first-time award; missed-event
cancellation; exact card boundaries; escaped names; desktop navigation, calendar,
bookmarks, search, scrolling, card expiry and entry lock; production build.

Version 6.20.0 / protocol 80. Character model work remains separate.
