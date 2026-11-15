# Performance and persistence report

## Targets

The browser smoke profiler uses configurable targets. Override these before running `node scripts/browser-smoke.mjs`:

| Variable | Default | Meaning |
| --- | ---: | --- |
| `OTTOMAN_PROFILE_MS` | 3000 ms | Main frame sample duration (clamped to 1–15 seconds) |
| `OTTOMAN_DESKTOP_FRAME_P95_MS` | 16.7 ms | Desktop 60 FPS frame-time target |
| `OTTOMAN_DESKTOP_JS_HEAP_MB` | 256 MB | Desktop JavaScript heap target |
| `OTTOMAN_ANDROID_FRAME_P95_MS` | 33.3 ms | Mid-range Android 30 FPS frame-time target |
| `OTTOMAN_ANDROID_JS_HEAP_MB` | 192 MB | Android JavaScript heap target |
| `OTTOMAN_SAVE_LOAD_MS` | 500 ms | Save and load duration target |
| `OTTOMAN_PATH_100_MS` | 16.7 ms | 100 path searches target |
| `OTTOMAN_NEARBY_1000_MS` | 16.7 ms | 200 nearby-NPC queries at 1,000 states target |

These are engineering budgets, not measured device guarantees. The Android values have not been verified on an Android device or emulator.

## Measured run

Run date: 2026-10-29. The available environment was a local macOS desktop running HeadlessChrome 156 at 1280×800 CSS pixels, device pixel ratio 1, using Phaser's **Canvas renderer**. This is not a representative Android run. `performance.memory` exposes JavaScript heap only; GPU memory and total process memory were unavailable.

| Measurement | Result | Context |
| --- | ---: | --- |
| Average sampled frame rate | 40.7 FPS | One 3.05-second gameplay sample |
| Frame time p50 / p95 / max | 16.7 / 33.4 / 33.4 ms | p95 misses the desktop 16.7 ms target |
| JavaScript heap | 72.6 MB | Chrome heap reading; excludes native/GPU allocations |
| Phaser display objects / textures | 181 / 195 | Gameplay scene at the measured point |
| Active settlement NPCs | 7 | Current authored population |
| Settlement update wrapper time | 1.7 ms total / 3.05 sec | Includes throttle-return calls; no NPC route change occurred during this sample |
| 100 path searches | 0.3 ms | Direct deterministic searches; not called by the idle update sample |
| Nearby-NPC query, 200 calls | 4.9 ms at 1,000 states | Synthetic state-count stress; sprites/AI were not created for the synthetic records |
| Save / load | 188 / 79 ms | One IndexedDB run; includes serialization in the save measurement |
| 1,000-entry inventory validation | 0.4 ms | Validation only, not a full 1,000-item gameplay session |

Short frame samples vary under headless Chrome. A separate graphics-quality comparison in another run measured balanced at 49.7 FPS average and low at 59.7 FPS; effect-isolation samples did not consistently move the p95. The balanced p95 remained around 33 ms. This points to renderer/frame pacing or broader Canvas rendering work as the remaining profiling area; no single visual effect was proven to be the cause. The current quality setting still misses the desktop p95 target in this environment.

## Stabilization changes

- HUD refresh is capped at 10 Hz, and unchanged text is no longer re-laid out every frame.
- Settlement catch-up processes elapsed hours and day events chronologically for up to ten years. Earlier logic silently limited jumps to 24 hours, dropping routines, needs and event expiry during year advancement.
- Settlement event history is capped at 100 entries.
- Year advancement and regional travel explicitly catch up settlement routines before saving, so an immediate save cannot persist a stale NPC clock.
- Save schema is now `1.3.0`; migration fills missing world/quest sections for older supported saves. Save validation checks nested core collections, dates, plot ranges, inventory limits, and optional system state before applying data.
- Each IndexedDB write reads the current slot and writes the previous valid save to a hidden backup key in the same read/write transaction. An interrupted write aborts both changes. Corrupt originals are kept; loading can recover the previous backup without replacing the original. Imports require an empty destination and pass the same validation.
- Browser checks cover interrupted transaction recovery, corrupt/future saves, 1,000-item inventory validation, multi-year schedule/farm/family consistency, and five rapid scene restarts.

## Remaining bottlenecks and limits

- The measured Canvas profile misses the desktop p95 target. The main sample contains 181 display objects and 195 textures, but Chrome's JavaScript heap and frame timings do not split renderer CPU from compositor/GPU time. A WebGL-enabled desktop and a physical mid-range Android run are needed before attributing the remaining frame pacing cost or claiming platform targets.
- The authored settlement has seven NPCs. The 50/200/1,000 population checks measure nearby-state lookup only; they do not represent full NPC rendering, schedule simulation, or AI under those populations. The game has no configurable production NPC population, so no such feature was added solely to inflate this benchmark.
- Pathfinding is inexpensive in the 100-query desktop microbenchmark. No pathfinding cache or object pool was added without evidence of a production bottleneck.
- Runtime artwork is generated once at boot. Ground chunk textures are removed with the tile-map lifecycle; shared generated art remains cached for scene reuse. There is no external asset bundle to stream or unload.

## Reproduction

Run `npm run test:smoke`. The script prints `PROFILE`, target checks, graphics comparisons, and desktop/mobile regression results. It requires local Chrome and a loopback preview server. The five-generation family acceptance remains in `npm run test:family`; persistence validation is in `npm run test:save-ui` and `npm run test:quest`.
