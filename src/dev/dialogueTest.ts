import { DEFAULT_PERSONALITIES, DialogueSystem, SETTLEMENT_DIALOGUES, type DialogueActor } from '@systems/DialogueSystem';

let passed=0,failed=0;
function check(name:string, condition:boolean):void{if(condition){passed++;console.log(`  ok ${name}`);}else{failed++;console.error(`  FAIL ${name}`);}}
const npc=(id:string,overrides:Partial<DialogueActor['personality']>={}):DialogueActor=>({id,name:id,personality:{ambition:50,courage:50,patience:50,generosity:50,caution:50,loyalty:50,negotiation:50,...DEFAULT_PERSONALITIES[id],...overrides}});
console.log('\nRelationship and dialogue systems');
check('five or more residents have individual dialogue branches',Object.keys(SETTLEMENT_DIALOGUES).length>=5&&Object.values(SETTLEMENT_DIALOGUES).every(d=>Object.keys(d.nodes).length>=2));

const first=new DialogueSystem();
let view=first.open(npc('hasan_farmer'))!;
check('Hasan offers choices that match his patient personality',view.choices.some(c=>c.id==='ask'&&c.available));
view=first.choose('seed',npc('hasan_farmer'))!;
check('helping Hasan creates a persistent quest and family bond',first.hasFlag('hasan_seed_helped')&&first.getState().quests.includes('harvest_debt'));
view=first.choose('close',npc('hasan_farmer'))!;
check('a finished branch can close cleanly',view===null);
const saved=first.getState(), reloaded=new DialogueSystem();reloaded.loadState(JSON.parse(JSON.stringify(saved)));
view=reloaded.open(npc('hasan_farmer'))!;
check('prior-generation kindness unlocks a later family dialogue branch',view.choices.some(c=>c.id==='legacy'&&c.available));
view=reloaded.choose('legacy',npc('hasan_farmer'))!;
view=reloaded.choose('accept',npc('hasan_farmer'))!;
check('inherited support can unlock later harvest help',reloaded.hasFlag('hasan_future_support')&&reloaded.getState().quests.includes('harvest_debt'));

const cautious=new DialogueSystem();
view=cautious.open(npc('kara_guard',{courage:20}))!;
check('trait requirement disables the courage-based watch choice',view.choices.some(c=>c.id==='volunteer'&&!c.available));
view=cautious.open(npc('kara_guard'))!;
view=cautious.choose('volunteer',npc('kara_guard'))!;
check('military service changes independent military and faction standings and unlocks a quest',cautious.relationship('kara_guard','military')===12&&cautious.relationship('kara_guard','factions')===6&&cautious.getState().quests.includes('frontier_watch'));

const negotiation=new DialogueSystem();
view=negotiation.open(npc('ilyas_official'))!;
check('official mediation is locked until its dispute prerequisite exists',view.choices.some(c=>c.id==='mediate'&&!c.available));
negotiation.loadState({...negotiation.getState(),flags:['boundary_mediation_offered']});
negotiation.setReputation(5);
view=negotiation.open(npc('ilyas_official',{negotiation:90}))!;
view=negotiation.choose('mediate',npc('ilyas_official',{negotiation:90}))!;
check('mediation records a fictional timeline consequence and authority standing',negotiation.hasFlag('ilyas_mediation_recorded')&&negotiation.relationship('ilyas_official','authorities')===9);
const reputationGate=new DialogueSystem();view=reputationGate.open(npc('emine_weaver'))!;
check('reputation and generosity jointly gate fair payment dialogue',view.choices.some(c=>c.id==='fair_wage'&&!c.available));
reputationGate.setReputation(5);view=reputationGate.open(npc('emine_weaver'))!;
check('earned reputation unlocks a fair trade branch',view.choices.some(c=>c.id==='fair_wage'&&c.available));

const english=new DialogueSystem('en');
const fatmaText=SETTLEMENT_DIALOGUES.fatma_villager!.nodes.start!.text;
const savedEnglish=fatmaText.en;fatmaText.en='';
view=english.open(npc('fatma_villager'))!;
check('missing English copy falls back to Turkish dialogue text',view.text.includes('Köyde herkesin bir derdi var'));
if(savedEnglish===undefined)delete fatmaText.en;else fatmaText.en=savedEnglish;
check('unknown character dialogue fails safely',english.open(npc('unknown'))===null);
const social=new DialogueSystem();social.adjustRelationship('yusuf_merchant','merchants',15);social.adjustRelationship('yusuf_merchant','friends',-2);
check('merchant and friendship standing remain separate',social.relationship('yusuf_merchant','merchants')===15&&social.relationship('yusuf_merchant','friends')===-2);

const supplies=new DialogueSystem();
view=supplies.open(npc('hasan_farmer'),effect=>!effect.cost)!;
check('resource-dependent dialogue choice is disabled when the player lacks its cost',view.choices.some(c=>c.id==='seed'&&!c.available));
view=supplies.open(npc('hasan_farmer'))!;
view=supplies.choose('seed',npc('hasan_farmer'))!;
check('seed help becomes a saved decision after the resource check passes',supplies.hasFlag('hasan_seed_helped')&&supplies.getState().decisions.includes('hasan_farmer:seed'));

const brokenPromise=new DialogueSystem();
view=brokenPromise.open(npc('yusuf_merchant'))!;
view=brokenPromise.choose('promise_escort',npc('yusuf_merchant'))!;
view=brokenPromise.choose('close',npc('yusuf_merchant'))!;
brokenPromise.advanceDay(2);
const promiseSave=JSON.parse(JSON.stringify(brokenPromise.getState()));
const brokenAfterLoad=new DialogueSystem();brokenAfterLoad.loadState(promiseSave);brokenAfterLoad.advanceDay(4);
check('an unkept promise matures into rivalry after save/load',brokenAfterLoad.hasFlag('yusuf_escort_broken')&&brokenAfterLoad.relationship('yusuf_merchant','rivals')===12);
const keptPromise=new DialogueSystem();
view=keptPromise.open(npc('yusuf_merchant'))!;
view=keptPromise.choose('promise_escort',npc('yusuf_merchant'))!;
view=keptPromise.choose('close',npc('yusuf_merchant'))!;
view=keptPromise.open(npc('yusuf_merchant'))!;
view=keptPromise.choose('honor_escort',npc('yusuf_merchant'))!;
keptPromise.advanceDay(4);
check('a fulfilled promise earns a separate positive outcome',keptPromise.hasFlag('yusuf_escort_kept')&&!keptPromise.hasFlag('yusuf_escort_broken')&&keptPromise.relationship('yusuf_merchant','rivals')===0);

console.log(`\n${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;
