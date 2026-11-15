# Timeline and alternate history

## Two records kept separate

`src/data/HistoricalContent.ts` is the curated historical baseline. Its records carry date precision, confidence, geographic context, source IDs, source-supported claims, uncertainty notes, and permitted game adaptations. The baseline does not change when the player makes a choice. `src/data/HistoricalData.ts` contains playable encounters. The opening village, household decisions, and named local actors in those encounters are fictional; a `baselineEventId` points to context without claiming that the invented encounter is documented.

The chronicle labels source-backed facts, disputed interpretations, uncertain claims, fictional scenarios, and explicit alternate-history branches separately. The confidence label measures the strength of the content entry and does not mean that a debated historical interpretation is settled.

## Initial period content

The sourced baseline begins with the uncertain emergence of the Ottoman polity around 1300, Bapheus in 1302, the probable upper bound on Osman’s death from Orhan’s 1324 vakfiye, and Bursa’s capture in 1326. Later entries include Ankara in 1402 and the interregnum through 1413. Exact dates are used only where the cited entry supports them; Bapheus is shown at year precision and its identification with Koyunhisar is not asserted.

The playable chain supplies six branching decisions: the fictional frontier military request, grain reserve, Bapheus-period supply choice, grazing compromise, household succession commitment, and Bursa-period market transition. The household, local disputes, caravan choices, and the player’s presence are fictional. Diverting the fictional supply detachment explicitly changes the Bapheus branch and records why; the baseline entry remains unchanged and visible. Other choices alter family relationships, resources, flags, or delayed consequences without claiming to change the historical event.

## Sources and confidence

- Douglas A. Howard, *A History of the Ottoman Empire*, “Ottoman Genesis, 1300–1397” (Cambridge University Press, 2017), excerpt pp. 8–11. Used for the uncertain early foundation narratives, the probable upper bound for Osman’s death, and Bursa in 1326. [Cambridge excerpt](https://assets.cambridge.org/97805218/98676/excerpt/9780521898676_excerpt.pdf)
- Albert Failler, “Les origines de l’Empire ottoman et la bataille de Bapheus (1302),” *Revue des études byzantines* 77 (2019), pp. 175–202. Used to avoid false precision and to keep Bapheus separate from the disputed Koyunhisar identification. [Persée article](https://www.persee.fr/doc/rebyz_0766-5598_2019_num_77_1_5167)
- Rudi Paul Lindner, “Anatolia, 1300–1451,” *The Cambridge History of Turkey*, vol. 1, chapter 4 (Cambridge University Press, 2009). Used only for regional framing, not as evidence for a single foundation date. [Cambridge chapter](https://www.cambridge.org/core/books/abs/cambridge-history-of-turkey/anatolia-13001451/71691A45EAABF8F09B64EB28C1C680EB)
- Jerzy Hauziński, “The Connections of the Ottomans state crisis with the neighbouring vassal states (1403–1413). Rumelian course,” *Balcanica Posnaniensia* 21 (2014), pp. 13–24. Used for the Ankara and interregnum entries. [Publisher record](https://doi.org/10.14746/bp.2014.21.2)

The source registry records the exact pages or checked reference for each claim. A source is not evidence for claims beyond the `supports` text attached to an event. The playable branch events have no historical sources because they are authored fiction.

## Adding events

Add historical anchors to `HistoricalContent.ts` with a stable ID, conservative date precision, source support, confidence, place/person references, uncertainty, and permitted adaptation. Add playable choices separately in `HistoricalData.ts`; specify prerequisites and date/context requirements, guard costs with requirements, and put delayed effects in `delayedConsequences`. For a branch that changes a historical baseline, provide `baselineEventId`, set `divergesFromBaseline`, and write `divergenceExplanation`. Ordinary fictional events must not be marked as historical divergences.

`ChronologyValidator` checks source links, dates, referenced people and places, event dependencies, cycles, choice IDs, costs, and explanations. Historical choices and due consequences are persisted in save schema 1.10.0 and use the shared simulation day, not wall-clock time. Run `npm run test:chronology`, `npm run test:historical`, and `npm run test:quest` when editing timeline content.
