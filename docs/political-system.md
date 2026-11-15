# Political relationships and factions

The diplomacy model lives in `src/systems/PoliticalSystem.ts`; period gated faction, leader, title, and dispute definitions live in `src/data/PoliticalData.ts`. Keep historical availability in data definitions rather than scattering year checks through the UI.

## Current playable scenario

The opening frontier scenario starts with a fictional local dispute over grazing and cultivated land. The player can pay to negotiate, support the local leader, seek mediation, compromise, or withdraw. Separate actions let the player build standing with the market and frontier factions, request limited military support, sign and fulfill a grain contract, or prepare a rebellion. Major rebellion requires resources, recruits, influence, popular support, faction backing, and military strength; poor preparation can result in confiscation or exile. Failure leaves a continuing political state.

Political actions record their outcomes in the simulation timeline and NPC memories. Political standing also affects land access, family political records, quest events, and market buying and selling terms. Save schema 1.10.0 carries individual trust and reputation, faction standing, influence, resources and leaders, alliances, rivalries, disputes, contract state, and memories. Older saves receive defaults for fields they do not contain.

## Adding an institution or political character

1. Add a stable faction or NPC ID and period range in `src/data/PoliticalData.ts`.
2. Define public goals and personality values in the 0–100 range. Do not expose hidden goals in the diplomacy panel.
3. Add a dispute template if the institution has a distinct negotiable conflict.
4. Add a `PoliticalAction` and decision availability rule in `PoliticalSystem.getDecisions`.
5. Implement the action as a deterministic state transition. Charge resources through the supplied payment callback, update trust and faction standing, add a memory, and return a readable result.
6. Connect the result to quest, family, economy, and timeline hooks in `GameplayScene` where relevant.
7. Add a test for the period gate, costs, state outcome, and serialized round trip in `src/dev/politicalTest.ts`.

The simulation currently supplies historical leader transitions for the Ottoman house as the calendar advances. Other NPC death or succession systems can call `recordFactionLeaderChange` when those events occur; the political system does not invent deaths on its own. Political rebellion resolution is a strategic outcome in this sample scenario, not a separate battlefield campaign.
