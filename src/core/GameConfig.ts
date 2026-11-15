import { Types } from 'phaser';

export interface ViewportConfig {
  baseWidth: number;
  baseHeight: number;
  minWidth: number;
  minHeight: number;
  scaleMode: number;
  autoCenter: number;
}

export interface IsometricConfig {
  tileWidth: number;
  tileHeight: number;
  originX: number;
  originY: number;
}

export interface GameSettings {
  debugMode: boolean;
  showFPS: boolean;
  showGrid: boolean;
  showCoordinates: boolean;
  graphicsQuality:'low'|'balanced'|'high';
  keyBindings:{up:string;down:string;left:string;right:string};
  audio: AudioSettings;
}

export type AudioBus = 'music'|'ambience'|'ui'|'farming'|'combat'|'voice';
export type AudioMood = 'calm'|'travel'|'political'|'battlefield';
export interface AudioSettings { masterMuted:boolean; volumes:Record<AudioBus,number> }

export const DEFAULT_AUDIO_SETTINGS:AudioSettings={masterMuted:false,volumes:{music:0.28,ambience:0.34,ui:0.55,farming:0.5,combat:0.55,voice:0.45}};

export const GAME_CONFIG: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: 'app',
  backgroundColor: '#2d4f2d',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1024,
    height: 768,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

export const VIEWPORT_CONFIG: ViewportConfig = {
  baseWidth: 1024,
  baseHeight: 768,
  minWidth: 320,
  minHeight: 568,
  scaleMode: Phaser.Scale.RESIZE,
  autoCenter: Phaser.Scale.CENTER_BOTH,
};

export const ISOMETRIC_CONFIG: IsometricConfig = {
  tileWidth: 128,
  tileHeight: 64,
  originX: 0,
  originY: 0,
};

export const DEFAULT_SETTINGS: GameSettings = {
  debugMode: false,
  showFPS: true,
  showGrid: true,
  showCoordinates: true,
  graphicsQuality: 'balanced',
  keyBindings:{up:'W',down:'S',left:'A',right:'D'},
  audio: DEFAULT_AUDIO_SETTINGS,
};

export const MAP_CONFIG = {
  defaultWidth: 20,
  defaultHeight: 20,
};

export const PLAYER_CONFIG = {
  // Screen-space speed. Grid velocity is derived from it so the larger
  // isometric tiles still feel brisk to walk across.
  speed: 320,
  acceleration: 800,
  drag: 600,
};

export class GameSettingsManager {
  private static instance: GameSettingsManager;
  private settings: GameSettings;

  private constructor() {
    const limited=typeof navigator!=='undefined'?(navigator as Navigator&{deviceMemory?:number}).deviceMemory:undefined;
    const mobile=typeof window!=='undefined'&&(window.matchMedia?.('(pointer: coarse)').matches??false);
    let persisted:Partial<GameSettings>={};try{const value=JSON.parse(localStorage.getItem('ottoman-settings')??'{}');if(value&&typeof value==='object')persisted=value as Partial<GameSettings>;}catch{/* inaccessible storage: defaults remain available */}
    const quality=['low','balanced','high'].includes(persisted.graphicsQuality??'')?persisted.graphicsQuality!:mobile&&limited!==undefined&&limited<=4?'low':'balanced';
    const keyBindings={...DEFAULT_SETTINGS.keyBindings,...(persisted.keyBindings??{})};
    for(const direction of ['up','down','left','right'] as const)if(!/^[A-Z0-9]$/.test(keyBindings[direction]))keyBindings[direction]=DEFAULT_SETTINGS.keyBindings[direction];
    const persistedAudio=persisted.audio as Partial<AudioSettings>|undefined;
    const volumes={...DEFAULT_AUDIO_SETTINGS.volumes,...(persistedAudio?.volumes??{})};
    for(const bus of Object.keys(DEFAULT_AUDIO_SETTINGS.volumes) as AudioBus[]){const v=volumes[bus];volumes[bus]=Number.isFinite(v)?Math.max(0,Math.min(1,v)):DEFAULT_AUDIO_SETTINGS.volumes[bus];}
    const audio:AudioSettings={masterMuted:typeof persistedAudio?.masterMuted==='boolean'?persistedAudio.masterMuted:DEFAULT_AUDIO_SETTINGS.masterMuted,volumes};
    this.settings = { ...DEFAULT_SETTINGS, ...persisted, graphicsQuality:quality, keyBindings, audio };
  }

  public static getInstance(): GameSettingsManager {
    if (!GameSettingsManager.instance) {
      GameSettingsManager.instance = new GameSettingsManager();
    }
    return GameSettingsManager.instance;
  }

  public getSettings(): GameSettings {
    return { ...this.settings, audio:{...this.settings.audio,volumes:{...this.settings.audio.volumes}} };
  }

  public setDebugMode(enabled: boolean): void {
    this.settings.debugMode = enabled;
  }

  public toggleDebugMode(): boolean {
    this.settings.debugMode = !this.settings.debugMode;
    return this.settings.debugMode;
  }

  public setShowGrid(enabled: boolean): void {
    this.settings.showGrid = enabled;
    this.persist();
  }

  public setShowCoordinates(enabled: boolean): void {
    this.settings.showCoordinates = enabled;
    this.persist();
  }

  public setShowFPS(enabled: boolean): void {
    this.settings.showFPS = enabled;
    this.persist();
  }

  public setGraphicsQuality(quality:GameSettings['graphicsQuality']):void { this.settings.graphicsQuality=quality;this.persist(); }
  public setAudioMasterMuted(muted:boolean):void{this.settings.audio={...this.settings.audio,masterMuted:muted};this.persist();}
  public setAudioVolume(bus:AudioBus,volume:number):void{if(!Number.isFinite(volume))return;this.settings.audio={...this.settings.audio,volumes:{...this.settings.audio.volumes,[bus]:Math.max(0,Math.min(1,volume))}};this.persist();}
  public setKeyBinding(direction:keyof GameSettings['keyBindings'],key:string):void{if(!/^[a-z0-9]$/i.test(key))return;this.settings.keyBindings={...this.settings.keyBindings,[direction]:key.toUpperCase()};this.persist();}
  private persist():void{try{localStorage.setItem('ottoman-settings',JSON.stringify(this.settings));}catch{/* settings are optional; keep current-session values */}}
}
