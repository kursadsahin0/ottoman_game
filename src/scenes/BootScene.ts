import { Scene } from 'phaser';
import { generateTerrainArt } from '../art/TerrainArt';
import { generatePropArt } from '../art/PropArt';
import { generateCharacterArt } from '../art/CharacterArt';
import { generateUiArt } from '../art/UiArt';
import { generateFarmArt } from '../art/FarmArt';

/**
 * Paints every runtime texture before the first playable frame. The game ships
 * without binary art, so all tiles, props, characters and UI chrome are
 * generated into canvas textures here.
 */
export class BootScene extends Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    console.log('BootScene: painting procedural art...');

    generateTerrainArt(this);
    generatePropArt(this);
    generateCharacterArt(this);
    generateUiArt(this);
    generateFarmArt(this);

    console.log('BootScene: art ready');
    this.scene.start(typeof location!=='undefined'&&new URLSearchParams(location.search).get('artBenchmark')==='1'?'ArtBenchmarkScene':'LoadingScene');
  }
}
