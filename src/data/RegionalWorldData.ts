export type LocationKind = 'village' | 'market_town' | 'fort' | 'camp';
export type TenureRule = 'communal_lease' | 'market_lease' | 'military_grant';

export interface RegionalLocation {
  id: string; name: string; kind: LocationKind; classification: 'fictional' | 'historical';
  availableFrom: number; availableUntil?: number; terrain: string; climate: string;
  population: number; economy: { prosperity: number; transportCost: number; demand: Record<string, number>; stock: Record<string, number>; prices: Record<string, number> };
  authority: string; faction: string; neighbors: Array<{ id: string; distance: number; terrain: string }>;
  services: string[]; tenure?: { rule: TenureRule; cost: number; requiresInfluence: number; plots: number };
}

// These are explicitly fictional gameplay locations, not documented historical settlements.
export const REGIONAL_LOCATIONS: RegionalLocation[] = [
  { id:'kizilca_village', name:'Kızılca Köyü', kind:'village', classification:'fictional', availableFrom:1299, terrain:'ekilebilir ova', climate:'ılıman karasal', population:86, economy:{prosperity:0.8,transportCost:1,demand:{wheat:8,barley:6,oats:5},stock:{wheat:18,barley:14,oats:9,seed_wheat:4,seed_barley:4,seed_oats:3,hoe:1},prices:{wheat:7,barley:5,oats:6,seed_wheat:4,seed_barley:3,seed_oats:4,hoe:18}}, authority:'uç beyi adına yerel temsilci', faction:'uç topluluğu', neighbors:[{id:'akpinar_market',distance:12,terrain:'ova yolu'},{id:'karadere_fort',distance:17,terrain:'orman ve sırt'}], services:['tarla','pazar','konaklama'] },
  { id:'akpinar_market', name:'Akpınar Pazar Kasabası', kind:'market_town', classification:'fictional', availableFrom:1299, terrain:'dere kavşağı', climate:'nemli ılıman', population:640, economy:{prosperity:1.25,transportCost:1.2,demand:{wheat:18,barley:14},stock:{wheat:10,barley:8,seed_wheat:10,seed_barley:9,hoe:5},prices:{wheat:9,barley:7,seed_wheat:4,seed_barley:3,hoe:20}}, authority:'yerel kadı ve pazar emini', faction:'kasaba eşrafı', neighbors:[{id:'kizilca_village',distance:12,terrain:'ova yolu'},{id:'karadere_fort',distance:14,terrain:'orman geçidi'},{id:'sariova_camp',distance:19,terrain:'kervan yolu'}], services:['pazar','konaklama','arazi kirası'], tenure:{rule:'market_lease',cost:32,requiresInfluence:3,plots:2} },
  { id:'karadere_fort', name:'Karadere Gözetleme Hisarı', kind:'fort', classification:'fictional', availableFrom:1299, terrain:'kayalık orman sırtı', climate:'serin yüksek arazi', population:54, economy:{prosperity:0.55,transportCost:1.55,demand:{wheat:6,barley:9},stock:{wheat:3,barley:7,seed_wheat:1,seed_barley:2,hoe:1},prices:{wheat:12,barley:8,seed_wheat:6,seed_barley:4,hoe:24}}, authority:'uç garnizonu', faction:'uç topluluğu', neighbors:[{id:'kizilca_village',distance:17,terrain:'orman ve sırt'},{id:'akpinar_market',distance:14,terrain:'orman geçidi'},{id:'sariova_camp',distance:11,terrain:'dağ patikası'}], services:['garnizon','haberleşme','konaklama'] },
  { id:'sariova_camp', name:'Sarıova Kervan Durağı', kind:'camp', classification:'fictional', availableFrom:1299, terrain:'açık bozkır', climate:'kurak karasal', population:32, economy:{prosperity:0.95,transportCost:1.1,demand:{wheat:10,barley:16},stock:{wheat:8,barley:12,seed_wheat:3,seed_barley:5,hoe:2},prices:{wheat:8,barley:6,seed_wheat:5,seed_barley:3,hoe:21}}, authority:'kervan başı ve yerel koruma', faction:'kervan birliği', neighbors:[{id:'akpinar_market',distance:19,terrain:'kervan yolu'},{id:'karadere_fort',distance:11,terrain:'dağ patikası'}], services:['kervan','pazar','konaklama'] },
];
