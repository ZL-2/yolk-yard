# Update 185 — Loading and lobby recovery

Version 6.6.2; network protocol stays 67.

- Fix the Zone Wars map updater dereferencing null match state after leaving, which stopped the render loop and stranded the return overlay. Hide its preparation gates when there is no Zone Wars state.
- Preserve a loading dismissal requested before artwork finishes. The existing image deadline also completes dismissal without another render tick.
- Returning to the lobby signals readiness locally. Departed map shader jobs are detached from the lobby; reentry prewarms again.
- Bound shader prewarming to eight seconds, then use normal renderer compilation. Handle rejection and synchronous failure; obsolete completion cannot clear a newer job.
- Guard room creation across map refresh and isolate cancelled connection completion from a new attempt. Detach the connection before teardown so a cleanup error cannot block lobby state reset.
- Focused unit tests and desktop fault injection cover slow imagery, shader stalls, cancellation, reentry and repeated lobby return. No mobile changes.
