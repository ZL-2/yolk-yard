# Responsive controls and switching — 6.31.0 / protocol 87

A guest previously waited for authoritative inventory state before a weapon draw
began. A host that lost simulation time could also retain a six-input (100 ms)
FIFO tail indefinitely after returning to 60 Hz. Rebuilding first-person weapons
and arms during each switch added allocation and rendering setup spikes.

## Changes

- Cosmetic local equip intent starts on the next input/frame, is reconciled by
  sequence acknowledgement and survives intermediate older snapshots. Accepted
  draws preserve their original animation clock; rejection, death, changed items,
  new rounds and map changes discard speculative state. Fire eligibility, ammo,
  damage and inventory ownership continue to use the authoritative player.
- Local interaction feedback is bounded and clears on acknowledgement or timeout.
  Pickup prompts use predicted position and current aim. No speculative inventory
  item or duplicate pickup sound is created.
- When input queue debt cannot drain using earned simulation time, a 150 ms grace
  period retires stale movement. Ordinary jitter and server catch-up keep all
  earned steps. Retiring a queue grants no extra movement time. Same-slot action
  taps survive; obsolete fire/drop requests never act on a newly selected slot.
- Human inventory/pickup updates can use a 30 Hz snapshot slot while unchanged
  states retain the existing cadence. Spectator and socket backpressure limits
  remain in force. Idle inputs do not trigger additional broadcasts.
- Authored weapon templates share immutable geometry and remap private animated
  sockets and optic materials. First-person weapon/arm reuse retains at most six
  inactive models. Evictions dispose private buffers. Host/local movement renders
  the latest fixed simulation step rather than waiting for its next snapshot.
- Frame reports no longer scale away stalls at a 30 FPS cap. Worst frame and count
  over 50 ms are included; prediction replay advances the movement clock per step.

## Evidence

`tests/input-response.test.js` covers late acknowledgements, rapid switches,
rejection, death, inventory replacement, action taps, queue recovery, independent
model sockets, bounded arm/model reuse and real frame durations.

`INPUT_RESPONSE_BASELINE=../input-baseline node scripts/input-response-performance.mjs`
compares against `0fb8e4f28f3611ca5f93b150433d5984a47267de`. The initial run reduced
median repeated switch setup CPU by 99%; the synthetic 100 ms queue tail cleared
within 150 ms rather than remaining after ten seconds. All twelve weapon geometry,
transform and material digests matched the baseline exactly. This supports
refreshing the model-source manifest hash without changing the existing artwork.
These are controlled CPU measurements, not a promise of a device FPS or network RTT.

`node scripts/input-response-browser-check.mjs` exercises real Cup sockets, actual
keyboard input, delayed state application, rapid switches and a single confirmed
pickup. GPU rasterization is suppressed during this input-isolation fixture;
`performance-browser-check.mjs` separately exercises actual WebGL rendering.

The pre-existing `royale-systems` foundation-count test reports 7672 versus 7736
on both this change and the baseline; no map-layout code is changed here.

The older `field-refinement` suite also imports removed `publicRoyaleMarkup` on
both baseline and this change. Current pickup and field-polish suites are used
for the touched interaction behavior instead.

The field-polish fixture now constructs the current LootAuras component, fixing
an existing test-only initialization failure without changing production loot code.

Final release validation: 126 targeted regression tests passed, production build
passed, real Cup keyboard/pickup browser acceptance passed, complete WebGL
presentation passed, and the 11-player/3-spectator realtime load check passed.
