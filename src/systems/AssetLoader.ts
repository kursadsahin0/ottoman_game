import { Scene } from 'phaser';

export interface AssetDefinition {
  key: string;
  path: string;
  type: 'image' | 'spritesheet' | 'tilemapTiledJSON' | 'audio' | 'bitmapFont';
  frameConfig?: {
    frameWidth: number;
    frameHeight: number;
    startFrame?: number;
    endFrame?: number;
    margin?: number;
    spacing?: number;
  };
}

export class AssetLoader {
  private scene: Scene;
  private assets: AssetDefinition[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public registerAsset(asset: AssetDefinition): void {
    this.assets.push(asset);
  }

  public registerAssets(assets: AssetDefinition[]): void {
    this.assets.push(...assets);
  }

  public loadAll(): void {
    for (const asset of this.assets) {
      this.loadAsset(asset);
    }
  }

  private loadAsset(asset: AssetDefinition): void {
    switch (asset.type) {
      case 'image':
        this.scene.load.image(asset.key, asset.path);
        break;
      case 'spritesheet':
        if (asset.frameConfig) {
          const frameConfig: Phaser.Types.Loader.FileTypes.ImageFrameConfig = {
            frameWidth: asset.frameConfig.frameWidth,
            frameHeight: asset.frameConfig.frameHeight,
          };
          if (asset.frameConfig.startFrame !== undefined) frameConfig.startFrame = asset.frameConfig.startFrame;
          if (asset.frameConfig.endFrame !== undefined) frameConfig.endFrame = asset.frameConfig.endFrame;
          if (asset.frameConfig.margin !== undefined) frameConfig.margin = asset.frameConfig.margin;
          if (asset.frameConfig.spacing !== undefined) frameConfig.spacing = asset.frameConfig.spacing;
          this.scene.load.spritesheet(asset.key, asset.path, frameConfig);
        } else {
          console.error(`Spritesheet ${asset.key} requires frameConfig`);
        }
        break;
      case 'tilemapTiledJSON':
        this.scene.load.tilemapTiledJSON(asset.key, asset.path);
        break;
      case 'audio':
        this.scene.load.audio(asset.key, asset.path);
        break;
      case 'bitmapFont':
        this.scene.load.bitmapFont(asset.key, asset.path);
        break;
      default:
        console.error(`Unknown asset type for ${asset.key}`);
    }
  }

  public createLoadingBar(x: number, y: number, width: number, height: number): {
    progressBar: Phaser.GameObjects.Graphics;
    progressBox: Phaser.GameObjects.Graphics;
    loadingText: Phaser.GameObjects.Text;
  } {
    const progressBox = this.scene.add.graphics();
    const progressBar = this.scene.add.graphics();
    
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(x - width / 2, y - height / 2, width, height);
    
    const loadingText = this.scene.add.text(x, y - 50, 'Loading...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5, 0.5);
    
    this.scene.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(x - width / 2 + 10, y - height / 2 + 10, (width - 20) * value, height - 20);
    });
    
    this.scene.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
    
    return { progressBar, progressBox, loadingText };
  }

  public getDefaultAssets(): AssetDefinition[] {
    // No binary assets ship with the foundation yet. BootScene generates the
    // temporary geometric artwork at runtime. Register real files here (or in a
    // data-driven manifest) once art is available; see docs/ASSET_PIPELINE.md.
    return [];
  }
}
