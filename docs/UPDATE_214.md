# Update 214 — Tactical map and competitive records

Version 6.22.0 / protocol 82.

- Expanded the map into a nearly full-screen tactical panel. The current terrain, roads, building footprints, helipad, named locations and live objectives remain visible. Zoom 1–6× with the wheel, buttons or keyboard; drag to pan; reset the island or center on your player. Waypoints use the zoomed world position, and dragging does not place a marker. The minimap remains unchanged in scale.
- Box Fights hides opponents’ overhead names while preserving teammate labels. Zone Wars retains enemy labels.
- Career includes saved tournament finishes, wins, podiums, placements, eliminations, prize earnings and repeat-winner bonuses, with a direct shortcut from Compete. The authenticated server identity determines whose record is returned. Manual grants and ordinary match rewards are excluded. Older incomplete results remain explicitly incomplete.
- Marks awards use the existing response banner and remain pending until explicitly acknowledged. Acknowledgement is stored per recipient in SQLite and survives reconnects and restarts; wallet totals remain cumulative and idempotent. Private owner audit reasons are not exposed in notifications.
- Passenger crosshairs remain visible until a scope is actually rendered, including aim transitions and interrupted aiming in first and third person. Driver and eliminated-player restrictions remain intact.
- Victory Score is now **1,000 × wins + 10 × eliminations**. Equal-win players with 100 more eliminations are 1,000 points apart. Existing totals are preserved and rankings recalculate using the shared server/client formula.

Validation uses local fixtures only: durable grant acknowledgement, identity isolation, tournament accounting and legacy results, map coordinate transforms, Box Fights/Zone Wars labels, and passenger reticle continuity. Browser coverage exercises the real Career/Compete navigation, grant reload/dismiss flow, map zoom/pan/waypoints/resizing, and passenger ADS in both camera perspectives. No production tournament is entered or fabricated.

The cropped asset-deletion request is not included; its intended targets are not visible. No character assets are deleted in this update.
