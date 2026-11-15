# Living village simulation

## Architecture and integration

The game remains a Phaser 3 isometric scene on a 32×32 `WorldMap`. `GameplayScene` owns the existing `TimeManager`, generated terrain, `TileMap`, and `WorldObjectManager`. It constructs `SettlementSimulation` with the same tile and building collision predicate used by the player; the village does not create a parallel map or separate clock.

The simulation is split by responsibility under `src/village/`:

- `VillageClock` derives one village clock from `TimeManager` and exposes morning, afternoon, evening, night, market day, weather, and military-emergency state.
- `ScheduleResolver` picks a deterministic routine block. Emergency overrides bad weather, which overrides market day, which overrides the base schedule.
- `NpcBrain` selects an activity and goal from schedule, needs, personality, and incidents. `NpcMovement` follows waypoints and separates nearby residents. `NavigationGrid` caches collision and `Pathfinder` runs deterministic A* with safe diagonal movement and path smoothing.
- `VillageSimulation` owns the roster, needs, memory, relationships, incidents, recovery from blocked movement, and save data. It is independent of Phaser.
- `VillageRenderer` handles visible sprites, facing, animation fallback, labels, depth, and the optional route overlay. `VillageDebugPanel` is a read-only inspector.

`SettlementSimulation` adapts the pure simulation to dialogue, historical timeline entries, battle reports, the existing market, and `SaveManager`. Save payloads use settlement schema 2. Existing schema 1 settlement saves migrate to the new schema; saves without a settlement section still start from the configured default village.

## Configured village

`src/village/VillageData.ts` defines 19 residents, each with a unique name and ID, occupation, home, workplace, personality, attributes, relationships, motivation, and schedule. The current fictional roster includes farmers, merchant, baker, blacksmith, carpenter, weaver, miller, potter, imam, scribe, healer, official, herder, groom, water carrier, household residents, and two guards. Nineteen distinct home positions are used. `VillageLocations.ts` defines shared work, market, well, lodge, pasture, granary, and patrol spots next to the real scene buildings.

These named people, routines, relationships, and incidents are game fiction, not claims about documented inhabitants or a universal Ottoman daily schedule.

## Daily life, conditions, and incidents

Schedules include base routines and optional market-day, bad-weather, and emergency blocks. They cover meals, rest, work, trade, socializing, water collection, sleep, and guard patrols. Each fifth game day is a market day. Weather is deterministic from the calendar; rainy or snowy routines can move outdoor work indoors and shorten trade hours. An emergency sends civilians home, keeps civic work available, closes the market, and sends guards to muster or patrol.

The central clock changes decisions only when relevant game-hour or world conditions change. Needs update from elapsed simulation time, never through one timer per NPC. Nearby fire, theft, combat, and approaching-stranger incidents produce flee, investigate, or cautious behavior based on occupation, courage, distance, and schedule. Incidents can be raised through `SettlementSimulation.raiseVillageIncident`; reported battle outcomes create a combat incident and military alarm. Deterministic periodic incidents provide playable examples. Resolved incidents and notable player interactions enter a bounded per-NPC memory, and player trust, relationships, identities, attributes, and occupation history persist.

## Movement, rendering, and performance

The 32×32 walkability map is sampled once when the simulation is created. A* avoids terrain, building footprints, props, and blocked diagonal corners. Path goals inside a blocked building resolve to a reachable approach. Market destinations use stable slots so visitors do not all occupy one tile. Small separation forces reduce character overlap. Blocked or stalled paths are retried; after repeated failure the NPC is moved to a legal tile and waits for the next schedule decision.

The renderer checks camera visibility at most four times per second. On-screen villagers update movement and sprite state each frame; off-screen villagers use a one-second simplified update and have no label, depth, texture, or animation work. The renderer uses available directional idle and walk textures. It selects dedicated work, talk, or sleep art only when the corresponding texture exists; otherwise it retains compatible idle art and adds restrained motion/tint. Gameplay continues regardless of optional animation assets.

Debug controls: press **N** to open/cycle the resident inspector, **Shift+N** to cycle backward, and **V** to toggle the route and destination overlay. The inspector shows the selected resident's current activity, decision reason, destination, remaining path, needs, trust, relationships, memories, and base/conditional schedules.

## Add an occupation or behavior

1. Add the ID to `OccupationId` and define its label, work activity, speed, behavior tags, and fallback destination in `src/village/Occupations.ts`.
2. Add one or more walkable named standing positions in `src/village/VillageLocations.ts` if the job needs a new workplace.
3. Add a resident definition in `src/village/VillageData.ts`, including an existing walkable home, personality, attributes, relationships, and full-day base schedule. Add conditional blocks only when that occupation needs a distinct market, weather, or emergency routine.
4. Add a decision rule to `NpcBrain` only for behavior that cannot be expressed as schedule, needs, or generic occupation tags. Keep decisions deterministic and return a destination key/position; do not move or render the resident there.
5. Add optional art as texture keys following the existing `player_{gender}_{occupation}_{direction}_{state}` convention. `VillageRenderer` checks texture availability and supplies a playable fallback.
6. Extend `src/dev/villageTest.ts` with schedule, path, reaction, and save assertions for the new behavior, then run `npm run test:village` and `npm run typecheck`.

## Verification

`npm run test:village` is a headless automated suite using the generated game map and real collision rules. It covers the 19-person roster, unique homes, schedules and phases, occupational destinations, market/weather/emergency behavior, deterministic A* movement, blocked-path recovery, event reactions, off-screen updates, memory, occupation changes, and schema-2 save/load validation.
