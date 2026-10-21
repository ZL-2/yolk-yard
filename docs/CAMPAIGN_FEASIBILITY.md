# Ravelfront campaign feasibility — October 20, 2026

This is research and a proposed scope, not a campaign implementation or a promise of Call of Duty parity. Zombies is paused, not deleted. Its engine, assets and progression remain in the repository and existing stores.

## Honest conclusion

A polished, short military FPS story mission is a plausible next project. A modern Call of Duty campaign's combined photorealism, animation, performances, cinematic spectacle, length and consistency is not a credible promise for this project's current browser targets and production resources. A larger feature list or an engine change alone cannot close that gap. Fun and visual quality must be demonstrated through playable work, not declared from tests.

## What the current code actually provides

- Three.js WebGL rendering, gunplay, movement, collision, HUD, audio and spatial optimizations can be reused.
- `src/humanoid.js`, `operator-motion.js` and `character-motion.js` build and animate the existing operators procedurally. Their current result is not a cinematic performance/face-animation pipeline.
- The project can load authored GLTF models (`map-object-view.js`, `zombies-actors.js`) and some animation clips. That is useful plumbing; it does not mean a coherent library of realistic soldiers, first-person arms, reloads, reactions and mission interactions exists.
- Existing bot and Zombies objective code is not automatically a reliable campaign director. We would need mission-specific encounter states, navigation/cover behavior, companion actions, checkpoints, restart-safe scripting, dialogue timing and authored pacing.
- The current school-Mac target remains a constraint. We do not have an on-device benchmark for a proposed campaign, so neither 60 FPS nor a specific quality setting can be promised yet.

## Evidence and implications

Activision's Dark Water breakdown describes separate animation, lighting, VFX, technical art, audio and level-design work; even a moving-container encounter required coordinated changes to navigation, physics and combat. It explicitly describes a playable vertical slice and repeated iteration. The lesson is that production quality comes from finished assets, staging and revision, not the number of implemented mechanics.

Three.js supports loading GLTF assets with authored materials, meshes, skins and animations. MDN's WebGL guidance emphasizes hardware-dependent limits, VRAM budgets, batching and compressed textures. Chrome documents hardware/driver/acceleration reasons WebGPU can be unavailable, and notes that merely translating WebGL code need not improve performance. WebGPU is worth evaluating later, not treating as a shortcut to realism.

## Proposed first proof, not the whole campaign

One original 8–12 minute single-player mission: approach a compact coastal communications site, follow a squadmate inside, clear two deliberate encounters, recover intelligence and escape through a controlled finale. Keep it one location with a small cast and a few well-finished weapons. Avoid open-world travel, multiplayer co-op, sprawling vehicle systems and branching campaigns in this first proof.

Invest first in one coherent environment kit, a believable soldier/arms rig, reload and reaction animations, layered positional audio, restrained lighting and a small set of authored enemy behaviors. Use original or properly licensed assets and performances. We should not assume paid assets or voice production are available until a budget is agreed.

Implement mission progression separately from the existing multiplayer simulation. Reuse stable combat components while keeping campaign loading, AI, checkpoints and rendering adjustments isolated so they do not destabilize Box Fights, Zone Wars or Royale. Run solo simulation locally; this removes relay latency from solo combat but does not fix expensive rendering or bad AI.

Acceptance before expanding: playable beginning to end; every checkpoint restores objective, actors and dialogue correctly; no softlocks after death or interrupted actions; readable enemies/objectives; believable weapons and character motion in actual gameplay; controlled loading/memory; measured frame times on the user's actual Mac; and the user finds the complete mission fun and visually worth continuing. A 60 FPS target is a target, not a verified outcome. Measure combat and effects-heavy sections, not an empty corridor.

If that mission meets the quality bar, expand in small episodes. If it does not, revise the art direction or stop before creating many mediocre missions. A desktop-engine project could raise the tooling/graphics ceiling, but would sacrifice the current no-install browser delivery and still require the same art, audio, animation and design production. We should not migrate the game or promise hours of content before the proof.

No reliable completion date or total budget can be estimated before choosing assets, confirming hardware and timing the first finished mission. Paid assets and specialist art/audio work may be required for the requested realism.

## Primary sources

- Activision, *Making Dark Water*: https://www.callofduty.com/blog/2022/08/call-of-duty-modern-warfare-II-dark-water-deep-dive
- Three.js, *Loading a GLTF File*: https://threejs.org/manual/pages/load-gltf.html
- Three.js, *Optimizing Lots of Objects*: https://threejs.org/manual/pages/optimize-lots-of-objects.html
- MDN, *WebGL best practices*: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- Chrome, *WebGPU troubleshooting*: https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips
