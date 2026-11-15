export enum HistoricalCertainty {
  CONFIRMED = 'confirmed',
  DISPUTED = 'disputed',
  FICTIONAL = 'fictional',
}

export enum EventCategory {
  POLITICAL = 'political',
  MILITARY = 'military',
  ECONOMIC = 'economic',
  SOCIAL = 'social',
  CULTURAL = 'cultural',
}

export interface HistoricalSource {
  type: 'primary' | 'secondary' | 'archaeological' | 'scholarly';
  citation: string;
  notes?: string;
}

export interface Ruler {
  id: string;
  name: string;
  title: string;
  reignStartYear: number;
  reignEndYear?: number;
  certainty: HistoricalCertainty;
  biographyNotes: string;
}

export interface HistoricalEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  certainty: HistoricalCertainty;
  isFictional: boolean;
  period: string;
  rulerId: string;
  earliestYear: number;
  latestYear?: number;
  earliestMonth?: number;
  latestMonth?: number;
  locations: string[];
  people: string[];
  factions: string[];
  prerequisites: string[];
  requiredContext: string[];
  triggerConditions: EventTriggerCondition[];
  choices: EventChoice[];
  historicalSources: HistoricalSource[];
  uncertaintyNotes?: string;
  relatedEvents: string[];
  /** Historical anchor shown separately from this invented playable encounter. */
  baselineEventId?: string;
  divergenceReason?: string;
}

export interface EventTriggerCondition {
  type: 'year_range' | 'ruler' | 'reputation' | 'rank' | 'has_completed_event' | 'has_completed_mission' | 'relationship' | 'currency' | 'military_strength' | 'faction_standing' | 'military_outcome' | 'flag' | 'family_generation' | 'custom';
  target?:string;
  operator?: 'gte' | 'lte' | 'eq' | 'neq';
  value: any;
  description: string;
}

export interface EventChoice {
  id: string;
  text: string;
  description: string;
  requirements?: EventTriggerCondition[];
  immediateConsequences: EventConsequence[];
  delayedConsequences: EventConsequence[];
  alternativeOutcomes: AlternativeOutcome[];
  divergesFromBaseline?: boolean;
  divergenceExplanation?: string;
}

export interface EventConsequence {
  type: 'reputation' | 'currency' | 'relationship' | 'rank_progress' | 'add_item' | 'trigger_event' | 'set_flag' | 'modify_military';
  target?: string;
  value: number | string | any;
  delayDays?: number;
  description: string;
}

export interface AlternativeOutcome {
  id: string;
  condition: string;
  outcome: string;
  consequences: EventConsequence[];
}

export const RULERS: Ruler[] = [
  {
    id: 'osman_gazi',
    name: 'Osman Gazi',
    title: 'Bey',
    reignStartYear: 1299,
    reignEndYear: 1326,
    certainty: HistoricalCertainty.DISPUTED,
    biographyNotes: 'Traditional founder of Ottoman dynasty. Dates and biographical details have scholarly debate.',
  },
  {
    id: 'orhan_gazi',
    name: 'Orhan Gazi',
    title: 'Bey',
    reignStartYear: 1326,
    reignEndYear: 1362,
    certainty: HistoricalCertainty.DISPUTED,
    biographyNotes: 'Son of Osman. Expansion period, Bursa conquest traditionally placed in this era.',
  },
  {
    id: 'murad_i',
    name: 'Murad I',
    title: 'Sultan',
    reignStartYear: 1362,
    reignEndYear: 1389,
    certainty: HistoricalCertainty.DISPUTED,
    biographyNotes: 'First to use Sultan title traditionally. Battle of Kosovo context debated.',
  },
  {
    id: 'bayezid_i',
    name: 'Bayezid I',
    title: 'Sultan',
    reignStartYear: 1389,
    reignEndYear: 1402,
    certainty: HistoricalCertainty.DISPUTED,
    biographyNotes: 'Yıldırım Bayezid. Battle of Ankara period.',
  },
  {
    id: 'mehmed_i',
    name: 'Mehmed I',
    title: 'Sultan',
    reignStartYear: 1413,
    reignEndYear: 1421,
    certainty: HistoricalCertainty.DISPUTED,
    biographyNotes: 'Interregnum resolution period.',
  },
  {
    id: 'murad_ii',
    name: 'Murad II',
    title: 'Sultan',
    reignStartYear: 1421,
    reignEndYear: 1444,
    certainty: HistoricalCertainty.DISPUTED,
    biographyNotes: 'Long reign with multiple phases.',
  },
  {
    id: 'mehmed_ii',
    name: 'Mehmed II',
    title: 'Sultan',
    reignStartYear: 1444,
    reignEndYear: 1446,
    certainty: HistoricalCertainty.DISPUTED,
    biographyNotes: 'First reign, then abdication and return. Conquest of Constantinople in 1453.',
  },
];

export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  {
    id: 'frontier_local_military_request',
    title: 'Frontier Levies Request (Fictional)',
    description: 'A local bey\'s representative approaches with a request for assistance in securing a vulnerable frontier hamlet from raiders. Resources are limited on both sides.',
    category: EventCategory.MILITARY,
    certainty: HistoricalCertainty.FICTIONAL,
    isFictional: true,
    period: 'Early Ottoman Frontier',
    rulerId: 'osman_gazi',
    earliestYear: 1299,
    latestYear: 1320,
    locations: ['Frontier Hamlets', 'Border Zone'],
    people: ['Local Bey Representative', 'Frontier Herders'],
    factions: ['Ottoman Frontier Group', 'Raiding Band'],
    prerequisites: [],
    requiredContext: ['Frontier settlement established'],
    triggerConditions: [
      {
        type: 'year_range',
        operator: 'gte',
        value: 1299,
        description: 'Must be in or after 1299',
      },
      {
        type: 'ruler',
        value: 'osman_gazi',
        description: 'During Osman Gazi period',
      },
    ],
    choices: [
      {
        id: 'accept_full',
        text: 'Accept full assignment',
        description: 'Take on full responsibility with your own resources',
        requirements:[{type:'currency',operator:'gte',value:20,description:'Requires 20 akçe.'}],
        immediateConsequences: [
          { type: 'reputation', value: 15, description: 'Gain reputation for loyalty' },
          { type: 'currency', value: -20, description: 'Spend resources on equipment/supplies' },
          { type: 'modify_military', target: 'enemies_defeated', value: 0, description: 'Prepare for combat' },
        ],
        delayedConsequences: [
          { type: 'reputation', value: 10, delayDays: 5, description: 'Long-term reputation gain' },
          { type: 'relationship', target: 'commander_kara', value: 5, delayDays: 5, description: 'Improve relationship' },
        ],
        alternativeOutcomes: [
          {
            id: 'clean_victory',
            condition: 'successful_combat',
            outcome: 'Clean victory with minimal losses',
            consequences: [
              { type: 'reputation', value: 5, description: 'Bonus for clean victory' },
            ],
          },
        ],
      },
      {
        id: 'negotiate',
        text: 'Negotiate contribution',
        description: 'Offer limited assistance in exchange for shared costs',
        requirements:[{type:'currency',operator:'gte',value:10,description:'Requires 10 akçe.'}],
        immediateConsequences: [
          { type: 'reputation', value: 8, description: 'Gain reputation for diplomacy' },
          { type: 'currency', value: -10, description: 'Reduced cost' },
          { type: 'relationship', target: 'commander_kara', value: 3, description: 'Diplomatic gain' },
        ],
        delayedConsequences: [
          { type: 'reputation', value: 5, delayDays: 5, description: 'Moderate long-term gain' },
        ],
        alternativeOutcomes: [],
      },
      {
        id: 'refuse',
        text: 'Refuse politely',
        description: 'Explain limited resources and decline',
        immediateConsequences: [
          { type: 'reputation', value: -5, description: 'Small reputation loss' },
          { type: 'relationship', target: 'commander_kara', value: -3, description: 'Disappointed commander' },
        ],
        delayedConsequences: [],
        alternativeOutcomes: [],
      },
    ],
    // This authored encounter is fictional; no historical citation is claimed.
    historicalSources: [],
    uncertaintyNotes: 'This is an original illustrative scenario, not a documented historical event.',
    relatedEvents: [],
  },
  {
    id:'frontier_grain_reserve_decision', title:'Kışlık tahıl ve kervan payı (Kurgusal)',
    description:'Kızılca çevresindeki haneler, bir sonraki hasada kadar tahılı nasıl kullanacakları konusunda karar ister.',
    category:EventCategory.ECONOMIC, certainty:HistoricalCertainty.FICTIONAL, isFictional:true,
    period:'Early Ottoman Frontier', rulerId:'osman_gazi', earliestYear:1299, latestYear:1320,
    locations:['Frontier Hamlets'], people:['Village households','Yusuf the merchant'], factions:['Village community','Market merchants'],
    prerequisites:['frontier_local_military_request'], requiredContext:['The opening frontier request has been resolved'],
    triggerConditions:[], baselineEventId:'ottoman-emergence-c1300',
    choices:[
      {id:'store_grain',text:'Store grain for the village',description:'Keep a reserve for households through winter.',immediateConsequences:[{type:'set_flag',target:'grain_reserve',value:'stored',description:'A shared winter grain reserve was established.'},{type:'relationship',target:'hasan_farmer',value:5,description:'The farming households trust the family.'}],delayedConsequences:[{type:'reputation',value:3,delayDays:30,description:'The reserve steadies the family’s standing after the harvest.'}],alternativeOutcomes:[]},
      {id:'sell_surplus',text:'Sell the surplus to merchants',description:'Take a modest payment and accept lower household reserves.',immediateConsequences:[{type:'currency',value:8,description:'The family earns 8 akçe from the grain sale.'},{type:'relationship',target:'yusuf_merchant',value:5,description:'The merchant values the reliable supply.'}],delayedConsequences:[{type:'set_flag',target:'merchant_credit',value:'available',delayDays:20,description:'The merchant offers limited credit after the household kept its promise.'}],alternativeOutcomes:[]},
      {id:'keep_seed',text:'Keep the grain as seed',description:'Protect next season’s planting stock instead of earning immediate coin.',immediateConsequences:[{type:'set_flag',target:'seed_stock',value:'protected',description:'The household protects seed stock for the next planting.'},{type:'reputation',value:2,description:'The choice is seen as prudent by local farmers.'}],delayedConsequences:[{type:'relationship',target:'hasan_farmer',value:3,delayDays:15,description:'The farmer appreciates the preserved seed.'}],alternativeOutcomes:[]},
    ], historicalSources:[], uncertaintyNotes:'Invented household decision. The historical anchor describes the uncertain rise of the Ottoman polity, not this village or market.', relatedEvents:['bapheus_supply_decision'],
  },
  {
    id:'bapheus_supply_decision', title:'Bapheus çevresinde erzak kararı (Kurgusal)',
    description:'1302 için kaynaklarda anılan Bapheus çatışmasının çevresinde, oyuncunun ailesine ait olduğu belgelenmemiş bir erzak birliği için karar verilir. Savaşın tarihsel kaydı ayrı tutulur.',
    category:EventCategory.MILITARY, certainty:HistoricalCertainty.FICTIONAL, isFictional:true,
    period:'Early Ottoman Frontier', rulerId:'osman_gazi', earliestYear:1302, latestYear:1326,
    locations:['Border Zone'], people:['Osman Gazi','Kara Alp'], factions:['Ottoman Frontier Group','Village community'],
    prerequisites:['frontier_grain_reserve_decision'], requiredContext:['The grain decision has been resolved'],
    triggerConditions:[{type:'year_range',operator:'gte',value:1302,description:'The simulation has reached the 1302 Bapheus context.'}],
    baselineEventId:'bapheus-1302', divergenceReason:'The campaign result changes only if the player diverts the fictional supply detachment; the documented baseline remains visible beside this branch.',
    choices:[
      {id:'historical_path',text:'Send the agreed supplies',description:'Keep the small fictional household detachment aligned with the documented Ottoman victory.',immediateConsequences:[{type:'reputation',value:4,description:'The household gains a modest military reputation.'},{type:'set_flag',target:'bapheus_local_support',value:'sent',description:'The family’s fictional detachment sent supplies.'}],delayedConsequences:[{type:'relationship',target:'commander_kara',value:4,delayDays:10,description:'The commander remembers the timely supply.'}],alternativeOutcomes:[]},
      {id:'divert_supply',text:'Divert the detachment to protect the village',description:'Keep the family’s fictional stores at home; the battle outcome changes in this branch.',requirements:[{type:'currency',operator:'gte',value:5,description:'Keep 5 akçe in household travel funds.'}],immediateConsequences:[{type:'currency',value:-5,description:'Spend 5 akçe moving the supplies back to the village.'},{type:'set_flag',target:'bapheus_branch',value:'detachment_diverted',description:'The fictional supply detachment did not join the campaign.'}],delayedConsequences:[{type:'relationship',target:'commander_kara',value:-5,delayDays:5,description:'The commander objects to the diversion.'}],alternativeOutcomes:[],divergesFromBaseline:true,divergenceExplanation:'The player diverted the fictional supply detachment, so this simulation no longer follows the baseline campaign outcome at Bapheus.'},
      {id:'escort_households',text:'Escort nearby households away from danger',description:'Prioritize civilians and preserve the family’s local ties.',immediateConsequences:[{type:'relationship',target:'hasan_farmer',value:7,description:'Households remember the escort.'},{type:'set_flag',target:'bapheus_civilians',value:'escorted',description:'Nearby fictional households were escorted to safety.'}],delayedConsequences:[{type:'reputation',value:3,delayDays:12,description:'The community later credits the family’s care.'}],alternativeOutcomes:[]},
    ], historicalSources:[], uncertaintyNotes:'This is an invented family encounter. Bapheus is a historical anchor dated to 1302 with disputed chronology and location; the player’s detachment is not documented.', relatedEvents:['grazing_compromise'],
  },
  {
    id:'grazing_compromise', title:'Mera ve tarla uzlaşması (Kurgusal)',
    description:'An invented dispute over grazing rights asks the family to balance village needs against obligations to the frontier leadership.',
    category:EventCategory.SOCIAL, certainty:HistoricalCertainty.FICTIONAL, isFictional:true,
    period:'Early Ottoman Frontier', rulerId:'osman_gazi', earliestYear:1310, latestYear:1326,
    locations:['Frontier Hamlets'], people:['Hasan the farmer','Kara Alp'], factions:['Village community','Ottoman Frontier Group'],
    prerequisites:['bapheus_supply_decision'], requiredContext:['The Bapheus-period supply decision has been resolved'], triggerConditions:[],
    baselineEventId:'ottoman-emergence-c1300',
    choices:[
      {id:'mediate_shared_use',text:'Negotiate shared seasonal use',description:'Set a rotation so crops and herds both have room.',immediateConsequences:[{type:'relationship',target:'hasan_farmer',value:6,description:'The village accepts the seasonal arrangement.'},{type:'relationship',target:'commander_kara',value:3,description:'The commander accepts a predictable grazing schedule.'},{type:'set_flag',target:'shared_pasture',value:'agreed',description:'Seasonal shared-use terms are recorded.'}],delayedConsequences:[{type:'reputation',value:4,delayDays:45,description:'The agreement earns trust after one season.'}],alternativeOutcomes:[]},
      {id:'favor_households',text:'Give the village first claim',description:'Protect the harvest and accept a colder relationship with the frontier group.',immediateConsequences:[{type:'relationship',target:'hasan_farmer',value:9,description:'The farming households gain confidence.'},{type:'relationship',target:'commander_kara',value:-4,description:'The frontier group sees the choice as partial.'}],delayedConsequences:[],alternativeOutcomes:[]},
      {id:'favor_frontier',text:'Honor the frontier grazing obligation',description:'Keep faith with the commander but risk village resentment.',requirements:[{type:'flag',target:'bapheus_local_support',value:'sent',description:'The household sent supplies to the frontier campaign.'},{type:'military_outcome',value:'victory',description:'A recorded military victory gives the frontier group stronger standing.'}],immediateConsequences:[{type:'relationship',target:'commander_kara',value:7,description:'The frontier group recognizes the commitment.'},{type:'relationship',target:'hasan_farmer',value:-5,description:'The village loses access during part of the growing season.'}],delayedConsequences:[],alternativeOutcomes:[]},
    ], historicalSources:[], uncertaintyNotes:'The dispute and participants are fictional and make no claim about a documented Ottoman land grant.', relatedEvents:['household_succession_commitment'],
  },
  {
    id:'household_succession_commitment', title:'Ailenin gelecek kuşağına bağlılık (Kurgusal)',
    description:'As leadership passes within the household, relatives ask how the family’s land, duties, and loyalties should be carried forward.',
    category:EventCategory.POLITICAL, certainty:HistoricalCertainty.FICTIONAL, isFictional:true,
    period:'Early Ottoman Frontier', rulerId:'orhan_gazi', earliestYear:1324, latestYear:1326,
    locations:['Frontier Hamlets'], people:['Orhan Gazi','Family heirs'], factions:['Ottoman House','Village community'],
    prerequisites:['grazing_compromise'], requiredContext:['A family heir is available'],
    triggerConditions:[{type:'family_generation',operator:'gte',value:2,description:'At least a second family generation is active.'}],
    baselineEventId:'osman-death-by-1324',
    choices:[
      {id:'heir_land_steward',text:'Train the heir to steward the land',description:'Keep the family’s livelihood grounded in its plots and village ties.',immediateConsequences:[{type:'set_flag',target:'heir_training',value:'land_steward',description:'The chosen heir begins learning land stewardship.'},{type:'relationship',target:'hasan_farmer',value:4,description:'The village supports the heir’s practical training.'}],delayedConsequences:[{type:'reputation',value:5,delayDays:3600,description:'After a decade, the next generation earns standing for maintaining the land.'}],alternativeOutcomes:[]},
      {id:'heir_frontier_service',text:'Prepare the heir for frontier service',description:'Keep military obligations while accepting less time for the family’s fields.',immediateConsequences:[{type:'set_flag',target:'heir_training',value:'frontier_service',description:'The heir is promised for future frontier service.'},{type:'modify_military',target:'leadership',value:3,description:'The family’s leadership experience increases slightly.'}],delayedConsequences:[{type:'relationship',target:'commander_kara',value:5,delayDays:360,description:'The commander remembers the heir’s service pledge.'}],alternativeOutcomes:[]},
      {id:'share_inheritance',text:'Share land rights among the family',description:'Reduce one heir’s control to keep several branches invested.',immediateConsequences:[{type:'set_flag',target:'inheritance_plan',value:'shared',description:'A shared family land plan is recorded.'},{type:'relationship',target:'hasan_farmer',value:2,description:'The village sees fewer sudden land claims.'}],delayedConsequences:[{type:'reputation',value:2,delayDays:180,description:'Relatives remember that the settlement was honored.'}],alternativeOutcomes:[]},
    ], historicalSources:[], uncertaintyNotes:'The succession and family are fictional. The historical anchor is only the uncertain upper bound for Osman’s death, not a sourced household succession.', relatedEvents:['bursa_market_transition'],
  },
  {
    id:'bursa_market_transition', title:'Bursa’ya yönelen ticaret (Kurgusal aile kararı)',
    description:'Bursa’s capture in 1326 is the historical anchor. This invented household decides whether to move its small trade network, stay in the village, or divide its effort.',
    category:EventCategory.ECONOMIC, certainty:HistoricalCertainty.FICTIONAL, isFictional:true,
    period:'Early Ottoman Frontier', rulerId:'orhan_gazi', earliestYear:1326, latestYear:1326,
    locations:['Brusa'], people:['Orhan Gazi','Family heirs'], factions:['Market merchants','Village community'],
    prerequisites:['household_succession_commitment'], requiredContext:['The succession commitment has been resolved'], triggerConditions:[],
    baselineEventId:'bursa-capture-1326',
    choices:[
      {id:'stay_village',text:'Keep the household business in the village',description:'Preserve familiar buyers and farm connections.',immediateConsequences:[{type:'relationship',target:'hasan_farmer',value:3,description:'The village retains a reliable local trader.'},{type:'set_flag',target:'family_trade_base',value:'village',description:'The family keeps its trading base in the village.'}],delayedConsequences:[{type:'currency',value:5,delayDays:30,description:'A steady local market brings a modest later return.'}],alternativeOutcomes:[]},
      {id:'invest_bursa_route',text:'Invest in a Bursa trade route',description:'Pay for a small caravan share and pursue new customers.',requirements:[{type:'currency',operator:'gte',value:12,description:'Requires 12 akçe for the route share.'}],immediateConsequences:[{type:'currency',value:-12,description:'Pay 12 akçe toward the fictional caravan share.'},{type:'set_flag',target:'family_trade_base',value:'bursa_route',description:'The family invests in a route toward Bursa.'}],delayedConsequences:[{type:'reputation',value:5,delayDays:60,description:'The new route brings the family wider recognition.'}],alternativeOutcomes:[]},
      {id:'divide_household',text:'Keep the farm and send one relative to trade',description:'Split the family’s effort between land and the new market.',immediateConsequences:[{type:'relationship',target:'hasan_farmer',value:2,description:'The family maintains its village obligations.'},{type:'set_flag',target:'family_trade_base',value:'shared',description:'Family work is divided between village and route.'}],delayedConsequences:[{type:'currency',value:3,delayDays:45,description:'The two-part livelihood returns a modest amount.'}],alternativeOutcomes:[]},
    ], historicalSources:[], uncertaintyNotes:'The family, route decision, and local market are invented. Bursa’s capture is documented for 1326, but this choice does not change that baseline event.', relatedEvents:[],
  },
];
