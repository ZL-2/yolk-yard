# Update 169 — Operator Motion Fit

Follow-up to the user's recording of Update 168:

- Adapt the rifle walk's oversized stride and deep forward crouch to the existing
  Ravelfront rig. Shortened strides retain distance-driven cadence; walking hip
  height respects leg reach, and torso/root sway no longer lowers the face to the rifle.
- Level support soles and smoothly release boot orientation during swing. Preserve
  world-space foot locks and lobby road travel.
- Select the base posture from the active inventory slot, not inventory existence
  or the fallback gun id. Pickaxe/consumable/empty slots use non-rifle idle.
- Refit lobby rifle position for upright shoulders with both grips maintained.
- Parent Victory Crowns to the animated head rather than a fixed root height.
- Add upright-head, sole contact, active-slot and crown regressions, plus a visible
  floor and Voss/cape stride sequence to the focused desktop render check.

No changes to physics, shot origins, hitboxes, match networking or mobile controls.
Mixamo source data is unchanged; this corrects the runtime adaptation.
