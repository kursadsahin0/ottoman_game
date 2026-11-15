import {
  MilitaryRank,
  RANK_ORDER,
  RANK_REQUIREMENTS,
  RANK_NAMES,
  COMMANDERS,
  MissionDefinition,
  MISSIONS,
} from '@data/MilitaryData';
import { BattlefieldSystem, type BattleStartContext, type BattlefieldSaveState, type UnitOrder } from './BattlefieldSystem';

export interface MilitaryState {
  rank: MilitaryRank;
  reputation: number;
  serviceDays: number;
  enemiesDefeated: number;
  successfulMissions: number;
  relationships: Record<string, number>; // commanderId -> relationship value
  currentMission: MissionDefinition | null;
  completedMissions: string[];
  serviceRecord: Array<{ date: string; event: string; type: string }>;
  battlefield?: BattlefieldSaveState;
  leadership: number;
  tacticalDecisions: number;
  isEnlisted: boolean;
  supplyScore: number;
  experience: number;
  tacticalExperienceThisBattle: number;
}

export class MilitarySystem {
  private readonly battlefield = new BattlefieldSystem();
  private state: MilitaryState = {
    rank: MilitaryRank.RECRUIT,
    reputation: 0,
    serviceDays: 0,
    enemiesDefeated: 0,
    successfulMissions: 0,
    relationships: {},
    currentMission: null,
    completedMissions: [],
    serviceRecord: [],
    leadership: 0,
    tacticalDecisions: 0,
    isEnlisted: true,
    supplyScore: 0,
    experience: 0,
    tacticalExperienceThisBattle: 0,
  };

  constructor() {
    // Initialize relationships
    for (const commander of COMMANDERS) {
      this.state.relationships[commander.id] = 0;
    }
    this.addServiceRecord('Enlisted as recruit', 'enlistment');
  }

  getState(): MilitaryState {
    return { ...this.state };
  }

  getRank(): MilitaryRank {
    return this.state.rank;
  }

  getReputation(): number {
    return this.state.reputation;
  }

  enlist(leadership = this.state.leadership): { success: boolean; message: string } {
    if (this.state.isEnlisted) return { success: false, message: 'Zaten askerlik hizmetindesiniz.' };
    this.state.isEnlisted = true;
    this.state.leadership = Math.max(0, Math.min(100, Math.floor(leadership)));
    this.addServiceRecord('Hudut birliğine er olarak katıldı.', 'enlistment');
    return { success: true, message: 'Hudut birliğine er olarak katıldınız.' };
  }

  leaveService(): { success: boolean; message: string } {
    if (!this.state.isEnlisted) return { success: false, message: 'Askerlik hizmetinde değilsiniz.' };
    if (this.battlefield.isInBattle() || this.state.currentMission) return { success: false, message: 'Aktif askerî görev tamamlanmadan sivil yaşama dönülemez.' };
    this.state.isEnlisted = false;
    this.state.currentMission = null;
    this.addServiceRecord('Hudut hizmetinden ayrıldı.', 'discharge');
    return { success: true, message: 'Askerlik hizmetinden ayrıldınız; sivil yaşama dönebilirsiniz.' };
  }

  setLeadershipScore(score: number): void { this.state.leadership = Math.max(0, Math.min(100, Math.floor(score))); this.checkRankProgression(); }
  recordTacticalDecision(order: UnitOrder): void {
    this.state.tacticalDecisions += 1;
    const earned = Math.min(5, 20 - this.state.tacticalExperienceThisBattle);
    if (earned > 0) {
      this.state.experience += earned;
      this.state.tacticalExperienceThisBattle += earned;
    }
    this.addServiceRecord(`Sahada taktik karar: ${order}`, 'tactical_decision');
    this.checkRankProgression();
  }
  recordSupplyUse(supplied: boolean): void { this.state.supplyScore = Math.max(0, Math.min(100, this.state.supplyScore + (supplied ? 3 : 0))); }

  addReputation(amount: number): void {
    this.state.reputation = Math.max(0, this.state.reputation + amount);
    this.checkRankProgression();
  }

  addServiceDays(days: number): void {
    this.state.serviceDays += days;
    this.checkRankProgression();
  }

  recordEnemyDefeated(): void {
    this.state.enemiesDefeated++;
    this.state.experience += 15;
    this.addReputation(2);
    this.addServiceRecord('Defeated enemy in combat', 'combat');
    this.checkRankProgression();
  }

  modifyRelationship(commanderId: string, amount: number): void {
    if (this.state.relationships.hasOwnProperty(commanderId)) {
      const current = this.state.relationships[commanderId];
      if (typeof current === 'number') {
        this.state.relationships[commanderId] = Math.max(-100, Math.min(100, current + amount));
      } else {
        this.state.relationships[commanderId] = Math.max(-100, Math.min(100, amount));
      }
      this.addServiceRecord(`Relationship with commander changed`, 'relationship');
    }
  }

  getRelationship(commanderId: string): number {
    return this.state.relationships[commanderId] || 0;
  }

  getBattlefield(): BattlefieldSystem { return this.battlefield; }

  startBattle(year: number, context: BattleStartContext = {}): {success:boolean;message:string} {
    const mission=this.state.currentMission;
    if(!mission)return {success:false,message:'Önce bir askerî görev kabul edin.'};
    const battle=this.battlefield.getState();
    if(this.battlefield.isActive())return {success:false,message:'Bir çatışma zaten sürüyor.'};
    if(battle.status!=='inactive'&&(!battle.reported||battle.missionId===mission.id))return {success:false,message:'Bu görev için savaş raporu zaten açılmış veya sonuçlanmıştır.'};
    const result = this.battlefield.start(mission.id,year,[],context);
    if (result.success) this.state.tacticalExperienceThisBattle = 0;
    return result;
  }

  issueBattleCommand(command:UnitOrder,target?:{x:number;y:number},missionAuthority=true):{success:boolean;message:string} {
    const result=this.battlefield.issueCommand(command,this.state.rank,target,missionAuthority);
    if(result.success)this.recordTacticalDecision(command);
    return result;
  }

  resolveBattleReport():{success:boolean;message:string;casualties:number;enemyCasualties:number} {
    const battle=this.battlefield.getState();
    if(!this.state.currentMission||!this.battlefield.markReported())return {success:false,message:'Savaş raporu bu görev için kullanılamıyor.',casualties:0,enemyCasualties:0};
    const casualties=this.battlefield.getCasualties('friendly'),enemyCasualties=this.battlefield.getCasualties('enemy');
    if(battle.status==='victory'){
      this.state.experience += 40 + enemyCasualties * 3;
      this.updateMissionObjective('defeat_raiders',2);
      this.updateMissionObjective('survive',1);
      this.state.enemiesDefeated+=Math.max(1,battle.units.filter(u=>u.side==='enemy'&&u.count===0).length);
      this.state.reputation=Math.max(0,this.state.reputation+Math.max(1,6-Math.floor(casualties/3)));
      this.modifyRelationship(this.state.currentMission.commanderId,Math.max(-5,5-Math.floor(casualties/2)));
      this.addServiceRecord(`Frontier battle report: victory; ${casualties} friendly casualties, ${enemyCasualties} enemy casualties`,'battle_report');
      this.checkRankProgression();
      return {success:true,message:`Zafer raporu: ${casualties} dost kaybı, ${enemyCasualties} düşman kaybı.`,casualties,enemyCasualties};
    }
    this.state.experience += (battle.status === 'retreated' ? 15 : 10) + enemyCasualties * 2;
    this.state.reputation=Math.max(0,this.state.reputation-5);
    this.modifyRelationship(this.state.currentMission.commanderId,-7);
    this.addServiceRecord(`Frontier battle report: ${battle.status}; ${casualties} friendly casualties`,'battle_report');
    return {success:true,message:`Çatışma ${battle.status==='retreated'?'geri çekilmeyle':'yenilgiyle'} sonuçlandı; ${casualties} dost kaybı.`,casualties,enemyCasualties};
  }

  getAvailableMissions(): MissionDefinition[] {
    if (!this.state.isEnlisted) return [];
    return MISSIONS.filter(mission => {
      if (this.state.completedMissions.includes(mission.id)) return false;
      if (this.state.currentMission) return false;
      if (mission.requiredRank) {
        const requiredIndex = RANK_ORDER.indexOf(mission.requiredRank);
        const currentIndex = RANK_ORDER.indexOf(this.state.rank);
        if (currentIndex < requiredIndex) return false;
      }
      if (mission.minReputation !== undefined && this.state.reputation < mission.minReputation) {
        return false;
      }
      return true;
    });
  }

  acceptMission(missionId: string): { success: boolean; message: string } {
    if (!this.state.isEnlisted) return { success: false, message: 'Önce askerlik hizmetine katılın.' };
    const mission = MISSIONS.find(m => m.id === missionId);
    if (!mission) {
      return { success: false, message: 'Mission not found' };
    }
    if (this.state.currentMission) {
      return { success: false, message: 'Already have an active mission' };
    }

    const available = this.getAvailableMissions();
    if (!available.find(m => m.id === missionId)) {
      return { success: false, message: 'Mission not available' };
    }

    // Deep copy mission
    this.state.currentMission = JSON.parse(JSON.stringify(mission));
    this.addServiceRecord(`Accepted mission: ${mission.title}`, 'mission');
    this.modifyRelationship(mission.commanderId, 3);
    return { success: true, message: `Accepted: ${mission.title}` };
  }

  updateMissionObjective(objectiveId: string, progress: number = 1): void {
    if (!this.state.currentMission) return;
    const objective = this.state.currentMission.objectives.find(o => o.id === objectiveId);
    if (!objective || objective.completed) return;

    if (objective.targetCount !== undefined) {
      objective.currentCount = (objective.currentCount || 0) + progress;
      if (objective.currentCount >= objective.targetCount) {
        objective.completed = true;
        this.addServiceRecord(`Objective completed: ${objective.description}`, 'objective');
      }
    } else {
      objective.completed = true;
      this.addServiceRecord(`Objective completed: ${objective.description}`, 'objective');
    }
  }

  checkMissionCompletion(): { completed: boolean; success: boolean } {
    if (!this.state.currentMission) return { completed: false, success: false };
    
    const allObjectivesComplete = this.state.currentMission.objectives.every(o => o.completed);
    if (!allObjectivesComplete) return { completed: false, success: false };

    return { completed: true, success: true };
  }

  completeMission(playerDecision: 'aggressive' | 'cautious' | 'diplomatic' = 'cautious'): {
    success: boolean;
    rewards: any;
    message: string;
  } {
    if (!this.state.currentMission) {
      return { success: false, rewards: null, message: 'No active mission' };
    }

    const completion = this.checkMissionCompletion();
    if (!completion.completed) {
      return { success: false, rewards: null, message: 'Objectives not completed' };
    }

    const mission = this.state.currentMission;
    let rewards = { ...mission.rewards };

    // Player decisions influence rewards and reputation
    if (playerDecision === 'aggressive') {
      rewards.reputation += 5;
      rewards.currency += 10;
      this.modifyRelationship(mission.commanderId, -2); // Riskier approach
    } else if (playerDecision === 'diplomatic') {
      rewards.reputation += 3;
      this.modifyRelationship(mission.commanderId, 5);
    } else if (playerDecision === 'cautious') {
      rewards.reputation += 2;
      this.modifyRelationship(mission.commanderId, 2);
    }

    this.state.successfulMissions++;
    this.state.experience += 50;
    this.state.reputation += rewards.reputation;
    this.addServiceDays(2); // Mission takes time
    this.addServiceRecord(`Completed mission: ${mission.title}`, 'mission_complete');
    
    this.state.completedMissions.push(mission.id);
    this.state.currentMission = null;
    
    this.checkRankProgression();
    
    return { success: true, rewards, message: `Mission completed! Received ${rewards.currency} akçe and ${rewards.reputation} reputation.` };
  }

  failMission(): { success: boolean; message: string } {
    if (!this.state.currentMission) {
      return { success: false, message: 'No active mission' };
    }

    const mission = this.state.currentMission;
    this.state.reputation = Math.max(0, this.state.reputation - 5);
    this.modifyRelationship(mission.commanderId, -5);
    this.addServiceRecord(`Failed mission: ${mission.title}`, 'mission_fail');
    this.state.currentMission = null;
    
    return { success: true, message: 'Mission failed. Reputation and standing decreased.' };
  }

  private checkRankProgression(): void {
    const currentIndex = RANK_ORDER.indexOf(this.state.rank);
    if (currentIndex < 0 || currentIndex >= RANK_ORDER.length - 1) return;

    const nextRank = RANK_ORDER[currentIndex + 1];
    if (!nextRank) return;
    const requirements = RANK_REQUIREMENTS.find(r => r.rank === nextRank);
    
    if (!requirements) return;

    if (
      this.state.reputation >= requirements.minReputation &&
      this.state.serviceDays >= requirements.minServiceDays &&
      this.state.enemiesDefeated >= requirements.minEnemiesDefeated &&
      this.state.successfulMissions >= requirements.minSuccessfulMissions &&
      this.state.experience >= (requirements.minExperience ?? 0) &&
      this.state.leadership >= (requirements.minLeadership ?? 0) &&
      this.state.tacticalDecisions >= (requirements.minTacticalDecisions ?? 0)
    ) {
      this.state.rank = nextRank;
      this.addServiceRecord(`Promoted to ${RANK_NAMES[nextRank]}`, 'promotion');
      this.addReputation(10);
    }
  }

  private addServiceRecord(event: string, type: string): void {
    this.state.serviceRecord.push({
      date: new Date().toISOString(),
      event,
      type,
    });
    // Keep last 50 records
    if (this.state.serviceRecord.length > 50) {
      this.state.serviceRecord = this.state.serviceRecord.slice(-50);
    }
  }

  serialize(): MilitaryState {
    return JSON.parse(JSON.stringify({...this.state,battlefield:this.battlefield.getState()}));
  }

  deserialize(data: Partial<MilitaryState> | null | undefined): void {
    if (!data) return;
    
    if (data.rank && RANK_ORDER.includes(data.rank)) this.state.rank = data.rank;
    if (typeof data.leadership === 'number') this.state.leadership=Math.max(0,Math.min(100,data.leadership));
    if (typeof data.experience === 'number' && Number.isFinite(data.experience)) this.state.experience=Math.max(0,Math.floor(data.experience));
    if (typeof data.tacticalExperienceThisBattle === 'number' && Number.isFinite(data.tacticalExperienceThisBattle)) this.state.tacticalExperienceThisBattle=Math.max(0,Math.min(20,Math.floor(data.tacticalExperienceThisBattle)));
    if (typeof data.tacticalDecisions === 'number') this.state.tacticalDecisions=Math.max(0,data.tacticalDecisions);
    if (typeof data.isEnlisted === 'boolean') this.state.isEnlisted=data.isEnlisted;
    if (typeof data.supplyScore === 'number') this.state.supplyScore=Math.max(0,Math.min(100,data.supplyScore));
    if (typeof data.reputation === 'number') this.state.reputation = data.reputation;
    if (typeof data.serviceDays === 'number') this.state.serviceDays = data.serviceDays;
    if (typeof data.enemiesDefeated === 'number') this.state.enemiesDefeated = data.enemiesDefeated;
    if (typeof data.successfulMissions === 'number') this.state.successfulMissions = data.successfulMissions;
    if (data.relationships) this.state.relationships = { ...data.relationships };
    if (Array.isArray(data.completedMissions)) this.state.completedMissions = [...data.completedMissions];
    if (Array.isArray(data.serviceRecord)) this.state.serviceRecord = [...data.serviceRecord];
    this.battlefield.restore(data.battlefield);
    if (data.currentMission) {
      this.state.currentMission = JSON.parse(JSON.stringify(data.currentMission));
    } else {
      this.state.currentMission = null;
    }
  }
}
