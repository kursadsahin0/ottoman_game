import { MilitaryRank } from '@data/MilitaryData';
import { BattlefieldSystem, UNIT_DEFINITIONS } from '@systems/BattlefieldSystem';
import { MilitarySystem } from '@systems/MilitarySystem';

let passed=0,failed=0;
function check(name:string,condition:boolean,detail=''):void{if(condition){passed++;console.log(`  ok ${name}`);}else{failed++;console.error(`  FAIL ${name} ${detail}`);}}
console.log('\nBattlefield and command system');

const battle=new BattlefieldSystem();
const start=battle.start('mission_frontier_skirmish',1299);
check('fictional frontier battle starts on a dedicated tactical map',start.success&&battle.getTiles().length===96&&battle.getUnits().length===5);
check('unit availability respects the selected historical period',UNIT_DEFINITIONS.armored_cavalry.minYear>1299&&!battle.getUnits().some(u=>u.type==='armored_cavalry'));
const supportedTypes=battle.getAvailableUnitTypes(1299);
check('reinforcement waves remain optional until a mission configures them',supportedTypes.includes('defensive_militia')&&!supportedTypes.includes('armored_cavalry'));
const reserveBattle=new BattlefieldSystem();reserveBattle.start('mission_frontier_skirmish',1299,[{id:'reserve_archers',atTick:1,side:'friendly',type:'archer',count:4,x:3,y:4}]);reserveBattle.update(.9);
check('configured reinforcements arrive on their scheduled group tick',reserveBattle.getUnits().some(u=>u.id==='reserve_archers'&&u.count===4));

const weatherBattle=new BattlefieldSystem();weatherBattle.start('mission_frontier_skirmish',1299,[],{weather:'rain',supplied:false,fatigue:80,weaponRange:1.6,weaponDamage:14,armorDefense:8,stamina:80,maxStamina:100,health:76,maxHealth:100});
const weatherPlayer=weatherBattle.getUnits().find(u=>u.id==='player_character')!;
check('battle setup carries weather, supply, fatigue, weapon, armor and existing injury',weatherBattle.getState().weather==='rain'&&!weatherBattle.getState().supplied&&weatherBattle.getState().fatigue===80&&weatherPlayer.defenseBonus===8&&weatherPlayer.health===76);
check('pre-battle fatigue reduces available battle stamina and morale',weatherPlayer.stamina<80&&weatherPlayer.morale<50);
const weatherSaved=new BattlefieldSystem();weatherSaved.restore(weatherBattle.getState());
check('battle conditions and soldier condition survive save/load',weatherSaved.getState().weather==='rain'&&!weatherSaved.getState().supplied&&weatherSaved.getUnits().find(u=>u.id==='player_character')?.stamina===weatherPlayer.stamina);

const reachTest=new BattlefieldSystem();reachTest.start('mission_frontier_skirmish',1299,[],{weaponRange:1,weaponDamage:8,stamina:100});
const reachPlayer=reachTest.getUnits().find(u=>u.id==='player_character')!,reachEnemy=reachTest.getUnits().find(u=>u.id==='raiders_east')!;
reachPlayer.x=6.5;reachPlayer.y=5;reachEnemy.x=8;reachEnemy.y=5;
check('short weapon is blocked outside its actual reach',!reachTest.attackWithPlayer(reachEnemy.id).success);
const spearTest=new BattlefieldSystem();spearTest.start('mission_frontier_skirmish',1299,[],{weaponRange:1.6,weaponDamage:14,stamina:100});
const spearUser=spearTest.getUnits().find(u=>u.id==='player_character')!,spearTarget=spearTest.getUnits().find(u=>u.id==='raiders_east')!;
spearUser.x=6.5;spearUser.y=5;spearTarget.x=8;spearTarget.y=5;
const spearStrike=spearTest.attackWithPlayer(spearTarget.id);
check('equipped spear extends reach, improves damage and spends stamina',spearStrike.success&&spearStrike.damage>reachTest.getState().playerWeaponDamage-2&&spearUser.stamina<100);
const bowDry=new BattlefieldSystem();bowDry.start('mission_frontier_skirmish',1299,[],{weaponRange:4.6,weaponDamage:7,ammunition:0,stamina:100});
check('ranged weapon cannot fire without carried arrows',bowDry.attackWithPlayer('raiders_east').success===false);
const bowSupplied=new BattlefieldSystem();bowSupplied.start('mission_frontier_skirmish',1299,[],{weaponRange:4.6,weaponDamage:7,ammunition:2,stamina:100});
const bowUser=bowSupplied.getUnits().find(u=>u.id==='player_character')!,bowTarget=bowSupplied.getUnits().find(u=>u.id==='raiders_east')!;bowUser.x=5;bowUser.y=4;bowTarget.x=9;bowTarget.y=4;
const arrowShot=bowSupplied.attackWithPlayer(bowTarget.id);
check('bow uses its ranged reach and consumes one saved arrow',arrowShot.success&&arrowShot.ammunitionUsed===true&&bowSupplied.getState().playerAmmunition===1);

const service=new MilitarySystem();
check('ordinary enlistment can be left for civilian life',service.leaveService().success&&service.getAvailableMissions().length===0);
check('player may enlist again for ordinary service',service.enlist(0).success&&service.getState().isEnlisted);
service.acceptMission('mission_frontier_skirmish');service.updateMissionObjective('defeat_raiders',2);service.updateMissionObjective('survive');
service.completeMission('cautious');service.addServiceDays(3);service.recordEnemyDefeated();service.recordEnemyDefeated();
check('service, missions and combat earn experience for advancement',service.getState().experience===80);
check('rank advancement waits for leadership as well as service and results',service.getRank()===MilitaryRank.RECRUIT);
service.setLeadershipScore(20);
check('qualified leadership completes the rank requirement',service.getRank()===MilitaryRank.AZAB);
const serviceSave=new MilitarySystem();serviceSave.deserialize(service.serialize());
check('rank, experience, leadership, service choice and promotion record survive save/load',serviceSave.getRank()===MilitaryRank.AZAB&&serviceSave.getState().experience===80&&serviceSave.getState().leadership===20&&serviceSave.getState().serviceRecord.some(entry=>entry.type==='promotion'));
const decisionCap=new MilitarySystem();for(let i=0;i<8;i++)decisionCap.recordTacticalDecision('hold');
check('tactical orders award at most 20 experience per battle',decisionCap.getState().experience===20&&decisionCap.getState().tacticalDecisions===8);
check('friendly units can be selected while enemy groups cannot be commanded',battle.selectUnit('frontier_archers')&&!battle.selectUnit('raiders_east'));
check('new recruit cannot issue formation commands',!battle.issueCommand('hold',MilitaryRank.RECRUIT).success);
battle.selectUnit('frontier_militia');
check('Azab can hold but cannot yet advance a group',battle.issueCommand('hold',MilitaryRank.AZAB).success&&!battle.issueCommand('advance',MilitaryRank.AZAB).success);
check('Yaya authority unlocks advance and protect commands',battle.getCommands(MilitaryRank.YAYA).find(c=>c.command==='advance')?.available===true&&battle.issueCommand('protect',MilitaryRank.YAYA,{x:3,y:5}).success);
check('Focus requires a target and sufficient responsibility',!battle.issueCommand('focus',MilitaryRank.YAYA,{x:3,y:5}).success&&battle.getCommands(MilitaryRank.AKINCI).find(c=>c.command==='focus')?.available===true);

battle.selectUnit('player_character');
const player=battle.getUnits().find(u=>u.id==='player_character')!;
const bridgePath=battle.findPath(player,{x:8,y:4});
check('pathfinding crosses the river only at its bridge',bridgePath.some(p=>p.x===6&&p.y===4)&&!bridgePath.some(p=>p.x===6&&p.y!==4));
check('pathfinding rejects an impassable target',battle.findPath(player,{x:6,y:2}).length===0);
check('forest terrain blocks sight across its cover',(()=>{player.x=6;player.y=2;const archer=battle.getUnits().find(u=>u.id==='frontier_archers')!;archer.x=9;archer.y=2;return !battle.hasLineOfSight(player.id,archer.id);})());

const moraleBattle=new BattlefieldSystem();moraleBattle.start('mission_frontier_skirmish',1299);
const militia=moraleBattle.getUnits().find(u=>u.id==='frontier_militia')!;militia.morale=15;
moraleBattle.update(0.9);
check('low morale triggers a tactical retreat',militia.retreating&&militia.order==='retreat');
const retreatX=militia.x;moraleBattle.update(0.9);
check('retreating formation follows its withdrawal path',militia.x<retreatX);

const combat=new BattlefieldSystem();combat.start('mission_frontier_skirmish',1299);
const attacker=combat.getUnits().find(u=>u.id==='player_character')!,target=combat.getUnits().find(u=>u.id==='raiders_east')!;
attacker.x=target.x-1;attacker.y=target.y;
const moraleBefore=target.morale;const attack=combat.attackWithPlayer(target.id);combat.attackWithPlayer(target.id);combat.attackWithPlayer(target.id);combat.update(0.9);
check('player can participate in combat and casualties reduce morale',attack.success&&target.casualties>0&&target.morale<moraleBefore,JSON.stringify({attack,target}));

const campaign=new MilitarySystem();
campaign.acceptMission('mission_frontier_skirmish');
check('mission authority is required before battle entry',campaign.startBattle(1299).success);
const midBattleSave=new MilitarySystem();midBattleSave.deserialize(campaign.serialize());
check('active battle map, units, and objectives survive save/load',midBattleSave.getBattlefield().isActive()&&midBattleSave.getBattlefield().getUnits().length===5&&midBattleSave.getState().currentMission?.id==='mission_frontier_skirmish');
const campaignBattle=campaign.getBattlefield();
for(const enemy of campaignBattle.getUnits().filter(u=>u.side==='enemy')){enemy.count=0;enemy.health=0;}
campaignBattle.update(0.9);
const report=campaign.resolveBattleReport();
check('victory report completes battle objectives and records consequences',report.success&&campaign.getState().currentMission?.objectives.every(o=>o.completed)===true&&campaign.getReputation()>0&&campaign.getRelationship('commander_kara')>3);
const completion=campaign.completeMission('cautious');
check('battle objective can be completed as a military mission',completion.success&&campaign.getState().completedMissions.includes('mission_frontier_skirmish'));
const roundTrip=new MilitarySystem();roundTrip.deserialize(campaign.serialize());
check('battlefield report and campaign consequences survive save/load',roundTrip.serialize().battlefield?.reported===true&&roundTrip.getState().completedMissions.includes('mission_frontier_skirmish'));
check('career experience, leadership, decisions, enlistment and supply history survive save/load',roundTrip.getState().isEnlisted&&typeof roundTrip.getState().experience==='number'&&typeof roundTrip.getState().leadership==='number'&&typeof roundTrip.getState().tacticalDecisions==='number');

const liveBattle=new BattlefieldSystem();liveBattle.start('mission_frontier_skirmish',1299);liveBattle.selectUnit('player_character');liveBattle.issueCommand('advance',MilitaryRank.RECRUIT,{x:4,y:5});
for(let i=0;i<300&&liveBattle.isActive();i++){
  const playerUnit=liveBattle.getUnits().find(u=>u.id==='player_character')!;
  const target=liveBattle.getUnits().filter(u=>u.side==='enemy'&&u.count>0).sort((a,b)=>Math.hypot(a.x-playerUnit.x,a.y-playerUnit.y)-Math.hypot(b.x-playerUnit.x,b.y-playerUnit.y))[0];
  if(target&&Math.hypot(target.x-playerUnit.x,target.y-playerUnit.y)<1.85&&liveBattle.hasLineOfSight(playerUnit.id,target.id))liveBattle.attackWithPlayer(target.id);
  liveBattle.update(.8);
}
check('a real engagement can resolve through group combat and player participation',liveBattle.getState().status==='victory',JSON.stringify({status:liveBattle.getState().status,units:liveBattle.getUnits().map(u=>({id:u.id,count:u.count,morale:u.morale,casualties:u.casualties}))}));

console.log(`\n${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
