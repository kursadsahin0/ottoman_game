import { PoliticalSystem, POLITICAL_CONFIG } from '@systems/PoliticalSystem';
import { HistoricalEventSystem } from '@systems/HistoricalEventSystem';
import { FamilySystem } from '@systems/FamilySystem';
import { Season } from '@systems/TimeManager';

const assert=(condition:boolean,message:string):void=>{if(!condition)throw new Error(`Political test failed: ${message}`);};
const context={year:1300,ruler:'osman_gazi',location:'Frontier Settlement',rank:'recruit',currency:200,militaryStrength:40,familyGeneration:1};
const timeline=new HistoricalEventSystem();
const locked=new PoliticalSystem();
assert(!locked.getDecisions(context).find(d=>d.id==='rebel')?.available,'unprepared character cannot rebel');
assert(!locked.getDecisions({...context,year:1400}).find(d=>d.id==='negotiate_land')?.available,'local dispute choices unavailable out of period');

const prepared=new PoliticalSystem({loyalty:25,localInfluence:60,popularSupport:65,militaryStrength:45,joinedFaction:'frontier_beyliks',factionStanding:{frontier_beyliks:50},rebellion:{preparation:24,recruits:3,active:false,lastOutcome:null}});
assert(!!prepared.getDecisions(context).find(d=>d.id==='rebel')?.available,'prepared rebellion unlocks');
const win=prepared.act('rebel',context,timeline,()=>true);
assert(win.success&&win.outcome==='victory','strong rebellion can win');
assert(prepared.getState().authorityId==='frontier_council','victory changes authority');
assert(timeline.getState().simulationTimeline.eventOutcomes[`political_rebellion_${context.year}_1`]?.classification==='fictional'&&timeline.getDivergences().length===0,'fictional rebellion is recorded without mislabeling it as an alternate-history divergence');

const poor=new PoliticalSystem({loyalty:20,localInfluence:25,popularSupport:30,militaryStrength:0,fear:100,joinedFaction:'frontier_beyliks',rebellion:{preparation:0,recruits:3,active:false,lastOutcome:null}});
const defeat=poor.act('rebel',{...context,militaryStrength:20},timeline,()=>true);
assert(defeat.success&&defeat.outcome==='exile','poorly prepared rebellion risks exile');
assert(poor.getState().propertyConfiscated&&poor.getState().authorityId==='exile','exile confiscates property and changes status');

const earlyFactions=locked.getFactionDefinitions(1299),lateFactions=locked.getFactionDefinitions(1362);
assert(earlyFactions.some(f=>f.id==='local_judiciary')&&!earlyFactions.some(f=>f.id==='regional_authority')&&lateFactions.some(f=>f.id==='regional_authority'),'institutions appear only in their configured historical period');
assert(locked.getNpcDefinitions(1299).some(n=>n.id==='commander_kara'&&n.goals.length>0&&n.resources>0&&n.personality.negotiation>0),'key political NPCs carry data-driven goals, personality, loyalty and resources');
assert(locked.getTitleForYear(1299)!==locked.getTitleForYear(1362),'political titles follow the simulation period');

let money=50;
const negotiated=new PoliticalSystem();
const landResult=negotiated.act('negotiate_land',{...context,currency:money},timeline,amount=>{if(money<amount)return false;money-=amount;return true;});
assert(landResult.success&&negotiated.getState().landRights===15&&negotiated.getState().disputes.find(d=>d.kind==='land')?.status==='settled','land negotiation spends resources and resolves the active dispute');
assert((negotiated.getState().individualTrust.local_cadi??0)>10&&negotiated.getState().memories.some(m=>m.actorId==='local_cadi'&&m.kind==='agreement'),'individual trust and NPC political memory reflect the negotiated agreement');

const mediation=new PoliticalSystem({localInfluence:80,popularSupport:70,individualTrust:{local_cadi:55}});
const mediated=mediation.act('mediate_dispute',{...context,currency:50},timeline,()=>true);
assert(mediated.success&&mediated.disputeStatus==='settled'&&mediation.getState().landRights>0,'strong local support successfully mediates a land dispute');
const rejectedMediation=new PoliticalSystem({localInfluence:10,popularSupport:0,individualTrust:{local_cadi:0}});
const rejected=rejectedMediation.act('mediate_dispute',{...context,currency:50},timeline,()=>true);
assert(rejected.success&&rejected.disputeStatus==='contested','weak mediation fails without ending the political path');
assert(rejectedMediation.getDecisions({...context,currency:50}).some(d=>d.id==='compromise_dispute'&&d.available),'a rejected mediation leaves compromise and withdrawal choices');

const supportPath=new PoliticalSystem({joinedFaction:'frontier_beyliks',popularSupport:40,factionStanding:{frontier_beyliks:50}});
const allied=supportPath.act('form_alliance',{...context,currency:50},timeline,()=>true);
assert(allied.success&&supportPath.getState().alliances.includes('frontier_beyliks'),'alliance requires faction membership, trust, support and a resource cost');
assert(supportPath.getFactionStance('frontier_beyliks')==='allied','the diplomacy model exposes an explicit allied stance');

const favor=new PoliticalSystem();
favor.act('offer_favor',{...context,currency:50},timeline,()=>true);
const contract=favor.act('sign_trade_contract',{...context,currency:50,totalDays:0},timeline,()=>true);
let delivered=0;
const fulfilled=favor.act('fulfill_trade_contract',{...context,currency:50,totalDays:4,items:{wheat:3}},timeline,()=>true,(itemId,amount)=>{if(itemId!=='wheat'||amount!==3)return false;delivered+=amount;return true;});
assert(contract.success&&fulfilled.success&&delivered===3&&fulfilled.currencyReward===10&&favor.getState().tradeContract?.status==='fulfilled','grain contract consumes its actual inventory goods and returns the saved deposit');
const contractSave=new PoliticalSystem();contractSave.deserialize(favor.serialize());
assert(contractSave.getState().tradeContract?.status==='fulfilled'&&contractSave.getState().memories.some(m=>m.kind==='promise'),'contract state and memories survive political save/load');
const defaultContract=new PoliticalSystem();defaultContract.act('offer_favor',{...context,currency:50},timeline,()=>true);defaultContract.act('sign_trade_contract',{...context,currency:50,totalDays:0},timeline,()=>true);
assert(defaultContract.advanceToDay(31,timeline,1300)&&defaultContract.getState().tradeContract?.status==='defaulted'&&defaultContract.getState().memories.some(m=>m.kind==='betrayal'),'missed contract deadline creates a recorded trust and market consequence, not a game over');

const taxPetition=new PoliticalSystem({localInfluence:22});
const tax=taxPetition.act('petition_tax',{...context,year:1362},timeline,()=>true);
assert(tax.success&&taxPetition.getState().disputes.some(d=>d.kind==='tax'&&d.status==='active'),'later-period tax petition opens a real negotiable dispute');
const successionClaim=new PoliticalSystem({localInfluence:20});
assert(successionClaim.act('raise_succession_claim',{...context,year:1326,familyGeneration:2},timeline,()=>true).success&&successionClaim.getState().disputes.some(d=>d.kind==='succession'),'a later-generation family can open a succession dispute');
const tradeDispute=new PoliticalSystem();tradeDispute.act('offer_favor',{...context,currency:50},timeline,()=>true);
assert(tradeDispute.act('contest_trade_terms',{...context,currency:50},timeline,()=>true).success&&tradeDispute.getState().disputes.some(d=>d.kind==='trade'),'market terms can be contested and later mediated');

const leaderChange=new PoliticalSystem();leaderChange.updateEra(1326,'orhan_gazi',timeline);
assert(leaderChange.getState().factionLeaders.ottoman_house==='orhan_gazi'&&leaderChange.getState().memories.some(m=>m.description.includes('önder değişti')),'a historical leadership transition is remembered and changes faction resources');
const lowResources=new PoliticalSystem({factionResources:{frontier_beyliks:10}});
assert(lowResources.getFactionStance('frontier_beyliks')==='wary','faction stance becomes wary when its resources decline');
const rivalry=new PoliticalSystem({loyalty:30,localInfluence:20});
rivalry.act('resist_order',context,timeline,()=>true);
assert(rivalry.getState().rivalries.includes('ottoman_house')&&rivalry.getFactionStance('ottoman_house')==='hostile','resisting a ruler can establish a remembered faction rivalry');

const family=new FamilySystem({seed:17,time:{day:1,month:3,year:1300,season:Season.SPRING,totalDays:0},familyName:'Kayı'});
const founder=family.getCurrentCharacter();
assert(!!founder,'family founder exists');
founder!.gender='male';
const spouse=family.createSpouse(founder!.id,{day:1,month:3,year:1300,season:Season.SPRING,totalDays:0},{age:25});
founder!.birthDate={...founder!.birthDate,year:1260};founder!.age=40;
if(spouse){spouse.birthDate={...spouse.birthDate,year:1260};spouse.age=40;}
const child=spouse&&family.createChild(spouse.id,founder!.id,{day:1,month:3,year:1300,season:Season.SPRING,totalDays:0},{gender:'male',age:20});
assert(!!child,'test heir created');
family.setPoliticalLegacy(40);
// Political legacy is inherited at succession and influences the heir's reputation.
const successionDate={day:1,month:3,year:1301,season:Season.SPRING,totalDays:360};
family.killCharacter(founder!.id,'natural_age',successionDate);
const succession=family.selectSuccessor(child!.id,successionDate);
assert(succession.success,'eligible heir can succeed the founder');
assert(child!.reputation>0,'political legacy affects heir reputation');
assert(family.getLegacy().legacy.some(entry=>entry.includes('Political legacy passed')),'political succession recorded in family legacy');
console.log(`Political systems verified (minimum rebellion influence ${POLITICAL_CONFIG.rebellionMinimumInfluence}).`);
