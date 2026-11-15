import { Game } from 'phaser';
import { GAME_CONFIG } from '@core/GameConfig';
import { BootScene } from '@scenes/BootScene';
import { LoadingScene } from '@scenes/LoadingScene';
import { MainMenuScene } from '@scenes/MainMenuScene';
import { GameplayScene } from '@scenes/GameplayScene';
import { ArtBenchmarkScene } from '@scenes/ArtBenchmarkScene';

class OttomanGame extends Game {
  constructor() {
    const config = {
      ...GAME_CONFIG,
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      scene: [BootScene, LoadingScene, MainMenuScene, GameplayScene, ArtBenchmarkScene],
    };
    
    super(config);
  }
}

declare global {
  interface Window {
    /** Exposed for debugging and automated smoke tests. */
    __ottomanGame?: Game;
  }
}

window.addEventListener('load', () => {
  const game = new OttomanGame();
  window.__ottomanGame = game;
});
