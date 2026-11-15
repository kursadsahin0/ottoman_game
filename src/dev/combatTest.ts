/**
 * Headless verification of combat/military loop.
 */
import { CombatSystem } from '@systems/CombatSystem';
import { AIStateMachine, AIState } from '@systems/AIStateMachine';
import { MilitarySystem } from '@systems/MilitarySystem';
import { EquipmentSystem } from '@systems/EquipmentSystem';
import { WeaponType, ArmorType } from '@data/CombatData';
import { MilitaryRank } from '@data/MilitaryData';

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

const combat = new CombatSystem();
const ai = new AIStateMachine();
const military = new MilitarySystem();
const equipment = new EquipmentSystem();

section('Equipment');
check('starts with dagger', equipment.getEquipment().weapon === WeaponType.MELEE_DAGGER);
check('can equip sword', equipment.equipWeapon(WeaponType.MELEE_SWORD).success);
check('sword equipped', equipment.getEquipment().weapon === WeaponType.MELEE_SWORD);
check('bow remains unavailable before its configured period', !equipment.equipWeapon(WeaponType.BOW,1298).success);
check('period-appropriate bow enables ranged battlefield use', equipment.equipWeapon(WeaponType.BOW,1299).success&&equipment.getWeaponStats().range>4);

section('Combat system');
const player = combat.createPlayerCombatant(WeaponType.MELEE_SWORD, ArmorType.LEATHER);
const enemy = combat.createEnemyCombatant(30, 10, 2, 1.5);
check('player has health', player.health === 100 && player.alive);
check('enemy created', enemy.health === 30);

const attackResult = combat.performAttack(player, enemy, WeaponType.MELEE_SWORD, Date.now(), 0);
check('attack can hit', attackResult.result.hit);
check('enemy takes damage', enemy.health < 30);

section('Attack cooldown');
const cooldownResult = combat.performAttack(player, enemy, WeaponType.MELEE_SWORD, Date.now(), Date.now());
check('attack on cooldown blocked', !cooldownResult.result.hit);

section('Stamina');
player.stamina = 5;
const noStamResult = combat.performAttack(player, enemy, WeaponType.MELEE_SWORD, Date.now(), 0);
check('cannot attack without stamina', !noStamResult.result.hit);

section('Enemy defeat');
const killPlayer = combat.createPlayerCombatant(WeaponType.MELEE_SWORD, ArmorType.LEATHER);
const weakEnemy2 = combat.createEnemyCombatant(5, 5, 0, 1.0);
const killResult2 = combat.performAttack(killPlayer, weakEnemy2, WeaponType.MELEE_SWORD, Date.now() + 20000, 0);
check('can kill enemy', killResult2.result.killed === true);
check('enemy defeated state', weakEnemy2.alive === false);

section('AI state machine');
void ai.update(100, { x: 0, y: 0 }, { x: 5, y: 0 }, 1.0, false, []);
check('AI starts in idle/patrol', ai.getState() === AIState.IDLE || ai.getState() === AIState.PATROL);

const detectionResult = ai.update(3000, { x: 0, y: 0 }, { x: 2, y: 0 }, 1.0, true, []);
check('AI can detect player', detectionResult.action !== 'idle');

section('Military progression');
check('starts as recruit', military.getRank() === MilitaryRank.RECRUIT);
check('starts with reputation 0', military.getReputation() === 0);

military.recordEnemyDefeated();
military.recordEnemyDefeated();
check('enemies defeated tracked', military.getState().enemiesDefeated === 2);

section('Mission system');
const missions = military.getAvailableMissions();
check('has available missions', missions.length > 0);

const acceptResult = military.acceptMission('mission_frontier_skirmish');
check('can accept mission', acceptResult.success);
check('has active mission', military.getState().currentMission !== null);

military.updateMissionObjective('defeat_raiders', 2);
military.updateMissionObjective('survive', 1);
const completion = military.checkMissionCompletion();
check('mission objectives completable', completion.completed);

const completeResult = military.completeMission('cautious');
check('can complete mission', completeResult.success);
check('rewards received', completeResult.rewards.currency > 0);
check('reputation increased', military.getReputation() > 0);

section('Save/load');
const militaryState = military.serialize();
const military2 = new MilitarySystem();
military2.deserialize(JSON.parse(JSON.stringify(militaryState)));
check('military state survives save/load', military2.getReputation() === military.getReputation());
check('completed missions saved', military2.getState().completedMissions.length === 1);

section('Death state');
const dyingPlayer = combat.createPlayerCombatant(WeaponType.MELEE_DAGGER, ArmorType.NONE);
void combat.applyDamage(dyingPlayer, 200);
check('player can die', !dyingPlayer.alive);
check('death state marked', dyingPlayer.health === 0);
check('three days of rest can recover a non-graphic injury', combat.recoverHealth(dyingPlayer, 30) === 30 && dyingPlayer.health === 30 && dyingPlayer.alive);
check('recovery cannot exceed maximum health', combat.recoverHealth(dyingPlayer, 500) === 70 && dyingPlayer.health === dyingPlayer.maxHealth);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
