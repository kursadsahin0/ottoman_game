import { AUTHORED_QUESTS } from '@data/QuestData';
import { HISTORICAL_EVENTS } from '@data/HistoricalData';
import { ITEM_DEFINITIONS } from '@data/EconomyData';
import { REGIONAL_LOCATIONS } from '@data/RegionalWorldData';
import { QuestSystem, validateQuestDefinitions, type QuestContext } from '@systems/QuestSystem';
import { SaveManager, SAVE_VERSION } from '@systems/SaveManager';
import { Season } from '@systems/TimeManager';

const npcIds=['hasan_farmer','yusuf_merchant','kara_guard','emine_weaver','fatma_villager','ilyas_official','arslan_herder'];
const index={npcs:npcIds,items:Object.keys(ITEM_DEFINITIONS),locations:REGIONAL_LOCATIONS.map(l=>l.id),historicalEvents:HISTORICAL_EVENTS.map(e=>e.id)};
const assert=(ok:boolean,message:string):void=>{if(!ok)throw new Error(`Quest test failed: ${message}`);};
const context=(overrides:Partial<QuestContext>={}):QuestContext=>({year:1299,day:0,generation:1,descendantSupport:0,currency:50,inventory:{hoe:1,seed_wheat:1},relationships:{},factionStanding:{frontier_beyliks:10},locationId:'kizilca_village',knownLocations:index.locations,knownNpcs:index.npcs,knownItems:index.items,knownHistoricalEvents:index.historicalEvents,completedQuestIds:[],worldFlags:[],...overrides});

assert(AUTHORED_QUESTS.length>=10,'at least ten quests are authored');
assert(validateQuestDefinitions(AUTHORED_QUESTS,index).length===0,'catalog has no duplicate IDs, missing text, unresolved follow-ups, or missing dependencies');
assert(AUTHORED_QUESTS.filter(q=>q.branches.length>1).length>=3,'at least three quests have branching solutions');
assert(AUTHORED_QUESTS.filter(q=>q.branches.some(b=>!!b.legacy)).length>=2,'multiple authored quests pass consequences to later generations');
assert(validateQuestDefinitions([...AUTHORED_QUESTS,...[AUTHORED_QUESTS[0]!]],index).some(issue=>issue.includes('Duplicate')),'duplicate quest IDs are diagnosed');
assert(validateQuestDefinitions([...AUTHORED_QUESTS,{...AUTHORED_QUESTS[0]!,id:'quest_missing_dependency',prerequisites:[],followUps:[],dependencies:{npcs:['missing_npc']}}],index).some(issue=>issue.includes('missing_npc')),'missing NPC dependencies are diagnosed');

const missing=new QuestSystem(AUTHORED_QUESTS,{...index,npcs:[]});
assert(missing.getAvailable(context()).every(q=>!q.dependencies.npcs?.length),'missing NPC dependency hides dependent quests');
assert(!missing.activate('frontier_watch',context()).success,'a quest with a missing issuer cannot activate');

const quests=new QuestSystem(AUTHORED_QUESTS,index);
assert(quests.activate('harvest_for_winter',context()).success,'eligible quest activates');
assert(!quests.activate('harvest_for_winter',context()).success,'duplicate activation is rejected');
assert(!quests.resolve('harvest_for_winter','share',context(),()=>true).success,'required objective gates the resolution');
quests.recordEvent('farm.harvest.wheat');
assert(!quests.resolve('harvest_for_winter','share',context(),()=>false).success,'failed cost payment leaves quest active');
assert(quests.resolve('harvest_for_winter','share',context(),()=>true).success,'objective and cost permit a branch outcome');
assert(quests.getRecord('harvest_for_winter')?.status==='completed','resolved quest is completed and persistent');

assert(quests.activate('frontier_watch',context()).success,'military quest activates');
const declined=quests.resolve('frontier_watch','decline',context(),()=>true);
assert(declined.success&&quests.getRecord('frontier_watch')?.status==='failed','declining is a supported failure outcome');

const expiring=new QuestSystem(AUTHORED_QUESTS,index);
assert(expiring.activate('harvest_for_winter',context()).success,'timed quest activates');
assert(expiring.updateDay(context({day:31})).includes('harvest_for_winter'),'deadline failure is detected');
assert(expiring.getRecord('harvest_for_winter')?.status==='failed','deadline moves quest to failed journal');

const dispute=new QuestSystem(AUTHORED_QUESTS,index);
assert(dispute.activate('boundary_dispute',context()).success,'local dispute uses the available officials and parties');
dispute.recordEvent('dispute.heard_both');
const mediated=dispute.resolve('boundary_dispute','mediate',context(),()=>true);
assert(mediated.success&&mediated.landRightsChange===3&&mediated.factionChanges?.frontier_beyliks===2,'mediation changes land access and faction standing');

const dynasty=new QuestSystem(AUTHORED_QUESTS,index);
assert(dynasty.activate('family_council',context()).success,'family quest activates');
dynasty.recordEvent('family.bond');
assert(dynasty.resolve('family_council','share_duty',context(),()=>true).success,'family choice resolves');
const legacy=dynasty.getState().familyLegacy;
assert(legacy.descendantSupport===1&&legacy.familyReputation===5,'family choice affects long-term household legacy');
assert(dynasty.getAvailable(context({generation:2,descendantSupport:legacy.descendantSupport,completedQuestIds:['family_council'],worldFlags:dynasty.getState().flags})).some(q=>q.id==='heir_education'),'later-generation quest unlocks from legacy support');

const save=dynasty.serialize(),restored=new QuestSystem(AUTHORED_QUESTS,index);
restored.deserialize(save);
assert(restored.getState().familyLegacy.descendantSupport===1,'legacy consequences survive quest save/load');
assert(restored.getRecord('family_council')?.branchId==='share_duty','chosen branch survives save/load');
restored.deserialize({...save,records:[...save.records,{...save.records[0]!,id:'missing_quest'},{...save.records[0]!}]});
assert(restored.getState().records.filter(r=>r.id==='family_council').length===1,'save recovery filters unknown and duplicate quest records');

const manager=SaveManager.getInstance();
const payload={time:{day:1,month:3,year:1299,season:Season.SPRING,totalDays:0},inventory:{items:[['hoe',1] as [string,number]],maxSlots:20},economy:{currency:50},farm:{plots:[]},market:{stock:[] as Array<[string,number]>,lastRestockDay:0},playerPosition:{x:16,y:17},quests:{active:[],completed:['family_council'],achievements:[],system:restored.serialize()}};
assert(await manager.saveGame('slot901',payload),'quest state can be written through versioned save manager');
const loaded=await manager.loadSlot('slot901');
assert(loaded.status==='ok'&&loaded.data.quests?.system?.familyLegacy.descendantSupport===1,'quest state is restored from a game save');
assert(SAVE_VERSION==='1.11.0','character appearance and prior systems use the backward-migrated save version');

console.log('Quest catalog, branches, validation, failure states and save/load verified.');
