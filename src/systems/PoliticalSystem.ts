import type { HistoricalEventSystem } from './HistoricalEventSystem';
import { POLITICAL_DISPUTES, POLITICAL_FACTIONS, POLITICAL_NPCS, POLITICAL_TITLES } from '@data/PoliticalData';

export type PoliticalAction = 'accept_levy' | 'refuse_levy' | 'negotiate_land' | 'support_leader' | 'join_faction' | 'resist_order' | 'recruit' | 'rebel' | 'negotiate_surrender' | 'mediate_dispute' | 'compromise_dispute' | 'withdraw_dispute' | 'request_faction_support' | 'offer_favor' | 'form_alliance' | 'sign_trade_contract' | 'fulfill_trade_contract' | 'cancel_trade_contract' | 'petition_tax' | 'raise_succession_claim' | 'contest_trade_terms';
export type RebellionOutcome = 'victory' | 'defeat' | 'surrender' | 'exile';
export type DisputeKind = keyof typeof POLITICAL_DISPUTES;
export interface PoliticalDispute { id:string;kind:DisputeKind;title:string;parties:string[];status:'active'|'settled'|'withdrawn'|'contested';startedYear:number;lastOutcome?:string }
export interface PoliticalMemory { day:number;actorId:string;kind:'promise'|'aid'|'betrayal'|'conflict'|'agreement';description:string;trustChange:number }
export interface PoliticalContract { id:string;factionId:string;itemId:'wheat';amount:number;deposit:number;dueDay:number;status:'active'|'fulfilled'|'defaulted'|'cancelled' }

export interface PoliticalState {
  authorityId: string;
  loyalty: number;
  reputation: number;
  localInfluence: number;
  wealth: number;
  militaryStrength: number;
  popularSupport: number;
  fear: number;
  legitimacy: number;
  commanderTrust: Record<string, number>;
  officialTrust: Record<string, number>;
  factionStanding: Record<string, number>;
  factionInfluence: Record<string, number>;
  factionLeaders: Record<string,string>;
  joinedFaction: string | null;
  landRights: number;
  rebellion: { preparation: number; recruits: number; active: boolean; lastOutcome: RebellionOutcome | null };
  propertyConfiscated: boolean;
  politicalLegacy: number;
  choices: string[];
  fictionalDisputes: string[];
  individualTrust: Record<string,number>;
  individualReputation: Record<string,number>;
  factionResources: Record<string,number>;
  alliances: string[];
  rivalries: string[];
  disputes: PoliticalDispute[];
  memories: PoliticalMemory[];
  tradeContract: PoliticalContract | null;
  eraYear: number;
}

export interface PoliticalContext { year: number; ruler: string; location: string; rank: string; currency: number; militaryStrength: number; familyGeneration: number; totalDays?:number; items?:Record<string,number> }
export interface PoliticalDecision { id: PoliticalAction; label: string; available: boolean; reason?: string; risk?:string; effect?:string }
export interface PoliticalResult { success: boolean; message: string; outcome?: RebellionOutcome; disputeStatus?:PoliticalDispute['status']; currencyReward?:number; relationshipChanges?:Record<string,number>; memoryKind?:PoliticalMemory['kind']; memorySummary?:string }

export const POLITICAL_CONFIG = {
  rebellionMinimumInfluence: 25, rebellionMinimumSupport: 30, rebellionMinimumRecruitment: 3,
  rebellionCurrencyCost: 40, rebellionMilitaryRequirement: 20, recruitmentCost: 10,
  initialCommander: 'commander_kara', initialFaction: 'frontier_beyliks',
  fictionalDisputeId: 'fictional_frontier_land_dispute',
  mediationCost: 10, favorCost: 5, allianceCost: 20, contractDeposit: 10, contractItemCount: 3, contractDurationDays: 30,
} as const;

export const INITIAL_POLITICAL_STATE: PoliticalState = {
  authorityId: 'osman_gazi', loyalty: 60, reputation: 10, localInfluence: 5, wealth: 0,
  militaryStrength: 10, popularSupport: 12, fear: 0, legitimacy: 45,
  commanderTrust: { commander_kara: 20 }, officialTrust: { local_cadi: 10 }, factionStanding: { frontier_beyliks: 10, ottoman_house: 15, village_community:15, market_merchants:8, frontier_garrison:12, local_judiciary:10, regional_authority:0 },
  factionInfluence: { frontier_beyliks:5,ottoman_house:8,village_community:12,market_merchants:3,frontier_garrison:4,local_judiciary:2,regional_authority:0 },
  factionLeaders: Object.fromEntries(POLITICAL_FACTIONS.map(f=>[f.id,f.leaderId])),
  joinedFaction: null, landRights: 0, rebellion: { preparation: 0, recruits: 0, active: false, lastOutcome: null },
  propertyConfiscated: false, politicalLegacy: 0, choices: [], fictionalDisputes: [],
  individualTrust: { commander_kara:20, local_cadi:10, hasan_farmer:18, yusuf_merchant:12 },
  individualReputation: { commander_kara:10, local_cadi:8, hasan_farmer:10, yusuf_merchant:10 },
  factionResources: Object.fromEntries(POLITICAL_FACTIONS.map(f=>[f.id,f.startingResources])),
  alliances: [], rivalries: [],
  disputes: [{id:POLITICAL_DISPUTES.land.id,kind:'land',title:POLITICAL_DISPUTES.land.title,parties:[...POLITICAL_DISPUTES.land.parties],status:'active',startedYear:1299}],
  memories: [], tradeContract:null, eraYear:1299,
};

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export class PoliticalSystem {
  private state: PoliticalState;
  constructor(state?: Partial<PoliticalState>) {
    this.state = { ...INITIAL_POLITICAL_STATE, ...structuredClone(state ?? {}),
      commanderTrust: { ...INITIAL_POLITICAL_STATE.commanderTrust, ...(state?.commanderTrust ?? {}) },
      officialTrust: { ...INITIAL_POLITICAL_STATE.officialTrust, ...(state?.officialTrust ?? {}) },
      factionStanding: { ...INITIAL_POLITICAL_STATE.factionStanding, ...(state?.factionStanding ?? {}) },
      factionInfluence: { ...INITIAL_POLITICAL_STATE.factionInfluence, ...(state?.factionInfluence ?? {}) },
      factionLeaders: { ...INITIAL_POLITICAL_STATE.factionLeaders, ...(state?.factionLeaders ?? {}) },
      individualTrust: { ...INITIAL_POLITICAL_STATE.individualTrust, ...(state?.individualTrust ?? {}) },
      individualReputation: { ...INITIAL_POLITICAL_STATE.individualReputation, ...(state?.individualReputation ?? {}) },
      factionResources: { ...INITIAL_POLITICAL_STATE.factionResources, ...(state?.factionResources ?? {}) },
      rebellion: { ...INITIAL_POLITICAL_STATE.rebellion, ...(state?.rebellion ?? {}) },
      choices: [...(state?.choices ?? [])], fictionalDisputes: [...(state?.fictionalDisputes ?? [])],
      alliances: [...(state?.alliances ?? [])], rivalries:[...(state?.rivalries??[])], disputes: structuredClone(state?.disputes ?? INITIAL_POLITICAL_STATE.disputes),
      memories: structuredClone(state?.memories ?? []), tradeContract: state?.tradeContract ? structuredClone(state.tradeContract) : null,
      eraYear: state?.eraYear ?? 1299 };
  }
  serialize(): PoliticalState { return structuredClone(this.state); }
  deserialize(state?: Partial<PoliticalState> | null): void { this.state = new PoliticalSystem(state ?? {}).state; }
  reset(): void { this.state = new PoliticalSystem().state; }
  getState(): PoliticalState { return this.serialize(); }
  getFactionDefinitions(year:number) { return POLITICAL_FACTIONS.filter(f=>year>=f.fromYear&&(f.untilYear===undefined||year<=f.untilYear)); }
  getNpcDefinitions(year:number) { return POLITICAL_NPCS.filter(n=>year>=n.fromYear&&(n.untilYear===undefined||year<=n.untilYear)); }
  getTitleForYear(year:number):string { return POLITICAL_TITLES.find(t=>year>=t.fromYear&&(!('untilYear'in t)||year<=t.untilYear))?.title??'Yerel siyaset'; }
  getFactionStance(factionId:string):'allied'|'friendly'|'neutral'|'wary'|'hostile' {
    if(this.state.rivalries.includes(factionId))return 'hostile';
    if(this.state.alliances.includes(factionId))return 'allied';
    if((this.state.factionResources[factionId]??50)<20||(this.state.factionStanding[factionId]??0)<7)return 'wary';
    if((this.state.factionStanding[factionId]??0)>=45)return 'friendly';
    return 'neutral';
  }
  recordFactionLeaderChange(factionId:string,oldLeaderId:string,newLeaderId:string,year:number,timeline:HistoricalEventSystem):void {
    if(!newLeaderId||this.state.factionLeaders[factionId]===newLeaderId)return;
    this.state.factionLeaders[factionId]=newLeaderId;
    this.state.factionResources[factionId]=clamp((this.state.factionResources[factionId]??50)-10);
    this.adjustFactionInfluence(factionId,-2);
    this.remember(oldLeaderId,'conflict',`Siyasi önder değişti; yeni önder ${newLeaderId}.`,-3,year);
    timeline.recordSimulationEvent({id:`political_leader_change_${factionId}_${year}`,title:'Siyasi Önder Değişimi (Simülasyon)',description:'Önder değişimi yerel kaynakları ve bağlılıkları etkiledi.',year,choice:`${oldLeaderId} → ${newLeaderId}`,consequences:['Kaynak azaldı','Oyuncunun fraksiyon nüfuzu yeniden değerlendirildi'],isFictional:true});
  }
  private remember(actorId:string,kind:PoliticalMemory['kind'],description:string,trustChange:number,day=0):void {
    this.state.individualTrust[actorId]=clamp((this.state.individualTrust[actorId]??0)+trustChange);
    this.state.individualReputation[actorId]=clamp((this.state.individualReputation[actorId]??0)+(trustChange>0?Math.ceil(trustChange/2):Math.floor(trustChange/2)));
    this.state.memories.push({day:Math.max(0,Math.floor(day)),actorId,kind,description,trustChange});
    if(this.state.memories.length>100)this.state.memories.splice(0,this.state.memories.length-100);
  }
  updateEra(year:number,ruler:string,timeline:HistoricalEventSystem):void {
    const expected=year<1326?'osman_gazi':year<1362?'orhan_gazi':'murad_i';
    if(this.state.authorityId==='frontier_council'||this.state.authorityId==='exile'){this.state.eraYear=year;return;}
    if(this.state.eraYear===year&&this.state.authorityId===expected)return;
    const prior=this.state.authorityId; this.state.eraYear=year; this.state.authorityId=ruler||expected;
    if(this.state.factionLeaders.ottoman_house!==this.state.authorityId)this.recordFactionLeaderChange('ottoman_house',this.state.factionLeaders.ottoman_house??prior,this.state.authorityId,year,timeline);
    if(prior!==this.state.authorityId){
      this.state.factionStanding.ottoman_house=clamp((this.state.factionStanding.ottoman_house??0)+2);
      this.state.factionStanding.frontier_beyliks=clamp((this.state.factionStanding.frontier_beyliks??0)-1);
      this.remember(this.state.authorityId,'promise',`Yeni siyasi dönem: ${this.state.authorityId}`,1,year);
      timeline.recordSimulationEvent({id:`political_era_${year}_${this.state.authorityId}`,title:'Siyasi Dönem Değişimi (Simülasyon)',description:'Siyasi bağlar yeni dönemin hanedan otoritesine göre yeniden değerlendirildi.',year,choice:`Otorite ${prior} → ${this.state.authorityId}`,consequences:['Hanedan ve uç gruplarının tutumları değişti'],isFictional:true});
    }
  }
  advanceToDay(day:number,timeline:HistoricalEventSystem,currentYear?:number):boolean {
    const contract=this.state.tradeContract;
    if(!contract||contract.status!=='active'||day<=contract.dueDay)return false;
    contract.status='defaulted'; this.state.factionStanding[contract.factionId]=clamp((this.state.factionStanding[contract.factionId]??0)-8);
    this.change('reputation',-3); this.remember('yusuf_merchant','betrayal','Tahıl tedarik sözleşmesi süresinde tamamlanmadı.',-12,day);
    timeline.recordSimulationEvent({id:`political_contract_default_${contract.id}`,title:'Ticaret Sözleşmesi Gecikti (Kurgusal)',description:'Yerel tahıl sözleşmesi süresi içinde yerine getirilemedi; esnafın güveni azaldı.',year:currentYear??Math.floor(1299+day/360),choice:'Sözleşme süresi geçti',consequences:['Pazar esnafının güveni düştü','Yeni sözleşme için itibar gerekebilir'],isFictional:true});
    return true;
  }
  adjustReputation(amount:number):void { this.change('reputation',amount); }
  adjustFactionStanding(factionId:string,amount:number):void { this.state.factionStanding[factionId]=clamp((this.state.factionStanding[factionId]??0)+amount); }
  adjustFactionInfluence(factionId:string,amount:number):void { this.state.factionInfluence[factionId]=clamp((this.state.factionInfluence[factionId]??0)+amount); }
  grantLandRights(amount:number):void { this.change('landRights',amount); }
  private change(key: 'loyalty'|'reputation'|'localInfluence'|'popularSupport'|'fear'|'legitimacy'|'landRights'|'militaryStrength', amount: number): void { this.state[key] = clamp(this.state[key] + amount); }
  getDecisions(c: PoliticalContext): PoliticalDecision[] {
    const early = c.year < 1326;
    const dispute = early && c.location.toLowerCase().includes('frontier') && this.state.disputes.some(d=>d.kind==='land'&&d.status==='active');
    const rebellious = this.state.rebellion;
    const activeContract=this.state.tradeContract?.status==='active';
    const faction=this.state.factionStanding.frontier_beyliks??0;
    const support=this.state.factionStanding.market_merchants??0;
    const activeDispute=this.state.disputes.some(d=>d.status==='active'||d.status==='contested');
    return [
      { id:'accept_levy', label:'Accept the frontier levy', available: early && c.currency >= 20, reason:'Early frontier period and 20 akçe.',risk:'Costs money; improves commander and household standing.',effect:'Loyalty and military standing rise.' },
      { id:'refuse_levy', label:'Refuse the levy', available: early, reason:'Available only in the early frontier period.',risk:'Commander trust and general reputation may fall.',effect:'Local influence may rise.' },
      { id:'negotiate_land', label:'Negotiate land rights', available: dispute && c.currency>=10, reason:'Active frontier land dispute and 10 akçe.',risk:'A failed negotiation may reduce standing with the local authority.',effect:'May improve land rights and trust with the kadı.' },
      { id:'support_leader', label:'Support the local leader', available: dispute, reason:'Requires an active local land dispute.',risk:'Takes a side in a local conflict.',effect:'Community support and frontier influence rise.' },
      { id:'mediate_dispute',label:'Mediate an active dispute',available:activeDispute&&this.state.localInfluence>=10&&c.currency>=POLITICAL_CONFIG.mediationCost,reason:'10 influence and 10 akçe.',risk:'The parties may reject an unfair settlement.',effect:'A fair settlement can preserve property and improve trust.'},
      { id:'compromise_dispute',label:'Offer a compromise',available:activeDispute,reason:'Requires an active political dispute.',risk:'You may gain less than a direct claim.',effect:'Can settle a dispute and improve local trust.'},
      { id:'withdraw_dispute',label:'Withdraw a political claim',available:activeDispute,reason:'Requires an active political dispute.',risk:'Reduces influence with the faction whose claim you leave.',effect:'Lowers conflict and protects relationships.'},
      { id:'join_faction', label:'Join the frontier beyliks', available: early && faction >= 15, reason:'Build faction standing to 15 first.',risk:'Publicly commits the family to the frontier coalition.',effect:'Improves access to military support.' },
      { id:'request_faction_support',label:'Request frontier support',available:early&&this.state.joinedFaction==='frontier_beyliks'&&faction>=20,reason:'Join the beyliks and build 20 standing.',risk:'Uses faction resources and creates an obligation.',effect:'May add military and popular support.'},
      { id:'offer_favor',label:'Offer a favor to the market',available:early&&c.currency>=POLITICAL_CONFIG.favorCost,reason:'Requires 5 akçe.',risk:'Costs a small amount of household money.',effect:'Builds trust with Yusuf and the market faction.'},
      { id:'form_alliance',label:'Form a frontier alliance',available:early&&this.state.joinedFaction==='frontier_beyliks'&&faction>=35&&this.state.popularSupport>=25&&c.currency>=POLITICAL_CONFIG.allianceCost,reason:'Join the faction, reach 35 standing and 25 popular support; costs 20 akçe.',risk:'An alliance ties the family to faction disputes.',effect:'Records a durable alliance and gains support.'},
      { id:'sign_trade_contract',label:'Sign a village grain contract',available:early&&!activeContract&&support>=10&&c.currency>=POLITICAL_CONFIG.contractDeposit,reason:'Market standing 10 and a 10 akçe deposit.',risk:`Requires ${POLITICAL_CONFIG.contractItemCount} wheat before the due date.`,effect:'Improves market trust if fulfilled.'},
      { id:'fulfill_trade_contract',label:`Deliver ${this.state.tradeContract?.amount??POLITICAL_CONFIG.contractItemCount} wheat`,available:activeContract&&(c.items?.wheat??0)>=(this.state.tradeContract?.amount??POLITICAL_CONFIG.contractItemCount),reason:'Requires an active contract and enough wheat.',risk:'Consumes the contracted grain.',effect:'Returns the deposit and builds trust.'},
      { id:'cancel_trade_contract',label:'Cancel the grain contract',available:activeContract,reason:'Only available while a contract is active.',risk:'The deposit is lost and merchant trust falls.',effect:'Ends the obligation without ending the game.'},
      { id:'petition_tax',label:'Petition over a tax demand',available:c.year>=1362&&this.state.localInfluence>=15&&!this.state.disputes.some(d=>d.kind==='tax'&&d.status==='active'),reason:'Regional administration period and 15 influence.',risk:'Publicly challenges a regional demand.',effect:'Opens a negotiable tax dispute.'},
      { id:'raise_succession_claim',label:'Raise a succession claim',available:c.year>=1326&&c.familyGeneration>=2&&this.state.localInfluence>=15&&!this.state.disputes.some(d=>d.kind==='succession'&&d.status==='active'),reason:'A later period, second family generation and 15 influence.',risk:'May divide family and faction loyalties.',effect:'Opens a locally negotiated succession dispute.'},
      { id:'contest_trade_terms',label:'Contest a trade term',available:early&&support>=10&&!this.state.disputes.some(d=>d.kind==='trade'&&d.status==='active'),reason:'Build market standing to 10 first.',risk:'May delay access to merchant credit.',effect:'Opens a negotiable market dispute.'},
      { id:'resist_order', label:'Resist the ruler’s order', available: this.state.loyalty < 45 && this.state.localInfluence >= 15, reason:'Requires loyalty below 45 and influence of 15.',risk:'Can lead to confiscation or exile if conflict escalates.',effect:'Raises local influence and popular support.' },
      { id:'recruit', label:'Recruit for a political cause', available: rebellious.active && c.currency >= POLITICAL_CONFIG.recruitmentCost, reason:'Requires an active cause and 10 akçe.',risk:'Consumes funds and raises political tension.',effect:'Adds a recruit and preparation.' },
      { id:'rebel', label:'Proclaim open rebellion', available: this.canStartRebellion(c), reason:'Requires preparation, local support, recruits, arms, and an early frontier crisis.',risk:'Defeat can cost property, standing and safety.',effect:'Victory can establish a frontier council.' },
      { id:'negotiate_surrender', label:'Seek surrender or reconciliation', available: rebellious.active, reason:'Only available during an active rebellion.',risk:'Ends the cause and gives up some influence.',effect:'Can preserve property and create a political recovery path.' },
    ];
  }
  private canStartRebellion(c: PoliticalContext): boolean {
    return c.year < 1362 && c.location.toLowerCase().includes('frontier') && this.state.loyalty <= 40 &&
      this.state.localInfluence >= POLITICAL_CONFIG.rebellionMinimumInfluence && this.state.popularSupport >= POLITICAL_CONFIG.rebellionMinimumSupport &&
      this.state.rebellion.recruits >= POLITICAL_CONFIG.rebellionMinimumRecruitment && c.currency >= POLITICAL_CONFIG.rebellionCurrencyCost &&
      Math.max(c.militaryStrength, this.state.militaryStrength) >= POLITICAL_CONFIG.rebellionMilitaryRequirement && this.state.joinedFaction !== null;
  }
  act(action: PoliticalAction, c: PoliticalContext, timeline: HistoricalEventSystem, pay: (amount: number) => boolean, consumeItem?: (itemId:string,amount:number)=>boolean): PoliticalResult {
    if (!this.getDecisions(c).find(d => d.id === action)?.available) return { success:false, message:'This political choice is not currently available.' };
    const s = this.state;
    let result:PoliticalResult={success:true,message:`Political choice recorded: ${action}.`};
    switch (action) {
      case 'accept_levy': if (!pay(20)) return { success:false, message:'You cannot afford the levy.' }; this.change('loyalty', 8); this.change('reputation', 6); this.change('militaryStrength', 4); s.commanderTrust.commander_kara = clamp((s.commanderTrust.commander_kara ?? 0)+12); this.adjustFactionStanding('frontier_garrison',5);this.remember('commander_kara','aid','Katkı payı askerî yükümlülük için ödendi.',12,c.totalDays);result.relationshipChanges={commander_kara:6};result.memoryKind='aid';result.memorySummary='Hudut katkısı ödendi.'; break;
      case 'refuse_levy': this.change('loyalty', -10); this.change('reputation', -3); this.change('localInfluence', 4); s.commanderTrust.commander_kara = clamp((s.commanderTrust.commander_kara ?? 0)-12);this.activateDispute('levy',c,timeline);this.remember('commander_kara','conflict','Askerî katkı talebi reddedildi.',-12,c.totalDays);result.relationshipChanges={commander_kara:-5};result.memoryKind='conflict';result.memorySummary='Askerî yükümlülük reddedildi.'; break;
      case 'negotiate_land': if(!pay(10))return {success:false,message:'Land negotiation requires 10 akçe.'};this.change('localInfluence', 8); this.change('reputation', 3); this.change('landRights', 15); s.officialTrust.local_cadi = clamp((s.officialTrust.local_cadi ?? 0)+8);this.resolveDispute('land','Negotiated land rights');this.remember('local_cadi','agreement','Arazi kullanımı kadıyla müzakere edildi.',8,c.totalDays);result.relationshipChanges={hasan_farmer:3};result.memoryKind='agreement';result.memorySummary='Arazi sınırı müzakere edildi.'; break;
      case 'support_leader': this.change('loyalty', 4); this.change('popularSupport', 8); this.change('localInfluence', 5); s.factionStanding.frontier_beyliks = clamp((s.factionStanding.frontier_beyliks ?? 0)+10);this.adjustFactionInfluence('frontier_beyliks',5);this.adjustFactionInfluence('village_community',4); this.recordFictionalDispute(timeline,c);this.remember('hasan_farmer','aid','Ailenin yerel uzlaşma girişimine destek verildi.',5,c.totalDays);result.relationshipChanges={hasan_farmer:4};result.memoryKind='aid';result.memorySummary='Yerel arazi uzlaşmasına destek verildi.'; break;
      case 'join_faction': s.joinedFaction='frontier_beyliks'; s.factionStanding.frontier_beyliks=clamp((s.factionStanding.frontier_beyliks ?? 0)+15);this.adjustFactionInfluence('frontier_beyliks',4); this.change('localInfluence',3); this.recordFictionalDispute(timeline,c);this.remember('commander_kara','promise','Aile uç beyleriyle siyasi bağlılık kurdu.',8,c.totalDays);result.memoryKind='promise';result.memorySummary='Uç beyleriyle bağlılık kuruldu.'; break;
      case 'resist_order': this.change('loyalty',-12); this.change('fear',6); this.change('localInfluence',8); this.change('popularSupport',5); s.commanderTrust.commander_kara=clamp((s.commanderTrust.commander_kara??0)-12);if(!s.rivalries.includes('ottoman_house'))s.rivalries.push('ottoman_house'); this.recordFictionalDispute(timeline,c);this.remember('commander_kara','conflict','Ruler emrine açıkça karşı çıkıldı.',-12,c.totalDays);result.relationshipChanges={commander_kara:-7};result.memoryKind='conflict';result.memorySummary='Emre karşı çıkıldı.'; break;
      case 'recruit': if (!pay(POLITICAL_CONFIG.recruitmentCost)) return {success:false,message:'You cannot afford recruitment.'}; s.rebellion.recruits += 1; s.rebellion.preparation=clamp(s.rebellion.preparation+8); this.change('militaryStrength',3); this.change('localInfluence',2); break;
      case 'mediate_dispute': {
        if(!pay(POLITICAL_CONFIG.mediationCost))return {success:false,message:'Mediation requires 10 akçe.'};
        const active=s.disputes.find(d=>d.status==='active'||d.status==='contested');if(!active)return {success:false,message:'There is no active dispute to mediate.'};
        const leader=POLITICAL_FACTIONS.find(f=>f.id===active.parties[0])?.leaderId??'local_cadi';
        const score=this.state.localInfluence*0.45+this.state.popularSupport*0.25+(this.state.individualTrust.local_cadi??0)*0.2+(POLITICAL_NPCS.find(n=>n.id==='local_cadi')?.personality.negotiation??50)*0.1;
        if(score>=48){active.status='settled';active.lastOutcome='mediated';if(active.kind==='land')this.change('landRights',8);this.change('legitimacy',4);this.change('reputation',4);this.adjustFactionStanding(active.parties[0]??'village_community',5);this.adjustFactionStanding(active.parties[1]??'frontier_beyliks',5);for(const id of active.parties)this.adjustFactionInfluence(id,2);this.remember(leader,'agreement',`${active.title} uzlaşmayla çözüldü.`,8,c.totalDays);this.remember('hasan_farmer','agreement',`${active.title} için arabuluculuk kabul edildi.`,6,c.totalDays);result={success:true,message:`Arabuluculuk kabul edildi: ${active.title} uzlaşmayla çözüldü.`,disputeStatus:'settled',relationshipChanges:{local_cadi:5,hasan_farmer:5},memoryKind:'agreement',memorySummary:`${active.title} arabuluculukla çözüldü.`};}
        else{active.status='contested';active.lastOutcome='rejected';this.change('reputation',-2);this.remember(leader,'conflict',`${active.title} için önerilen uzlaşma reddedildi.`, -5,c.totalDays);result={success:true,message:'Taraflar teklifi reddetti; anlaşmazlık sürüyor. Yeni destek veya daha iyi koşullar arayabilirsiniz.',disputeStatus:'contested',relationshipChanges:{local_cadi:-2,hasan_farmer:-2},memoryKind:'conflict',memorySummary:`${active.title} uzlaşma teklifi reddedildi.`};}
        break;
      }
      case 'compromise_dispute': {const d=s.disputes.find(x=>x.status==='active'||x.status==='contested');if(!d)return {success:false,message:'There is no active dispute.'};d.status='settled';d.lastOutcome='compromise';if(d.kind==='land')this.change('landRights',5);this.change('legitimacy',3);this.adjustFactionStanding(d.parties[0]??'village_community',3);this.adjustFactionStanding(d.parties[1]??'frontier_beyliks',3);this.remember('local_cadi','agreement',`${d.title} için uzlaşma sağlandı.`,5,c.totalDays);result={success:true,message:`Uzlaşma sağlandı: ${d.title}.`,disputeStatus:'settled',relationshipChanges:{local_cadi:3,hasan_farmer:3},memoryKind:'agreement',memorySummary:`${d.title} uzlaşmayla kapandı.`};break;}
      case 'withdraw_dispute': {const d=s.disputes.find(x=>x.status==='active'||x.status==='contested');if(!d)return {success:false,message:'There is no active dispute.'};d.status='withdrawn';d.lastOutcome='withdrawn';this.change('loyalty',3);this.adjustFactionStanding(d.parties[0]??'frontier_beyliks',-4);this.remember(POLITICAL_FACTIONS.find(f=>f.id===d.parties[0])?.leaderId??'local_cadi','promise',`${d.title} için aile talebinden vazgeçildi.`,4,c.totalDays);result={success:true,message:`Siyasi talep geri çekildi; ${d.title} için çatışma sona erdi.`,disputeStatus:'withdrawn',relationshipChanges:{local_cadi:2,hasan_farmer:2},memoryKind:'promise',memorySummary:`${d.title} talebinden vazgeçildi.`};break;}
      case 'request_faction_support': {const resources=s.factionResources.frontier_beyliks??0;if(resources<8)return {success:false,message:'Frontier faction resources are too low.'};s.factionResources.frontier_beyliks=resources-8;this.change('militaryStrength',5);this.change('popularSupport',4);this.adjustFactionStanding('frontier_beyliks',3);this.adjustFactionInfluence('frontier_beyliks',3);this.remember('commander_kara','aid','Uç beyleri siyasi talebe sınırlı destek verdi.',5,c.totalDays);result={success:true,message:'Uç beyleri sınırlı askerî ve siyasi destek gönderdi.',relationshipChanges:{commander_kara:4},memoryKind:'aid',memorySummary:'Uç beylerinden destek istendi.'};break;}
      case 'offer_favor': if(!pay(POLITICAL_CONFIG.favorCost))return {success:false,message:'A market favor costs 5 akçe.'};this.adjustFactionStanding('market_merchants',12);this.adjustFactionInfluence('market_merchants',4);s.factionResources.market_merchants=clamp((s.factionResources.market_merchants??0)+2);this.remember('yusuf_merchant','aid','Pazar esnafına küçük bir yardım ulaştırıldı.',10,c.totalDays);result={success:true,message:'Pazar esnafına yardım ettiniz; Yusuf ve tüccarlar güven kazandı.',relationshipChanges:{yusuf_merchant:7},memoryKind:'aid',memorySummary:'Pazar esnafına yardım edildi.'};break;
      case 'form_alliance': if(!pay(POLITICAL_CONFIG.allianceCost))return {success:false,message:'An alliance requires 20 akçe.'};if(!s.alliances.includes('frontier_beyliks'))s.alliances.push('frontier_beyliks');this.adjustFactionStanding('frontier_beyliks',10);this.adjustFactionInfluence('frontier_beyliks',5);this.change('legitimacy',5);this.remember('commander_kara','promise','Aile uç beyleriyle kalıcı ittifak kurdu.',12,c.totalDays);result={success:true,message:'Uç beyleriyle ittifak kuruldu; aile karşılıklı destek sözü verdi.',relationshipChanges:{commander_kara:8},memoryKind:'promise',memorySummary:'Uç beyleriyle ittifak kuruldu.'};break;
      case 'sign_trade_contract': if(!pay(POLITICAL_CONFIG.contractDeposit))return {success:false,message:'The 10 akçe contract deposit is unavailable.'};s.tradeContract={id:`grain_${c.year}_${Math.floor(c.totalDays??0)}_${s.choices.length}`,factionId:'market_merchants',itemId:'wheat',amount:POLITICAL_CONFIG.contractItemCount,deposit:POLITICAL_CONFIG.contractDeposit,dueDay:(c.totalDays??0)+POLITICAL_CONFIG.contractDurationDays,status:'active'};this.remember('yusuf_merchant','promise','Yusuf ile tahıl tedarik sözleşmesi imzalandı.',5,c.totalDays);result={success:true,message:`Üç buğdayı ${POLITICAL_CONFIG.contractDurationDays} gün içinde teslim etme sözü verildi.`,relationshipChanges:{yusuf_merchant:3},memoryKind:'promise',memorySummary:'Tahıl tedarik sözleşmesi imzalandı.'};break;
      case 'fulfill_trade_contract': {const contract=s.tradeContract;if(!contract||contract.status!=='active')return {success:false,message:'There is no active grain contract.'};if(!(consumeItem?.(contract.itemId,contract.amount)??false))return {success:false,message:'The contracted wheat could not be delivered.'};contract.status='fulfilled';this.adjustFactionStanding(contract.factionId,8);this.change('reputation',5);this.remember('yusuf_merchant','promise','Tahıl sözleşmesi zamanında yerine getirildi.',14,c.totalDays);result={success:true,message:'Tahıl teslim edildi; depozito iade edildi ve pazar güveni arttı.',currencyReward:contract.deposit,relationshipChanges:{yusuf_merchant:10},memoryKind:'promise',memorySummary:'Tahıl sözleşmesi yerine getirildi.'};break;}
      case 'cancel_trade_contract': {const contract=s.tradeContract;if(!contract||contract.status!=='active')return {success:false,message:'There is no active grain contract.'};contract.status='cancelled';this.adjustFactionStanding(contract.factionId,-5);this.remember('yusuf_merchant','betrayal','Tahıl sözleşmesi oyuncu tarafından iptal edildi.',-8,c.totalDays);result={success:true,message:'Sözleşme iptal edildi; depozito ve bir miktar pazar güveni kaybedildi.',relationshipChanges:{yusuf_merchant:-6},memoryKind:'betrayal',memorySummary:'Tahıl sözleşmesi iptal edildi.'};break;}
      case 'petition_tax': this.activateDispute('tax',c,timeline);result={success:true,message:'Ürün payı için vergi dilekçesi açıldı; bölgesel idareyle müzakere edebilirsiniz.',disputeStatus:'active',memoryKind:'conflict',memorySummary:'Vergi talebine itiraz edildi.'};break;
      case 'raise_succession_claim': this.activateDispute('succession',c,timeline);this.remember('commander_kara','conflict','Aile yerel halefiyet talebinde bulundu.',-3,c.totalDays);result={success:true,message:'Yerel bağlılık ve halefiyet iddiası kayda geçti; aile uzlaşma arayabilir.',disputeStatus:'active',memoryKind:'conflict',memorySummary:'Aile halefiyet iddiası sundu.'};break;
      case 'contest_trade_terms': this.activateDispute('trade',c,timeline);this.remember('yusuf_merchant','conflict','Pazar koşullarına itiraz edildi.',-3,c.totalDays);result={success:true,message:'Ticaret şartları anlaşmazlığı açıldı; esnafla uzlaşma veya geri çekilme mümkün.',disputeStatus:'active',memoryKind:'conflict',memorySummary:'Ticaret şartlarına itiraz edildi.'};break;
      case 'rebel': return this.resolveRebellion(c,pay,timeline);
      case 'negotiate_surrender': return this.resolveNegotiation(timeline,c);
    }
    s.choices.push(action);
    timeline.recordSimulationEvent({id:`political_${action}_${c.year}_${Math.floor(c.totalDays??0)}_${s.choices.length}`,title:`Siyasi Karar: ${action}`,description:'Oyuncunun siyasi seçimi kurmaca simülasyon geçmişine işlendi.',year:c.year,choice:result.message,consequences:[`Genel destek: ${s.popularSupport}`,`Yerel nüfuz: ${s.localInfluence}`,`İtibar: ${s.reputation}`],isFictional:true});
    return result;
  }
  private recordFictionalDispute(timeline: HistoricalEventSystem, c: PoliticalContext): void {
    const id=POLITICAL_CONFIG.fictionalDisputeId;
    if (this.state.fictionalDisputes.includes(id)) return;
    this.state.fictionalDisputes.push(id);
    timeline.recordSimulationEvent({id,title:'Frontier Land Dispute (Fictional)',description:'An invented local dispute over grazing and cultivated land near the frontier settlement.',year:c.year,choice:'Player intervened in local politics',consequences:['Local trust and faction standing changed'],isFictional:true});
  }
  private activateDispute(kind:DisputeKind,c:PoliticalContext,timeline:HistoricalEventSystem):void {
    const definition=POLITICAL_DISPUTES[kind];
    if(c.year<definition.startYear||('endYear'in definition&&definition.endYear!==undefined&&c.year>definition.endYear))return;
    const existing=this.state.disputes.find(d=>d.id===definition.id);
    if(existing&&(existing.status==='active'||existing.status==='contested'))return;
    this.state.disputes.push({id:definition.id,kind,title:definition.title,parties:[...definition.parties],status:'active',startedYear:c.year});
    if(this.state.disputes.length>30)this.state.disputes.splice(0,this.state.disputes.length-30);
    this.state.fictionalDisputes.push(definition.id);
    timeline.recordSimulationEvent({id:`political_dispute_${definition.id}_${c.year}_${this.state.disputes.length}`,title:`Anlaşmazlık Açıldı: ${definition.title}`,description:'Oyuncu tarafından başlatılan kurmaca siyasi anlaşmazlık.',year:c.year,choice:definition.title,consequences:['Müzakere, uzlaşma ve geri çekilme seçenekleri açıldı'],isFictional:true});
  }
  private resolveDispute(kind:DisputeKind,outcome:string):void {
    const dispute=this.state.disputes.find(d=>d.kind===kind&&(d.status==='active'||d.status==='contested'));
    if(dispute){dispute.status='settled';dispute.lastOutcome=outcome;}
  }
  private resolveRebellion(c: PoliticalContext,pay:(amount:number)=>boolean,t:HistoricalEventSystem):PoliticalResult {
    if(!pay(POLITICAL_CONFIG.rebellionCurrencyCost)) return {success:false,message:'The rebellion’s 40 akçe supply fund is unavailable.'};
    this.state.rebellion.active=true; this.state.rebellion.preparation=clamp(this.state.rebellion.preparation+15);
    const score=this.state.rebellion.recruits*8+this.state.localInfluence*0.45+this.state.popularSupport*0.4+Math.max(c.militaryStrength,this.state.militaryStrength)*0.55+this.state.rebellion.preparation*0.2-this.state.fear*0.2;
    const outcome:RebellionOutcome=score>=95?'victory':score>=70?'surrender':score>=48?'defeat':'exile';
    this.state.rebellion.active=false; this.state.rebellion.lastOutcome=outcome; this.state.rebellion.preparation=0;
    this.state.choices.push('rebel');
    if(outcome==='victory'){this.change('legitimacy',12);this.change('popularSupport',8);this.change('localInfluence',12);this.change('loyalty',-5);this.state.authorityId='frontier_council';this.state.factionStanding.frontier_beyliks=clamp((this.state.factionStanding.frontier_beyliks??0)+20);this.state.propertyConfiscated=false;}
    if(outcome==='surrender'){this.change('loyalty',16);this.change('fear',-8);this.change('localInfluence',-6);this.state.propertyConfiscated=false;}
    if(outcome==='defeat'){this.change('loyalty',-12);this.change('localInfluence',-12);this.change('popularSupport',-10);this.change('reputation',-8);this.state.propertyConfiscated=true;}
    if(outcome==='exile'){this.change('loyalty',-20);this.change('localInfluence',-18);this.change('popularSupport',-15);this.change('reputation',-12);this.state.propertyConfiscated=true;this.state.authorityId='exile';}
    this.state.politicalLegacy = clamp(this.state.politicalLegacy + (outcome==='victory'?12:outcome==='surrender'?2:-8));
    t.recordSimulationEvent({id:`political_rebellion_${c.year}_${this.state.choices.length}`,title:`Frontier Rebellion: ${outcome}`,description:`A fictional local political crisis resolved as ${outcome}.`,year:c.year,choice:`Rebellion ${outcome}`,consequences:[`Authority: ${this.state.authorityId}`,`Land confiscated: ${this.state.propertyConfiscated}`],isFictional:true});
    return {success:true,outcome,message:`Rebellion ended in ${outcome}. Preparation and independent faction support shaped the result.`};
  }
  private resolveNegotiation(t:HistoricalEventSystem,c:PoliticalContext):PoliticalResult { this.state.rebellion.active=false;this.state.rebellion.lastOutcome='surrender';this.state.rebellion.preparation=0;this.state.propertyConfiscated=false;this.change('loyalty',12);this.change('fear',-10);this.change('localInfluence',-5);this.state.politicalLegacy+=2;this.state.choices.push('negotiate_surrender');t.recordSimulationEvent({id:`political_reconciliation_${c.year}_${this.state.choices.length}`,title:'Reconciliation after a Frontier Dispute (Fictional)',description:'The player negotiated an end to a fictional local confrontation.',year:c.year,choice:'Negotiated surrender and reconciliation',consequences:['Property retained','Authority restored'],isFictional:true});return {success:true,outcome:'surrender',message:'Negotiated reconciliation: property retained and the authority relationship improved.'}; }
}
