export enum MilitaryRank {
  RECRUIT = 'recruit',
  AZAB = 'azab',
  YAYA = 'yaya',
  AKINCI = 'akinci',
  SEPAHI = 'sepahi',
}

export const RANK_ORDER: MilitaryRank[] = [
  MilitaryRank.RECRUIT,
  MilitaryRank.AZAB,
  MilitaryRank.YAYA,
  MilitaryRank.AKINCI,
  MilitaryRank.SEPAHI,
];

export const RANK_NAMES: Record<MilitaryRank, string> = {
  [MilitaryRank.RECRUIT]: 'Acemi (Recruit)',
  [MilitaryRank.AZAB]: 'Azab',
  [MilitaryRank.YAYA]: 'Yaya',
  [MilitaryRank.AKINCI]: 'Akıncı',
  [MilitaryRank.SEPAHI]: 'Sipahi',
};

export interface RankRequirements {
  rank: MilitaryRank;
  minReputation: number;
  minServiceDays: number;
  minEnemiesDefeated: number;
  minSuccessfulMissions: number;
  minLeadership?: number;
  minTacticalDecisions?: number;
  minExperience?: number;
  requiredRelationships?: string[];
}

export const RANK_REQUIREMENTS: RankRequirements[] = [
  { rank: MilitaryRank.RECRUIT, minReputation: 0, minServiceDays: 0, minEnemiesDefeated: 0, minSuccessfulMissions: 0, minLeadership: 0, minTacticalDecisions: 0, minExperience: 0 },
  { rank: MilitaryRank.AZAB, minReputation: 10, minServiceDays: 5, minEnemiesDefeated: 2, minSuccessfulMissions: 1, minLeadership: 20, minTacticalDecisions: 0, minExperience: 70 },
  { rank: MilitaryRank.YAYA, minReputation: 25, minServiceDays: 12, minEnemiesDefeated: 5, minSuccessfulMissions: 3, minLeadership: 30, minTacticalDecisions: 2, minExperience: 180 },
  { rank: MilitaryRank.AKINCI, minReputation: 45, minServiceDays: 20, minEnemiesDefeated: 10, minSuccessfulMissions: 5, minLeadership: 40, minTacticalDecisions: 5, minExperience: 340 },
  { rank: MilitaryRank.SEPAHI, minReputation: 70, minServiceDays: 35, minEnemiesDefeated: 18, minSuccessfulMissions: 8, minLeadership: 55, minTacticalDecisions: 8, minExperience: 560 },
];

export interface Commander {
  id: string;
  name: string;
  title: string;
  description: string;
}

export const COMMANDERS: Commander[] = [
  {
    id: 'commander_kara',
    name: 'Kara Bey',
    title: 'Frontier Bey',
    description: 'Pragmatic frontier commander, values loyalty and results',
  },
  {
    id: 'commander_timur',
    name: 'Timur Alp',
    title: 'Akıncı Subaşı',
    description: 'Experienced raider, respects bold but careful action',
  },
];

export interface MissionReward {
  currency: number;
  reputation: number;
  items?: Array<{ itemId: string; quantity: number }>;
  equipment?: { weapon?: string; armor?: string };
}

export interface MissionObjective {
  id: string;
  description: string;
  type: 'defeat_enemies' | 'survive' | 'reach_location' | 'protect' | 'escort';
  targetCount?: number;
  currentCount?: number;
  completed: boolean;
}

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  historicalContext: string; // Mark as fictional/inspired, not documented
  isFictional: boolean;
  location: string;
  participants: string[];
  commanderId: string;
  requiredRank?: MilitaryRank;
  minReputation?: number;
  objectives: MissionObjective[];
  possibleOutcomes: string[];
  rewards: MissionReward;
  failureRewards?: MissionReward;
}

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'mission_frontier_skirmish',
    title: 'Frontier Skirmish (Fictional Encounter)',
    description: 'A small band of mounted raiders has been harassing frontier herders. Drive them off and secure the area.',
    historicalContext: 'This is an original fictional encounter inspired by early 14th-century Anatolian frontier conditions, not a documented historical battle.',
    isFictional: true,
    location: 'Frontier Outskirts',
    participants: ['Player', 'Frontier Levies'],
    commanderId: 'commander_kara',
    requiredRank: MilitaryRank.RECRUIT,
    minReputation: 0,
    objectives: [
      {
        id: 'defeat_raiders',
        description: 'Defeat raiders in the skirmish',
        type: 'defeat_enemies',
        targetCount: 2,
        currentCount: 0,
        completed: false,
      },
      {
        id: 'survive',
        description: 'Survive the encounter',
        type: 'survive',
        completed: false,
      },
    ],
    possibleOutcomes: ['Clean victory with minimal losses', 'Hard fought victory with casualties', 'Pyrrhic victory'],
    rewards: {
      currency: 40,
      reputation: 15,
      items: [{ itemId: 'wheat', quantity: 2 }],
    },
  },
];
