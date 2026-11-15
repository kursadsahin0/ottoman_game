# Art direction and production pipeline

## Visual target

A grounded, hand-painted isometric village on the early Ottoman Anatolian frontier. The current runtime art is original canvas-painted artwork, not geometric placeholder art. Use readable silhouettes, quiet natural materials, painterly gradients, restrained edge texture and soft contact shadows. Keep decoration subordinate to navigation and interaction.

The renderer is a 2D Phaser pipeline; it does not use 3D models, physically based maps, or imported raster art. Current visual work keeps assets project-owned and native to Canvas: grass has sixteen seeded variants, per-cell ground scatter is sparser, plaster grain is clipped to each wall plane, and clothing recolor is masked away from facial pixels. Character gender is independent from occupation. Women use a distinct, period-grounded silhouette: a wrapped head covering, a longer layered outer garment with a stitched hem and woven inner panel, and subtler waist/shoulder shaping. Men retain a shorter tunic and belt silhouette. Occupation changes cloth colors and details without erasing the gender-specific cut. These are stylized visual conventions, not claims that every person in the period dressed identically. The lookdev scene is available at `/?artBenchmark=1` and uses the same terrain, buildings, and controllable player as gameplay.

### Core rendering specification

- **Projection:** 2:1 isometric diamond, 128×64 px per ground cell. Grid origin is the top corner; grid-to-screen is `x=(gx-gy)×64`, `y=(gx+gy)×32`.
- **Character cell:** 128×176 px; feet anchor `(0.5, 158/176)`, rendered at scale `0.62` against a 128×64 cell. A normal adult stands about 1.7 cells tall on screen. Preserve transparent headroom and a shared baseline across every pose.
- **Lighting:** warm daylight from upper left (screen northwest), with cool/soft shadows falling lower right. Contact shadows sit at the ground footprint, not the sprite centre. Night, interiors and weather can change ambient color, but keep the light direction consistent unless a scene explicitly defines another source.
- **Palette:** dusty olive and sage greens, ochre grass, clay and umber soil, limestone, smoke-dark timber, muted indigo, natural wool, and restrained brass. UI uses dark walnut, parchment, and antique brass. Reserve saturated color for interactable or exceptional objects.
- **Detail density:** one strong focal read per tile. Scatter is sparse and seeded; keep tile centres and footpaths clear. Buildings may carry fine roof/plaster detail, but texture should not compete at normal camera zoom. Sixteen ground texture seeds reduce large-scale tile repetition without increasing scatter density.
- **Materials:** stone is irregular and matte; timber is hand-hewn with visible joints; plaster is sun-worn and uneven; roofs use small clay tiles; cloth is woven/matte; leather is dark and low-gloss; iron is dark forged metal with small highlights. Do not use plastic shine, machined repetition, modern glass, or photorealistic noise.
- **UI icons:** small, hand-painted, high-contrast silhouettes with a warm light edge and consistent 28×28 base size. No emoji, modern currency symbol, or mixed outline/fill language.

## Historical period variation

Every authored asset must declare its earliest and latest intended period in the manifest. Do not apply a universal “Ottoman” costume or building set across centuries. The initial 1299 frontier set uses modest rural timber-and-stone dwellings, local cloth, leather, hand tools and period-appropriate weapons. Later sets should be separate variants tied to researched period data: urban masonry and civic/religious architecture, garments, military equipment, crops, trade goods, and settlement density change only when the simulation date and region justify them. Never upgrade a prop simply because the player advanced a generation. Unknown or unresearched combinations use the conservative frontier set, not invented ornament.

Before production of a period-specific uniform, weapon, structure or emblem, record the historical reference and confidence in the asset source notes. In particular, do not depict later janissary uniforms, firearms, imperial motifs, or mature Ottoman court architecture in the 1299 frontier scene.

### Kızılca village plan (1299 frontier scene)

Kızılca is a fictional rural frontier settlement, so it uses a small, scene-specific neighborhood rather than a universal Ottoman mahalle template. Six modest dwellings cluster along the main earthen road and a short branch lane; a small rural zaviye with a covered guest porch sits at the branch's end, with a shared well nearby. The market remains a few open roadside stalls, while the household fields and productive buildings sit at the village edge. The zaviye is a plausible frontier-settlement choice: research describes rural zaviyes as possible settlement nuclei, but this does not mean every village had one. Traditional neighborhood studies also distinguish communities with and without a mosque; do not auto-place a Friday mosque, minaret, bath, or urban külliye in every settlement. The specific lodge is deliberately low and modest, without a monumental dome or minaret.

Reference notes: [Yüksel, “Aydınoğulları’ndan Osmanlı’ya Tire Külliyeleri (14.–16. yüzyıllar)”](https://dergipark.org.tr/en/pub/turkiyat/article/1439391) discusses rural zaviyes and town complexes as distinct settlement contexts; [Barkan, “Osmanlı İmparatorluğunda Desantralizasyona Dair Genel Gözlemler”](https://belleten.gov.tr/tam-metin/1340/tur) describes early Ottoman zaviye endowments and their role as nuclei of some new villages; [Açık, “Mahalle ve camii”](https://dergipark.org.tr/tr/pub/otam/article/132210) identifies neighborhood types with and without mosques, a useful check against treating one plan as universal. The later [Kıreli rural-settlements study](https://dergipark.org.tr/tr/download/article-file/3438751) documents wells and other surviving village elements for a later period; those elements are used here only as rural-site context, not as direct proof of a 1299 layout.

## Naming and animation conventions

- Runtime keys use lowercase snake case: `{category}_{subject}_{variant}`. Character keys are `player_{direction}_{state}` or `player_{role}_{direction}_{state}`; crop keys are `farm_{crop}_{stage}`; props use `prop_{subject}_{variant}`; UI glyphs use `icon_{subject}`.
- External files mirror their runtime key under category folders, for example `assets/characters/player/front/walk_00.png` or `assets/terrain/grass/grass_00.png`. Never reuse a key for different art or overwrite a source without checking all references.
- Sprite sheets use fixed-size cells, transparent padding, top-left frame order, stable pivots, and no trim/rotation unless atlas metadata preserves the original anchor. Character locomotion: 6 frames at 110 ms; action loops are authored at 8–12 frames, 90–130 ms, and event poses are non-looping. Keep FPS configurable by action metadata rather than baking timing into frame art.
- Current supported facing is front, back and side; left/right share side art via flip. Do not claim diagonal facings until matching animation cells exist. Male and female appearances use matching directional and walk cells, but distinct body silhouettes and garment cuts; gender is read from the current family member while occupation remains an independent clothing palette.
- Existing authored states: idle and walk only. Farming, harvesting, interacting, attacking, taking damage, defeated and carrying are not available as dedicated frames yet. For any absent optional state, use matching facing idle; if unavailable, use `player_front_idle`; if even that key is missing, retain the last valid texture. Keep the underlying gameplay action functional. Never reference a texture until `TextureManager.exists()` confirms it.

## Asset production and manifest

`ART_MANIFEST.json` is the source of truth for runtime key/path, category, dimensions, frame counts, license/provenance, intended use, and historical period. Procedural canvases record the generator source path; if exported to files later, add file path, checksum, source reference, and author before replacing a generated key. All current entries are original project-created art. No copyrighted game sprites are included.

Pipeline: research and period-tag → thumbnail silhouette → native-cell paint → anchor/frame validation → manifest entry → generated-texture smoke check → visual review at native and gameplay zoom → gameplay regression check. Retain working source and do not overwrite a used key without updating all consumers in the same change.

## Cohesive sample scene

The playable `GameplayScene` and developer-only `ArtBenchmarkScene` are the sample compositions: seeded 32×32 frontier terrain with chunk-baked grass/dirt/water and sparse scatter; six timber/plaster homes grouped along a narrow branch lane, a rural zaviye, smith's workshop, raised granary, shared well and four open-air roadside stalls; an orchard/field edge with wheat or barley growth; a front-facing player at the shared feet anchor; soft upper-left light, lower-right contact shadows, and walnut/parchment HUD. The lookdev scene reuses the terrain, props, and controllable player, then adds representative villagers for review. The composition keeps roads legible and the village, field and water visually distinct. The rendered implementation is assembled in `BootScene`, `TileMap`, `WorldObjectManager`, `FarmManager`, `Player`, and the scene classes; this is the approval target for additional assets.

## Rendering and performance rules

- `TileMap` bakes 8×8 chunks with padding, then draws glints separately. Preserve the 128×64 seamless tile border; detail may bleed into the padded chunk only when it cannot create a seam.
- Ground uses the fixed ground band. Props, crops, NPCs and the player use `worldDepth(gridX, gridY, bias)`, ordered primarily by row and then column. Large buildings anchor at the ground contact point; their footprint's rear cell determines occlusion. Do not sort by sprite centre or add a depth bias large enough to cross a row.
- Main-camera world art is registered through `registerWorld`; UI uses `registerUi` and screen-space depth bands. Avoid per-frame graphics redraw for static assets.
- Keep player/NPC feet and building bases on their ground plane. Avoid tile overlap from mismatched origins; do not independently scale the tile diamond away from the global projection.
- Missing optional character states fall back as above. Missing external files should be omitted from the asset manifest until supplied and license-reviewed; generated runtime art remains the gameplay fallback.

See `ART_MANIFEST.json` for the machine-readable catalogue and animation contract.
