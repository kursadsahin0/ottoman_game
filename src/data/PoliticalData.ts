export type FactionCategory = 'local_leadership'|'military'|'merchant'|'community'|'regional_authority';

export interface PoliticalFactionDefinition {
  id: string; name: string; category: FactionCategory; fromYear: number; untilYear?: number;
  leaderId: string; goals: string[]; personality: { caution: number; ambition: number; generosity: number; loyalty: number };
  startingResources: number; publicDescription: string;
}

export interface PoliticalNpcDefinition {
  id: string; name: string; factionId: string; fromYear: number; untilYear?: number;
  goals: string[]; personality: { caution: number; ambition: number; generosity: number; loyalty: number; negotiation: number };
  resources: number; loyalty: number;
}

/** Faction and title availability follows the playable 1299+ simulation era. */
export const POLITICAL_FACTIONS: readonly PoliticalFactionDefinition[] = [
  { id:'ottoman_house', name:'Osmanlı Hanesi', category:'local_leadership', fromYear:1299, leaderId:'osman_gazi', goals:['Sınır yerleşimlerinde bağlılık','Uç düzenini korumak'], personality:{caution:44,ambition:82,generosity:58,loyalty:78}, startingResources:72, publicDescription:'Uçta meşruiyet ve bağlılık arayan hanedan çevresi.' },
  { id:'frontier_beyliks', name:'Uç Beyleri', category:'military', fromYear:1299, leaderId:'commander_kara', goals:['Askerî yükümlülükleri sürdürmek','Yol ve mera güvenliği'], personality:{caution:52,ambition:64,generosity:42,loyalty:70}, startingResources:58, publicDescription:'Yerel askerî önderler ve bağlı savaşçılar.' },
  { id:'village_community', name:'Kızılca Köyü', category:'community', fromYear:1299, leaderId:'hasan_farmer', goals:['Tarla ve mera haklarını korumak','Kışlık erzakı güvenceye almak'], personality:{caution:68,ambition:34,generosity:72,loyalty:66}, startingResources:46, publicDescription:'Köylü hanelerinin ortak çıkarları.' },
  { id:'market_merchants', name:'Pazar Esnafı', category:'merchant', fromYear:1299, leaderId:'yusuf_merchant', goals:['Ticaret yollarını açık tutmak','Adil ve öngörülebilir alışveriş'], personality:{caution:62,ambition:59,generosity:38,loyalty:48}, startingResources:63, publicDescription:'Yerel tüccarlar ve kervan ortakları.' },
  { id:'frontier_garrison', name:'Hudut Birliği', category:'military', fromYear:1299, leaderId:'commander_kara', goals:['Nöbet ve erzak düzeni','Komutanlık emirlerine bağlılık'], personality:{caution:47,ambition:53,generosity:45,loyalty:82}, startingResources:55, publicDescription:'Köy yollarını ve sınır geçitlerini gözeten birlik.' },
  { id:'local_judiciary', name:'Yerel Kadılık', category:'regional_authority', fromYear:1299, leaderId:'local_cadi', goals:['Uyuşmazlıkları usulle çözmek','Yerel hakları kayıt altına almak'], personality:{caution:74,ambition:42,generosity:48,loyalty:73}, startingResources:42, publicDescription:'Yerel kadı ve uyuşmazlık çözüm ağı.' },
  { id:'regional_authority', name:'Bölgesel İdare', category:'regional_authority', fromYear:1362, leaderId:'murad_i', goals:['Düzenli vergi ve asker yükümlülüğü','Merkezî idareyi güçlendirmek'], personality:{caution:71,ambition:74,generosity:29,loyalty:76}, startingResources:86, publicDescription:'Daha sonraki dönemde görünür olan bölgesel idare.' },
];

export const POLITICAL_NPCS: readonly PoliticalNpcDefinition[] = [
  { id:'osman_gazi',name:'Osman Gazi',factionId:'ottoman_house',fromYear:1299,untilYear:1326,goals:['Uçta bağlılık kurmak'],personality:{caution:42,ambition:88,generosity:58,loyalty:84,negotiation:69},resources:78,loyalty:90 },
  { id:'orhan_gazi',name:'Orhan Gazi',factionId:'ottoman_house',fromYear:1326,untilYear:1362,goals:['Hanedan düzenini sürdürmek'],personality:{caution:54,ambition:80,generosity:53,loyalty:82,negotiation:73},resources:82,loyalty:88 },
  { id:'murad_i',name:'I. Murad',factionId:'regional_authority',fromYear:1362,goals:['Bölgesel idareyi genişletmek'],personality:{caution:62,ambition:84,generosity:39,loyalty:86,negotiation:68},resources:88,loyalty:90 },
  { id:'commander_kara',name:'Kara Alp',factionId:'frontier_beyliks',fromYear:1299,goals:['Hudut birliğini hazır tutmak'],personality:{caution:48,ambition:58,generosity:44,loyalty:82,negotiation:51},resources:53,loyalty:74 },
  { id:'local_cadi',name:'Yerel Kadı',factionId:'local_judiciary',fromYear:1299,goals:['Uyuşmazlıkları usulle çözmek'],personality:{caution:74,ambition:42,generosity:48,loyalty:73,negotiation:84},resources:42,loyalty:68 },
  { id:'hasan_farmer',name:'Hasan',factionId:'village_community',fromYear:1299,goals:['Ailesinin tahılını ve tarla hakkını korumak'],personality:{caution:62,ambition:38,generosity:70,loyalty:75,negotiation:45},resources:34,loyalty:68 },
  { id:'yusuf_merchant',name:'Yusuf',factionId:'market_merchants',fromYear:1299,goals:['Kervan ticaretini güvenceye almak'],personality:{caution:68,ambition:61,generosity:38,loyalty:50,negotiation:78},resources:48,loyalty:56 },
];

export const POLITICAL_TITLES = [
  { fromYear:1299, untilYear:1361, title:'Uç beyliği dönemi' },
  { fromYear:1362, title:'Bölgesel beylik ve erken sancak düzeni' },
] as const;

export const POLITICAL_DISPUTES = {
  land: { id:'fictional_frontier_land_dispute', title:'Mera ve tarla sınırı', parties:['village_community','frontier_beyliks'], startYear:1299, endYear:1325 },
  levy: { id:'fictional_frontier_levy', title:'Askerî yükümlülük', parties:['frontier_garrison','village_community'], startYear:1299, endYear:1361 },
  trade: { id:'fictional_market_contract', title:'Pazar tedarik sözleşmesi', parties:['market_merchants','village_community'], startYear:1299 },
  tax: { id:'fictional_tax_petition', title:'Ürün payı ve vergi talebi', parties:['regional_authority','village_community'], startYear:1362 },
  succession: { id:'fictional_local_succession', title:'Yerel bağlılık ve halefiyet', parties:['ottoman_house','frontier_beyliks'], startYear:1326 },
} as const;
