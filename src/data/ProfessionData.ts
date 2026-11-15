export type ProfessionId = 'farming' | 'husbandry' | 'smithing' | 'carpentry' | 'trade' | 'horse_care' | 'hunting' | 'military' | 'weaving' | 'milling' | 'pottery';
export type ProfessionActivity = 'prepare' | 'plant' | 'harvest' | 'trade_buy' | 'trade_sell' | 'animal_feed' | 'animal_collect' | 'smith' | 'carpentry' | 'horse_care' | 'hunt' | 'military_service' | 'weave' | 'mill' | 'pottery';
export interface ProfessionDefinition {
  id: ProfessionId; label: string; occupationIds: readonly string[]; skillKey: 'farming' | 'trade' | 'craftsmanship' | 'combat';
  activities: Partial<Record<ProfessionActivity, { xp: number; fatigue: number }>>;
  abilities: readonly { level: number; label: string }[];
}

/** Activity definitions are the single balance point for profession work. */
export const PROFESSION_DEFINITIONS: Record<ProfessionId, ProfessionDefinition> = {
  farming: { id: 'farming', label: 'Çiftçilik', occupationIds: ['farmer'], skillKey: 'farming', activities: { prepare: { xp: 8, fatigue: 9 }, plant: { xp: 5, fatigue: 4 }, harvest: { xp: 12, fatigue: 10 } }, abilities: [{ level: 2, label: 'Özenli ekim · ürün kaybı riski azalır' }, { level: 4, label: 'Bereketli hasat · her tarlada en çok +1 ürün' }, { level: 7, label: 'Usta çiftçi · toprak işi daha az yorucu' }] },
  husbandry: { id: 'husbandry', label: 'Hayvancılık', occupationIds: ['herder'], skillKey: 'farming', activities: { animal_feed: { xp: 5, fatigue: 3 }, animal_collect: { xp: 8, fatigue: 4 } }, abilities: [{ level: 2, label: 'Dikkatli bakım' }, { level: 5, label: 'Sürü yönetimi' }] },
  smithing: { id: 'smithing', label: 'Demircilik', occupationIds: ['blacksmith'], skillKey: 'craftsmanship', activities: { smith: { xp: 12, fatigue: 9 } }, abilities: [{ level: 2, label: 'Dengeli dövme' }, { level: 5, label: 'Sağlam işçilik' }, { level: 8, label: 'Usta siparişleri' }] },
  carpentry: { id: 'carpentry', label: 'Marangozluk ve inşaat', occupationIds: ['carpenter'], skillKey: 'craftsmanship', activities: { carpentry: { xp: 12, fatigue: 8 } }, abilities: [{ level: 2, label: 'Tasarruflu kereste' }, { level: 5, label: 'Yapı siparişleri' }] },
  trade: { id: 'trade', label: 'Ticaret', occupationIds: ['merchant'], skillKey: 'trade', activities: { trade_buy: { xp: 2, fatigue: 0 }, trade_sell: { xp: 3, fatigue: 0 } }, abilities: [{ level: 2, label: 'Güvenilir müşteri · fiyat pazarlığı' }, { level: 5, label: 'Toptan alışveriş' }, { level: 8, label: 'Kervan komisyonları' }] },
  horse_care: { id: 'horse_care', label: 'At yetiştiriciliği', occupationIds: ['groom'], skillKey: 'farming', activities: { horse_care: { xp: 8, fatigue: 4 } }, abilities: [{ level: 2, label: 'Düzenli bakım' }, { level: 5, label: 'At yetiştiricisi' }] },
  hunting: { id: 'hunting', label: 'Avcılık ve toplayıcılık', occupationIds: ['herder', 'villager'], skillKey: 'combat', activities: { hunt: { xp: 8, fatigue: 8 } }, abilities: [{ level: 2, label: 'İz sürme' }, { level: 5, label: 'Usta avcı' }] },
  military: { id: 'military', label: 'Askerlik', occupationIds: ['guard'], skillKey: 'combat', activities: { military_service: { xp: 12, fatigue: 10 } }, abilities: [{ level: 2, label: 'Hudut tecrübesi' }, { level: 5, label: 'Kıdemli hizmet' }, { level: 8, label: 'Komuta ehliyeti' }] },
  weaving: { id: 'weaving', label: 'Dokumacılık', occupationIds: ['weaver'], skillKey: 'craftsmanship', activities: { weave: { xp: 10, fatigue: 7 } }, abilities: [{ level: 2, label: 'İsrafsız dokuma' }, { level: 5, label: 'İnce kumaş siparişleri' }] },
  milling: { id: 'milling', label: 'Değirmencilik', occupationIds: ['miller'], skillKey: 'craftsmanship', activities: { mill: { xp: 10, fatigue: 6 } }, abilities: [{ level: 2, label: 'Verimli öğütme' }, { level: 5, label: 'Ambar sözleşmeleri' }] },
  pottery: { id: 'pottery', label: 'Çömlekçilik', occupationIds: ['potter'], skillKey: 'craftsmanship', activities: { pottery: { xp: 10, fatigue: 7 } }, abilities: [{ level: 2, label: 'Sağlam kaplar' }, { level: 5, label: 'Usta siparişleri' }] },
};

export const PROFESSION_XP_PER_LEVEL = (level: number): number => Math.floor(80 + 45 * level ** 1.35);
