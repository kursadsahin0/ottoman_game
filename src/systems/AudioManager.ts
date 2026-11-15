import { GameSettingsManager, type AudioBus, type AudioMood } from '@core/GameConfig';
import { ATMOSPHERE_PRESETS } from '@data/AtmosphereData';

const clamp01 = (value:number):number => Math.max(0,Math.min(1,value));

export interface AudioEnvironment {
  place: 'village'|'forest'|'market'|'travel'|'battlefield';
  weather: 'clear'|'cloudy'|'rain'|'fog'|'snow'|'wind';
  hour: number;
  mood: AudioMood;
  weatherIntensity?: number;
}

type Voice = { oscillator?: OscillatorNode; source?: AudioBufferSourceNode; gain: GainNode; startedAt: number };

/** Procedural, original Web Audio soundscape. It downloads no recordings and degrades silently when Web Audio is unavailable. */
export class AudioManager {
  private static instance: AudioManager | null = null;
  private readonly settings = GameSettingsManager.getInstance();
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private busGains = new Map<AudioBus, GainNode>();
  private pauseGains = new Map<AudioBus, GainNode>();
  private noiseBuffer: AudioBuffer | null = null;
  private readonly voices: Voice[] = [];
  private readonly maxVoices = 18;
  private environment: AudioEnvironment = { place: 'village', weather: 'clear', hour: 9, mood: 'calm' };
  private gamePaused = false;
  private pageHidden = false;
  private combatActive = false;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private ambienceTimer: ReturnType<typeof setInterval> | null = null;
  private musicBeat = 0;
  private previousMusicMood: AudioMood = 'calm';
  private musicMoodChangedAt = 0;
  private nextMusicAt = 0;
  private lastEffectAt = new Map<string, number>();
  private activationInstalled = false;

  private constructor() {
    if (typeof window !== 'undefined') this.installActivationHandlers();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.pageHidden = document.hidden;
        this.syncPauseGains();
      });
    }
  }

  static getInstance(): AudioManager { return this.instance ??= new AudioManager(); }

  /** Called on user input as well as by the activation listener for WebView autoplay policies. */
  activate(): void {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    this.refreshSettings();
    this.startSchedulers();
  }

  setEnvironment(environment: AudioEnvironment): void {
    if (this.environment.mood !== environment.mood) {
      this.previousMusicMood = this.environment.mood;
      this.musicMoodChangedAt = this.context?.currentTime ?? 0;
    }
    const changed = this.environment.place !== environment.place || this.environment.weather !== environment.weather ||
      this.environment.mood !== environment.mood || Math.floor(this.environment.hour / 4) !== Math.floor(environment.hour / 4)
      || Math.abs((this.environment.weatherIntensity ?? 1) - (environment.weatherIntensity ?? 1)) >= 0.08;
    this.environment = { ...environment, hour: Math.max(0, Math.min(23, environment.hour)), weatherIntensity: Math.max(0, Math.min(1, environment.weatherIntensity ?? 1)) };
    this.refreshSettings();
    if (changed && this.context) this.crossfadeAmbience();
  }

  setPaused(paused: boolean): void { if(this.gamePaused===paused)return;this.gamePaused = paused; this.syncPauseGains(); }
  setCombatActive(active:boolean):void{if(this.combatActive===active)return;this.combatActive=active;this.syncPauseGains();}

  refreshSettings(): void {
    const settings = this.settings.getSettings().audio;
    const now = this.context?.currentTime ?? 0;
    if (this.master) this.master.gain.setTargetAtTime(settings.masterMuted ? 0 : 1, now, 0.045);
    const ambienceScale=ATMOSPHERE_PRESETS[this.environment.place].ambienceGain;
    for (const [bus, gain] of this.busGains) gain.gain.setTargetAtTime(settings.volumes[bus]*(bus==='ambience'?ambienceScale:1), now, 0.6);
  }

  playUi(kind: 'tap'|'confirm'|'error' = 'tap'): void {
    const now = this.now('ui', kind, 45);
    if (now === null) return;
    const notes = kind === 'confirm' ? [660, 880] : kind === 'error' ? [260, 190] : [720];
    notes.forEach((frequency, index) => this.tone('ui', frequency, 'sine', 0.045, 0.025, now + index * 0.055));
  }

  playFarming(kind: 'prepare'|'plant'|'harvest'|'craft'): void {
    const now = this.now('farming', kind, 80);
    if (now === null) return;
    if (kind === 'prepare') this.noise('farming', 0.09, 'lowpass', 750, 0.065, now);
    else if (kind === 'plant') this.tone('farming', 420, 'triangle', 0.11, 0.045, now);
    else if (kind === 'harvest') { this.tone('farming', 520, 'triangle', 0.19, 0.055, now); this.noise('farming', 0.12, 'lowpass', 1300, 0.035, now + 0.025); }
    else { this.tone('farming', 620, 'sine', 0.14, 0.045, now); this.tone('farming', 820, 'sine', 0.1, 0.025, now + 0.06); }
  }

  playCombat(kind: 'strike'|'impact'|'command' = 'strike'): void {
    const now = this.now('combat', kind, 70);
    if (now === null) return;
    if (kind === 'command') this.tone('combat', 330, 'triangle', 0.12, 0.035, now);
    else {
      this.tone('combat', kind === 'impact' ? 92 : 180, 'sawtooth', 0.12, 0.065, now);
      this.noise('combat', 0.1, 'lowpass', kind === 'impact' ? 500 : 1800, 0.09, now);
    }
  }

  playFootstep(surface: 'earth'|'grass'|'wood' = 'earth'): void {
    const at=this.now('ambience',`step_${surface}`,260);if(at===null)return;
    this.noise('ambience',0.055,'lowpass',surface==='wood'?900:420,surface==='wood'?0.018:0.012,at);
    this.tone('ambience',surface==='wood'?150:surface==='grass'?95:118,'triangle',0.045,0.009,at);
  }

  playAnimal(kind: 'goat'|'horse' = 'goat'): void {
    const at=this.now('ambience',`animal_${kind}`,3600);if(at===null)return;
    const pitch=kind==='horse'?115:260;
    this.tone('ambience',pitch,'triangle',kind==='horse'?0.28:0.18,0.008,at);
    this.tone('ambience',pitch*(kind==='horse'?1.16:0.72),'sine',0.13,0.005,at+0.08);
  }

  /** Voice controls are exposed for future licensed or original NPC performances; no voice clips ship currently. */
  playVoiceEffect(frequency = 440): void {
    const now = this.now('voice', 'voice', 120);
    if (now !== null) this.tone('voice', Math.max(100, Math.min(1200, frequency)), 'sine', 0.08, 0.02, now);
  }

  getEnvironment(): AudioEnvironment { return { ...this.environment }; }
  getPaused(): boolean { return this.gamePaused || this.pageHidden; }

  private installActivationHandlers(): void {
    if (this.activationInstalled) return;
    this.activationInstalled = true;
    const activate = (): void => this.activate();
    const pointerDown = (): void => { this.activate(); this.playUi('tap'); };
    window.addEventListener('pointerdown', pointerDown, { capture: true, passive: true });
    window.addEventListener('keydown', activate, { capture: true, passive: true });
    window.addEventListener('touchstart', activate, { capture: true, passive: true });
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    try {
      const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const AudioContextType = globalThis.AudioContext ?? scope.webkitAudioContext;
      if (!AudioContextType) return null;
      const context = this.context = new AudioContextType();
      const master = this.master = context.createGain();
      master.connect(context.destination);
      for (const bus of ['music','ambience','ui','farming','combat','voice'] as AudioBus[]) {
        const busGain = context.createGain();
        const pauseGain = context.createGain();
        busGain.connect(pauseGain); pauseGain.connect(master);
        this.busGains.set(bus, busGain); this.pauseGains.set(bus, pauseGain);
      }
      this.noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const channel = this.noiseBuffer.getChannelData(0);
      // Deterministic, offline-generated noise avoids external samples and runtime downloads.
      let seed = 1907;
      for (let i = 0; i < channel.length; i++) { seed = (seed * 16807) % 2147483647; channel[i] = ((seed / 1073741823.5) - 1) * 0.55; }
      this.refreshSettings(); this.syncPauseGains();
      return context;
    } catch {
      this.context = null;
      return null;
    }
  }

  private startSchedulers(): void {
    if (!this.musicTimer) this.musicTimer = setInterval(() => this.scheduleMusic(), 130);
    if (!this.ambienceTimer) this.ambienceTimer = setInterval(() => this.scheduleAmbience(), 1250);
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (!context || context.state !== 'running' || this.getPaused() || this.settings.getSettings().audio.masterMuted || this.settings.getSettings().audio.volumes.music <= 0) return;
    if (context.currentTime < this.nextMusicAt) return;
    const mood = this.environment.mood;
    const scales: Record<AudioMood, number[]> = {
      calm: [0, 3, 5, 7, 10, 7, 5, 3], travel: [0, 5, 7, 10, 12, 10, 7, 5],
      political: [0, 1, 5, 6, 8, 6, 5, 1], battlefield: [0, 3, 5, 7, 10, 7, 5, 3],
    };
    const degrees = scales[mood];
    const interval = mood === 'battlefield' ? 0.37 : mood === 'travel' ? 0.52 : mood === 'political' ? 0.64 : 0.78;
    const index = this.musicBeat++ % degrees.length;
    const semitone = degrees[index] ?? 0;
    const root = mood === 'battlefield' ? 110 : mood === 'political' ? 146.83 : mood === 'travel' ? 174.61 : 164.81;
    const frequency = root * Math.pow(2, semitone / 12);
    const blend=clamp01((context.currentTime-this.musicMoodChangedAt)/2.4);
    const previousScale=scales[this.previousMusicMood];
    const previousRoot=this.previousMusicMood==='battlefield'?110:this.previousMusicMood==='political'?146.83:this.previousMusicMood==='travel'?174.61:164.81;
    const previousFrequency=previousRoot*Math.pow(2,(previousScale[index]??0)/12);
    const duration=mood==='battlefield'?0.29:0.48, level=mood==='battlefield'?0.035:0.026;
    this.tone('music',previousFrequency,'triangle',duration,level*(1-blend),context.currentTime);
    this.tone('music',frequency,'triangle',duration,level*blend,context.currentTime);
    if (index === 0 || index === 4) this.tone('music', frequency / 2, 'sine', interval * 1.3, 0.014, context.currentTime + 0.01);
    if (mood === 'battlefield' && index % 2 === 0) this.noise('music', 0.11, 'lowpass', 260, 0.036, context.currentTime);
    this.nextMusicAt = context.currentTime + interval;
  }

  private scheduleAmbience(): void {
    if (!this.context || this.context.state !== 'running' || this.getPaused() || this.settings.getSettings().audio.masterMuted || this.settings.getSettings().audio.volumes.ambience <= 0) return;
    const { place, weather, hour, weatherIntensity = 1 } = this.environment;
    const now = this.context.currentTime + 0.01;
    const night = hour < 5 || hour >= 21;
    if (weather === 'rain') this.noise('ambience', 1.5, 'highpass', 1300, 0.018 * weatherIntensity, now);
    else if (weather === 'wind' || weather === 'snow' || weather === 'cloudy' || weather === 'fog') this.noise('ambience', 1.8, 'lowpass', weather === 'snow' ? 700 : weather === 'fog' ? 900 : 460, (weather === 'fog' ? 0.009 : 0.014) * weatherIntensity, now);
    if (place === 'battlefield') {
      this.noise('ambience', 1.6, 'lowpass', 360, 0.018, now);
      this.tone('ambience', 72, 'sine', 0.48, 0.018, now + 0.07);
    } else if (place === 'market') {
      this.noise('ambience', 1.35, 'bandpass', 520, 0.012, now);
      if (Math.random() < 0.42) this.tone('ambience', 320 + Math.random() * 240, 'sine', 0.08, 0.006, now + 0.15);
    } else if (place === 'forest') {
      this.noise('ambience', 1.7, 'lowpass', 540, 0.013, now);
      if (!night && Math.random() < 0.68) this.bird(now + 0.1);
    } else if (place === 'village' && !night && Math.random() < 0.09) {
      this.playAnimal(Math.random() < 0.55 ? 'goat' : 'horse');
    } else if (night) {
      this.tone('ambience', 910 + Math.random() * 180, 'sine', 0.08, 0.004, now);
    } else if (Math.random() < (place === 'village' ? 0.62 : 0.38)) {
      this.bird(now + Math.random() * 0.25);
    }
  }

  private crossfadeAmbience(): void {
    // Sound generation is event-driven; the existing bed continues so a scene
    // transition changes the next layer without restarting music or voices.
    if (!this.ambienceTimer && this.context?.state === 'running') this.startSchedulers();
  }

  private bird(at: number): void {
    const first = 1450 + Math.random() * 450;
    this.tone('ambience', first, 'sine', 0.07, 0.006, at);
    this.tone('ambience', first * (1.12 + Math.random() * 0.08), 'sine', 0.09, 0.005, at + 0.11);
  }

  private now(bus: AudioBus, effect: string, cooldownMs: number): number | null {
    this.activate();
    const context = this.context;
    if (!context || context.state !== 'running' || this.settings.getSettings().audio.masterMuted || this.settings.getSettings().audio.volumes[bus] <= 0) return null;
    if (this.pageHidden || (this.gamePaused && bus !== 'ui' && !(bus === 'combat' && this.combatActive))) return null;
    const wallNow = Date.now();
    const last = this.lastEffectAt.get(`${bus}:${effect}`) ?? 0;
    if (wallNow - last < cooldownMs) return null;
    this.lastEffectAt.set(`${bus}:${effect}`, wallNow);
    return context.currentTime + 0.003;
  }

  private tone(bus: AudioBus, frequency: number, type: OscillatorType, duration: number, level: number, at: number): void {
    const context = this.context, output = this.busGains.get(bus);
    if (!context || !output || this.voices.length >= this.maxVoices) return;
    try {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain); gain.connect(output);
      const voice: Voice = { oscillator, gain, startedAt: at }; this.voices.push(voice);
      oscillator.onended = () => this.removeVoice(voice);
      oscillator.start(at); oscillator.stop(at + duration + 0.02);
    } catch { /* Audio nodes can fail on suspended or disposed mobile contexts. */ }
  }

  private noise(bus: AudioBus, duration: number, filterType: BiquadFilterType, cutoff: number, level: number, at: number): void {
    const context = this.context, output = this.busGains.get(bus), buffer = this.noiseBuffer;
    if (!context || !output || !buffer || this.voices.length >= this.maxVoices) return;
    try {
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
      source.buffer = buffer; source.loop = duration > buffer.duration;
      filter.type = filterType; filter.frequency.setValueAtTime(cutoff, at);
      gain.gain.setValueAtTime(Math.max(0.0001, level * 0.3), at); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.12);
      gain.gain.setTargetAtTime(Math.max(0.0001, level * 0.22), at + Math.max(0.13, duration * 0.45), Math.max(0.035, duration * 0.12));
      source.connect(filter); filter.connect(gain); gain.connect(output);
      const voice: Voice = { source, gain, startedAt: at }; this.voices.push(voice);
      source.onended = () => this.removeVoice(voice);
      source.start(at); source.stop(at + duration);
    } catch { /* Missing or unavailable audio support is a silent fallback. */ }
  }

  private removeVoice(voice: Voice): void {
    const index = this.voices.indexOf(voice);
    if (index >= 0) this.voices.splice(index, 1);
    try { voice.oscillator?.disconnect(); voice.source?.disconnect(); voice.gain.disconnect(); } catch { /* already disconnected */ }
  }

  private syncPauseGains(): void {
    const now = this.context?.currentTime ?? 0;
    for (const [bus, gain] of this.pauseGains) gain.gain.setTargetAtTime(((this.gamePaused || this.pageHidden) && bus !== 'ui' && !(this.gamePaused && !this.pageHidden && bus === 'combat' && this.combatActive)) ? 0 : 1, now, 0.04);
  }
}
