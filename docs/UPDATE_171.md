# Update 171 — Combat Steps & Freefall

The recording exposed two distinct animation defects that the prior floor/contact checks did not catch.

- Upright rifle posture changed the pelvis quaternion without compensating its leg children. That rotated straight captured steps into large sideways/cross-body sweeps. The adjustment now preserves leg directions in character space before the existing ground-contact pass.
- The airborne slot used Mixamo's tucked `Falling Idle`, intended for a jump fall. Skydiving now selects a separate, rig-authored extended freefall pose: spread arms, separated thighs, relaxed knee bend and raised head. This pose is not represented as downloaded Mixamo mocap.
- The old positive body pitch faced the chest upward. Negative pitch faces it down; YXZ rotation applies that pitch in the flight heading, including sideways/reverse headings. Launch uses the same extended flight pose.

Focused checks cover boot lanes through a complete lobby scan, extended legs and belly orientation through the actual royale presenter at four headings, transition continuity, grips, contact, anatomy and gameplay immutability. Browser evidence includes front/side combat walking against moving/fixed ground, actual skydiving and glider deployment, with deterministic frame captures.

Version 5.17.3. No new animation downloads, model weights, backend changes, region restrictions or gameplay/protocol changes.
