# Audio system

The game uses a single `AudioManager` for synthesized audio, shared by the menu and gameplay scenes. It creates sound with the Web Audio API at runtime, downloads no audio files, and continues to work silently if Web Audio is unavailable or a browser refuses playback. The current musical motifs and sound effects are original procedural design; they are not presented as historically authenticated Ottoman music or field recordings.

## Controls and saved settings

The Chronicle's **Ses / Audio** tab exposes independent 0–100% levels for music, ambience, interface, farming/crafting, combat, and NPC voice effects, plus master mute. Settings are persisted in `ottoman-settings` alongside the other local game settings. Invalid or out-of-range stored levels are normalized to safe values. Audio preferences do not affect save-game compatibility.

The voice-effects bus is available for future original or licensed content. There are no NPC voice performances in the current build. Turning every bus down or enabling master mute leaves all gameplay actions available.

## State response

The manager is a singleton so scene transitions do not restart the music scheduler. Gameplay refreshes the sound context periodically from current location, weather, in-game hour, active combat, political screen, and pause state. Mood changes alter the continuing procedural music phrase. Ambience layers are scheduled sparsely and capped by a small voice limit. UI effects remain available while gameplay is paused; other buses are muted while paused or when the page is hidden.

AudioContext creation and resume happen only in response to pointer, touch, or keyboard input to meet browser and WebView activation requirements. Core settings and the game never depend on successful audio initialization.

## Asset and licensing policy

No third-party recordings or copyrighted game audio are bundled. If recorded or sampled audio is added later, record its source, license, attribution requirements, allowed platforms, and intended use in the asset manifest before shipping it. Do not describe any track as historically authentic unless its provenance has been independently verified.

## Extension points

Use `playUi`, `playFarming`, and `playCombat` for successful gameplay actions, and `setEnvironment` when adding new location or weather state. Keep sounds short, cooldown repeated events, and avoid creating a sound for a failed or purely presentational action. Keep NPC voice content on the voice bus. The generated scheduler limits active voices to prevent unbounded overlap.
