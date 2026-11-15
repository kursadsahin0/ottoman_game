# Ottoman: A Legacy Through Generations

An isometric 2D settlement simulation built with **TypeScript (strict), Phaser 3,
and Vite**. Set in a frontier village of the early Ottoman beylik (1299), the
current build is a playable vertical slice: walk the settlement, work the land,
grow and sell grain in akçe, buy more land, and persist your progress.

The project is mobile-first (virtual joystick + context action button) and
desktop-ready (keyboard), with a clean path to Capacitor/Tauri packaging.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # type-check + production bundle
npm run preview    # serve dist/
```

Requirements: Node.js 18+ and npm.

---

## Gameplay

You start in the village with **50 akçe**, a **hoe**, **1 wheat seed**, and
**1 barley seed**. Three of the nine farm plots are already yours.

### Core loop

1. **Prepare** an owned plot's soil with the hoe.
2. **Plant** a seed (wheat or barley) from the plot menu.
3. **Advance time** — crops grow one stage per suitable-season day.
4. **Harvest** the mature plot to add grain to your inventory.
5. **Sell** grain at the village market, then **buy seeds** or **rent more land**.
6. **Save** (S or the *Kaydet* button) and reload later.

Planting is season-gated: wheat and barley can only be sown in **spring** and
**autumn**. A crop planted out of season is refused with feedback rather than
silently wasted.

### Crops

| Crop | Growth | Yield | Seed cost | Sell value | Seasons |
| --- | --- | --- | --- | --- | --- |
| Wheat | 4 days | 3 | 3 akçe | 8 akçe | Spring, Autumn |
| Barley | 3 days | 3 | 2 akçe | 6 akçe | Spring, Autumn |

Definitions live in `src/data/CropData.ts`; item values and market rules live in
`src/data/EconomyData.ts`. Adding a crop is a data change, not a code change.

### Farm plots and land

- Nine plots sit in a 3×3 block in the settlement's farm area.
- Owned plots can be tilled immediately.
- Locked plots show **"Arazi kirala — 20 akçe"** and cost **20 akçe** to acquire.
- Ownership is permanent and survives save/load.
- Plot lifecycle: `untouched → prepared → seeded → growing → ready → harvested`.
  A harvested plot can be prepared again for the next crop.

### Market and economy

- Market stalls sit in the village centre. Approach them and press **M** (desktop)
  or use the context action button (touch).
- The market **buys crops at 0.7×** base value and **sells goods at 1.2×**.
- Seeds stock 12 each; hoes stock 3. Stock is consumed by purchases and
  **restocks every 7 in-game days**.
- All transactions are validated: without enough akçe, a purchase fails and the
  player sees a rejection message. There is no negative balance and no free item.
- Akçe is a period-appropriate silver currency; no modern money appears.

### Time, seasons, and offline progress

- One in-game day takes **30 seconds** of real time.
- The HUD clock shows the current hour; light shifts from night through dawn to
  daylight. Weather is selected deterministically by season and calendar day.
- Seven fictional residents follow reusable work, market, patrol, well, and home
  schedules. Their needs, selected relationships, current task, and location are
  saved. Off-screen residents use simplified movement updates.
- Talk to a nearby resident with **E** or the touch action button. Some days
  bring a fictional request for help, a delayed market, or a local dispute.
  Resolving these changes resources, relationships, and the existing timeline.
- Change the clock rate from **Defter → Ayar → Zamanı yavaşlat/hızlandır**.
- The calendar tracks day (1–30), month (1–12), season, and year.
- Seasons: spring (months 3–5), summer (6–8), autumn (9–11), winter (12–2).
- Growth is computed from elapsed in-game days, counting only days in the crop's
  suitable seasons. Progress is deterministic and survives save/load.
- **P** pauses everything: calendar, movement, prompts, market updates, and farm
  actions. Save/load and unpausing still work while paused.
- **Offline progress applies only when loading a save**, and is hard-capped at
  **7 days** so returning after a long break cannot skip content.

### Inventory

- 20 slots, stacks up to 99.
- Starts with a hoe (non-stackable tool) and one seed of each grain.
- Harvests, purchases, and sales update quantities immediately in the HUD.
- Full inventory rejects new stacks instead of silently deleting items.

---

## Controls

### Desktop

| Input | Action |
| --- | --- |
| **WASD** / **Arrow keys** | Move |
| **F** | Farm action on the current plot (prepare, plant, harvest, rent) |
| **E** | Talk to nearby residents or interact with houses, well, and stalls |
| **M** | Open the market when nearby |
| **T** | Advance one day (also the *Gün +1* HUD button) |
| **P** | Pause / resume |
| **S** / **L** | Save / load to IndexedDB slot `slot1` |
| **F3** | Toggle debug overlay (grid, coordinates, FPS) |
| **Esc** | Return to the main menu |

### Touch / mobile

- **Virtual joystick** (bottom-left) for analog movement; diagonals are normalized.
- **Context action button** (bottom-right) appears on farm plots and near
  residents, market stalls, or other interactables.
- On-screen **Kaydet**, **Yükle**, and **Gün +1** buttons. Desktop-only help text
  is hidden on touch layouts.

---

## Persistence

Progress is saved to **IndexedDB** (`OttomanGameDB`, store `saves`) under slot
`slot1`, with an in-memory fallback when IndexedDB is unavailable (private
browsing, some embedded webviews).

The save payload (`src/systems/SaveManager.ts`, `SAVE_VERSION` `1.1.0`) stores:

- calendar and elapsed days
- inventory contents and slot capacity
- akçe balance
- every farm plot (state, crop, planting day, growth, land ownership)
- market stock state
- settlement residents, their routines, needs, relationships, destinations,
  current weather and active local events
- selected character appearance and time speed
- player grid position
- save timestamp (used for the 7-day offline cap)

Older saves migrate without resident data and receive the current fictional
settlement roster. Loaded state is applied before farm and market resync.

Historical timeline entries continue to come from `HistoricalData.ts`. Named
residents, their schedules, weather sequence, and village events are fictional
gameplay material; their routines are not claims about specific historical
people. See [`docs/living-world.md`](docs/living-world.md).

---

## Architecture

```
src/
├── art/        Runtime-painted Canvas textures (terrain, props, characters, farms, UI)
├── core/       GameConfig (viewport, isometric constants, debug settings)
├── data/       CropData, EconomyData, WorldData (data-driven definitions)
├── entities/   Player (movement, collision, directional walk frames)
├── scenes/     Boot → Loading → MainMenu → Gameplay
├── systems/    Simulation and rendering systems (see below)
├── utils/      IsometricUtils, Depth bands, CameraLayers (world + UI cameras)
├── dev/        Headless logic test harness
└── main.ts     Game bootstrap
scripts/        Browser smoke test (CDP)
docs/           Art and asset pipeline notes
```

### Key systems

| File | Responsibility |
| --- | --- |
| `FarmSimulation.ts` | **Pure** farming rules: plot states, growth, seasons, land, serialization. No Phaser imports, fully testable. |
| `FarmManager.ts` | Renders plots and delegates to `FarmSimulation`. |
| `FarmInteractionSystem.ts` | Contextual prompts, seed menu, planting, harvesting, land rental. |
| `Economy.ts` | Akçe balance, buy/sell pricing, transaction validation. |
| `Inventory.ts` | Stacking, capacity, starting items, serialization. |
| `MarketSystem.ts` | Stock, restock timer, market UI, buy/sell actions. |
| `TimeManager.ts` | Singleton calendar, pause/resume, day advancement, offline cap. |
| `SaveManager.ts` | IndexedDB persistence with memory fallback. |
| `InputManager.ts` | Input-source pattern merging keyboard and touch. |
| `VirtualJoystick.ts` | Touch joystick and context action button. |
| `InteractionSystem.ts` | Proximity prompts and dialog for world objects. |
| `TileMap.ts` | Bakes padded 8×8-tile ground chunks, scatters detail, animates water glints. |
| `WorldObjectManager.ts` | Prop sprites with anchors, contact shadows, variants and chimney smoke. |
| `ArtUtils.ts` / `art/*.ts` | Canvas helpers and generators for every texture in the game. |
| `Depth.ts` / `CameraLayers.ts` | Fixed depth bands and the split world/UI camera setup. |

### Design decisions

- **Rendering and rules are separated.** `FarmSimulation` has no Phaser
  dependency, so growth and economy can be verified headlessly.
- **Simulation runs in grid space.** Collision, interaction range, and movement
  are resolution-independent; rendering converts to isometric screen space.
- **Static terrain is baked, not redrawn.** `TileMap` paints each 8×8-tile chunk
  into one padded canvas texture (with cross-border scatter), so a 32×32 map is
  a handful of draw calls rather than 1024 sprites.
- **Depth is centralised.** `src/utils/Depth.ts` reserves fixed bands for ground,
  glints, world props, atmosphere, prompts, controls, HUD and modals, while
  world props still sort by `worldDepth(gridX, gridY)` so rows overlap correctly.
- **UI has its own camera.** Phaser applies camera zoom to zero-scroll-factor
  objects too, which would drag and shrink the HUD. `CameraLayers.ts` adds a
  second camera at zoom 1 and splits draw lists via `registerWorld()` /
  `registerUi()`, keeping the interface pixel-perfect at every zoom level.
- **The world camera zooms responsively** (0.62–1.0) while the world origin stays
  fixed, so terrain, props and collision remain aligned on desktop and phones.
- **Movement is delta-timed with sub-stepping**, preventing tunnelling through
  collision tiles on slow frames or high zoom.
- **Time is authoritative.** Crop progress is derived from `totalDays` and the
  calendar rather than incremented per frame, so pausing, saving, and loading
  cannot desynchronize growth.
- **No fake systems.** Every documented action mutates real state and persists.

---

## Testing

```bash
npm run typecheck   # strict TypeScript, no emit
npm run test:logic  # 45 headless farming/economy/time assertions
npm run test:smoke  # build + real Chrome smoke test (desktop + mobile)
npm test            # typecheck + logic tests
```

- **Logic tests** (`src/dev/logicTest.ts`) bundle with esbuild and run in Node.
  They cover the planting→growth→harvest→sell→reinvest loop, seasons, land
  purchase, insufficient funds, inventory capacity, serialization, pause, and
  the offline cap.
- **Browser smoke test** (`scripts/browser-smoke.mjs`) drives the production
  build through the Chrome DevTools Protocol: canvas mount, spawn, keyboard
  movement, the full farm loop, market stock, land purchase, pause freezing,
  IndexedDB save/load, and a 390×844 touch pass with joystick movement. It
  reuses a running preview server or starts one, and writes menu/gameplay
  screenshots for desktop and mobile to `.tmp/`.
  Requires Chrome; override with `CHROME_PATH=/path/to/chrome`.

> Headless Chrome is unfocused by default, which makes Phaser pause its loop and
> replay queued key events. The smoke test enables focus emulation
> (`Emulation.setFocusEmulationEnabled`) so input behaves like a real tab.

---

## Visuals and assets

The game ships **no binary art**. Every visual is painted at runtime with the
Canvas 2D API in `src/art/` before the first playable frame, so a clean checkout
runs with no missing textures and nothing to license.

- **Terrain** — 128×64 isometric tiles with painted gradients, grain and edge
  lighting, baked into padded 8×8-tile chunk canvases plus animated water glints.
- **Props** — houses, trees, rocks, market stalls, a well, hay, sacks, barrels,
  crates and fences as anchored sprites with soft contact shadows, deterministic
  variants and chimney smoke.
- **Characters** — the player has three facings, an idle frame and a six-frame
  walk cycle, with fixed feet alignment so movement never slides.
- **Farms** — soil states and crop stages for wheat and barley, sized 128×128 so
  mature crops rise above the plot.
- **Interface** — painted wood/brass panel, buttons, akçe and grain icons, a
  title background, vignette, sunbeam and world-space backdrop.

Real art can still be dropped in through `AssetLoader.getDefaultAssets()` without
touching gameplay code. See [`docs/ASSET_PIPELINE.md`](docs/ASSET_PIPELINE.md)
for the texture catalog, chunk/depth rules, manifest format, isometric
conventions and historical art-direction constraints.

---

## Packaging (planned)

- **Capacitor** for Android/iOS
- **Tauri** for Windows, macOS, and Linux

The game avoids browser-only APIs outside a guarded IndexedDB layer, so both
targets can reuse the same build.

---

## Roadmap

- Additional crops, tools, and multi-season rotation
- NPC schedules and dialogue beyond ambient lines
- Generational progression and family legacy
- Historical events and faction reputation
- Ambient audio and richer weather/lighting
