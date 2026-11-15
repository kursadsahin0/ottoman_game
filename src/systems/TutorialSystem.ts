export interface TutorialStep {
  id: string;
  title: string;
  story: string;
  objective: string;
  historicalContext?: string;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'arrival', title: 'A new beginning', story: 'You arrive at Kızılca as a new head of household. This opening scene is fictional and introduces your own family.', objective: 'Move a few paces into the settlement with WASD or arrow keys. On touch, drag the left joystick. Mouse users can click menus and visible action prompts.' },
  { id: 'meet', title: 'Meet the settlement', story: 'The villagers have their own work and routines. This resident and the encounter are fictional.', objective: 'Walk near a resident and use E, the action button, or click the nearby interaction prompt.' },
  { id: 'dialogue', title: 'Choose your words', story: 'A conversation can change trust, relationships, and the events remembered by your family.', objective: 'Choose one available dialogue response. Choices that require goods or akçe stay locked until you have them.' },
  { id: 'plant', title: 'Prepare the field', story: 'The household begins with a few plots and seeds. Farming actions consume real inventory and change the saved crop state.', objective: 'The family plots lie northwest of your arrival, around grid 10–12 by 12–14. Walk to a plot until its prompt appears, prepare the soil, then plant wheat or barley using F or the on-screen action.' },
  { id: 'growth', title: 'Let the crop grow', story: 'Crop progress follows the calendar and suitable seasons. Time advances through the day controls.', objective: 'Advance days with T or Gün +1 until this crop is ready to harvest.' },
  { id: 'harvest', title: 'Bring in the harvest', story: 'Harvested grain enters your inventory. The chronicle shows your carried goods and available equipment.', objective: 'Harvest the ready crop. Check the inventory in Defter (J) or use the on-screen journal.' },
  { id: 'military', title: 'A frontier assignment', story: 'Military service is one path through the simulation. Accepting a mission changes your actual service record.', objective: 'Open Defter → Görev and accept an available military assignment.' },
  { id: 'politics', title: 'A consequential choice', story: 'This levy decision is a fictional gameplay scenario. The Historical Baseline in the timeline is kept separate from the choices recorded in your simulated history.', objective: 'Open Political Council (B) and choose whether to accept or refuse the available frontier levy.', historicalContext: 'History and simulation are separate records. The game labels fictional choices as gameplay; consult the timeline’s source-status labels for documented, disputed, and uncertain entries.' },
  { id: 'legacy', title: 'A household beyond one life', story: 'The family tree records relationships and generations. Succession transfers selected property, obligations, and heirlooms when the current character dies; it does not copy their identity.', objective: 'Open the family tree (G), review your household, then make a manual save with Kaydet or Defter → Kayıt → Kaydet.' },
];

export interface TutorialSaveState {
  completedSteps: string[];
  skipped: boolean;
  active: boolean;
}

export class TutorialSystem {
  private completed = new Set<string>();
  private skipped = false;
  private active = false;
  private replayStepId: string | null = null;

  constructor(saved?: Partial<TutorialSaveState> | null, startFirstRun = false) {
    if (saved !== undefined) {
      this.restore(saved);
    } else if (startFirstRun) {
      this.active = true;
    } else {
      // Existing saves from before tutorials should never be forced into one.
      this.skipped = true;
    }
  }

  restore(saved?: Partial<TutorialSaveState> | null): void {
    this.replayStepId = null;
    if (!saved) {
      this.completed.clear(); this.active = false; this.skipped = true;
      return;
    }
    this.completed = new Set((saved.completedSteps ?? []).filter(id => TUTORIAL_STEPS.some(step => step.id === id)));
    this.skipped = saved.skipped === true;
    this.active = saved.active === true && !this.skipped && this.completed.size < TUTORIAL_STEPS.length;
  }

  getCurrentStep(): TutorialStep | null {
    const id = this.replayStepId ?? TUTORIAL_STEPS.find(step => !this.completed.has(step.id))?.id;
    return TUTORIAL_STEPS.find(step => step.id === id) ?? null;
  }

  isActive(): boolean { return this.replayStepId !== null || (this.active && !this.skipped && this.getCurrentStep() !== null); }
  isReplaying(): boolean { return this.replayStepId !== null; }
  getReplayStepId(): string | null { return this.replayStepId; }
  isComplete(stepId: string): boolean { return this.completed.has(stepId); }
  isSkipped(): boolean { return this.skipped; }
  completedCount(): number { return this.completed.size; }
  totalSteps(): number { return TUTORIAL_STEPS.length; }

  completeStep(stepId: string): boolean {
    if (!TUTORIAL_STEPS.some(step => step.id === stepId)) return false;
    if (this.replayStepId) {
      if (this.replayStepId !== stepId) return false;
      this.replayStepId = null;
      return true;
    }
    if (!this.active || this.skipped || this.completed.has(stepId)) return false;
    this.completed.add(stepId);
    if (this.completed.size === TUTORIAL_STEPS.length) this.active = false;
    return true;
  }

  continue(): void {
    if (!this.skipped && this.completed.size < TUTORIAL_STEPS.length) this.active = true;
  }

  skip(): void { this.replayStepId = null; this.active = false; this.skipped = true; }

  replay(stepId: string): boolean {
    if (!TUTORIAL_STEPS.some(step => step.id === stepId)) return false;
    this.replayStepId = stepId;
    return true;
  }

  cancelReplay(): void { this.replayStepId = null; }

  saveState(): TutorialSaveState {
    return { completedSteps: TUTORIAL_STEPS.filter(step => this.completed.has(step.id)).map(step => step.id), skipped: this.skipped, active: this.active && !this.skipped };
  }
}
