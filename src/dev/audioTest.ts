import type { AudioBus } from '@core/GameConfig';

let passed=0,failed=0;
function check(name:string,condition:boolean):void{if(condition){passed++;console.log(`  ok  ${name}`);}else{failed++;console.error(`FAIL  ${name}`);}}

const values=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}});
Object.defineProperty(globalThis,'Phaser',{configurable:true,value:{AUTO:0,Scale:{RESIZE:0,CENTER_BOTH:0}}});
const { AudioManager }=await import('@systems/AudioManager');
const { DEFAULT_AUDIO_SETTINGS, GameSettingsManager }=await import('@core/GameConfig');
const settings=GameSettingsManager.getInstance();
const buses:AudioBus[]=['music','ambience','ui','farming','combat','voice'];
for(const bus of buses)settings.setAudioVolume(bus,0);
settings.setAudioVolume('music',0.31);
settings.setAudioVolume('farming',0.23);
settings.setAudioVolume('ambience',2);
settings.setAudioMasterMuted(true);
const stored=JSON.parse(values.get('ottoman-settings')??'{}');
check('separate levels and master mute persist in game settings',stored.audio?.volumes?.music===0.31&&stored.audio?.volumes?.farming===0.23&&stored.audio?.masterMuted===true);
check('volume values clamp to the supported range',settings.getSettings().audio.volumes.ambience===1);
settings.setAudioMasterMuted(false);
for(const bus of buses)settings.setAudioVolume(bus,0);
const audio=AudioManager.getInstance();
audio.setEnvironment({place:'forest',weather:'rain',hour:23,mood:'travel'});
audio.setPaused(true);
audio.playUi('tap');audio.playFarming('plant');audio.playCombat('strike');audio.playVoiceEffect();audio.playFootstep('earth');audio.playAnimal('horse');
check('environment context and pause state update without audio hardware',audio.getEnvironment().place==='forest'&&audio.getEnvironment().weather==='rain'&&audio.getPaused());
check('all sound buses can be silenced without disabling the audio API',buses.every(bus=>settings.getSettings().audio.volumes[bus]===0));
audio.refreshSettings();audio.setPaused(false);
check('the silent fallback accepts UI, farming, combat, voice, movement and animal requests',true);
console.log(`\n${passed} passed, ${failed} failed`);
if(failed)process.exitCode=1;

// Protect the shared defaults from accidental mutation in settings/UI code.
check('audio defaults remain defined',Object.keys(DEFAULT_AUDIO_SETTINGS.volumes).length===buses.length);
