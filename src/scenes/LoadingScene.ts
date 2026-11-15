import { Scene } from 'phaser';
import { AssetLoader } from '@systems/AssetLoader';

export class LoadingScene extends Scene {
  private assetLoader!: AssetLoader;

  constructor() {
    super({ key: 'LoadingScene' });
  }

  preload(): void {
    this.assetLoader = new AssetLoader(this);
    
    // Create loading bar
    const { width, height } = this.scale;
    this.assetLoader.createLoadingBar(width / 2, height / 2, 400, 30);
    
    // Register and load assets
    this.assetLoader.registerAssets(this.assetLoader.getDefaultAssets());
    this.assetLoader.loadAll();
  }

  create(): void {
    console.log('LoadingScene: Assets loaded');
    
    // Small delay for smooth transition
    this.time.delayedCall(500, () => {
      this.scene.start('MainMenuScene');
    });
  }
}
