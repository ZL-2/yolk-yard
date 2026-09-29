# Quality Update 62 — Fieldcraft & Firepower (3.1.0)

Protocol 21 moves online match simulation into the relay. A room leader controls lobby settings, but cannot submit combat state. Each authenticated socket owns only its input and interaction intent. The server validates elapsed movement, standardized stance hit regions, damage, team membership, knocks, revival and marker audiences. No animation bones are transmitted. Room leadership can change while the simulation stays in place; socket recovery retains identity and excludes disconnected time from activity.

All eleven firearms use `data.js` names and `makeBlaster` geometry. `npm run art:weapons` regenerates the entire weapon image catalog; its manifest records source and asset hashes. Inventory, loot, HUD and previews use that catalog. Reusable meshes, merged material batches and a separate first-person camera retain readable detail without world-FOV clipping. Reticles are weapon-specific. Original synthesized pressure, crack, tail and mechanism layers distinguish firing/reloading; no commercial game recordings are used.

Humanoid outfits share the same skeleton contract and combat regions. Clothing, hair, helmets and back accessories remain visual-only. Full-body states include crouch idle/motion, slide, downed/crawl, revive and being revived. Upper-body handling continues independently when crouching. Head proportions, clothing seams, carrier panels, knees and boots were refined within the existing geometry budget. The lobby walks in place with time-driven scanning and grip shifts.

| Mechanic | Rules |
| --- | --- |
| Crouch | Hold Control by default; 48% normal movement, 1.25 m body height. Clearance prevents standing under ceilings. |
| Slide | Crouch with at least 5.5 m/s validated ground momentum; slope-sensitive friction, limited steering, 10.5 m/s cap, 3.4 s maximum and 0.65 s cooldown. Jump exits; low ceilings retain a compact pose. |
| Downed | Duos only with an active teammate. 100 vitality, 22% movement, no combat/build/loot/use. Bleed begins after 1 s at 2/s; repeated downs increase depletion. |
| Revive | Hold Interact within 2.6 m and unobstructed proximity for 10 s. Restore 30 health. Movement, release, firing or combat damage interrupts; progress decays at 1 s/s. One validated helper progresses a target. |
| Team wipe | A team with no active member is eliminated; original knock credit, placement and victory resolve once. Storm still damages downed players; storm damage itself does not interrupt an otherwise valid revive. |
| Markers | Middle mouse normal / Y danger, rebindable. One per sender, 0.8 s spacing, at most three per six seconds. Danger 12 s, world 45 s, map 90 s. Only the sender and Duo receive marker state. |

The published Epic DBNO device documentation informed vitality/decay and a 10-second revive; Epic's movement documentation informed crouch-to-slide behavior. These are Ravelfront's explicit rules, not a claim to reproduce every current Fortnite playlist setting.

Persistent profile, wallet and cosmetic storage keys remain compatible. This update does not rotate the production owner credential. Authentication and short-lived authorization remain server-side; the logo gesture only opens the sign-in interface. Regression checks exercise invalid/valid ephemeral fixture credentials, analytics, session information and the authenticated Marks tool without reading the live secret.

Essential verification: focused weapon asset/audio/viewmodel tests, humanoid/hitbox tests, crouch/slide clearance and packet-gap tests, DBNO/revive/team-wipe/storm tests, actual WebSocket authority/reconnect/leadership tests, and actual lobby browser owner/party/input/marker/ADS checks. Browser capture artifacts are retained by the release workflow. Live verification checks the exact deployed commit, relay protocol/features and a real private Duo party launch.
