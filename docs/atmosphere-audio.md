# Atmosphere and presentation

## Rendering

The world remains in the existing Phaser 2D/isometric renderer. Lighting is a low-cost screen-space color wash over baked terrain and props. Dawn, daylight, dusk, night, weather, season, and location pick targets from [`AtmosphereData.ts`](../src/data/AtmosphereData.ts); the wash eases toward each target instead of stepping between colors. Window and forge warmth are painted into the original house and workshop artwork, with a subtle local glow at windows, workshops, and market lanterns after dusk. Trees have a restrained low-amplitude sway; chimney puffs drift on a slow loop. The renderer does not add per-pixel real-time lights or post-processing.

Rain, snow, wind traces, and clear-day dust draw in one bounded Graphics batch. The in-game graphics quality setting controls the budget: low disables atmospheric particles and chimney animation, balanced caps them at 12, and high permits up to 30. The atmosphere tint stays enabled because it is one inexpensive overlay. Existing camera follow uses Phaser's lerp; zoom changes now ease over 190 ms. Major quest and military completions use a brief 140 ms warm camera flash.

## Location profiles

`ATMOSPHERE_PRESETS` supplies daylight/dawn/dusk/night tints, night strength, and ambience gain for the village, forest, market, travel, and battlefield. `GameplayScene.updateAudioState()` selects a profile from location, market state, battle state, time, weather, and political mood. Adjust these profiles to tune a location without changing simulation rules.

## Sound

`AudioManager` generates the current music, weather beds, birds, UI tones, farming actions, combat, footsteps, and occasional livestock calls with Web Audio oscillators and filtered noise. It downloads no recordings. Mood changes blend between their melodic patterns over 2.4 seconds. Separate persisted sliders and master mute are in the audio panel; pause/visibility state gates gameplay sound. Audio context creation stays behind the existing pointer, keyboard, and touch activation hooks for mobile browsers.

All included art is generated in the project's own canvas drawing code (`src/art`). There are no external recordings or imported game sprites. If licensed or recorded material is added later, record its source, license, permitted platforms, and attribution here before shipping.

## Verification

Run `npm run test:atmosphere` for profile bounds and quality budgets, `npm run test:audio` for persisted audio controls and silent fallback, and `npm run test` for the full logic suite. The browser smoke test additionally needs the environment to permit binding a local preview server.
