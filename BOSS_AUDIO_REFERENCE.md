# Boss awareness and voice reference

Source: user-supplied `ScreenRecording_10-04-2026 20-54-45_1.mp4`, 43.143 seconds, recorded from an edited Foundation-henchman voice montage. The recording starts around 0:34 in its original video. All times below refer to the uploaded recording, not the original upload.

## Evidence limits

Frames were inspected throughout the recording and audio/silence boundaries measured. This environment cannot directly listen to or transcribe the audio. Clip-to-action assignments are therefore provisional visual-context assignments, not verified spoken-word meanings. No dialogue text or exact words are asserted. The video is a montage, so its short gaps do not demonstrate natural cooldowns, line probabilities, detection distances or audibility distances. It contains no reliable idle-to-question-mark transition or defeat scene. Damage/defeat-specific voice clips have not been invented.

## Scene/action mapping

| Recording time | Visible action | Audio implementation |
| --- | --- | --- |
| 0–4.9 s | Weapon lowered across chest; stationary turns, no visible alert marker | Two quiet/patrol variants; discretionary ambient lines |
| 4.9–5.9 s | Turns and walks across the room | Short patrol variant |
| 5.9–7.7 s | Stationary weapon-ready pose, close camera | Second patrol variant; exact speech intent unverified |
| 7.9–11.2 s | Rotates/aims; incoming tracer and firing effects in portions | Excluded from voice atlas to avoid obvious combat effects in quiet cues |
| 11.7–14.2 s | Red exclamation mark, rifle raised toward target | Two confirmed-contact variants |
| 14.6–15.8 s | Advances/repositions with rifle raised | First combat bark; provisional mapping |
| 16.3–20.5 s | Close-up burst firing, visible muzzle flashes | Excluded; game gunshots remain separate and procedural |
| 20.9–22.0 s | Weapon raised between shots | Second combat bark; provisional mapping |
| 22.5–25.6 s | Alerted movement through doorway and stair area | Two pursuit variants |
| 26–28.8 s | Alerted pause/turn near stairs, exclamation mark retained | Visual reference for continued target awareness; not proof of target-loss search |
| 29.1–31.7 s | Hands shift around rifle in a stationary ready pose | Two weapon-readiness variants mapped to reload; exact reload/line intent needs listening confirmation |
| 32–35.6 s | Camera changes to room, then aiming/side-step | Not used in quiet bank; cut boundaries and some effects ambiguous |
| 36–43.1 s | Pursuit, strafing and intermittent fire, red alert retained | Reference for pursuit/combat state, no extra firing audio baked into the atlas |

Each extracted clip retains source start/end in `src/boss-voice.js`. A 0.12-second silent separator prevents adjacent lines bleeding into each other. `scripts/extract-boss-voices.mjs` reproduces the single 139 KB mono MP3 atlas from the supplied file. Filtering trims low rumble/high hiss; this is not source separation and does not guarantee dialogue-only stems.

## Verified Fortnite model versus our tuning

Epic documents guard Idle, Patrolling, Suspicious, Alert and Attacking states. A question mark represents accumulating suspicion; an exclamation mark represents confirmed detection. Guards chase/attack confirmed opponents and return to patrol after the target escapes or is eliminated. The supplied footage directly shows red exclamation marks. Our yellow question-mark color, fill treatment, 120-degree initial vision cone, transition durations and search timeout are implementation choices intended to match the familiar presentation; exact Battle Royale pixel/color/timing parity is not claimed.

Epic's audio documentation supports spatialization, volume attenuation, relative random weights, and random selection without replacement. Those are available engine/Creative mechanisms, not evidence of the exact settings used by any Battle Royale boss. Creative Audio Player defaults (4 m inner distance, 32 m falloff) are not described here as BR boss parameters.

Sources:

- https://dev.epicgames.com/documentation/fortnite/npc-types-in-unreal-editor-for-fortnite
- https://dev.epicgames.com/documentation/fortnite/understanding-npc-behavior-in-unreal-editor-for-fortnite
- https://dev.epicgames.com/documentation/fortnite/using-audio-player-devices-in-fortnite-creative
- https://dev.epicgames.com/documentation/unreal-engine/sound-cue-reference-for-unreal-engine

## Implemented custom settings

| Cue | Maximum audible distance | Trigger/cooldown |
| --- | --- | --- |
| Idle / patrol | 26 / 28 m | First eligibility 8–18 s after spawn; later every 20–36 / 22–38 s, 65% chance |
| Suspicion | 36 m | On suspicion entry, minimum 8 s per cue |
| Confirmed contact | 58 m | On confirmed detection or damage identifying an attacker, minimum 10 s; interrupts lower-priority speech |
| Combat | 54 m | Only after a real accepted shot; one eligibility attempt every 9–16 s, 55% chance |
| Pursuit | 46 m | While alerted, every 11–18 s, 55% chance |
| Search | 36 m | On target loss, then every 9–15 s, 70% chance; patrol-style clips used because footage does not establish a distinct search line |
| Reload | 38 m | Only when reload is actually accepted, 70% chance, minimum 12 s |
| Ability | 54 m | Telegraph entry, minimum 10 s; combat-style clips |

Full voice level within 4 m; power-curve falloff to silence at each cue's maximum, using 3D distance. Solid static scenery reduces gain to 23% and low-pass cutoff to 1 kHz; this is custom occlusion behavior, not a measured Fortnite value. Stereo direction and gain update at 10 Hz only while a voice is playing. One voice per boss, at most two voices across bosses, and 2.5 seconds between ordinary lines; higher-priority contact can interrupt after 0.4 seconds. Each cue consumes a shuffled bag without replacement and avoids immediate repeats. Bosses use distinct playback rates and volumes, not distinct newly recorded actors.

Perception runs on the existing 0.2-second boss scan. Visual suspicion takes each boss's existing reaction time (Voss 1.35 s, Rook 1.2 s, Nyx 1.5 s), with a short post-acquisition reaction delay. Initial sight ranges remain 38 / 34 / 68 m. Rook retains his existing extended grappler pursuit of a recent, visible attacker; it does not grant longer passive detection or sight through walls. Nearby replicated gunshots can trigger investigation within 42 m, including from behind a wall; hearing alone never confirms a target or permits firing through cover. A known attacker immediately alerts the boss. On lost sight, firing stops immediately, then the marker switches back to question/search after 1.2 s; the last-known position is searched for up to 7 s before returning to patrol. Existing home leashes, wall/smoke checks, abilities, ammunition and weapon cadence remain authoritative.

Voice RNG is separate from loot RNG. Schedules, shuffle bags, perception memory and alert state survive host checkpoints. Only public alert fields and actual voice events go into normal snapshots. A joining client does not replay old lines; stale cues, duplicates, invalid cue/clip pairs and departed worlds are rejected. No boss voices play on Spawn Island, aboard the transport, during loading or outside matches. Defeat/exit stops active speech. Muting Effects mutes boss voices.
