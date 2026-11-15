import type {
  GridPoint, NpcSchedule, NpcScheduleBlock, VillageNpcDefinition, VillagePersonality,
} from './types';

const block = (
  startHour: number, endHour: number, activity: NpcScheduleBlock['activity'], destination: string,
): NpcScheduleBlock => ({ startHour, endHour, activity, destination });

const routine = (...blocks: NpcScheduleBlock[]): NpcScheduleBlock[] => blocks;

const schedule = (
  base: NpcScheduleBlock[],
  variants: Partial<Pick<NpcSchedule, 'marketDay' | 'badWeather' | 'emergency'>> = {},
): NpcSchedule => ({
  base,
  ...(variants.marketDay ? { marketDay: variants.marketDay } : {}),
  ...(variants.badWeather ? { badWeather: variants.badWeather } : {}),
  ...(variants.emergency ? { emergency: variants.emergency } : {}),
});

const personality = (
  values: Omit<VillagePersonality, 'sociability'>, sociability: number,
): VillagePersonality => ({ ...values, sociability });

const guardEmergency = routine(
  block(0, 6, 'patrolling', 'gate'),
  block(6, 22, 'mustering', 'alarm_post'),
  block(22, 24, 'patrolling', 'gate'),
);
const civicEmergency = routine(
  block(6, 22, 'working', 'lodge'),
);
const civilianEmergency = routine(
  block(6, 21, 'fleeing', 'home'),
);

/**
 * A frontier village of nineteen residents. Homes and workplaces are ordinary
 * walkable tiles adjacent to the existing painted buildings, so pathfinding,
 * collision and rendering all use the shipped world rather than a parallel map.
 */
export const VILLAGE_NPCS: readonly VillageNpcDefinition[] = [
  {
    id: 'hasan_farmer', name: 'Hasan', occupation: 'farmer', gender: 'male', appearance: 'Çiftçi',
    home: { x: 6, y: 13 }, workplace: { x: 10, y: 13 },
    motivation: 'Ailesinin kışlık tahılını yetiştirmek',
    personality: personality({ ambition: 38, courage: 48, patience: 82, generosity: 70, caution: 62, loyalty: 75, negotiation: 45 }, 58),
    attributes: { strength: 72, agility: 48, wit: 51, endurance: 78, craft: 64, faith: 61 },
    relationships: { emine_weaver: 18, yusuf_merchant: 5, rukiye_farmer: 22, fatma_villager: 14 },
    schedule: schedule(
      routine(
        block(5, 6, 'eating', 'home'),
        block(6, 12, 'working', 'fields'),
        block(12, 13, 'eating', 'home'),
        block(13, 18, 'working', 'fields'),
        block(18, 20, 'socializing', 'well'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 14, 'market', 'market')),
        badWeather: routine(
          block(6, 12, 'working', 'home'),
          block(12, 13, 'eating', 'home'),
          block(13, 17, 'working', 'home'),
          block(17, 19, 'socializing', 'lodge'),
        ),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'rukiye_farmer', name: 'Rukiye', occupation: 'farmer', gender: 'female', appearance: 'Çiftçi',
    home: { x: 6, y: 24 }, workplace: { x: 11, y: 12 },
    motivation: 'Kocası sınırda nöbetteyken tarlayı yalnız sürmek',
    personality: personality({ ambition: 64, courage: 66, patience: 71, generosity: 55, caution: 58, loyalty: 80, negotiation: 49 }, 52),
    attributes: { strength: 69, agility: 55, wit: 53, endurance: 81, craft: 58, faith: 66 },
    relationships: { hasan_farmer: 22, emine_weaver: 9, fatma_villager: 11, kara_guard: 6 },
    schedule: schedule(
      routine(
        block(5, 6, 'eating', 'home'),
        block(6, 11, 'working', 'fields'),
        block(11, 13, 'market', 'market'),
        block(13, 18, 'working', 'fields'),
        block(18, 19, 'fetching_water', 'well'),
        block(19, 20, 'socializing', 'well'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 14, 'market', 'market')),
        badWeather: routine(
          block(6, 12, 'working', 'home'),
          block(12, 13, 'eating', 'home'),
          block(13, 17, 'working', 'home'),
          block(17, 19, 'socializing', 'lodge'),
        ),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'yusuf_merchant', name: 'Yusuf', occupation: 'merchant', gender: 'male', appearance: 'Kervancı',
    home: { x: 13, y: 8 }, workplace: { x: 18, y: 16 },
    motivation: 'Kervan mallarını satıp güvenli yol bulmak',
    personality: personality({ ambition: 72, courage: 42, patience: 55, generosity: 38, caution: 78, loyalty: 51, negotiation: 86 }, 74),
    attributes: { strength: 51, agility: 57, wit: 79, endurance: 53, craft: 41, faith: 44 },
    relationships: { hasan_farmer: 5, fatma_villager: 12, ayse_baker: 16, kara_guard: 9, meryem_scribe: 7 },
    schedule: schedule(
      routine(
        block(6, 7, 'eating', 'home'),
        block(7, 8, 'working', 'market'),
        block(8, 13, 'market', 'market'),
        block(13, 14, 'eating', 'home'),
        block(14, 18, 'market', 'market'),
        block(18, 20, 'socializing', 'well'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 6, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(7, 18, 'market', 'market')),
        badWeather: routine(
          block(10, 15, 'market', 'market'),
          block(15, 17, 'working', 'home'),
          block(17, 19, 'socializing', 'lodge'),
        ),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'ayse_baker', name: 'Ayşe', occupation: 'baker', gender: 'female', appearance: 'Kervancı',
    home: { x: 18, y: 13 }, workplace: { x: 19, y: 15 },
    motivation: 'Fırını erken yakıp köyün ekmeğini yetiştirmek',
    personality: personality({ ambition: 63, courage: 52, patience: 68, generosity: 71, caution: 64, loyalty: 73, negotiation: 61 }, 66),
    attributes: { strength: 58, agility: 52, wit: 57, endurance: 74, craft: 77, faith: 60 },
    relationships: { yusuf_merchant: 16, emine_weaver: 13, fatma_villager: 10, nur_water_carrier: 8 },
    schedule: schedule(
      routine(
        block(3, 7, 'working', 'work'),
        block(7, 8, 'eating', 'home'),
        block(8, 12, 'market', 'market'),
        block(12, 13, 'eating', 'home'),
        block(13, 17, 'working', 'work'),
        block(17, 19, 'socializing', 'lodge'),
        block(19, 20, 'eating', 'home'),
        block(20, 24, 'sleeping', 'home'),
        block(0, 3, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(7, 15, 'market', 'market')),
        badWeather: routine(
          block(7, 12, 'working', 'work'),
          block(12, 13, 'eating', 'home'),
          block(13, 16, 'working', 'work'),
          block(17, 19, 'socializing', 'lodge'),
        ),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'demir_blacksmith', name: 'Demir', occupation: 'blacksmith', gender: 'male', appearance: 'Akıncı',
    home: { x: 5, y: 25 }, workplace: { x: 5, y: 17 },
    motivation: 'Saban demirlerini ve kapı menteselerini dövüp geçim sağlamak',
    personality: personality({ ambition: 55, courage: 74, patience: 59, generosity: 62, caution: 50, loyalty: 69, negotiation: 43 }, 46),
    attributes: { strength: 88, agility: 50, wit: 48, endurance: 82, craft: 85, faith: 55 },
    relationships: { omer_carpenter: 17, kara_guard: 14, huseyin_potter: 8, hasan_farmer: 11 },
    schedule: schedule(
      routine(
        block(5, 6, 'eating', 'home'),
        block(6, 12, 'working', 'work'),
        block(12, 13, 'eating', 'home'),
        block(13, 18, 'working', 'work'),
        block(18, 20, 'socializing', 'lodge'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(10, 13, 'market', 'market')),
        badWeather: routine(block(7, 17, 'working', 'work')),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'omer_carpenter', name: 'Ömer', occupation: 'carpenter', gender: 'male', appearance: 'Çiftçi',
    home: { x: 13, y: 26 }, workplace: { x: 5, y: 17 },
    motivation: 'Köyün çatılarını ve araba oklarını onarmak',
    personality: personality({ ambition: 47, courage: 57, patience: 76, generosity: 64, caution: 67, loyalty: 71, negotiation: 52 }, 49),
    attributes: { strength: 74, agility: 60, wit: 62, endurance: 72, craft: 80, faith: 52 },
    relationships: { demir_blacksmith: 17, selim_miller: 9, hasan_farmer: 7, cemal_groom: 6 },
    schedule: schedule(
      routine(
        block(5, 6, 'eating', 'home'),
        block(6, 12, 'working', 'work'),
        block(12, 13, 'eating', 'home'),
        block(13, 18, 'working', 'work'),
        block(18, 20, 'socializing', 'lodge'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(10, 13, 'market', 'market')),
        badWeather: routine(block(7, 17, 'working', 'work')),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'huseyin_potter', name: 'Hüseyin', occupation: 'potter', gender: 'male', appearance: 'Çiftçi',
    home: { x: 20, y: 24 }, workplace: { x: 4, y: 18 },
    motivation: 'Kuyu ve mutfak kaplarını çamura şekil vererek hazırlamak',
    personality: personality({ ambition: 44, courage: 45, patience: 84, generosity: 59, caution: 63, loyalty: 66, negotiation: 47 }, 43),
    attributes: { strength: 63, agility: 55, wit: 54, endurance: 69, craft: 86, faith: 58 },
    relationships: { demir_blacksmith: 8, nur_water_carrier: 12, fatma_villager: 7 },
    schedule: schedule(
      routine(
        block(6, 7, 'eating', 'home'),
        block(7, 12, 'working', 'work'),
        block(12, 13, 'eating', 'home'),
        block(13, 17, 'working', 'work'),
        block(17, 19, 'socializing', 'well'),
        block(19, 20, 'eating', 'home'),
        block(20, 24, 'sleeping', 'home'),
        block(0, 6, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(10, 13, 'market', 'market')),
        badWeather: routine(block(7, 17, 'working', 'work')),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'emine_weaver', name: 'Emine', occupation: 'weaver', gender: 'female', appearance: 'Çiftçi',
    home: { x: 7, y: 13 }, workplace: { x: 7, y: 13 },
    motivation: 'Yün ve keteni dokuyup ailesine gelir sağlamak',
    personality: personality({ ambition: 55, courage: 56, patience: 78, generosity: 76, caution: 65, loyalty: 68, negotiation: 66 }, 69),
    attributes: { strength: 52, agility: 67, wit: 66, endurance: 64, craft: 88, faith: 63 },
    relationships: { hasan_farmer: 18, fatma_villager: 15, ayse_baker: 13, rukiye_farmer: 9 },
    schedule: schedule(
      routine(
        block(5, 7, 'fetching_water', 'well'),
        block(7, 12, 'working', 'work'),
        block(12, 13, 'eating', 'home'),
        block(13, 18, 'working', 'work'),
        block(18, 20, 'socializing', 'well'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 13, 'market', 'market')),
        badWeather: routine(block(8, 17, 'working', 'work'), block(17, 19, 'socializing', 'lodge')),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'selim_miller', name: 'Selim', occupation: 'miller', gender: 'male', appearance: 'Çiftçi',
    home: { x: 14, y: 25 }, workplace: { x: 22, y: 22 },
    motivation: 'Değirmen taşını döndürüp köyün ununu hazırlamak',
    personality: personality({ ambition: 49, courage: 51, patience: 73, generosity: 48, caution: 70, loyalty: 62, negotiation: 55 }, 45),
    attributes: { strength: 76, agility: 47, wit: 56, endurance: 77, craft: 70, faith: 57 },
    relationships: { ayse_baker: 19, hasan_farmer: 13, yusuf_merchant: 6, omer_carpenter: 9 },
    schedule: schedule(
      routine(
        block(5, 6, 'eating', 'home'),
        block(6, 12, 'working', 'work'),
        block(12, 13, 'eating', 'home'),
        block(13, 18, 'working', 'work'),
        block(18, 20, 'socializing', 'lodge'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 13, 'market', 'market')),
        badWeather: routine(block(7, 17, 'working', 'work')),
        emergency: civicEmergency,
      },
    ),
  },
  {
    id: 'abdullah_imam', name: 'Abdullah', occupation: 'imam', gender: 'male', appearance: 'Kervancı',
    home: { x: 10, y: 21 }, workplace: { x: 10, y: 22 },
    motivation: 'Cemaati bir arada tutup yolculara barınak sağlamak',
    personality: personality({ ambition: 32, courage: 58, patience: 89, generosity: 85, caution: 74, loyalty: 81, negotiation: 68 }, 72),
    attributes: { strength: 48, agility: 45, wit: 70, endurance: 61, craft: 39, faith: 94 },
    relationships: { ilyas_official: 18, meryem_scribe: 14, fatma_villager: 16, nur_water_carrier: 11 },
    schedule: schedule(
      routine(
        block(5, 6, 'eating', 'home'),
        block(6, 12, 'working', 'lodge'),
        block(12, 13, 'eating', 'home'),
        block(13, 17, 'working', 'lodge'),
        block(17, 21, 'socializing', 'lodge'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(10, 13, 'socializing', 'market')),
        badWeather: routine(block(8, 17, 'working', 'lodge'), block(17, 20, 'socializing', 'lodge')),
        emergency: civicEmergency,
      },
    ),
  },
  {
    id: 'meryem_scribe', name: 'Meryem', occupation: 'scribe', gender: 'female', appearance: 'Kervancı',
    home: { x: 11, y: 9 }, workplace: { x: 10, y: 20 },
    motivation: 'Vergi ve arazi kayıtlarını eksiksiz tutmak',
    personality: personality({ ambition: 68, courage: 47, patience: 81, generosity: 43, caution: 79, loyalty: 72, negotiation: 64 }, 50),
    attributes: { strength: 41, agility: 52, wit: 88, endurance: 57, craft: 62, faith: 73 },
    relationships: { ilyas_official: 21, abdullah_imam: 14, yusuf_merchant: 7, kara_guard: 5 },
    schedule: schedule(
      routine(
        block(6, 7, 'eating', 'home'),
        block(7, 12, 'working', 'lodge'),
        block(12, 13, 'eating', 'home'),
        block(13, 17, 'working', 'lodge'),
        block(17, 19, 'socializing', 'well'),
        block(19, 20, 'eating', 'home'),
        block(20, 24, 'sleeping', 'home'),
        block(0, 6, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 13, 'market', 'market')),
        badWeather: routine(block(8, 16, 'working', 'lodge'), block(17, 19, 'socializing', 'lodge')),
        emergency: civicEmergency,
      },
    ),
  },
  {
    id: 'ilyas_official', name: 'İlyas', occupation: 'official', gender: 'male', appearance: 'Kervancı',
    home: { x: 19, y: 12 }, workplace: { x: 8, y: 22 },
    motivation: 'Köyün anlaşmazlıklarını yatıştırmak',
    personality: personality({ ambition: 66, courage: 49, patience: 73, generosity: 42, caution: 84, loyalty: 78, negotiation: 79 }, 57),
    attributes: { strength: 46, agility: 48, wit: 81, endurance: 55, craft: 43, faith: 66 },
    relationships: { kara_guard: 20, hasan_farmer: 8, meryem_scribe: 21, abdullah_imam: 18 },
    schedule: schedule(
      routine(
        block(6, 8, 'eating', 'home'),
        block(8, 12, 'working', 'lodge'),
        block(12, 13, 'eating', 'home'),
        block(13, 17, 'working', 'lodge'),
        block(17, 20, 'socializing', 'market'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 6, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 12, 'working', 'market'), block(12, 13, 'eating', 'home'), block(13, 16, 'socializing', 'market')),
        badWeather: routine(block(8, 16, 'working', 'lodge'), block(17, 19, 'socializing', 'lodge')),
        emergency: civicEmergency,
      },
    ),
  },
  {
    id: 'zeynep_healer', name: 'Zeynep', occupation: 'healer', gender: 'female', appearance: 'Çiftçi',
    home: { x: 12, y: 26 }, workplace: { x: 12, y: 26 },
    motivation: 'Yaraları sarıp hastalara şifalı otlar hazırlamak',
    personality: personality({ ambition: 41, courage: 63, patience: 86, generosity: 90, caution: 69, loyalty: 74, negotiation: 63 }, 75),
    attributes: { strength: 44, agility: 58, wit: 73, endurance: 62, craft: 71, faith: 77 },
    relationships: { fatma_villager: 19, abdullah_imam: 15, emine_weaver: 12, kara_guard: 10 },
    schedule: schedule(
      routine(
        block(6, 8, 'fetching_water', 'well'),
        block(8, 12, 'working', 'work'),
        block(12, 13, 'eating', 'home'),
        block(13, 17, 'working', 'work'),
        block(17, 19, 'socializing', 'well'),
        block(19, 20, 'eating', 'home'),
        block(20, 24, 'sleeping', 'home'),
        block(0, 6, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 13, 'market', 'market')),
        badWeather: routine(block(8, 17, 'working', 'work'), block(17, 19, 'socializing', 'lodge')),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'arslan_herder', name: 'Arslan', occupation: 'herder', gender: 'male', appearance: 'Akıncı',
    home: { x: 6, y: 23 }, workplace: { x: 7, y: 19 },
    motivation: 'Sürüsünü otlatıp hayvanları yırtıcılardan korumak',
    personality: personality({ ambition: 46, courage: 75, patience: 63, generosity: 61, caution: 52, loyalty: 64, negotiation: 47 }, 40),
    attributes: { strength: 79, agility: 63, wit: 49, endurance: 85, craft: 51, faith: 54 },
    relationships: { kara_guard: 4, hasan_farmer: 10, cemal_groom: 22, rukiye_farmer: 5 },
    schedule: schedule(
      routine(
        block(5, 11, 'working', 'work'),
        block(11, 13, 'eating', 'home'),
        block(13, 18, 'working', 'work'),
        block(18, 20, 'socializing', 'well'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 13, 'market', 'market')),
        badWeather: routine(block(8, 16, 'working', 'home'), block(17, 19, 'socializing', 'lodge')),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'cemal_groom', name: 'Cemal', occupation: 'groom', gender: 'male', appearance: 'Akıncı',
    home: { x: 21, y: 23 }, workplace: { x: 26, y: 10 },
    motivation: 'Atları tımarlayıp kervan hayvanlarını hazır tutmak',
    personality: personality({ ambition: 35, courage: 61, patience: 72, generosity: 67, caution: 56, loyalty: 77, negotiation: 41 }, 54),
    attributes: { strength: 71, agility: 69, wit: 45, endurance: 80, craft: 55, faith: 49 },
    relationships: { arslan_herder: 22, yusuf_merchant: 13, omer_carpenter: 6 },
    schedule: schedule(
      routine(
        block(6, 12, 'working', 'work'),
        block(12, 13, 'eating', 'home'),
        block(13, 18, 'working', 'work'),
        block(18, 20, 'socializing', 'lodge'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 6, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 13, 'market', 'market')),
        badWeather: routine(block(8, 16, 'working', 'home'), block(17, 19, 'socializing', 'lodge')),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'nur_water_carrier', name: 'Nur', occupation: 'water_carrier', gender: 'female', appearance: 'Çiftçi',
    home: { x: 9, y: 22 }, workplace: { x: 13, y: 18 },
    motivation: 'Evlere ve tezgâhlara kuyudan su taşımak',
    personality: personality({ ambition: 39, courage: 54, patience: 79, generosity: 82, caution: 60, loyalty: 70, negotiation: 56 }, 78),
    attributes: { strength: 66, agility: 61, wit: 50, endurance: 83, craft: 45, faith: 59 },
    relationships: { fatma_villager: 17, huseyin_potter: 12, ayse_baker: 8, abdullah_imam: 11 },
    schedule: schedule(
      routine(
        block(5, 7, 'fetching_water', 'well'),
        block(7, 12, 'working', 'well'),
        block(12, 13, 'eating', 'home'),
        block(13, 17, 'working', 'well'),
        block(17, 19, 'socializing', 'well'),
        block(19, 20, 'eating', 'home'),
        block(20, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(8, 12, 'working', 'well'), block(12, 14, 'market', 'market')),
        badWeather: routine(block(8, 10, 'fetching_water', 'well'), block(10, 17, 'working', 'home'), block(17, 19, 'socializing', 'lodge')),
        emergency: civilianEmergency,
      },
    ),
  },
  {
    id: 'kara_guard', name: 'Kara', occupation: 'guard', gender: 'male', appearance: 'Akıncı',
    home: { x: 18, y: 14 }, workplace: { x: 28, y: 14 },
    motivation: 'Yerleşimin yolunu ve halkını gözetmek',
    personality: personality({ ambition: 50, courage: 88, patience: 43, generosity: 48, caution: 56, loyalty: 82, negotiation: 40 }, 47),
    attributes: { strength: 84, agility: 72, wit: 55, endurance: 88, craft: 46, faith: 62 },
    relationships: { ilyas_official: 20, arslan_herder: 4, balaban_guard: 24, demir_blacksmith: 14 },
    schedule: schedule(
      routine(
        block(5, 6, 'eating', 'home'),
        block(6, 12, 'patrolling', 'patrol_north'),
        block(12, 13, 'eating', 'home'),
        block(13, 20, 'patrolling', 'patrol_south'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 5, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(9, 15, 'patrolling', 'patrol_market')),
        badWeather: routine(block(7, 12, 'patrolling', 'patrol_north'), block(12, 13, 'eating', 'home'), block(13, 17, 'patrolling', 'patrol_south')),
        emergency: guardEmergency,
      },
    ),
  },
  {
    id: 'balaban_guard', name: 'Balaban', occupation: 'guard', gender: 'male', appearance: 'Akıncı',
    home: { x: 17, y: 13 }, workplace: { x: 24, y: 18 },
    motivation: 'Gece nöbetinde sınır yolunu açık tutmak',
    personality: personality({ ambition: 44, courage: 82, patience: 61, generosity: 52, caution: 65, loyalty: 79, negotiation: 38 }, 44),
    attributes: { strength: 80, agility: 68, wit: 52, endurance: 86, craft: 50, faith: 58 },
    relationships: { kara_guard: 24, ilyas_official: 12, cemal_groom: 7, hasan_farmer: 6 },
    schedule: schedule(
      routine(
        block(5, 6, 'eating', 'home'),
        block(6, 12, 'patrolling', 'patrol_south'),
        block(12, 13, 'eating', 'home'),
        block(13, 20, 'patrolling', 'gate'),
        block(20, 22, 'socializing', 'well'),
        block(22, 24, 'patrolling', 'gate'),
        block(0, 5, 'patrolling', 'gate'),
      ),
      {
        marketDay: routine(block(9, 15, 'patrolling', 'patrol_market')),
        badWeather: routine(block(7, 12, 'patrolling', 'patrol_south'), block(12, 13, 'eating', 'home'), block(13, 17, 'patrolling', 'gate')),
        emergency: guardEmergency,
      },
    ),
  },
  {
    id: 'fatma_villager', name: 'Fatma', occupation: 'villager', gender: 'female', appearance: 'Çiftçi',
    home: { x: 5, y: 13 }, workplace: null,
    motivation: 'Su ve erzak bulup komşularına göz kulak olmak',
    personality: personality({ ambition: 34, courage: 60, patience: 67, generosity: 88, caution: 72, loyalty: 82, negotiation: 58 }, 84),
    attributes: { strength: 55, agility: 57, wit: 60, endurance: 68, craft: 59, faith: 71 },
    relationships: { yusuf_merchant: 12, emine_weaver: 15, zeynep_healer: 19, nur_water_carrier: 17 },
    schedule: schedule(
      routine(
        block(6, 8, 'fetching_water', 'well'),
        block(8, 11, 'market', 'market'),
        block(11, 13, 'eating', 'home'),
        block(13, 16, 'socializing', 'well'),
        block(16, 18, 'fetching_water', 'well'),
        block(18, 20, 'socializing', 'lodge'),
        block(20, 21, 'eating', 'home'),
        block(21, 24, 'sleeping', 'home'),
        block(0, 6, 'sleeping', 'home'),
      ),
      {
        marketDay: routine(block(8, 12, 'market', 'market')),
        badWeather: routine(block(8, 11, 'working', 'home'), block(13, 16, 'socializing', 'lodge'), block(16, 18, 'working', 'home')),
        emergency: civilianEmergency,
      },
    ),
  },
];

export const VILLAGE_HOME_COUNT = new Set(VILLAGE_NPCS.map(npc => `${npc.home.x},${npc.home.y}`)).size;

export function findVillageDefinition(id: string): VillageNpcDefinition | undefined {
  return VILLAGE_NPCS.find(npc => npc.id === id);
}

export function isWalkableHome(point: GridPoint): boolean {
  return Number.isInteger(point.x) && Number.isInteger(point.y);
}
