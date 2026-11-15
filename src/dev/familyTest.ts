/**
 * Headless verification of the generational family and inheritance system.
 * Run with: npm run test:family
 */
import { FamilySystem } from '@systems/FamilySystem';
import type { GameTime, Season } from '@systems/TimeManager';
import { seasonForMonth } from '@data/FamilyData';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.error(`FAIL  ${label}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function gameTime(year: number, month = 3, day = 1): GameTime {
  const season: Season = seasonForMonth(month);
  return { year, month, day, season, totalDays: (year - 1299) * 360 + (month - 3) * 30 + day };
}

const TEST_CONFIG = {
  birthChancePerYear: 0,
  mortalityMultiplier: 0,
  historicalDeathChance: 0,
  disputeChance: 0,
  inheritanceRule: 'primogeniture' as const,
  traitInheritanceChance: 0.5,
};

section('Founding family');
const family = new FamilySystem({
  seed: 7,
  config: TEST_CONFIG,
  time: gameTime(1300),
  familyName: 'Köprülü',
});
const founder = family.getCurrentCharacter();
check('founder exists', founder !== null);
check('founder generation 1', founder?.generation === 1);
check('founder is playable', founder?.isPlayable === true);
check('founder age matches calendar', founder?.age === 24);
check('family name applied', family.getFamily().name === 'Köprülü');

const spouse = family.createSpouse(founder!.id, gameTime(1300), { age: 22 });
check('spouse created', spouse !== null);
check('founder and spouse linked', founder?.spouseId === spouse?.id && spouse?.spouseId === founder?.id);
check('spouse counted in world population', family.getFamily().worldPopulation === 41);

// Age the parental couple in this historical fixture so the already-grown
// heirs have plausible birth dates while retaining the founder-age check.
founder!.birthDate = { ...founder!.birthDate, year: 1260 };
founder!.age = 40;
spouse!.birthDate = { ...spouse!.birthDate, year: 1262 };
spouse!.age = 38;

section('Children, traits and generations');
founder!.traits = ['brave', 'hardy'];
founder!.skills = { farming: 14, combat: 20, trade: 10, leadership: 16, craftsmanship: 9, diplomacy: 11 };
spouse!.traits = ['generous', 'scholarly'];

const son = family.createChild(spouse!.id, founder!.id, gameTime(1300), {
  firstName: 'Orhan',
  gender: 'male',
  age: 20,
});
check('son created', son !== null);
check('son is generation 2', son?.generation === 2);
check('son has a father and mother', son?.fatherId === founder?.id && son?.motherId === spouse?.id);
check('son appears in parent children list', founder?.childrenIds.includes(son!.id) === true);
check('son has personal history', (son?.personalHistory.length ?? 0) > 0);

const daughter = family.createChild(spouse!.id, founder!.id, gameTime(1300), {
  firstName: 'Fatma',
  gender: 'female',
  age: 17,
});
check('daughter created', daughter !== null);
check('siblings share a parent', daughter?.fatherId === son?.fatherId);
check('siblings have a sibling relationship', son?.relationships.some((rel) => rel.targetId === daughter?.id && rel.type === 'sibling') === true);

const unrelated = new FamilySystem({ seed: 9, config: TEST_CONFIG, time: gameTime(1300) });
const unrelatedFounder = unrelated.getCurrentCharacter()!;
unrelatedFounder.gender = 'male';
const unrelatedSpouse = unrelated.createSpouse(unrelatedFounder.id, gameTime(1300), { age: 25 })!;
unrelatedFounder.birthDate = { ...unrelatedFounder.birthDate, year: 1260 };
unrelatedFounder.age = 40;
unrelatedSpouse.birthDate = { ...unrelatedSpouse.birthDate, year: 1260 };
unrelatedSpouse.age = 40;
unrelatedFounder.traits = ['cautious', 'diplomatic'];
unrelatedSpouse.traits = ['stubborn', 'greedy'];
const inheritedChild = unrelated.createChild(unrelatedSpouse.id, unrelatedFounder.id, gameTime(1300))!;
check(
  'child traits differ from each parent',
  inheritedChild.traits.join(',') !== unrelatedFounder.traits.join(',') &&
    inheritedChild.traits.join(',') !== unrelatedSpouse.traits.join(','),
);
check('child has at least one trait', inheritedChild.traits.length >= 1);

section('Inheritance and property transfer');
founder!.wealth = 250;
founder!.debts = 40;
founder!.equipment = ['hoe', 'sword'];
founder!.landPlots = [0, 1];
founder!.reputation = 60;

const deathEvents = family.killCharacter(founder!.id, 'natural_age', gameTime(1301));
const pending = family.getPendingSuccession();
check('death emits death event', deathEvents.some((event) => event.type === 'death'));
check('death emits succession event', deathEvents.some((event) => event.type === 'succession_required'));
check('succession is pending', pending !== null);
check('two eligible heirs', pending?.inheritance.eligibleHeirIds.length === 2);
check('primogeniture default heir is eldest', pending?.inheritance.primaryHeirId === son?.id);
check('wealth resolved', pending?.inheritance.property.wealth === 250);
check('debts are reduced by inheritance ratio', pending?.inheritance.property.debts === 30);
check('equipment resolved', pending?.inheritance.property.equipment.length === 2);
check('land resolved', pending?.inheritance.property.landPlots.length === 2);
check('family reputation resolved', (pending?.inheritance.property.familyReputation ?? 0) === 30);

const chosen = family.selectSuccessor(son!.id, gameTime(1301));
check('successor selection succeeds', chosen.success);
check('playable character changed', family.getCurrentCharacter()?.id === son?.id);
check('successor inherits wealth', son?.wealth === 250);
check('successor inherits debts', son?.debts === 30);
check('successor inherits equipment', son?.equipment.includes('sword') === true);
check('successor inherits land', son?.landPlots.includes(1) === true);
check('successor reputation increased', (son?.reputation ?? 0) >= 30);
check('deceased estate cleared', founder?.wealth === 0 && founder?.landPlots.length === 0);
check('family survived two generations', family.getLegacy().generationsSurvived === 2);
check('succession recorded in legacy', family.getLegacy().legacy.some((line) => line.includes('yeni reisi')));

section('Third generation');
son!.birthDate = { ...son!.birthDate, year: 1244 };
son!.age = 57;
const heirSpouse = family.createSpouse(son!.id, gameTime(1301), { age: 22 });
check('heir can marry', heirSpouse !== null);
if (heirSpouse) { heirSpouse.birthDate = { ...heirSpouse.birthDate, year: 1244 }; heirSpouse.age = 57; }
const grandchild = family.createChild(heirSpouse!.id, son!.id, gameTime(1302), {
  firstName: 'Murad',
  gender: 'male',
  age: 19,
});
check('grandchild is generation 3', grandchild?.generation === 3);
check('grandchild is a valid heir', grandchild !== null && grandchild.isAlive);

son!.wealth = 400;
son!.equipment = [...(son!.equipment ?? []), 'bow'];
family.killCharacter(son!.id, 'battle', gameTime(1310));
const thirdPending = family.getPendingSuccession();
check('third succession pending', thirdPending !== null);
check('grandchild is sole heir', thirdPending?.inheritance.eligibleHeirIds.length === 1);
const thirdChosen = family.selectSuccessor(grandchild!.id, gameTime(1310));
check('third generation takes over', thirdChosen.success && family.getCurrentCharacter()?.id === grandchild?.id);
check('third generation inherits the estate', grandchild?.wealth === 400);
check('family survived three generations', family.getLegacy().generationsSurvived === 3);

section('Legacy records');
family.recordLandChange(3, 'Üç yeni tarla satın alındı.', 1311);
family.recordLandChange(-1, 'Bir tarla borç karşılığı kaybedildi.', 1312);
family.recordMilitaryAchievement('Sınır akınında yararlılık gösterdi.', 1313);
family.recordImportantChoice('Köy meclisinde vergi indirimi için oy verdi.', 1314);
family.recordHistoricalEvent('Bursa kuşatması', 1315);
family.recordRivalry('family_rival', 30);
family.recordAlliance('family_ally', 55);
check('land acquired tracked', family.getLegacy().landAcquired === 3);
check('land lost tracked', family.getLegacy().landLost === 1);
check('military achievements tracked', family.getLegacy().militaryAchievements === 1);
check('important choices tracked', family.getLegacy().importantChoices.length === 1);
check('historical events tracked', family.getLegacy().historicalEventsInfluenced.length === 1);
check('rivalries tracked', family.getLegacy().rivalries.length === 1);
check('alliances tracked', family.getLegacy().alliances.length === 1);
check('family tree has three generations', family.getFamilyTree().length === 3);

section('Persistence across save and load');
const saved = family.serialize();
const loadedFamily = new FamilySystem({ seed: 7 });
loadedFamily.deserialize(saved);
check('family restored from save', loadedFamily.getMembers().length === family.getMembers().length);
check('current character restored', loadedFamily.getCurrentCharacter()?.id === grandchild?.id);
check('generation count restored', loadedFamily.getLegacy().generationsSurvived === 3);
check('family tree restored', loadedFamily.getFamilyTree().length === 3);
check('death records restored', loadedFamily.getMember(founder!.id)?.isAlive === false);
check('personal history restored', (loadedFamily.getMember(grandchild!.id)?.personalHistory.length ?? 0) > 1);
check('legacy choices restored', loadedFamily.getLegacy().importantChoices.length === 1);
check('land records restored', loadedFamily.getLegacy().landAcquired === 3);
check('inherited equipment restored', loadedFamily.getMember(grandchild!.id)?.equipment.includes('sword') === true);

// A save can be taken while the succession screen is open (e.g. the game is
// closed after a death). The pending decision must survive the round-trip.
const successionSave = new FamilySystem({ seed: 21, config: TEST_CONFIG, time: gameTime(1300) });
const ssFounder = successionSave.getCurrentCharacter()!;
const ssSpouse = successionSave.createSpouse(ssFounder.id, gameTime(1300), { age: 25 })!;
ssFounder.birthDate = { ...ssFounder.birthDate, year: 1260 };
ssFounder.age = 40;
ssSpouse.birthDate = { ...ssSpouse.birthDate, year: 1260 };
ssSpouse.age = 40;
const ssHeir = successionSave.createChild(ssSpouse.id, ssFounder.id, gameTime(1300), {
  firstName: 'Süleyman',
  gender: 'male',
  age: 20,
})!;
successionSave.killCharacter(ssFounder.id, 'natural_age', gameTime(1301));
const restoredPending = new FamilySystem({ seed: 21 });
restoredPending.deserialize(successionSave.serialize());
check(
  'pending succession survives save/load',
  restoredPending.getPendingSuccession()?.deceasedId === ssFounder.id,
);
check(
  'eligible heirs survive save/load',
  restoredPending.getEligibleHeirs().some((heir) => heir.id === ssHeir.id),
);
const postLoadChoice = restoredPending.selectSuccessor(ssHeir.id, gameTime(1301));
check(
  'heir can be chosen after loading a pending succession',
  postLoadChoice.success && restoredPending.getCurrentCharacter()?.id === ssHeir.id,
);

section('Aging and life stages');
const agingFamily = new FamilySystem({
  seed: 12,
  config: { ...TEST_CONFIG, maxWorldPopulation: 200 },
  time: gameTime(1300),
});
const agingFounder = agingFamily.getCurrentCharacter()!;
const agingSpouse = agingFamily.createSpouse(agingFounder.id, gameTime(1300), { age: 25 })!;
const infant = agingFamily.createChild(agingSpouse.id, agingFounder.id, gameTime(1300))!;
check('newborn starts in infant stage', infant.lifeStage === 'infant');
const agingEvents = agingFamily.advanceTime(gameTime(1317));
check('child aged with the calendar', agingFamily.getMember(infant.id)?.age === 17);
check('life stage advanced to adult', agingFamily.getMember(infant.id)?.lifeStage === 'adult');
check('coming of age event emitted', agingEvents.some((event) => event.type === 'coming_of_age'));

section('Retirement, dispute and family integrity');
const retirementFamily = new FamilySystem({ seed: 81, config: TEST_CONFIG, time: gameTime(1300) });
const retiringHead = retirementFamily.getCurrentCharacter()!;
retiringHead.gender = 'male';
const retiringSpouse = retirementFamily.createSpouse(retiringHead.id, gameTime(1300), { age: 22 })!;
retiringHead.birthDate = { ...retiringHead.birthDate, year: 1260 }; retiringHead.age = 40;
retiringSpouse.birthDate = { ...retiringSpouse.birthDate, year: 1262 }; retiringSpouse.age = 38;
const retirementHeir = retirementFamily.createChild(retiringSpouse.id, retiringHead.id, gameTime(1300), { age: 20, gender: 'male' })!;
const retirementRival = retirementFamily.createChild(retiringSpouse.id, retiringHead.id, gameTime(1300), { age: 18, gender: 'female' })!;
retiringHead.wealth = 100;
const retirementEvents = retirementFamily.retireCharacter(retiringHead.id, gameTime(1300));
check('retirement opens succession without killing the former head', retirementEvents.some(event => event.type === 'succession_required') && retiringHead.isAlive && !!retiringHead.retirementDate);
check('retirement reason is saved', retirementFamily.serialize().pendingSuccession?.reason === 'retirement');
check('eligible sibling can challenge succession', retirementFamily.contestSuccession(retirementRival.id, 1300, 'Ablamın da hak iddiası var.') && retirementFamily.getPendingSuccession()?.contestedBy?.includes(retirementRival.id) === true);
const retiredOutcome = retirementFamily.selectSuccessor(retirementHeir.id, gameTime(1300));
check('challenged heir inherits the remaining estate', retiredOutcome.success && retirementHeir.wealth === 90);
check('succession challenge creates a persistent family rivalry', retirementHeir.relationships.some(link => link.targetId === retirementRival.id && link.type === 'rival'));
const retirementReload = new FamilySystem({ seed: 82 });
retirementReload.deserialize(retirementFamily.serialize());
check('retirement date and individual appearance survive save/load', retirementReload.getMember(retiringHead.id)?.retirementDate?.year === 1300 && retirementReload.getMember(retirementHeir.id)?.appearance === retirementHeir.appearance);
const invalidChild = retirementFamily.createChild(retiringSpouse.id, retiringSpouse.id, gameTime(1300));
check('same person cannot be both parents', invalidChild === null);
const malformed = retirementFamily.serialize();
malformed.family.members.push({ ...malformed.family.members[0]!, id: malformed.family.members[1]!.id });
malformed.family.members[0]!.spouseId = 'missing_member';
const repaired = new FamilySystem({ seed: 83 }); repaired.deserialize(malformed);
check('duplicate identities and dangling spouse links are repaired on load', repaired.getMembers().length === retirementFamily.getMembers().length && repaired.getMember(retiringHead.id)?.spouseId !== 'missing_member');

section('Natural death from old age');
const mortalFamily = new FamilySystem({
  seed: 3,
  config: { ...TEST_CONFIG, mortalityMultiplier: 100 },
  time: gameTime(1300),
});
const mortalFounder = mortalFamily.createFounder(gameTime(1300), { age: 60 });
mortalFamily.advanceTime(gameTime(1320));
check('founder died within twenty years', mortalFamily.getMember(mortalFounder.id)?.isAlive === false);
check('natural cause recorded', mortalFamily.getMember(mortalFounder.id)?.causeOfDeath === 'natural_age');
check('game over flagged when no heir', mortalFamily.getPendingSuccession()?.inheritance.gameOver === true);

section('No silent heir generation');
const restartFamily = new FamilySystem({ seed: 21, config: TEST_CONFIG, time: gameTime(1300) });
const doomedFounder = restartFamily.getCurrentCharacter()!;
restartFamily.killCharacter(doomedFounder.id, 'illness', gameTime(1301));
check('empty family reports game over', restartFamily.getPendingSuccession()?.inheritance.gameOver === true);
check('no invented heir', restartFamily.getMembers().length === 1);
const newFounder = restartFamily.startNewFamily(gameTime(1302), 'Yeni Aile');
check('explicit restart creates a founder', newFounder.id !== doomedFounder.id);
check('restart family starts at generation 1', newFounder.generation === 1 && restartFamily.getLegacy().generationsSurvived === 1);
check('restart clears pending succession', restartFamily.getPendingSuccession() === null);

section('Population caps');
const cappedFamily = new FamilySystem({
  seed: 33,
  config: { ...TEST_CONFIG, maxFamilyMembers: 2, maxWorldPopulation: 40 },
  time: gameTime(1300),
});
const cappedFounder = cappedFamily.getCurrentCharacter()!;
const cappedSpouse = cappedFamily.createSpouse(cappedFounder.id, gameTime(1300), { age: 24 });
check('population cap blocks extra spouse', cappedSpouse === null);
cappedFamily.getConfig();
const secondCappedSpouse = cappedFamily.createSpouse(cappedFounder.id, gameTime(1300), { age: 24 });
check('spouse still blocked at cap', secondCappedSpouse === null);

section('Five-generation legacy acceptance');
const dynasty = new FamilySystem({
  seed: 405,
  config: { ...TEST_CONFIG, landInheritanceRule: 'shared' },
  time: gameTime(1400),
  familyName: 'Test Hanesi',
});
let ruler = dynasty.getCurrentCharacter()!;
ruler.gender = 'male';
ruler.equipment = ['ancestor_sword'];
ruler.landPlots = ['orchard'];
ruler.reputation = 45;
check('founder designates an owned heirloom', dynasty.designateHeirloom('ancestor_sword', 'Hudut hizmetinin hatırası', 1400, { kind: 'social_prestige', magnitude: 0 }));
dynasty.recordImportantChoice('Sınır beyliğiyle ittifak yemini edildi.', 1400);
dynasty.recordAlliance('frontier_beylik', 35, 1400);
dynasty.recordMilitaryAchievement('Sefer hizmeti karşılığında meyve bahçesi kullanım hakkı kazandı.', 1401);
dynasty.recordLandChange(1, 'Sefer hizmeti karşılığında orchard kullanım hakkı kazanıldı.', 1401);
let finalHeirId = ruler.id;
for (let generation = 2; generation <= 5; generation++) {
  const year = 1400 + (generation - 2) * 20;
  dynasty.advanceTime(gameTime(year));
  const spouseForRuler = (ruler.spouseId ? dynasty.getMember(ruler.spouseId) : null)
    ?? dynasty.createSpouse(ruler.id, gameTime(year), { age: 24 });
  ruler.birthDate = { ...ruler.birthDate, year: year - 40 };
  ruler.age = 40;
  if (spouseForRuler) {
    spouseForRuler.birthDate = { ...spouseForRuler.birthDate, year: year - 38 };
    spouseForRuler.age = 38;
  }
  const child = spouseForRuler && dynasty.createChild(spouseForRuler.id, ruler.id, gameTime(year), {
    firstName: `Heir${generation}`,
    gender: 'male',
    age: 20,
  });
  check(`generation ${generation} heir exists`, child !== null && child.generation === generation);
  if (!child) break;
  finalHeirId = child.id;
  dynasty.killCharacter(ruler.id, 'natural_age', gameTime(year + 1));
  const succession = dynasty.selectSuccessor(child.id, gameTime(year + 1));
  check(`generation ${generation} succession completes`, succession.success);
  ruler = child;
}
const dynastyRecords = dynasty.getLegacyRecords();
check('five generations reached', dynasty.getLegacy().generationsSurvived === 5);
check('land provenance remains readable', dynastyRecords.some(record => record.kind === 'land_acquired' && record.description.toLocaleLowerCase('tr').includes('sefer hizmeti')));
check('military service event remains recorded', dynastyRecords.some(record => record.kind === 'military' && record.description.includes('Sefer hizmeti')));
check('political decision remains recorded', dynastyRecords.some(record => record.kind === 'political' && record.description.includes('ittifak yemini')));
check('heirloom transfers through generations', dynasty.getLegacy().heirlooms[0]?.currentHolderId === finalHeirId && (dynasty.getLegacy().heirlooms[0]?.transfers ?? 0) >= 3);
check('generation snapshots preserve succession history', dynasty.getGenerationSnapshots().length === 4);
const dynastySave = dynasty.serialize();
const dynastyReloaded = new FamilySystem({ seed: 405 });
dynastyReloaded.deserialize(dynastySave);
check('five-generation succession history survives save/load', dynastyReloaded.getGenerationSnapshots().length === 4);
check('historical decisions survive save/load', dynastyReloaded.getLegacy().importantChoices.some(choice => choice.includes('ittifak yemini')));
check('land and military records survive save/load', dynastyReloaded.getLegacyRecords().some(record => record.kind === 'land_acquired') && dynastyReloaded.getLegacyRecords().some(record => record.kind === 'military'));
check('heirloom holder and transfer history survive save/load', dynastyReloaded.getLegacy().heirlooms[0]?.currentHolderId === finalHeirId && dynastyReloaded.getLegacy().heirlooms[0]?.transfers === dynasty.getLegacy().heirlooms[0]?.transfers);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
