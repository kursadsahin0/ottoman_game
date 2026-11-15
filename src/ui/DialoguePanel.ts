import Phaser from 'phaser';
import { registerUi } from '@utils/CameraLayers';
import type { DialogueView } from '@systems/DialogueSystem';

/** Compact, touch-friendly branching dialogue panel for the settlement. */
export class DialoguePanel {
  private container: Phaser.GameObjects.Container | null = null;
  private view: DialogueView | null = null;
  private resizeHandler: (() => void) | null = null;
  constructor(private readonly scene: Phaser.Scene, private readonly onChoose:(choiceId:string)=>DialogueView|null, private readonly hasRequest:(npcId:string)=>boolean, private readonly onResolve:(npcId:string)=>void, private readonly onClose:()=>void) {}
  isOpen():boolean{return this.container!==null;}
  open(view:DialogueView):void {this.view=view;this.rebuild();if(!this.resizeHandler){this.resizeHandler=()=>this.rebuild();this.scene.scale.on('resize',this.resizeHandler);}}
  update(view:DialogueView|null):void {if(!view){this.close();return;}this.view=view;this.rebuild();}
  close():void {this.destroyPanel();this.view=null;this.onClose();}
  destroy():void {this.destroyPanel();this.view=null;}
  private destroyPanel():void {if(this.resizeHandler){this.scene.scale.off('resize',this.resizeHandler);this.resizeHandler=null;}this.container?.destroy(true);this.container=null;}
  private rebuild():void {
    if(!this.view)return;this.container?.destroy(true);
    const {width,height}=this.scene.scale, compact=width<600, panelW=Math.min(width-20,compact?520:660), panelH=Math.min(height-24,compact?420:390), x=(width-panelW)/2, y=height-panelH-12;
    this.container=this.scene.add.container(0,0).setDepth(880).setScrollFactor(0);
    const bg=this.scene.add.graphics();bg.fillStyle(0x19140f,0.98);bg.fillRoundedRect(x,y,panelW,panelH,10);bg.lineStyle(2,0x9a7b4f,1);bg.strokeRoundedRect(x,y,panelW,panelH,10);this.container.add(bg);
    const header=this.scene.add.text(x+18,y+13,this.view.name,{fontFamily:'Georgia,serif',fontSize:compact?'19px':'22px',fontStyle:'bold',color:'#e8c766'});this.container.add(header);
    const close=this.scene.add.text(x+panelW-58,y+12,'×',{fontFamily:'Arial',fontSize:'24px',color:'#d8c9a8',backgroundColor:'#3d2f21',padding:{x:10,y:3}}).setInteractive({useHandCursor:true});close.on('pointerdown',()=>this.close());this.container.add(close);
    const bodyY=y+48, textBox=this.scene.add.text(x+18,bodyY,this.view.text,{fontFamily:'Georgia,serif',fontSize:compact?'15px':'16px',color:'#eadfc7',lineSpacing:5,wordWrap:{width:panelW-36}});this.container.add(textBox);
    let row=Math.max(bodyY+58,bodyY+textBox.height+12), end=y+panelH-52;
    for(const option of this.view.choices){if(row+38>end)break;const available=option.available;const button=this.scene.add.text(x+18,row,`${available?'›':'·'} ${option.text}`,{fontFamily:'Arial',fontSize:compact?'13px':'14px',color:available?'#f3e3c0':'#857d6e',backgroundColor:available?'#493421':'#28231d',padding:{x:10,y:8},wordWrap:{width:panelW-56}}).setInteractive(available?{useHandCursor:true}:{});if(available)button.on('pointerdown',()=>{const next=this.onChoose(option.id);if(next)this.update(next);else this.close();});this.container.add(button);row+=Math.max(40,button.height+5);}
    if(this.hasRequest(this.view.npcId)){const request=this.scene.add.text(x+18,y+panelH-43,'Yerel isteği görüş',{fontFamily:'Arial',fontSize:'13px',color:'#f3e3c0',backgroundColor:'#63372b',padding:{x:10,y:7}}).setInteractive({useHandCursor:true});request.on('pointerdown',()=>{const npcId=this.view?.npcId;if(npcId){this.close();this.onResolve(npcId);}});this.container.add(request);}
    registerUi(this.scene,this.container);
  }
}
