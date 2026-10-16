# Quality Update 166 — Move With Purpose

## Reported issues and changes

- The desktop leaderboard had independent 180px/120px caps inside a flex column. The scroll viewport now fills its parent's remaining height, with a small minimum and a functioning scroll thumb.
- Legacy generic actions used pale paper backgrounds plus a globally redefined, light `--ink`. Shared secondary actions now explicitly pair a dark surface with a light foreground, including hover and nested button text.
- Presence kept an `in-match` enum but no mode metadata. The enum remains compatible; party snapshots and social cards now carry a validated playing mode, rendered as Playing Battle Royale, Playing Free For All or Playing Training.
- Discovery cards receive pushed population changes from the social service, deduplicated by identity across tabs and combined across public/private rooms. Bots, spectator sessions, disconnected admissions and unreleased modes do not inflate counts. Training and legacy direct-code rooms use authenticated session activity; genuinely offline players cannot be counted. Connection loss shows unavailable rather than a stale number.
- The options row explicitly ends in Public or Private.
- Locomotion had a fixed lowered pelvis, too-short cycle distances at running speeds, the wrong pelvis-turn sign for a right strafe, and additive torso rotations applied to residual prior-frame rotations. It now starts each pose from the bind pose, matches stance travel to velocity, locks stance feet in world space, uses reach-aware pelvis height, heel/toe articulation, correct directional warping and bounded transition smoothing. Lobby patrol has a more upright stride and reduced side sway.
- Equipment used one below-the-screen draw path. Long guns and harvesting tools now use an over-shoulder/back path; compact SMGs, pistols and utility items use hip paths. Stowing follows the outgoing item's route. Equip readiness and fire gating are unchanged.
- Operator artwork gains refined eyes and ears, back armor, tailored joint seams, reinforced knee edges and ankle cuffs. All styles retain the same 32-bone, one-draw-call character mesh and shared physically based surface atlas; collision and hitboxes are untouched.

## Research and implementation boundary

Epic's official [Fortnite Chapter 5 announcement](https://www.fortnite.com/news/join-the-fight-in-fortnite-battle-royale-chapter-5-season-1-underground) describes motion matching and procedural layering for walking/running transitions, direction changes and weapon use. Its [Pose Warping documentation](https://dev.epicgames.com/documentation/unreal-engine/pose-warping-in-unreal-engine?lang=en-US) describes directional compensation, stride adjustment and separating aimed upper-body facing from leg orientation. [Motion Matching](https://dev.epicgames.com/documentation/unreal-engine/motion-matching-in-unreal-engine?lang=en-US) requires a pose-search database of animation clips.

This update implements original lightweight procedural equivalents appropriate to Ravelfront's Three.js rig. It does not claim to contain Fortnite's proprietary animation assets or Unreal's motion-matching runtime. The back/hip classification is an original item-category presentation choice, not a claim that every Fortnite item follows the same rule.

## Focused verification

`tests/operator-refresh.test.js` covers mode labels/counts, duplicate tabs, public/private rooms, spectator/disconnect/return cleanup, contact velocity, directional turns at 30/60/120Hz, bounded transforms and item routes. Existing rig, equip-clock, party, room-pool, leaderboard and deployment tests remain release gates.

The desktop browser gate checks real lobby cards/options, button contrast, usable ranking height and scrolling at 1440×900 and 1280×720, pushed population updates, party readiness, actual browser hosting and guest reconnection. An additional rendered pose sheet covers walking contact/passing, strafe, sprint, back draw and hip draw. No mobile work or active-match-empty prerequisite is added.

Version 5.16.0. Protocol 58 remains compatible: this is presentation and additive social metadata, not a combat or snapshot schema change.
