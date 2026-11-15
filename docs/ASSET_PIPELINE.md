# Asset Pipeline

The production art direction, period rules, animation contract, fallback behavior,
and cohesive gameplay-scene composition live in [`ART_DIRECTION.md`](ART_DIRECTION.md).
The machine-readable dimensions, frame counts, provenance, and planned categories
are catalogued in [`ART_MANIFEST.json`](ART_MANIFEST.json).

The game ships **no binary art**. Every texture is painted at runtime with the
Canvas 2D API before the first playable frame, so a clean checkout runs without
missing assets and the build stays license-safe.

The art is no longer placeholder geometry: tiles, buildings, crops, characters
and UI chrome are high-resolution canvases with gradients, noise, painted
lighting, contact shadows and animation frames.

## How it works

`BootScene.create()` calls the generators in `src/art/`:

| Module | Generates |
| --- | --- |
| `TerrainArt.ts` | 16 seeded grass, 3 dirt, 3 road and 3 water tiles (128×64), sparse cell-level tufts, flowers, pebbles, reeds, water glints |
| `PropArt.ts` | 2 houses, a rural zaviye, a smith's workshop, a raised granary, 3 trees, 2 rocks, 2 market-stall designs, well, hay, sacks, pots, barrels, crates, signs, fences, smoke puffs and a soft contact shadow |
| `CharacterArt.ts` | Male/female player frames: 3 directions × idle + 6-frame walk cycle, with farmer, frontier guard and caravaner clothing variants, plus the selection ring |
| `FarmArt.ts` | Farm plots for locked, untouched, prepared, seeded, harvested, 4 growth stages × wheat/barley, and ready crops |
| `UiArt.ts` | Title background, wood/brass button and panel, coin/wheat/barley icons, vignette, sunbeam, backdrop, selection ring |
| `ArtUtils.ts` | Shared canvas, RNG, noise, isometric diamond, lighting and scatter helpers |

Textures are created with `createCanvasTexture()` in `ArtUtils.ts`, which paints
into an offscreen canvas and registers it with Phaser's texture manager. Each
generator uses a fixed RNG seed, so the world looks identical on every run.

## Rendering structure

- **Ground is baked, not drawn per tile.** `TileMap` renders 8×8-tile chunks
  into padded canvas textures (one texture and one draw call per chunk). Baked
  scatter (tufts, flowers, pebbles, reeds) overlaps tile borders naturally.
  Animated water glints remain individual sprites so the pond moves.
- **Props are sprites with anchors.** `WorldObjectManager` places each prop by a
  normalised anchor that sits on the tile centre, adds a soft contact shadow,
  and animates chimney smoke for houses. Variants are chosen deterministically
  from the object id.
- **Depth is centralised.** `src/utils/Depth.ts` defines fixed bands: ground,
  glints, world props, selection, vignette, prompts, touch controls, HUD, modals
  and feedback. World objects use `worldDepth(gridX, gridY)`, so row order is
  always correct while UI stays above the world.
- **The UI has its own camera.** Phaser applies camera zoom to *all* objects,
  including zero-scroll-factor ones. `src/utils/CameraLayers.ts` adds a second
  camera at zoom 1 and splits draw lists: the main camera draws world content,
  the UI camera draws HUD, prompts, menus and touch controls at exact pixel
  sizes. Register new objects with `registerWorld()` or `registerUi()`.
- **The world camera zooms responsively**, clamped to 0.62–1.0, and the fixed
  world origin keeps terrain and props aligned across viewports. A world-space
  painted backdrop fills the area beyond the map edge.

## Isometric rules

- Tile diamond is **128×64** (`ISOMETRIC_CONFIG`).
- `IsometricUtils.gridToScreen()` returns the **top corner** of the diamond.
  Props anchored to a tile are positioned at `screen.y + tileHeight / 2`.
- Farm textures are 128×128 so mature crops can rise above the soil;
  `FARM_ANCHOR` (0.5, 0.75) puts the diamond centre on the tile centre.
- Player frames are 128×176 with `FEET_Y = 158`; the sprite origin is
  `FEET_Y / 176`, so the boots stand on the tile rather than the image centre.
- New world visuals must use `registerWorld()` and `worldDepth()`; new HUD,
  prompts, menus and touch controls must use `registerUi()` and a UI depth band.

## Registering external art (optional)

`AssetLoader` (`src/systems/AssetLoader.ts`) remains the single entry point for
loading files. Its manifest is empty and is called by `LoadingScene`:

```ts
public getDefaultAssets(): AssetDefinition[] {
  // Register external files here if the procedural art is replaced.
  return [];
}
```

To add an asset:

1. Put the file under `assets/`:
   - `assets/sprites/` — characters, props, crops
   - `assets/tiles/` — terrain tiles
   - `assets/ui/` — panels, buttons, icons
   - `assets/audio/` — music and effects
   - `assets/maps/` — Tiled JSON maps
2. Add a manifest entry:

   ```ts
   {
     key: 'player_walk',
     path: 'assets/sprites/player_walk.png',
     type: 'spritesheet',
     frameConfig: { frameWidth: 128, frameHeight: 176 },
   }
   ```

   Supported types: `image`, `spritesheet`, `tilemapTiledJSON`, `audio`,
   `bitmapFont`.
3. Reference `asset.key` from the scene/entity instead of the generated key.
4. Remove the matching generator call in `BootScene` once nothing uses it.

`LoadingScene` already displays a progress bar driven by the loader, so new
manifest entries get real loading feedback automatically.

## Art direction constraints

The setting is Anatolia at the start of the Ottoman beylik (around 1299).
Assets should stay historically plausible:

- **No modern machinery, vehicles, firearms, or electricity.**
- **No modern currency symbols.** Wealth is expressed in akçe (silver coin).
- **Crops:** wheat and barley; tools are hand tools such as the hoe.
- **Architecture:** timber-framed houses, stone foundations, tiled roofs,
  a small open market, a well, dirt roads.
- **Palette:** earth tones (ochre, clay, olive, weathered wood) with restrained
  gold accents for UI.

## Performance notes for mobile

- Keep the ground baked into a handful of padded chunk textures rather than
  one sprite per tile (32×32 tiles → 16 chunks, including edge padding).
- Props and crops are individual textures, which is cheap at this scene size;
  avoid adding per-frame `Graphics` redraws for static content.
- Water glints and chimney smoke are the only continuously animated world
  sprites; keep that list small.
- Prefer atlas or spritesheet output over many individual PNGs if external art
  is introduced. Keep replacement terrain textures at 128×64 so chunk layout
  and depth sorting stay valid.

## Audio

No audio files are loaded yet. Add entries to the manifest with `type: 'audio'`
and guard playback behind user interaction, which mobile browsers require.
