/** Curated historical baseline. Gameplay-authored fiction lives in HistoricalData.ts. */
export type HistoricalClassification = 'documented_fact' | 'plausible_unverified' | 'disputed_interpretation' | 'fictional' | 'alternate_history';
export type DatePrecision = 'day' | 'month' | 'year' | 'year_range' | 'circa' | 'terminus_ante_quem' | 'unknown';
export interface HistoricalSourceRecord {
  id: string;
  title: string;
  author: string;
  publication: string;
  publicationYear?: number;
  publisherOrJournal?: string;
  pages?: string;
  url: string;
  checkedOn: string;
  checkedReference: string;
}
export interface HistoricalRecord {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  dateLabel: string;
  datePrecision: DatePrecision;
  people: string[];
  locations: string[];
  context: string;
  classification: HistoricalClassification;
  confidence: 'high' | 'medium' | 'low' | 'none';
  sources: Array<{ sourceId: string; supports: string }>;
  disputedInterpretations: string[];
  permittedGameplayAdaptations: string[];
  prerequisites: string[];
  baselineKey?: string;
  divergenceRequired?: boolean;
}
export interface HistoricalPersonRecord {
  id: string;
  name: string;
  birthEarliest?: number;
  birthLatest?: number;
  deathEarliest?: number;
  deathLatest?: number;
  notes: string;
}
export interface HistoricalLocationRecord {
  id: string;
  name: string;
  classification: 'historical' | 'fictional';
  availableFrom: number;
  availableUntil?: number;
  notes: string;
}

export const HISTORICAL_SOURCES: HistoricalSourceRecord[] = [
  { id: 'howard-2009', title: 'A History of the Ottoman Empire', author: 'Douglas A. Howard', publication: 'Ottoman Genesis, 1300–1397 (excerpt)', publicationYear: 2017, publisherOrJournal: 'Cambridge University Press', pages: 'pp. 8–11 (excerpt pp. 0–3)', url: 'https://assets.cambridge.org/97805218/98676/excerpt/9780521898676_excerpt.pdf', checkedOn: '2026-10-29', checkedReference: 'Cambridge UP excerpt, pp. 8–11; ISBN publication record lists 9 January 2017' },
  { id: 'failler-2019', title: 'Les origines de l’Empire ottoman et la bataille de Bapheus (1302)', author: 'Albert Failler', publication: 'Revue des études byzantines, 77', publicationYear: 2019, publisherOrJournal: 'Peeters Publishers', pages: 'pp. 175–202, especially pp. 188–190', url: 'https://www.persee.fr/doc/rebyz_0766-5598_2019_num_77_1_5167', checkedOn: '2026-10-29', checkedReference: 'Persée article text, pp. 188–190; distinguishes Bapheus chronology from the flood-linked date arguments' },
  { id: 'tdv-pachymeres', title: 'Pachymeres, Georgios', author: 'TDV İslâm Ansiklopedisi editorial entry', publication: 'TDV İslâm Ansiklopedisi', publisherOrJournal: 'Türkiye Diyanet Vakfı', url: 'https://islamansiklopedisi.org.tr/pachymeres-georgios', checkedOn: '2026-10-29', checkedReference: 'Entry text: Bapheus reference and 27 July 1302 date' },
  { id: 'hauzinski-2014', title: 'The Connections of the Ottomans state crisis with the neighbouring vassal states (1403–1413). Rumelian course', author: 'Jerzy Hauziński', publication: 'Balcanica Posnaniensia. Acta et Studia, 21', publicationYear: 2014, publisherOrJournal: 'Adam Mickiewicz University Press', pages: 'pp. 13–24', url: 'https://doi.org/10.14746/bp.2014.21.2', checkedOn: '2026-10-29', checkedReference: 'Publisher article page and abstract: Ankara date and interregnum through 1413' },
  { id: 'lindner-2010', title: 'Anatolia, 1300–1451', author: 'Rudi Paul Lindner', publication: 'The Cambridge History of Turkey, Vol. 1, Chapter 4', publisherOrJournal: 'Cambridge University Press', pages: 'Chapter 4', url: 'https://www.cambridge.org/core/books/abs/cambridge-history-of-turkey/anatolia-13001451/71691A45EAABF8F09B64EB28C1C680EB', checkedOn: '2026-10-29', checkedReference: 'Cambridge chapter record; used for broad regional frame only' },
];

export const HISTORICAL_PEOPLE: HistoricalPersonRecord[] = [
  { id: 'osman_gazi', name: 'Osman Gazi / Ataman', deathLatest: 1324, notes: 'Birth year unknown; Howard states death date uncertain and probably by 1324.' },
  { id: 'orhan_gazi', name: 'Orhan Gazi', notes: 'Documented by a trust deed registered in 1324; no birth/death bounds asserted here.' },
  { id: 'leon_mouzalon', name: 'Leon Mouzalon', notes: 'Byzantine commander associated with the Bapheus account; biographical bounds not verified in this content pass.' },
  { id: 'bayezid_i', name: 'Bayezid I', notes: 'Chronological record checked for Ankara and subsequent interregnum; individual birth/death bounds omitted.' },
  { id: 'mehmed_i', name: 'Mehmed I', notes: 'Associated with the end of the interregnum in 1413; personal lifespan bounds omitted.' },
];

export const HISTORICAL_LOCATIONS: HistoricalLocationRecord[] = [
  { id: 'sangarius_valley', name: 'Sangarios (Sakarya) vadisi', classification: 'historical', availableFrom: 1290, notes: 'Regional location; Howard discusses raids and settlement in the valley.' },
  { id: 'bapheus', name: 'Bapheus (Nikomedia çevresi)', classification: 'historical', availableFrom: 1300, notes: 'Approximate battlefield location; not a modern precise map pin.' },
  { id: 'brusa', name: 'Brusa (Bursa)', classification: 'historical', availableFrom: 1300, notes: 'City predates this timeline; Ottoman capture is a separate dated event.' },
  { id: 'ankara', name: 'Ankara', classification: 'historical', availableFrom: 1300, notes: 'Historical city and 1402 battle setting.' },
  { id: 'fictional_frontier_hamlets', name: 'Sınır köyleri (oyun bileşimi)', classification: 'fictional', availableFrom: 1299, notes: 'The named hamlet and encounter are fictional, not a historical place claim.' },
];

export const HISTORICAL_BASELINE: HistoricalRecord[] = [
  { id: 'ottoman-emergence-c1300', name: 'Osmanlı uç beyliğinin ortaya çıkışı', startYear: 1290, endYear: 1302, dateLabel: '13. yüzyıl sonu–14. yüzyıl başı (yaklaşık)', datePrecision: 'circa', people: ['osman_gazi'], locations: ['sangarius_valley'], context: 'Erken Osmanlı siyasi oluşumunun başlangıcını tek bir kuruluş günü veya kesin bir 1299 olayı olarak sabitlemek mümkün değildir. Kaynakların geç oluşu ve anlatıların kuruluş hafızasıyla şekillenmesi erken dönemin tarihlenmesini belirsiz kılar.', classification: 'disputed_interpretation', confidence: 'medium', sources: [{ sourceId: 'howard-2009', supports: 'pp. 8–9: kuruluş anlatılarının daha geç yazıya geçtiği, kesin kuruluş tarihinin belirsiz olduğu ve Osman’ın biyografisinin çok az bilindiği' }, { sourceId: 'lindner-2010', supports: '1300–1451 dönemi için akademik bölgesel çerçeve; tek bir kuruluş tarihi için kullanılmıyor' }], disputedInterpretations: ['Geleneksel 1299 tarihi kesin bir olay günü/yılı olarak kabul edilmemelidir.', 'Kuruluşu tek bir savaşın veya tek bir idari ilanın sonucu saymak tartışmalıdır.'], permittedGameplayAdaptations: ['Oyunu yaklaşık 1300 çevresinde başlatmak.', 'Oyuncu köyü ve aile hikâyesini açıkça kurgu olarak sunmak.'], prerequisites: [] },
  { id: 'bapheus-1302', name: 'Bapheus (Koyunhisar ile özdeşliği kesin olmayan) savaşı', startYear: 1302, endYear: 1302, dateLabel: '1302 (gün hassasiyeti ihtiyatla)', datePrecision: 'year', people: ['osman_gazi', 'leon_mouzalon'], locations: ['bapheus'], context: 'Bizans imparatorluk kuvvetleriyle Osman’ın kuvvetleri arasındaki Bapheus çatışması, erken Osmanlı yayılışının önemli bir göstergesidir. Olayın Türk kroniklerinde aynı adla eşdeğer bir anlatısı olduğu varsayılmamalıdır.', classification: 'disputed_interpretation', confidence: 'medium', sources: [{ sourceId: 'howard-2009', supports: 'pp. 8–9: Bapheus zaferini anlatır; erken tarih anlatılarının belirsizliğini özellikle vurgular' }, { sourceId: 'failler-2019', supports: 'pp. 188–190: Bapheus kronolojisini ve onunla ilişkilendirilen Sangarios taşkını anlatısının tarihlenme sorunlarını ele alır' }, { sourceId: 'tdv-pachymeres', supports: 'Pachymeres maddesi Bapheus’u 27 Temmuz 1302 olarak verir; veri gün hassasiyetini tarih yazımı ihtiyatıyla düşürür' }], disputedInterpretations: ['Failler, Bapheus anlatısını Sangarios taşkınıyla otomatik olarak birleştirmenin kronoloji sorunları doğurduğunu gösterir; burada yalnızca 1302 yılı kullanılır.', 'Bapheus’un Koyunhisar ile özdeşliği bu veri paketinde doğrulanmış kabul edilmez.'], permittedGameplayAdaptations: ['Olayı 1302 yılı içinde ve gün belirtmeden göstermek.', 'Yer ve kuvvetleri haritada yaklaşık göstermek; savaşı bölgesel sonuçlara indirgemek.'], prerequisites: [] },
  { id: 'osman-death-by-1324', name: 'Osman’ın ölümü için 1324 öncesi üst sınır', startYear: 1324, endYear: 1324, dateLabel: '1324’e kadar (kesin ölüm yılı değil)', datePrecision: 'terminus_ante_quem', people: ['osman_gazi', 'orhan_gazi'], locations: [], context: 'Orhan adına 1324 tarihli bir vakıf belgesi, Osman’ın ölümünün muhtemelen bu tarihe kadar gerçekleştiği sonucunu destekler. Bu kayıt Osman’ın ölümünü doğrudan 1324 yılına sabitlemez.', classification: 'documented_fact', confidence: 'medium', sources: [{ sourceId: 'howard-2009', supports: 'p. 10: Orhan’ın 1324 tarihli vakıf senedine dayanarak Osman’ın muhtemelen 1324’e kadar öldüğü' }], disputedInterpretations: ['Osman’ın kesin ölüm yılı belirsizdir; 1324 bir üst sınır niteliğindedir.'], permittedGameplayAdaptations: ['Hanedan geçişini 1324 çevresinde modellemek; kesin ölüm gününü göstermemek.'], prerequisites: ['ottoman-emergence-c1300'] },
  { id: 'bursa-capture-1326', name: 'Brusa’nın (Bursa) Osmanlı kuvvetlerince alınması', startYear: 1326, endYear: 1326, dateLabel: '1326', datePrecision: 'year', people: ['orhan_gazi'], locations: ['brusa'], context: 'Howard, uzun kuşatmanın ardından kentin 1326’da Orhan ve kuvvetlerince alındığını; ertesi yıl burada sikke basıldığını aktarır.', classification: 'documented_fact', confidence: 'high', sources: [{ sourceId: 'howard-2009', supports: 'p. 10: Bursa’nın 1326’da alınması ve sonraki yıl sikke basımı' }], disputedInterpretations: [], permittedGameplayAdaptations: ['Kuşatma sürecini görev zinciri olarak temsil etmek; oyuncu katkısını açıkça alternatif tarih olarak ayırmak.'], prerequisites: ['osman-death-by-1324'] },
  { id: 'ankara-battle-1402', name: 'Ankara Savaşı ve Bayezid’in yenilgisi', startYear: 1402, endYear: 1402, dateLabel: '28 Temmuz 1402', datePrecision: 'day', people: ['bayezid_i'], locations: ['ankara'], context: 'Ankara yenilgisini, hanedan üyelerinin taht mücadelesi ve siyasi bölünme izledi.', classification: 'documented_fact', confidence: 'high', sources: [{ sourceId: 'hauzinski-2014', supports: 'Makale özeti: Bayezid’in Ankara’da 28 Temmuz 1402 yenilgisi ve ardından Fetret dönemi' }], disputedInterpretations: [], permittedGameplayAdaptations: ['Savaş sonucu ve oyuncunun katılımını ayrı tutmak; alternatif sonuç seçilirse büyük ayrışma olarak kaydetmek.'], prerequisites: [] },
  { id: 'interregnum-1402-1413', name: 'Fetret Devri', startYear: 1402, endYear: 1413, dateLabel: '1402–1413', datePrecision: 'year_range', people: ['bayezid_i', 'mehmed_i'], locations: [], context: 'Ankara yenilgisi sonrasında Bayezid’in oğulları arasında hanedan mücadelesi yaşandı; siyasi birlik 1413’te yeniden kuruldu.', classification: 'documented_fact', confidence: 'high', sources: [{ sourceId: 'hauzinski-2014', supports: 'Makale özeti: bölünme ve hanedan savaşı 1413’e kadar sürdü' }], disputedInterpretations: ['Bölgesel hâkimiyet ve çatışma seyri tek ve kesintisiz bir merkezî savaş olarak modellenmemelidir.'], permittedGameplayAdaptations: ['Bölgesel görevler ve yerel bağlılıklar üretmek; tarihsel olayların sonucu değişirse alternatif zaman çizgisine kaydetmek.'], prerequisites: ['ankara-battle-1402'] },
];

/** Explicitly fictional content is intentionally not given invented historical citations. */
export const FICTIONAL_CONTENT_NOTE = 'Oyundaki Sınır Levazımı İsteği kurgu bir yerel olaydır; tarihsel kaynak iddiası taşımaz.';
