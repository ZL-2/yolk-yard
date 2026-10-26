# Frontier Cup team formats and Trios

Lobby tournament cards now appear two hours before entry. Existing event times and the two-hour results window remain unchanged. Cards, Compete, owner schedule, match listings and competitive career show the mode suffix, including legacy Solo events.

Owners can choose Solos, Duos, Trios or Squads before an event locks. Team size persists in the schedule and cannot be changed after lockdown. Legacy events default to Solos without rewriting historical results.

The party leader reserves the whole party in team cups. Admission checks every member and total remaining seats before issuing any tickets. Teams use a fixed reservation, remain together through entry retries, and cannot change teams by editing lobby membership. Smaller parties may compete without Fill. Incomplete/loading parties spectate together at the deadline, and a cup needs two opposing ready teams. No bots are introduced.

Team placements are ranked as a unit. Each teammate earns the full configured placement prize, including eliminated winning teammates. First-time champions receive the pickaxe; existing owners receive their individual repeat-winner bonus. Awards remain durable and idempotent.

Trios also works in public and private Royale selection, matchmaking pools, party sizing, HUDs, chat, downing/reviving and victories. Protocol 86 requires the matching client/server release; version 6.26.0.

Validation: tournament lifecycle, owner persistence and format locking, clock boundaries, real sockets for all team sizes, partial-party cutoff, oversized/full reservations, shared prizes and restart idempotency, public Trios, team chat, teammate bots, owner browser creation/edit/duplicate and frozen rules, and production build. The pre-existing `cached collision buckets` assertion in field-systems reproduces on unchanged upstream f486a2f; collision code is outside this patch.
