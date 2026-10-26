# Automatic teaming checks in regular public Battle Royale

Version 6.29.0, protocol 87. No owner approval step.

The existing Cup detector used the nonexistent `battle` phase. Royale uses `active` and `drop`; the detector now accepts both and only evaluates grounded eligible players. Evidence also resets on a new match ID. Regression tests cover both actual phases.

## Decision rule

Each opposing pair must qualify independently. Exclude legitimate teams, bots, warmup, transport, loading, disconnected, downed, dead or spectating players. Do not evaluate the first 30 seconds or a circle under 80 metres. Count only observations within 16 metres horizontally, under 4 metres vertically, with line of sight and at least 25 metres inside an active storm boundary. A separation over 10 seconds resets the pair. Observation gaps do not add time. Damage or a shot aimed at the partner vetoes the current observation sequence.

The ordinary automatic threshold is 180 observed seconds, 100 metres moving together, and joint damage to three distinct opposing teams across three fights at least 20 seconds apart. Each player must deal at least 30 damage to the same target within six seconds. Proximity and reports alone never suffice.

Server-run Cups additionally allow a 90-second / 40-metre path with two distinct shared fights, at least two actual supply pickups each way, and at least two item kinds. Regular public matches use only the stricter combat path; their snapshots do not reliably expose supply transfers.

## Regular-match evidence

Every connected client automatically runs the same detector on received gameplay, including geometry and event history. It sends a small heartbeat every five simulation seconds and bounded evidence only on qualification. The relay authenticates the sender against the current public-room membership, match and host generation. An observer must be present for at least three real minutes, with no heartbeat gap over 15 seconds. The host plus two distinct non-accused clients must agree on three targets and at least ten trail points. Evidence must be fresh, structurally valid and attributable to current room members. A host accusation or player report cannot directly impose a penalty. Server checks and candidates are bounded; a short 250 ms batch captures all qualifying pairs before removals mutate a three-person ring.

These observations are corroboration, not independent server truth: clients see a world supplied by the elected host. A malicious host can suppress or fabricate that world, and colluding clients remain a limitation. This is not a statistically calibrated detector and no measured accuracy rate is claimed. Short matches, insufficient observers, missing events, close circles and evasive cooperation may not trigger. Private/custom matches are outside this public-match integration.

## Penalties

Qualified players are disconnected from the current match automatically. Their saved identity is suspended across all modes for one hour and excluded from the next scheduled Cup, even if that Cup begins after the hour ends. Existing persistent countdowns, notices, owner evidence history and audited reversals apply. Regular-match settlement denies final rewards for the source match even after the hour expires. If an accused host is removed, existing host election keeps other players in the game. Client identity remains browser-based, not a verified human account.

## Verification

Detector scenarios, live public/Cup socket enforcement, host removal and transfer, observer authentication and quorum, malformed and conflicting evidence, stale hosts, round resets, penalties and public progression tests. Existing host recovery, tournament editing, Compete and restriction/scroll browser checks remain in CI.
