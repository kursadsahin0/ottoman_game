import Phaser from 'phaser';
import { InputManager } from '@systems/InputManager';
import { Player } from '@entities/Player';
import { TileMap } from '@systems/TileMap';
import { WorldObjectManager } from '@systems/WorldObjectManager';
import { WorldGenerator } from '@data/WorldData';
import { IsometricUtils } from '@utils/IsometricUtils';
import { createUiCamera, registerUi, registerWorld } from '@utils/CameraLayers';
import { worldDepth } from '@utils/Depth';

/** Focused lookdev scene using the same production textures and projection as gameplay. */
export class ArtBenchmarkScene extends Phaser.Scene {
  private inputManager!:InputManager;
  private player!:Player;

  constructor(){super({key:'ArtBenchmarkScene'});}

  create():void {
    const map=WorldGenerator.generateFrontierSettlement();
    createUiCamera(this);
    const terrain=new TileMap(this,map);terrain.render();
    const objects=new WorldObjectManager(this,map);objects.createObjects();

    this.inputManager=new InputManager(this);this.inputManager.initialize();
    this.player=new Player(this,16,17,this.inputManager,undefined,'Çiftçi','female');
    this.player.setMapBounds(map.width,map.height);
    this.player.setCollisionChecker((x,y)=>!terrain.isTileWalkable(x,y)||objects.checkCollision(x,y));
    this.player.showSelectionIndicator(true);

    this.addVillager(11,14,'player_Çiftçi_front_idle','Hasan');
    this.addVillager(14,18,'player_female_Çiftçi_front_idle','Emine');
    this.addVillager(25,14,'player_Akıncı_front_idle','Kara');
    this.cameras.main.setZoom(Math.min(1,Math.max(0.72,Math.min(this.scale.width/760,this.scale.height/760))));
    this.cameras.main.centerOn(0,1024);
    this.cameras.main.startFollow(this.player,false,0.08,0.08);
    this.cameras.main.setRoundPixels(false);

    const title=this.add.text(20,18,'FRONTIER LOOKDEV  ·  1299',{fontFamily:'Georgia,serif',fontSize:'16px',fontStyle:'bold',color:'#f0dca5',backgroundColor:'rgba(30,22,16,.76)',padding:{x:12,y:8}}).setScrollFactor(0).setDepth(920);
    const subtitle=this.add.text(20,52,'',{fontFamily:'Georgia,serif',fontSize:'12px',color:'#e2d1ad',backgroundColor:'rgba(30,22,16,.7)',padding:{x:10,y:6}}).setScrollFactor(0).setDepth(920);
    const back=this.add.text(this.scale.width-18,this.scale.height-18,'Return to menu  [F6]',{fontFamily:'Georgia,serif',fontSize:'13px',color:'#f1dba2',backgroundColor:'#39291f',padding:{x:10,y:7}}).setOrigin(1,1).setScrollFactor(0).setDepth(920).setInteractive({useHandCursor:true});
    back.on('pointerdown',()=>this.scene.start('MainMenuScene'));
    const layoutUi=():void=>{
      const compact=this.scale.width<600;
      title.setFontSize(compact?'14px':'16px');
      subtitle.setText(compact?'WASD / arrows · F6 returns':'2:1 isometric · hand-painted canvas textures · WASD / arrows to move · F6 to return');
      subtitle.setFontSize(compact?'11px':'12px');
      back.setText(compact?'Menu  [F6]':'Return to menu  [F6]');
      back.setPosition(this.scale.width-18,this.scale.height-18);
      this.cameras.main.setZoom(compact?0.72:Math.min(1,Math.max(0.72,Math.min(this.scale.width/760,this.scale.height/760))));
    };
    layoutUi();
    registerUi(this,title,subtitle,back);
    this.scale.on('resize',layoutUi);
    this.input.keyboard?.once('keydown-F6',()=>this.scene.start('MainMenuScene'));
    this.events.once('shutdown',()=>{this.inputManager.destroy();this.scale.off('resize',layoutUi);});
  }

  update(time:number,delta:number):void { this.inputManager.update();this.player.update(time,delta); }

  private addVillager(gridX:number,gridY:number,key:string,name:string):void {
    const position=IsometricUtils.gridToScreen(gridX,gridY);
    const sprite=this.add.image(position.x,position.y+32,key).setOrigin(0.5,0.9).setScale(0.52);
    sprite.setDepth(worldDepth(gridX,gridY,1));registerWorld(this,sprite);
    const label=this.add.text(position.x,position.y-8,name,{fontFamily:'Georgia,serif',fontSize:'10px',color:'#f1dfb8',backgroundColor:'rgba(32,23,16,.72)',padding:{x:3,y:2}}).setOrigin(0.5,1).setDepth(worldDepth(gridX,gridY,2));
    registerWorld(this,label);
  }
}
