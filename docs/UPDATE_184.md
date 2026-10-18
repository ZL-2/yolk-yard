# Spawn loot and visible opponents — 6.6.1 / protocol 67

- All sixteen possible Zone Wars spawns receive a fresh five-item ground line each round, including empty rooms. The assault rifle is nearest the initial player position, followed by the shotgun, third weapon/utility, shields, then healing/utility.
- Players start with a pickaxe and the existing health, shield, ammunition and materials. Walking over the line collects the equipment; manual pickup and saved preferred inventory slots still work. Preparation bounds include the full line. A full inventory is never automatically replaced, and deliberately dropped weapons are not automatically collected again.
- Floor seam support prevents items on upper floors from dropping through adjoining tiles. Loot remains subject to normal destruction, pickup and host authority. Checkpoints preserve partially collected lines; round resets regenerate exactly eighty drops.
- Zone Wars opponent names use outlined text at a consistent screen size and remain visible through structures. Dead players, spectators and the local operator are excluded. Other modes retain their name visibility rules.
- Box Fights still equips its AR first and shotgun second. Both competitive modes remain human-only.

Focused verification covers all spawn floors, all eighty pickups, public/private rounds, guest synchronization, host recovery, destruction/loot regressions and actual desktop rendering. No mobile work is included. Publishing remains authorized with active matches.
