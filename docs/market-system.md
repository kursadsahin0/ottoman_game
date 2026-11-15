# Local market and trade rules

`Economy` is the shared transaction authority: it checks item definitions, funds, inventory capacity, ownership, and nonnegative quantities before committing a purchase or sale. `MarketSystem` owns the village trader's finite stock, capital, demand pressure, weekly caravan replenishment, and market interface. Goods and starting stock are configured in `src/data/EconomyData.ts`.

Prices use the existing crop and item values, seasonal food scarcity, local stock, recorded purchases, route disruption, profession trade skill, and standing with the merchants. Stock and route pressure are deterministic and price factors are bounded. The village merchant has limited capital and storage; a sale may be limited by either, and the player receives payment only for the quantity actually transferred. Market inventory, demand, capital, route disruption, and restock date persist in save schema 1.10.0. Earlier market saves remain valid and receive defaults.

The currently playable market supports wheat, barley, oats, their seeds, a hoe, and arrows. Farming supplies real harvested inventory for sale; seeds and tools feed back into the farming and military inventory loops. Weather adjusts the route cost. Political standing and profession trade skill affect terms. The sample grain contract in diplomacy uses real wheat inventory and the same economy currency.

The current game does not yet produce livestock goods, crafted wares, clothing, regional caravan routes, shop staffing, or player-owned business ledgers. Those require production and regional supply systems that do not yet exist in the project. Do not advertise them as implemented or add them as purchasable stock without connecting real production, inventory, and save state.
