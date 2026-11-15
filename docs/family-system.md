# Family and succession system

The family simulation lives in `src/systems/FamilySystem.ts`; data contracts, policy definitions, date helpers, and life-stage labels live in `src/data/FamilyData.ts`. UI is in `src/ui/FamilyTreePanel.ts` and `src/ui/SuccessionPanel.ts`. `GameplayScene` connects the current family member to the rendered player and the live economy and farm state.

## Adding family members

Use `createFounder`, `createSpouse`, and `createChild` rather than constructing members directly. These methods allocate stable IDs, generate distinct names, traits, skills, and a player sprite appearance, and maintain reciprocal relationships. Children must have distinct parents of the expected genders, living parents, plausible parent ages at the recorded birth date, and the family population must be below its configured cap. For unusual historical starts, create the family with the correct date and ages instead of bypassing these checks.

Family age is calculated from `birthDate` and the simulation calendar. Keep that date as the source of truth; update age and life stage through `advanceTime`. Death and retirement are distinct: death records cause and date, while retirement records the date but leaves the former head alive.

## Inheritance policy

`FamilyConfig` selects the inheritance rule, land distribution, debt ratio, reputation ratio, and historical `inheritanceContext` (`regionId` and `periodId`). `INHERITANCE_POLICIES` in `FamilyData.ts` documents the available context specific presets. Set the policy when creating or configuring a family; the system does not infer one universal rule for all periods or regions. All eligible heirs remain visible for primogeniture and partible policies. The player explicitly selects the next playable descendant. A non-primary heir may challenge that succession from the succession screen; this records the challenge and causes a modest estate cost and a persistent rivalry when another heir is selected.

Death and voluntary retirement open the same pending succession. If no eligible descendant or configured spouse heir exists, the game shows its no-heir ending; it never fabricates a successor. `FamilyTreePanel` exposes retirement for the current living head.

## Legacy and persistence

Birth, death, retirement, succession, property changes, military service, political choices, and heirloom transfers are recorded from actual simulation actions. Do not add narrative entries as randomly generated history. Designate a held item with `designateHeirloom`; transfer history and the bounded gameplay effect are maintained by succession. The estate bridge in `GameplayScene` reads and applies live money and farm plots.

Family saves use schema version 3. `deserialize` hydrates earlier saves with missing appearance and retirement fields, removes duplicate IDs and dangling family links, and discards pending succession references to absent people. Add future migrations there and increment `FAMILY_SAVE_VERSION` when the serialized shape changes. Keep IDs stable and never derive them from array positions.

## Verification

Run `npm run test:family` for family simulation, succession, retirement, invalid relationship, save/load, and five-generation checks. Run `npm run typecheck` after changing the family data contracts. The automated five-generation scenario also checks land history, decisions, heirloom transfer, and preservation after loading.
