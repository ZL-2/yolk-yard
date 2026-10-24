# Roster 215 — work in progress

Authorized final roster: six base Shop outfits, four Victory Score outfits, and
the new free Frontier Scout (11). Retire all 24 legacy and six alternate outfits.
Keep equipment, Marks, receipts and archived ownership. Do not publish partial work.

Sequential order: Wren, Tempest, Rift, Solar, Apex, Voss, Rook, Nyx, Pulse, Morrow,
Scout. Wren approved source is recovered. Tempest and Rift passed mesh views and
six real game poses. Solar and Apex passed their final reviews. Voss is also reviewed. Rook passed the final view and pose checks. Nyx is reviewed after sleeve and UV corrections. Pulse is reviewed after arm and hip refinements. Morrow and Scout remain. Existing generic bodies do not count.

Runtime: `/tmp/ravel-blender-env/bin/python` (bpy 4.3.0 / NumPy 1.26.4).
Build with `scripts/art/build-<name>.py`. Actual renders and packed editable sources
are under `art/operators/<id>`, game assets under `public/models/operators`.
Browser: `BROWSER_EXECUTABLE=/tmp/chromium node scripts/operator-browser-check.mjs <id>`.
Screenshots and evidence in `test-results/roster215/<id>`. Reference images are
construction guides, not evidence of a completed 3D model. Hidden views inferred.

The previous temporary checkout disappeared; restored this branch into the current
workspace and rebuilt Tempest, Rift and Solar from the saved/reconstructed scripts.
All original generated references and approved Wren package remain available.
Save each next character checkpoint to the work branch. Main remains 214.

Remaining integration: both remaining assets, 11-ID manifest, review hashes; full lobby,
Locker and local-match smoke; bounded CI tests, version/release 215 bump; PR/merge
and verify GitHub Pages and Render. Preserve owner-edited tournament schedule.
Never restart/redeploy during an active tournament; check health/event pre-merge.
