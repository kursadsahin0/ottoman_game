import { Scene } from 'phaser';
import { GameSettingsManager } from '@core/GameConfig';
import { SaveManager } from '@systems/SaveManager';
import { AudioManager } from '@systems/AudioManager';
import { CHARACTER_PRESETS, normalizeCharacterVisuals, type CharacterVisuals } from '@data/CharacterCustomization';
import { generateCustomizedCharacterArt } from '../art/CharacterArt';

/**
 * Title screen: a painted dawn over an Anatolian village, with the menu
 * framed as carved wood and brass.
 */
export class MainMenuScene extends Scene {
  private settingsManager!: GameSettingsManager;
  private background!: Phaser.GameObjects.Image;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private button!: Phaser.GameObjects.Container;
  private buttonImage!: Phaser.GameObjects.Image;
  private buttonText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private instructions!: Phaser.GameObjects.Text;
  private tagline!: Phaser.GameObjects.Text;
  private menuActions: Phaser.GameObjects.Text[]=[];
  private modal:Phaser.GameObjects.Container|null=null;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    this.settingsManager = GameSettingsManager.getInstance();
    AudioManager.getInstance().setEnvironment({place:'village',weather:'clear',hour:9,mood:'calm'});

    this.background = this.add.image(0, 0, 'menu_background');
    this.background.setOrigin(0.5, 0.5);

    this.add.rectangle(0, 0, 10, 10, 0x0c0906, 0.22).setOrigin(0, 0).setName('shade');

    this.tagline = this.add.text(0, 0, 'KURULUŞ  ·  1299', {
      fontFamily: 'Georgia, serif',
      fontSize: '15px',
      color: '#d8bd79',
    });
    this.tagline.setOrigin(0.5, 0.5);
    this.tagline.setShadow(0, 2, '#000000', 4);

    this.title = this.add.text(0, 0, 'Ottoman', {
      fontFamily: 'Georgia, serif',
      fontSize: '84px',
      color: '#f0dc9c',
      fontStyle: 'bold',
    });
    this.title.setOrigin(0.5, 0.5);
    this.title.setShadow(0, 6, '#120c06', 14, true, true);

    this.subtitle = this.add.text(0, 0, 'A Legacy Through Generations', {
      fontFamily: 'Georgia, serif',
      fontSize: '26px',
      color: '#e6d7b4',
    });
    this.subtitle.setOrigin(0.5, 0.5);
    this.subtitle.setShadow(0, 3, '#120c06', 8);

    this.button = this.add.container(0, 0);
    this.buttonImage = this.add.image(0, 0, 'ui_button');
    this.buttonImage.setDisplaySize(384, 74);
    this.buttonText = this.add.text(0, 0, 'Oyuna Başla', {
      fontFamily: 'Georgia, serif',
      fontSize: '26px',
      color: '#f5e6c2',
      fontStyle: 'bold',
    });
    this.buttonText.setOrigin(0.5, 0.5);
    this.buttonText.setShadow(0, 2, '#000000', 3);
    this.button.add([this.buttonImage, this.buttonText]);
    this.button.setSize(384, 74);
    this.button.setInteractive({ useHandCursor: true });

    this.button.on('pointerover', () => {
      this.buttonImage.setAlpha(0.86);
      this.buttonText.setColor('#ffe9a8');
    });
    this.button.on('pointerout', () => {
      this.buttonImage.setAlpha(1);
      this.buttonText.setColor('#f5e6c2');
    });
    this.button.on('pointerdown', () => this.openCharacterCreation());

    this.debugText = this.add.text(0, 0, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#c9b98f',
    });
    this.debugText.setOrigin(0.5, 0.5);

    this.instructions = this.add.text(
      0,
      0,
      'Tanrı misafiri hoş gelir · WASD / oklar ile yürü · F3 ile hata ayıklama',
      {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#cbbd9a',
      },
    );
    this.instructions.setOrigin(0.5, 0.5);
    this.instructions.setShadow(0, 2, '#000000', 4);

    this.menuActions=[
      this.actionButton('Kayıttan devam et',()=>{void this.openLoadMenu();}),
      this.actionButton('Ayarlar',()=>this.openSettings()),
    ];

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-F3', () => {
        this.updateDebugText(this.settingsManager.toggleDebugMode());
      });
    }

    this.layout();
    this.updateDebugText(this.settingsManager.getSettings().debugMode);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', this.handleShutdown, this);

    this.cameras.main.fadeIn(500, 8, 6, 3);
  }

  private actionButton(label:string,action:()=>void):Phaser.GameObjects.Text{
    const b=this.add.text(0,0,label,{fontFamily:'Georgia,serif',fontSize:'17px',color:'#e7d9b9',backgroundColor:'#3a261c',padding:{x:16,y:10}}).setOrigin(.5).setInteractive({useHandCursor:true});
    b.on('pointerover',()=>b.setColor('#f3d786'));b.on('pointerout',()=>b.setColor('#e7d9b9'));b.on('pointerdown',action);return b;
  }
  private openCharacterCreation():void{
    this.closeModal(); const {width,height}=this.scale; const w=Math.min(width-24,680),h=Math.min(height-24,500),x=(width-w)/2,y=(height-h)/2;
    this.modal=this.add.container(0,0).setDepth(100);
    const g=this.add.graphics();g.fillStyle(0x1b130e,.98);g.fillRoundedRect(x,y,w,h,12);g.lineStyle(2,0x9b7945,1);g.strokeRoundedRect(x,y,w,h,12);this.modal.add(g);
    this.modal.add(this.add.text(width/2,y+22,'YENİ SEFER · KARAKTERİNİZ',{fontFamily:'Georgia,serif',fontSize:'20px',color:'#e5c77d',fontStyle:'bold'}).setOrigin(.5));
    let index=0, name=CHARACTER_PRESETS[0]!.name, visuals:CharacterVisuals={...CHARACTER_PRESETS[0]!.visuals}, background=CHARACTER_PRESETS[0]!.background;
    let preview:Phaser.GameObjects.Image|undefined, details:Phaser.GameObjects.Text|undefined, nameLabel:Phaser.GameObjects.Text|undefined;
    const redraw=()=>{
      visuals=normalizeCharacterVisuals(visuals,CHARACTER_PRESETS[index]!.gender);
      if(preview){const prefix=generateCustomizedCharacterArt(this,'menu_preview',background,CHARACTER_PRESETS[index]!.gender,visuals);preview.setTexture(`${prefix}front_idle`);}
      if(details)details.setText(`${background} · ${CHARACTER_PRESETS[index]!.gender==='female'?'Kadın':'Erkek'}
Yüz ${visuals.face} · Saç ${visuals.hairstyle}
Ten ${visuals.skinTone} · Yapı ${visuals.build} · Sakal ${visuals.facialHair}`);
      if(nameLabel)nameLabel.setText(`İsim: ${name}  (yazmak için tıklayın)`);
    };
    nameLabel=this.add.text(x+30,y+66,`İsim: ${name}  (yazmak için tıklayın)`,{fontFamily:'Georgia,serif',fontSize:'15px',color:'#f1dfb8'}).setInteractive({useHandCursor:true});this.modal.add(nameLabel);
    let editing=false; nameLabel.on('pointerdown',()=>{editing=true;nameLabel?.setColor('#f4cd76');});
    const keyHandler=(event:KeyboardEvent)=>{if(!editing)return;if(event.key==='Enter'){editing=false;nameLabel?.setColor('#f1dfb8');return;}if(event.key==='Backspace')name=name.slice(0,-1);else if(event.key.length===1&&/[\p{L} '-]/u.test(event.key)&&name.length<20)name+=event.key;redraw();};
    this.input.keyboard?.on('keydown',keyHandler);this.events.once('shutdown',()=>this.input.keyboard?.off('keydown',keyHandler));
    const cycle=(label:string,values:string[],get:()=>string,set:(value:string)=>void,px:number,py:number)=>{
      const b=this.add.text(px,py,`${label}: ${get()}  ‹ ›`,{fontFamily:'Georgia,serif',fontSize:'14px',color:'#ead9b6',backgroundColor:'#34251b',padding:{x:10,y:8}}).setInteractive({useHandCursor:true});this.modal!.add(b);
      b.on('pointerdown',()=>{const n=values.indexOf(get());set(values[(n+1)%values.length]!);b.setText(`${label}: ${get()}  ‹ ›`);redraw();});
    };
    const fieldX=x+28,rowY=y+112,gap=228;
    cycle('Karakter',CHARACTER_PRESETS.map(p=>`${p.name} · ${p.gender==='female'?'Kadın':'Erkek'}`),()=>`${CHARACTER_PRESETS[index]!.name} · ${CHARACTER_PRESETS[index]!.gender==='female'?'Kadın':'Erkek'}`,_v=>{index=(index+1)%CHARACTER_PRESETS.length;name=CHARACTER_PRESETS[index]!.name;visuals={...CHARACTER_PRESETS[index]!.visuals};background=CHARACTER_PRESETS[index]!.background;},fieldX,rowY);
    const compact=w<=480, step=compact?30:48, secondX=compact?fieldX:fieldX+gap, at=(row:number,_col:0|1=0)=>rowY+(compact?row*step:Math.floor(row/2)*step);
    cycle('Yüz',['oval','round','long'],()=>visuals.face,v=>{visuals.face=v as CharacterVisuals['face'];},secondX,at(1,1));
    cycle('Saç',['tied','short','braided'],()=>visuals.hairstyle,v=>{visuals.hairstyle=v as CharacterVisuals['hairstyle'];},fieldX,at(2));
    cycle('Sakal',['none','trimmed','full'],()=>visuals.facialHair,v=>{visuals.facialHair=v as CharacterVisuals['facialHair'];},secondX,at(3,1));
    cycle('Ten',['warm','olive','tan','deep'],()=>visuals.skinTone,v=>{visuals.skinTone=v as CharacterVisuals['skinTone'];},fieldX,at(4));
    cycle('Yapı',['slim','average','broad'],()=>visuals.build,v=>{visuals.build=v as CharacterVisuals['build'];},secondX,at(5,1));
    cycle('Başlangıç yolu',['Çiftçi','Akıncı','Kervancı'],()=>background,v=>{background=v as typeof background;},fieldX,at(6));
    if(!compact){preview=this.add.image(x+w-105,y+175,'player_front_idle').setScale(.75).setOrigin(.5,.5);this.modal.add(preview);details=this.add.text(x+w-190,y+244,'',{fontFamily:'Georgia,serif',fontSize:'12px',color:'#d0c1a2',align:'center',lineSpacing:4});this.modal.add(details);}
    redraw();
    if(!compact)this.modal.add(this.add.text(x+30,y+314,'1299 Anadolu sınır bölgesine uygun kaftan, başlık ve zırh katmanları kullanılır.\nKadın yüz kılları kapalıdır; başlangıç yolu giysi ve başlangıç donanımını belirler.',{fontFamily:'Georgia,serif',fontSize:'12px',color:'#b9a889',lineSpacing:5,wordWrap:{width:w-230}}));
    const start=this.add.text(width/2,y+h-43,'Seferi başlat',{fontFamily:'Georgia,serif',fontSize:'16px',color:'#f2e5c7',backgroundColor:'#633027',padding:{x:20,y:10}}).setOrigin(.5).setInteractive({useHandCursor:true});
    start.on('pointerdown',()=>this.beginGame({newCharacter:{firstName:name.trim()||'Hasan',gender:CHARACTER_PRESETS[index]!.gender,archetype:background,visuals},tutorialStart:true}));this.modal.add(start);
    this.modal.add(this.actionButton('Geri',()=>this.closeModal()).setPosition(width/2,y+h-5));
  }
  private async openLoadMenu():Promise<void>{
    this.closeModal();const slots=await SaveManager.getInstance().getSaveSlots();const {width,height}=this.scale;const w=Math.min(width-24,480),h=Math.min(height-30,Math.min(480,180+slots.length*54)),x=(width-w)/2,y=(height-h)/2;
    this.modal=this.add.container(0,0).setDepth(100);const g=this.add.graphics();g.fillStyle(0x1b130e,.98);g.fillRoundedRect(x,y,w,h,12);g.lineStyle(2,0x9b7945,1);g.strokeRoundedRect(x,y,w,h,1);this.modal.add(g);
    this.modal.add(this.add.text(width/2,y+24,'SEFER KAYITLARI',{fontFamily:'Georgia,serif',fontSize:'20px',color:'#e5c77d',fontStyle:'bold'}).setOrigin(.5));
    if(!slots.length)this.modal.add(this.add.text(width/2,y+84,'Henüz kayıtlı sefer bulunmuyor.',{fontFamily:'Georgia,serif',fontSize:'15px',color:'#d0c1a2'}).setOrigin(.5));
    for(const [i,slot] of slots.entries()){
      const result=await SaveManager.getInstance().getSaveStatus(slot);const label=result.status==='ok'?`${slot} · ${result.data.time.year} yılı`:result.status==='empty'?`${slot} · Boş`:`${slot} · Kayıt okunamadı`;
      const b=this.actionButton(label,()=>{if(result.status==='ok')this.beginGame({loadSlot:slot});});b.setPosition(width/2,y+75+i*52);this.modal.add(b);
    }
    const back=this.actionButton('Geri',()=>this.closeModal());back.setPosition(width/2,y+h-26);this.modal.add(back);
  }
  private openSettings():void{
    this.closeModal();const {width,height}=this.scale;this.modal=this.add.container(0,0).setDepth(100);const g=this.add.graphics();g.fillStyle(0x1b130e,.98);g.fillRoundedRect(width/2-190,height/2-150,380,300,12);g.lineStyle(2,0x9b7945,1);g.strokeRoundedRect(width/2-190,height/2-150,380,300,12);this.modal.add(g);
    this.modal.add(this.add.text(width/2,height/2-112,'AYARLAR',{fontFamily:'Georgia,serif',fontSize:'20px',color:'#e5c77d'}).setOrigin(.5));
    const settings=this.settingsManager.getSettings();[['FPS',settings.showFPS],['Izgara',settings.showGrid],['Koordinat',settings.showCoordinates]].forEach(([name,value],i)=>{const b=this.actionButton(`${value?'✓':'□'} ${name}`,()=>{const current=this.settingsManager.getSettings();if(name==='FPS')this.settingsManager.setShowFPS(!current.showFPS);if(name==='Izgara')this.settingsManager.setShowGrid(!current.showGrid);if(name==='Koordinat')this.settingsManager.setShowCoordinates(!current.showCoordinates);this.openSettings();});b.setPosition(width/2,height/2-52+i*52);this.modal!.add(b);});
    const back=this.actionButton('Geri',()=>this.closeModal());back.setPosition(width/2,height/2+112);this.modal.add(back);
  }
  private beginGame(data:object):void{this.closeModal();this.cameras.main.fadeOut(240,8,6,3);this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,()=>this.scene.start('GameplayScene',data));}
  private closeModal():void{this.modal?.destroy(true);this.modal=null;}

  private updateDebugText(enabled: boolean): void {
    this.debugText.setText(`Debug Mode: ${enabled ? 'ON' : 'OFF'} (F3)`);
  }

  private layout(): void {
    const { width, height } = this.scale;

    const cover = Math.max(width / 1600, height / 900);
    this.background.setScale(cover);
    this.background.setPosition(width / 2, height / 2);

    const shade = this.children.getByName('shade');
    if (shade instanceof Phaser.GameObjects.Rectangle) {
      shade.setSize(width, height);
      shade.setPosition(0, 0);
    }

    const narrow = width < 640;
    const titleSize = narrow ? 54 : 84;
    this.title.setFontSize(titleSize);
    this.subtitle.setFontSize(narrow ? 17 : 26);
    this.instructions.setFontSize(narrow ? 11 : 13);
    this.instructions.setText(
      narrow
        ? 'WASD / oklar ile yürü · F3: hata ayıklama'
        : 'Tanrı misafiri hoş gelir · WASD / oklar ile yürü · F3 ile hata ayıklama',
    );

    const top = height * (narrow ? 0.2 : 0.24);
    this.tagline.setPosition(width / 2, top - (narrow ? 52 : 74));
    this.title.setPosition(width / 2, top);
    this.subtitle.setPosition(width / 2, top + (narrow ? 42 : 66));

    const buttonY = Math.min(height * 0.68, top + (narrow ? 170 : 230));
    this.button.setPosition(width / 2, buttonY);
    this.buttonImage.setDisplaySize(narrow ? 300 : 384, narrow ? 64 : 74);
    this.buttonText.setFontSize(narrow ? 21 : 26);

    this.debugText.setPosition(width / 2, buttonY + (narrow ? 54 : 62));
    this.menuActions[0]?.setPosition(width/2,buttonY+(narrow?112:126));
    this.menuActions[1]?.setPosition(width/2,buttonY+(narrow?162:178));
    this.instructions.setPosition(width / 2, height - (narrow ? 28 : 34));
  }

  private handleShutdown(): void {
    this.closeModal();
    this.scale.off('resize', this.layout, this);
    this.events.off('shutdown', this.handleShutdown, this);
  }
}
