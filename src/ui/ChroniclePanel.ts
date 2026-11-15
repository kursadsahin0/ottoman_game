import Phaser from 'phaser';
import { registerUi } from '@utils/CameraLayers';
import type { AudioBus } from '@core/GameConfig';

export type ChronicleTab='inventory'|'character'|'journal'|'timeline'|'relations'|'region'|'saves'|'settings'|'audio'|'help'|'pause';
export interface ChroniclePanelData { title:string; lines:string[]; slots?:string[]; settings?:Record<string,boolean>; audio?:{masterMuted:boolean;volumes:Record<AudioBus,number>}; actions?:Array<{label:string;action:string}>; choices?:Record<string,string>; map?:Array<{id:string;name:string;x:number;y:number;current:boolean;visited:boolean;action:string}>; routes?:Array<[string,string]> }
export class ChroniclePanel {
  private scene:Phaser.Scene; private read:(tab:ChronicleTab)=>ChroniclePanelData; private act:(action:string)=>void;
  private container:Phaser.GameObjects.Container|null=null; private tab:ChronicleTab='inventory';
  private resizeHandler:()=>void;
  private audioSelectedBus:AudioBus='music';
  private tabs:ChronicleTab[]=['inventory','character','journal','timeline','relations','region','saves','settings','audio','help'];
  private labels:Record<ChronicleTab,string>={inventory:'Eşya',character:'Kişi',journal:'Görev',timeline:'Tarih',relations:'İlişkiler',region:'Bölge',saves:'Kayıt',settings:'Ayar',audio:'Ses',help:'Yardım',pause:'Duraklat'};
  constructor(scene:Phaser.Scene,read:(tab:ChronicleTab)=>ChroniclePanelData,act:(action:string)=>void){this.scene=scene;this.read=read;this.act=act;this.resizeHandler=()=>{if(this.container)this.build();};scene.scale.on('resize',this.resizeHandler);scene.input.keyboard?.on('keydown-LEFT',this.onAudioLeft,this);scene.input.keyboard?.on('keydown-RIGHT',this.onAudioRight,this);scene.events.once('shutdown',()=>{this.close();scene.scale.off('resize',this.resizeHandler);scene.input.keyboard?.off('keydown-LEFT',this.onAudioLeft,this);scene.input.keyboard?.off('keydown-RIGHT',this.onAudioRight,this);});}
  isOpen():boolean{return this.container!==null;}
  getTab():ChronicleTab{return this.tab;}
  open(tab:ChronicleTab='inventory'):void{this.tab=tab;this.build();}
  toggle(tab:ChronicleTab='inventory'):void{if(this.container){this.close();return;}this.open(tab);}
  show(tab:ChronicleTab):void{this.tab=tab;this.build();}
  close():void{this.container?.destroy(true);this.container=null;}
  private build():void{
    this.close();const {width,height}=this.scene.scale;const mobile=width<650;const w=Math.min(width-20,mobile?520:820);const h=Math.min(height-24,mobile?660:600);const x=(width-w)/2,y=(height-h)/2;
    const c=this.container=this.scene.add.container(0,0).setDepth(880).setScrollFactor(0);
    const bg=this.scene.add.graphics();bg.fillStyle(0x18110d,0.98);bg.fillRoundedRect(x,y,w,h,12);bg.lineStyle(2,0x9b7945,1);bg.strokeRoundedRect(x,y,w,h,12);bg.fillStyle(0x4a211d,1);bg.fillRoundedRect(x+10,y+10,w-20,58,7);c.add(bg);
    const title=this.scene.add.text(x+24,y+17,'SEFER DEFTERİ',{fontFamily:'Georgia,serif',fontSize:mobile?'17px':'21px',color:'#e5c77d',fontStyle:'bold'});c.add(title);
    const close=this.button(x+w-78,y+17,'Kapat',()=>this.close(),true);c.add(close);
    const columns=mobile?4:8; const gap=5; const navY=y+77; const navW=(w-32-gap*(columns-1))/columns;
    this.tabs.forEach((tab,i)=>{const row=Math.floor(i/columns),col=i%columns;const b=this.button(x+16+col*(navW+gap),navY+row*(mobile?44:38),this.labels[tab],()=>this.show(tab),tab===this.tab);b.setFixedSize(navW,mobile?40:34);c.add(b);});
    const contentY=navY+Math.ceil(this.tabs.length/columns)*(mobile?44:38)+6;const data=this.read(this.tab);
    const heading=this.scene.add.text(x+22,contentY+6,data.title,{fontFamily:'Georgia,serif',fontSize:mobile?'17px':'20px',color:'#edd9ae',fontStyle:'bold'});c.add(heading);
    let rowY=contentY+42;const maxY=y+h-18;
    if(this.tab==='region'&&data.map){
      const mx=x+24,my=rowY,mapW=w-48,mapH=mobile?90:164;const g=this.scene.add.graphics();g.fillStyle(0x55472f,0.95);g.fillRoundedRect(mx,my,mapW,mapH,8);g.lineStyle(2,0x9a8255,0.8);
      const pts=new Map<string,{x:number;y:number}>();for(const node of data.map)pts.set(node.id,{x:mx+node.x*mapW,y:my+node.y*mapH});
      for(const [a,b] of data.routes??[]){const p=pts.get(a),q=pts.get(b);if(p&&q)g.lineBetween(p.x,p.y,q.x,q.y);}
      c.add(g);for(const node of data.map){const p=pts.get(node.id)!;const dot=this.scene.add.circle(p.x,p.y,Math.max(7,mobile?8:9),node.current?0xcaa45b:node.visited?0x8c6844:0x47382a,1).setStrokeStyle(2,node.current?0xffdf8c:0xb49b6c);dot.setInteractive({useHandCursor:true});dot.on('pointerdown',()=>this.act(node.action));c.add(dot);const label=this.scene.add.text(p.x,p.y+10,node.name,{fontFamily:'Georgia,serif',fontSize:mobile?'9px':'11px',color:'#f0dfbb',align:'center',wordWrap:{width:mapW/3}}).setOrigin(.5,0);c.add(label);}
      rowY+=mapH+10;
    }
    for(const line of data.lines){if(rowY>maxY-28)break;const tx=this.scene.add.text(x+24,rowY,`·  ${line}`,{fontFamily:'Georgia,serif',fontSize:mobile?'12px':'14px',color:'#d0c1a2',wordWrap:{width:w-48},lineSpacing:3});c.add(tx);rowY+=Math.max(27,tx.height+8);}
    if(this.tab==='audio'&&data.audio){
      const mute=this.button(x+24,rowY+3,data.audio.masterMuted?'Master sound: muted':'Master sound: on',()=>this.act('audio:mute'),data.audio.masterMuted);mute.setFixedSize(w-48,38);c.add(mute);rowY+=48;
      const buses:Array<[AudioBus,string]>=[['music','Background music'],['ambience','Environment'],['ui','Interface'],['farming','Farming and craft'],['combat','Combat'],['voice','NPC voice effects']];
      for(const [bus,label] of buses){
        const value=data.audio.volumes[bus]??0;const cy=rowY+15;
        c.add(this.scene.add.text(x+24,rowY+4,`${label} · ${Math.round(value*100)}%`,{fontFamily:'Arial',fontSize:mobile?'11px':'12px',color:'#e3d3b2'}));
        const trackX=x+Math.min(177,w*0.42),trackW=w-(trackX-x)-70;
        const track=this.scene.add.rectangle(trackX,cy,trackW,10,0x493b2d,1).setOrigin(0,0.5).setInteractive({useHandCursor:true});
        const fill=this.scene.add.rectangle(trackX,cy,trackW*value,10,0xc5a15b,1).setOrigin(0,0.5);c.add([track,fill]);
        track.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{this.audioSelectedBus=bus;const bounds=track.getBounds(new Phaser.Geom.Rectangle());this.act(`audio:volume:${bus}:${Phaser.Math.Clamp((pointer.x-bounds.left)/bounds.width,0,1)}`);});
        const minus=this.button(trackX+trackW+5,cy-13,'−',()=>{this.audioSelectedBus=bus;this.act(`audio:step:${bus}:-0.05`);},false).setFixedSize(24,28);c.add(minus);
        const plus=this.button(trackX+trackW+32,cy-13,'+',()=>{this.audioSelectedBus=bus;this.act(`audio:step:${bus}:0.05`);},false).setFixedSize(24,28);c.add(plus);
        rowY+=43;
      }
    }
    if(data.actions?.length){const cols=mobile?2:3;const aw=(w-48-(cols-1)*6)/cols;data.actions.forEach((item,i)=>{const col=i%cols,line=Math.floor(i/cols);const b=this.button(x+20+col*(aw+6),rowY+line*46,item.label,()=>this.act(item.action),true);b.setFixedSize(aw,42);c.add(b);});rowY+=Math.ceil(data.actions.length/cols)*48;}
    if(this.tab==='saves'&&data.slots){const slots=['slot1','slot2','slot3'];slots.forEach((slot,i)=>{const cardW=(w-48)/slots.length;const sx=x+16+i*cardW;const by=Math.min(maxY-48,rowY+8);const name=this.scene.add.text(sx+4,by,`${i+1}. Yuva`,{fontFamily:'Georgia,serif',fontSize:'13px',color:'#e1c888'});c.add(name);const load=this.button(sx+2,by+24,'Yükle',()=>this.act(`load:${slot}`),false);load.setFixedSize(cardW/2-7,42);c.add(load);const save=this.button(sx+cardW/2,by+24,'Kaydet',()=>this.act(`save:${slot}`),true);save.setFixedSize(cardW/2-7,42);c.add(save);});}
    if(this.tab==='settings'&&data.settings){let sx=x+24;const sy=Math.min(maxY-40,rowY+8);for(const [key,value] of Object.entries(data.settings)){const b=this.button(sx,sy,`${value?'✓':'□'} ${key}`,()=>this.act(`setting:${key}`),value);c.add(b);sx+=b.width+8;}}
    if(this.tab==='settings'&&data.choices){const entries=Object.entries(data.choices);entries.forEach(([label,value],i)=>{const b=this.button(x+24+(i%2)*(w/2),Math.min(maxY-40,rowY+56+Math.floor(i/2)*48),`${label}: ${value}`,()=>this.act(`choice:${label}`),false);c.add(b);});}
    if(this.tab==='pause'){const b=this.button(x+24,Math.min(maxY-34,rowY+8),'Ana menüye dön',()=>this.act('menu'),false);c.add(b);}
    registerUi(this.scene,c);
  }
  private button(x:number,y:number,label:string,callback:()=>void,selected:boolean):Phaser.GameObjects.Text{const b=this.scene.add.text(x,y,label,{fontFamily:'Georgia,serif',fontSize:'12px',color:selected?'#f1d98e':'#dbcbb0',backgroundColor:selected?'#633027':'#382a20',padding:{x:9,y:8},align:'center',wordWrap:{width:200}}).setInteractive({useHandCursor:true});b.on('pointerdown',callback);return b;}
  private onAudioLeft():void{if(this.tab==='audio'&&this.isOpen())this.act(`audio:step:${this.audioSelectedBus}:-0.05`);}
  private onAudioRight():void{if(this.tab==='audio'&&this.isOpen())this.act(`audio:step:${this.audioSelectedBus}:0.05`);}
}
