import Phaser from 'phaser';
import { PoliticalSystem, type PoliticalAction, type PoliticalContext } from '@systems/PoliticalSystem';
import { registerUi } from '@utils/CameraLayers';

export class PoliticalPanel {
  private scene: Phaser.Scene; private political: PoliticalSystem; private context: () => PoliticalContext;
  private choose: (action: PoliticalAction) => void; private container: Phaser.GameObjects.Container | null = null;
  private page=0;
  constructor(scene: Phaser.Scene, political: PoliticalSystem, context: () => PoliticalContext, choose: (action: PoliticalAction) => void) { this.scene=scene;this.political=political;this.context=context;this.choose=choose; }
  isOpen(): boolean { return this.container !== null; }
  toggle(): void { if(this.container){this.container.destroy(true);this.container=null;return;} this.open(); }
  refresh(): void { if(this.isOpen()){this.container?.destroy(true);this.container=null;this.open();} }
  close(): void { this.container?.destroy(true);this.container=null; }
  private open(): void {
    const {width,height}=this.scene.scale; const boxW=Math.min(width-28,560); const boxH=Math.min(height-36,560); const x=(width-boxW)/2; const y=(height-boxH)/2;
    this.container=this.scene.add.container(0,0).setDepth(850).setScrollFactor(0);
    const bg=this.scene.add.graphics();bg.fillStyle(0x19140f,0.98);bg.fillRoundedRect(x,y,boxW,boxH,12);bg.lineStyle(2,0x9a7b4f,1);bg.strokeRoundedRect(x,y,boxW,boxH,12);this.container.add(bg);
    const c=this.context(),s=this.political.getState();
    const title=`Diplomacy · ${this.political.getTitleForYear(c.year)}`;
    this.container.add(this.scene.add.text(x+18,y+14,title,{fontFamily:'Georgia,serif',fontSize:'19px',color:'#e8c766',fontStyle:'bold'}));
    const stanceLabel=(id:string)=>({allied:'ittifak',friendly:'dostane',neutral:'tarafsız',wary:'temkinli',hostile:'rakip'}[this.political.getFactionStance(id)]);
    const factions=this.political.getFactionDefinitions(c.year).slice(0,5).map(f=>`${f.name}: ${stanceLabel(f.id)} · itibar ${s.factionStanding[f.id]??0} · nüfuz ${s.factionInfluence[f.id]??0} · önder güveni ${s.individualTrust[f.leaderId]??0}`).join('\n');
    const disputes=s.disputes.filter(d=>d.status==='active'||d.status==='contested').map(d=>`${d.title} · ${d.status==='contested'?'contested':'active'}`).join('  |  ')||'No active disputes';
    const visibleFactions=this.political.getFactionDefinitions(c.year);
    const alliances=s.alliances.map(id=>visibleFactions.find(f=>f.id===id)?.name??id).join(', ')||'None';
    const rivalries=s.rivalries.map(id=>visibleFactions.find(f=>f.id===id)?.name??id).join(', ')||'None';
    const contract=s.tradeContract?.status==='active'?`Grain contract: ${s.tradeContract.amount} wheat · due day ${Math.ceil(s.tradeContract.dueDay)}`:`Grain contract: ${s.tradeContract?.status??'none'}`;
    const summary=`Otorite: ${s.authorityId} · Sadakat ${s.loyalty} · Halk desteği ${s.popularSupport} · Yerel nüfuz ${s.localInfluence}\n${disputes}\nİttifaklar: ${alliances} · Rakipler: ${rivalries}\n${contract}\n${factions}`;
    this.container.add(this.scene.add.text(x+18,y+46,summary,{fontFamily:'Arial',fontSize:'10px',color:'#d8c9a8',lineSpacing:3,wordWrap:{width:boxW-36}}));
    const decisions=this.political.getDecisions(c),perPage=5,pages=Math.max(1,Math.ceil(decisions.length/perPage));this.page=Math.min(this.page,pages-1);
    const pageDecisions=decisions.slice(this.page*perPage,(this.page+1)*perPage);let row=y+164;
    for(const decision of pageDecisions){
      if(row>y+boxH-48) break;
      const color=decision.available?'#f3e3c0':'#817969';
      const button=this.scene.add.text(x+18,row,`${decision.available?'●':'○'} ${decision.label}${decision.available?'':` · ${decision.reason??'Unavailable'}`}`,{fontFamily:'Arial',fontSize:'11px',color,backgroundColor:decision.available?'#3d2f21':'#26221c',padding:{x:7,y:5},wordWrap:{width:boxW-48}}).setInteractive({useHandCursor:decision.available});
      button.on('pointerdown',()=>{if(decision.available)this.choose(decision.id);});this.container.add(button);
      const detail=this.scene.add.text(x+26,row+button.height+1,decision.available?`${decision.effect??''}  Risk: ${decision.risk??'Low'}`:'',{fontFamily:'Arial',fontSize:'9px',color:'#bda77d',wordWrap:{width:boxW-62}});this.container.add(detail);
      row+=Math.max(49,button.height+detail.height+8);
    }
    const paging=this.scene.add.text(x+18,y+boxH-31,`Page ${this.page+1}/${pages} · ${decisions.filter(d=>d.available).length} actions available`,{fontFamily:'Arial',fontSize:'10px',color:'#c7b993'});this.container.add(paging);
    if(pages>1){const prev=this.scene.add.text(x+boxW-116,y+boxH-34,'‹ Back',{fontFamily:'Arial',fontSize:'11px',color:'#f0d28e',backgroundColor:'#3d2f21',padding:{x:7,y:4}}).setInteractive({useHandCursor:true});prev.on('pointerdown',()=>{this.page=(this.page+pages-1)%pages;this.refresh();});this.container.add(prev);const next=this.scene.add.text(x+boxW-62,y+boxH-34,'Next ›',{fontFamily:'Arial',fontSize:'11px',color:'#f0d28e',backgroundColor:'#3d2f21',padding:{x:7,y:4}}).setInteractive({useHandCursor:true});next.on('pointerdown',()=>{this.page=(this.page+1)%pages;this.refresh();});this.container.add(next);}
    const close=this.scene.add.text(x+boxW-58,y+12,'Close',{fontFamily:'Arial',fontSize:'12px',color:'#d8c9a8',backgroundColor:'#3d2f21',padding:{x:8,y:5}}).setInteractive({useHandCursor:true});close.on('pointerdown',()=>this.close());this.container.add(close);
    registerUi(this.scene,this.container);
  }
}
