import { TutorialSystem, TUTORIAL_STEPS } from '@systems/TutorialSystem';

const assert = (ok: boolean, message: string): void => {
  if (!ok) throw new Error(`Tutorial test failed: ${message}`);
};

const fresh = new TutorialSystem(undefined, true);
assert(fresh.isActive() && fresh.getCurrentStep()?.id === 'arrival', 'new character starts at the opening lesson');
assert(fresh.completeStep('arrival'), 'a real movement signal completes the arrival lesson');
assert(fresh.getCurrentStep()?.id === 'meet', 'completed action advances the current lesson');
assert(!fresh.completeStep('not-a-step'), 'unknown progress cannot complete a lesson');

const restoredMidTutorial = new TutorialSystem(fresh.saveState());
assert(restoredMidTutorial.isActive() && restoredMidTutorial.getCurrentStep()?.id === 'meet', 'active lesson and completion history survive save/load');
restoredMidTutorial.skip();
assert(!restoredMidTutorial.isActive() && restoredMidTutorial.isSkipped(), 'tutorial can be skipped');
const skippedSave = new TutorialSystem(restoredMidTutorial.saveState());
assert(!skippedSave.isActive() && skippedSave.isSkipped(), 'skip choice survives save/load');

const oldCampaign = new TutorialSystem(undefined, false);
assert(!oldCampaign.isActive(), 'legacy saves without tutorial state do not force onboarding');

const replay = new TutorialSystem(fresh.saveState());
const campaignSnapshot = JSON.stringify(replay.saveState());
assert(replay.replay('plant') && replay.getCurrentStep()?.id === 'plant', 'help can replay one selected lesson');
assert(replay.completeStep('meet') === false, 'unrelated gameplay cannot finish the selected replay');
assert(replay.completeStep('plant') && replay.isActive() && replay.getCurrentStep()?.id === 'meet', 'actual matching gameplay ends a replay and returns to the campaign lesson');
assert(JSON.stringify(replay.saveState()) === campaignSnapshot, 'replaying does not rewrite campaign tutorial progress');
assert(replay.replay('harvest'), 'a different lesson can be replayed later');
replay.cancelReplay();
assert(replay.getCurrentStep()?.id === 'meet', 'help can leave a replay and return to campaign progress');

const complete = new TutorialSystem(undefined, true);
for (const step of TUTORIAL_STEPS) assert(complete.completeStep(step.id), `actual ${step.id} progress is accepted`);
assert(!complete.isActive() && complete.completedCount() === TUTORIAL_STEPS.length, 'all lessons finish without an explicit screen-open shortcut');
assert(new TutorialSystem(complete.saveState()).completedCount() === TUTORIAL_STEPS.length, 'finished tutorial survives save/load');

console.log('Tutorial progression, skip, replay, and save state verified.');
