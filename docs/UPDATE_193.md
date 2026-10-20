# Update 193 — Remember your comms. Set and play.

Version 6.9.1, compatible protocol 69. Publication remains authorized with active matches.

- Match options save when changed in all five multiplayer modes. Number fields save after a short typing pause or when leaving the field. No Apply button. Status indicates saving, success or failure. Public/private and team changes refresh dependent controls immediately. Saves are serialized and intermediate pending changes are combined; closing flushes the last valid edit. Server authority and leader/idle restrictions remain in force.
- Voice enabled and microphone enabled/muted choices are separate browser preferences. New users still opt into each. Returning users restore their previous settings without opening Voice or pressing Enable again. Leave Voice persists an off choice; cleanup and transient disconnects do not erase preferences. A blocked autoplay context resumes on an ordinary click or keypress. Mic permission errors leave listening available and do not retry permission continuously. Push-to-talk does not restore a held key.
- Audio initialization is shared across simultaneous requests. Microphone cancellation invalidates in-flight permission requests and stops late streams. Voice-off lobby users no longer send one voice-context request every second. Browser hosts still publish the roster needed by other players, even when the host leaves voice.

## Focused verification

- `tests/options-autosave.test.js`: ordered/coalesced saves, failures, and recovery with a newer queued choice.
- `scripts/options-browser-check.mjs`: actual desktop lobby controls in all five modes, authoritative saved settings, no Apply button, invalid number handling, close flush and rapid changes.
- `scripts/voice-browser-check.mjs`: real two-browser audio plus reload restoration, saved mute/off/listen-only states, strict autoplay activation, and preference-preserving cleanup.
- Existing voice-service and release-numbering unit checks and the production build remain gates. Updated older mode browser scripts to close automatically saved options instead of clicking the removed Apply button. No mobile sweep.

Browser behavior references: https://developer.chrome.com/blog/autoplay/#web-audio and https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia . Browser audio activation and microphone permissions remain required by the browser; remembered in-game choices do not bypass them.
