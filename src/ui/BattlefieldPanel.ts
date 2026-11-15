import Phaser from 'phaser';
import { MilitaryRank } from '@data/MilitaryData';
import { BattlefieldSystem, type BattleCommandOption, type BattleUnit, type BattlefieldTerrain, type UnitOrder } from '@systems/BattlefieldSystem';
import { registerUi } from '@utils/CameraLayers';

const terrainColor:Record<BattlefieldTerrain,number>={open:0x887c59,hill:0xa49567,forest:0x42523a,road:0xb7a27a,bridge:0x9b7148,defensive:0x6f7053,settlement:0x98704f,obstacle:0x343733,chokepoint:0x776648};
const terrainMark:Partial<Record<BattlefieldTerrain,string>>={hill:'▲',forest:'♣',road:'·',bridge:'╫',defensive:'▰',settlement:'⌂',obstacle:'×',chokepoint:'⋮'};

export class BattlefieldPanel {
 private container:Phaser.GameObjects.Container|null=null;
 private resizeHandler:(()=>void)|null=null;
 private pending:UnitOrder|null=null;
 private paused=false;
 constructor(private readonly scene:Phaser.Scene,private readonly battlefield:BattlefieldSystem,private readonly rank:()=>MilitaryRank,private readonly authority:()=>boolean,private readonly onAttack:()=>void,private readonly onProgress:()=>void,private readonly onReport:()=>void,private readonly onClose:()=>void,private readonly onDecision?:(order:UnitOrder)=>void,private readonly debugEnabled:()=>boolean=()=>false){}
 isOpen():boolean{return this.container!==null;}
 isPaused():boolean{return this.paused;}
 togglePaused():void{this.paused=!this.paused;this.rebuild();this.onProgress();}
 open():void{this.rebuild();if(!this.resizeHandler){this.resizeHandler=()=>this.rebuild();this.scene.scale.on('resize',this.resizeHandler);}}
 refresh():void{if(this.isOpen())this.rebuild();}
 close():void{if(this.battlefield.isActive())return;this.destroyPanel();this.onClose();}
 destroy():void{this.destroyPanel();}
 private destroyPanel():void{if(this.resizeHandler){this.scene.scale.off('resize',this.resizeHandler);this.resizeHandler=null;}this.container?.destroy(true);this.container=null;}
 private addButton(x:number,y:number,label:string,enabled:boolean,action:()=>void,w=125):void{if(!this.container)return;const button=this.scene.add.text(x,y,label,{fontFamily:'Arial',fontSize:'12px',color:enabled?'#f3e3c0':'#817969',backgroundColor:enabled?'#493421':'#29241e',padding:{x:8,y:7},wordWrap:{width:w-14}}).setFixedSize(w,32);if(enabled){button.setInteractive({useHandCursor:true});button.on('pointerdown',action);}this.container.add(button);}
 private rebuild():void{
  this.container?.destroy(true);this.container=null;if(!this.battlefield.isInBattle())return;
  const {width,height}=this.scene.scale,compact=width<600,panelW=Math.min(width-12,compact?540:850),panelH=Math.min(height-12,compact?760:610),x=(width-panelW)/2,y=(height-panelH)/2;
  this.container=this.scene.add.container(0,0).setDepth(920).setScrollFactor(0);
  const bg=this.scene.add.graphics();bg.fillStyle(0x17150f,0.985);bg.fillRoundedRect(x,y,panelW,panelH,8);bg.lineStyle(2,0x9a7b4f,1);bg.strokeRoundedRect(x,y,panelW,panelH,8);this.container.add(bg);
  const battle=this.battlefield.getState(),terminal=battle.status!=='active';
  this.container.add(this.scene.add.text(x+16,y+12,`Sınır Çatışması · ${battle.year} · Kurgusal karşılaşma`,{fontFamily:'Georgia,serif',fontSize:compact?'18px':'22px',fontStyle:'bold',color:'#e8c766'}));
  const close=this.scene.add.text(x+panelW-34,y+10,'×',{fontFamily:'Arial',fontSize:'21px',color:'#d8c9a8'});if(terminal){close.setInteractive({useHandCursor:true});close.on('pointerdown',()=>this.close());}this.container.add(close);
  const selected=this.battlefield.getSelectedUnit(),units=this.battlefield.getUnits(),enemies=units.filter(u=>u.side==='enemy'&&u.count>0);
  const tileSize=Math.floor(Math.min((panelW-32)/12,(panelH-(compact?300:205))/8,36)),mapW=tileSize*12,mapH=tileSize*8,mapX=x+(panelW-mapW)/2,mapY=y+52;
  const map=this.scene.add.graphics();this.container.add(map);map.lineStyle(1,0x2b271f,0.8);
  for(const tile of this.battlefield.getTiles()){
   const tx=mapX+tile.x*tileSize,ty=mapY+tile.y*tileSize;map.fillStyle(terrainColor[tile.terrain],1);map.fillRect(tx,ty,tileSize,tileSize);map.strokeRect(tx,ty,tileSize,tileSize);
   const mark=terrainMark[tile.terrain];if(mark){const text=this.scene.add.text(tx+tileSize/2,ty+tileSize/2,mark,{fontFamily:'Arial',fontSize:`${Math.max(10,tileSize-10)}px`,color:tile.terrain==='forest'?'#c4c08d':'#3a3024'}).setOrigin(.5);this.container.add(text);}
   const zone=this.scene.add.zone(tx,ty,tileSize,tileSize).setOrigin(0).setInteractive();zone.on('pointerdown',()=>this.onTile(tile.x,tile.y));this.container.add(zone);
  }
  for(const unit of units.filter(u=>u.count>0&&(u.side==='friendly'||u.detected))){
   const ux=mapX+(unit.x+.5)*tileSize,uy=mapY+(unit.y+.5)*tileSize,active=unit.id===selected?.id;
   const marker=this.scene.add.graphics();marker.fillStyle(unit.side==='friendly'?0x4d9271:0x9c4537,1);marker.fillCircle(ux,uy,Math.max(8,tileSize*.34));marker.lineStyle(active?3:1,active?0xf0cf8a:0x211a13,1);marker.strokeCircle(ux,uy,Math.max(8,tileSize*.34));this.container.add(marker);
   const label=this.scene.add.text(ux,uy,unit.id==='player_character'?'P':`${unit.count}`,{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#fff4dc'}).setOrigin(.5);this.container.add(label);
   const hit=this.scene.add.zone(ux,uy,tileSize,tileSize).setInteractive();hit.on('pointerdown',()=>{if(this.battlefield.selectUnit(unit.id)){this.pending=null;this.rebuild();this.onProgress();}});this.container.add(hit);
  }
  const statsY=mapY+mapH+8;
  const weatherLabel={clear:'açık',cloudy:'bulutlu',rain:'yağmurlu',snow:'karlı'}[battle.weather];
  const stateLine=terminal?`Sonuç: ${battle.status==='victory'?'Zafer':battle.status==='retreated'?'Geri çekilme':'Yenilgi'} · ${battle.resultReason??''}`:`${this.paused?'ÇATIŞMA DURAKLATILDI · ':''}${weatherLabel} hava · ${battle.supplied?'erzak mevcut':'erzak yok'} · Yorgunluk ${Math.round(battle.fatigue)}% · Düşman ${enemies.length} grubu · Dost kaybı ${this.battlefield.getCasualties('friendly')} · Düşman kaybı ${this.battlefield.getCasualties('enemy')}`;
  this.container.add(this.scene.add.text(x+16,statsY,stateLine,{fontFamily:'Arial',fontSize:'12px',color:terminal?'#e8c766':'#d8c9a8',wordWrap:{width:panelW-32}}));
  const debug=this.debugEnabled();
  if(debug){const trace=units.map(unit=>`${unit.id}@${unit.x.toFixed(1)},${unit.y.toFixed(1)} ${unit.order} M${Math.round(unit.morale)}${unit.targetId?`→${unit.targetId}`:''}`).join(' · ');this.container.add(this.scene.add.text(x+16,statsY+17,`DEBUG · ${trace}`,{fontFamily:'monospace',fontSize:'9px',color:'#a7c8b2',wordWrap:{width:panelW-32}}));}
  const intent=selected?.targetId?` · Hedef ${units.find(u=>u.id===selected.targetId)?.name??'birim'}`:selected?.destination?` · Emir: ${selected.order}`:'';
  const detail=selected?`${selected.name} · ${selected.count}/${selected.initialCount} · Moral ${Math.round(selected.morale)} · Düzen ${Math.round(selected.cohesion)}${selected.id==='player_character'?` · Can ${Math.ceil(selected.health)}/${selected.maxHealth} · Dayanıklılık ${Math.ceil(selected.stamina)}/${selected.maxStamina} · Ok ${battle.playerAmmunition}`:''}${selected.detected?' · Düşman görüldü':''}${intent}`:'Dost birliği seçin';
  this.container.add(this.scene.add.text(x+16,statsY+(debug?34:22),detail,{fontFamily:'Arial',fontSize:'12px',color:'#eadfc7',wordWrap:{width:panelW-32}}));
  if(terminal){this.container.add(this.scene.add.text(x+16,statsY+(debug?62:50),`Görev raporu: ${this.battlefield.getCasualties('friendly')} dost kaybı · ${this.battlefield.getCasualties('enemy')} düşman kaybı`,{fontFamily:'Arial',fontSize:'12px',color:'#d8c9a8'}));this.addButton(x+panelW-158,y+panelH-44,'Savaş raporunu ver',!battle.reported,()=>this.onReport(),142);}
  else this.drawCommands(x,y,panelW,panelH,compact,selected);
  registerUi(this.scene,this.container);
 }
 private drawCommands(x:number,y:number,w:number,h:number,compact:boolean,selected:BattleUnit|null):void{
  const baseY=y+h-(compact?165:118),left=x+14,gap=5,buttonW=compact?Math.floor((w-38)/2):124,rowH=38;const map=`Komut yetkisi: ${this.rank()} · ${this.authority()?'Görev yetkisi açık':'Görev bağlamı komutu kapalı'}`;
  this.container?.add(this.scene.add.text(left,baseY-22,map,{fontFamily:'Arial',fontSize:'11px',color:'#bbae92'}));
  let commands:BattleCommandOption[]=this.battlefield.getCommands(this.rank(),this.authority());if(selected?.id==='player_character')commands=[{command:'advance',label:'Karakteri taşı',available:true},...commands.filter(c=>c.command==='follow')];
  commands.forEach((option,index)=>{const row=Math.floor(index/(compact?2:5)),col=index%(compact?2:5),bx=left+col*(buttonW+gap),by=baseY+row*rowH;this.addButton(bx,by,option.available?option.label:`${option.label} · ${option.reason??'Kilitli'}`,option.available,()=>{this.pending=option.command;if(option.command==='protect'||option.command==='focus'||option.command==='advance'&&selected?.id==='player_character'){this.refresh();}else{const result=this.battlefield.issueCommand(option.command,this.rank(),undefined,this.authority());if(result.success){this.onDecision?.(option.command);this.refresh();this.onProgress();}}},buttonW);});
  const attackY=baseY+(compact?3:2)*rowH;this.addButton(left,attackY,'Karakter saldırısı',!!selected&&selected.id==='player_character'&&this.battlefield.isActive()&&!this.paused,this.onAttack,buttonW);
  this.addButton(left+buttonW+8,attackY,this.paused?'Savaşı sürdür':'Savaşı durdur',true,()=>this.togglePaused(),buttonW);
 }
 private onTile(x:number,y:number):void{
  const selected=this.battlefield.getSelectedUnit();if(!selected)return;
  if(this.pending){const order=this.pending;const result=this.battlefield.issueCommand(order,this.rank(),{x,y},this.authority());this.pending=null;if(result.success){this.onDecision?.(order);this.refresh();this.onProgress();}return;}
  if(selected.id==='player_character'){const result=this.battlefield.issueCommand('advance',this.rank(),{x,y},this.authority());if(result.success){this.onDecision?.('advance');this.refresh();this.onProgress();}}
 }
}
