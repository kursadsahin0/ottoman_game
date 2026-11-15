# Profession progression

`src/data/ProfessionData.ts` defines profession labels, matching village occupations, skill family, successful activity XP and fatigue, and level unlocks. `src/systems/ProfessionSystem.ts` is the persistence and progression service. It owns per-character profession state, daily XP limits, fatigue, hoe condition, mentor tuition, trade reputation and inheritance of limited family knowledge.

## Playable loops currently connected

- **Farming** uses the existing field interaction: prepare owned soil with a hoe, plant a suitable crop with seed, let the simulation grow it on the calendar, then harvest into inventory. Successful work grants activity XP, with a daily cap and same-field action deduplication. Fatigue recovers as days pass. The hoe wears with preparation, becomes unusable at zero, and costs 8 akçe to repair beside a blacksmith. A level 4 farmer can harvest at most one additional crop per field.
- **Trading** gains practice only after completed market purchases or sales. Skill and customer reputation provide a bounded price improvement (at most 10%).
- **Smithing** gains practice from paid hoe repair at the blacksmith. Master NPCs can teach a first lesson for 12 akçe once per profession and at most once every 30 days, provided they match the profession and have a relevant experienced attribute.
- A successor starts with their own character identity and receives at most a small amount of knowledge from professions mastered by the previous head. Other skills do not transfer automatically.

The data catalog also names husbandry, horse care, hunting, carpentry, military service, weaving, milling and pottery with their activity definitions and level abilities. Their production loops are not currently wired to gameplay. Do not present those entries as playable progression until a real activity produces its output and calls `recordActivity` from a successful simulation result.

## Extending the system

1. Add or adjust the profession definition and activity balance in `ProfessionData.ts`.
2. Implement the activity as a simulation operation that validates location, inputs, time and output capacity before changing state.
3. In the gameplay adapter, call `canWork` before the operation and `recordActivity` only after it succeeds. Use a stable source ID and the simulation day to prevent repeated rewards.
4. Add fatigue or tool costs only where the activity uses physical labor or equipment; restore condition through a real service and fee.
5. Add output to the shared inventory/economy, expose the action through an actual workstation or NPC, and test success, failure, output, limits, save/load and successor transition.

Profession state is an optional field in game saves. The current game save schema is 1.10.0; `SaveManager` validates its bounds before load, and older saves start with an empty progression state. Run `npm run test:professions` and `npm test` after changes.
