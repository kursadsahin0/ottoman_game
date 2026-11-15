# Character appearance pipeline

The game uses its existing Phaser 2D painted sprite rig (`src/art/CharacterArt.ts`): 128×176 frames, front/back/side views, one idle pose and six walking frames. Customized characters are generated through that same rig, so the creation preview and in-game player keep the established foot anchor and animation timing.

## Adding appearance options

1. Add the supported value to `CharacterVisuals` in `src/data/CharacterCustomization.ts`.
2. Validate it in `normalizeCharacterVisuals`; this is also the compatibility boundary for older saves.
3. Apply it in `paintCharacter` in `src/art/CharacterArt.ts`. Keep silhouette changes within the existing frame and feet baseline.
4. Add a creation-screen cycle control and a regression assertion in `src/dev/characterCustomizationTest.ts`.

Starting background is the existing `Çiftçi`, `Akıncı`, or `Kervancı` path. It selects starting resources and the matching generated clothing/headwear palette; it is separate from appearance and gameplay skill values. Armor and weapons are resolved separately from statistics and redraw the equipment silhouette when equipped. Only the supported early frontier clothing set is presented; the interface does not offer later uniforms as 1299 clothing.

Visual traits are optional on family records so pre-customization saves continue to load. Descendant traits are selected deterministically from the parents and adjusted to prevent an exact visual copy. The active character receives a subtle gray hair treatment at elder life stage. Women are normalized to no facial hair regardless of malformed imported data.

Save schema is `1.11.0`; older saves migrate through the existing save migration path. To verify this system run `npm run test:character`, `npm run test:family`, and `npm run typecheck`.
