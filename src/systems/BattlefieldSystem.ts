import { MilitaryRank, RANK_ORDER } from '@data/MilitaryData';

export type BattleSide='friendly'|'enemy';
export type BattlefieldTerrain='open'|'hill'|'forest'|'road'|'bridge'|'defensive'|'settlement'|'obstacle'|'chokepoint';
export type UnitType='foot_soldier'|'archer'|'light_cavalry'|'armored_cavalry'|'defensive_militia';
export type UnitOrder='follow'|'hold'|'advance'|'retreat'|'protect'|'focus';
export type BattleStatus='inactive'|'active'|'victory'|'defeat'|'retreated';
export interface BattleTile {x:number;y:number;terrain:BattlefieldTerrain;elevation:number;passable:boolean;cover:number;blocksSight:boolean}
export interface BattleUnit {id:string;name:string;type:UnitType;side:BattleSide;count:number;initialCount:number;health:number;maxHealth:number;stamina:number;maxStamina:number;defenseBonus:number;morale:number;cohesion:number;x:number;y:number;order:UnitOrder;destination:{x:number;y:number}|null;targetId:string|null;retreating:boolean;casualties:number;detected:boolean;path:Array<{x:number;y:number}>}
export interface ReinforcementWave {id:string;atTick:number;side:BattleSide;type:UnitType;count:number;x:number;y:number}
export interface BattlefieldSaveState {schema:2;status:BattleStatus;missionId:string|null;year:number;weather:'clear'|'cloudy'|'rain'|'snow';supplied:boolean;fatigue:number;playerAmmunition:number;playerWeaponRange:number;playerWeaponDamage:number;playerStaminaCost:number;tiles:BattleTile[];units:BattleUnit[];reinforcements:ReinforcementWave[];selectedUnitId:string|null;tick:number;elapsedSeconds:number;playerAttacks:number;resultReason:string|null;reported:boolean}
export interface BattleStartContext {weather?:'clear'|'cloudy'|'rain'|'snow';supplied?:boolean;ammunition?:number;fatigue?:number;weaponRange?:number;weaponDamage?:number;armorDefense?:number;stamina?:number;maxStamina?:number;health?:number;maxHealth?:number}
export interface UnitDefinition {id:UnitType;label:string;minYear:number;maxYear:number|null;speed:number;range:number;damage:number;defense:number;morale:number;cohesion:number;count:number}
export interface BattleCommandOption {command:UnitOrder;label:string;available:boolean;reason?:string}

export const UNIT_DEFINITIONS:Record<UnitType,UnitDefinition>={
 foot_soldier:{id:'foot_soldier',label:'Yaya birliği',minYear:1299,maxYear:null,speed:1.2,range:1.35,damage:9,defense:3,morale:72,cohesion:76,count:7},
 archer:{id:'archer',label:'Okçu birliği',minYear:1299,maxYear:null,speed:1.05,range:4.6,damage:7,defense:1,morale:65,cohesion:66,count:6},
 light_cavalry:{id:'light_cavalry',label:'Hafif süvari',minYear:1299,maxYear:null,speed:1.8,range:1.5,damage:11,defense:2,morale:67,cohesion:60,count:6},
 armored_cavalry:{id:'armored_cavalry',label:'Zırhlı süvari',minYear:1320,maxYear:null,speed:1.15,range:1.5,damage:15,defense:7,morale:78,cohesion:82,count:5},
 defensive_militia:{id:'defensive_militia',label:'Yerel milis',minYear:1299,maxYear:null,speed:0.95,range:1.25,damage:7,defense:5,morale:76,cohesion:84,count:8},
};

const W=12,H=8,idx=(x:number,y:number)=>y*W+x;
function inBounds(x:number,y:number):boolean{return x>=0&&y>=0&&x<W&&y<H;}
function makeTiles():BattleTile[]{
 const tiles:BattleTile[]=Array.from({length:W*H},(_,i)=>({x:i%W,y:Math.floor(i/W),terrain:'open',elevation:0,passable:true,cover:0,blocksSight:false}));
 const put=(x:number,y:number,terrain:BattlefieldTerrain,elevation=0,passable=true,cover=0,blocksSight=false)=>Object.assign(tiles[idx(x,y)]!,{terrain,elevation,passable,cover,blocksSight});
 for(const [x=0,y=0] of [[3,1],[4,1],[3,2],[4,2],[5,2]])put(x,y,'hill',1.2,true,0.12);
 for(const [x=0,y=0] of [[8,1],[8,2],[9,2],[8,3],[9,3],[7,4]])put(x,y,'forest',0,true,0.38,true);
 for(let x=0;x<W;x++)put(x,6,'road',0,true,0);
 for(let y=0;y<H;y++){if(y!==4)put(6,y,'obstacle',0,false,0,true);}
 put(6,4,'bridge',0,true,0.04);
 for(const [x=0,y=0] of [[2,5],[3,5],[2,4]])put(x,y,'defensive',0,true,0.48);
 for(const [x=0,y=0] of [[10,5],[10,6],[11,5]])put(x,y,'settlement',0,true,0.24,true);
 for(const [x=0,y=0] of [[5,4],[7,5]])put(x,y,'chokepoint',0,true,0.1);
 return tiles;
}

/** Group-scale tactical simulation. One update represents a bounded combat tick, not one AI per soldier. */
export class BattlefieldSystem {
 private state:BattlefieldSaveState={schema:2,status:'inactive',missionId:null,year:1299,weather:'clear',supplied:true,fatigue:0,playerAmmunition:0,playerWeaponRange:1.35,playerWeaponDamage:9,playerStaminaCost:12,tiles:[],units:[],reinforcements:[],selectedUnitId:null,tick:0,elapsedSeconds:0,playerAttacks:0,resultReason:null,reported:false};
 getState():BattlefieldSaveState{return JSON.parse(JSON.stringify(this.state));}
 isActive():boolean{return this.state.status==='active';}
 isInBattle():boolean{return this.state.status==='active'||this.state.status==='victory'||this.state.status==='defeat'||this.state.status==='retreated';}
 getTiles():BattleTile[]{return this.state.tiles;}
 getUnits():BattleUnit[]{return this.state.units;}
 getSelectedUnit():BattleUnit|null{return this.state.units.find(u=>u.id===this.state.selectedUnitId)??null;}
 start(missionId:string,year:number,reinforcements:ReinforcementWave[]=[],context:BattleStartContext={}):{success:boolean;message:string}{
  if(this.state.status==='active')return {success:false,message:'Çatışma zaten sürüyor.'};
  if(this.state.status!=='inactive'&&!this.state.reported)return {success:false,message:'Önce sonuçlanmış çatışmanın raporunu verin.'};
  if(this.state.reported&&this.state.missionId===missionId)return {success:false,message:'Bu görevin çatışma raporu zaten işlendi.'};
  if(missionId!=='mission_frontier_skirmish')return {success:false,message:'Bu görev için henüz bir savaş haritası yok.'};
  const tiles=makeTiles();
  const fatigue=Math.max(0,Math.min(100,context.fatigue??0));
  this.state={schema:2,status:'active',missionId,year,weather:context.weather??'clear',supplied:context.supplied??true,fatigue,playerAmmunition:Math.max(0,Math.floor(context.ammunition??0)),playerWeaponRange:Math.max(0.8,Math.min(5,context.weaponRange??1.35)),playerWeaponDamage:Math.max(4,Math.min(20,context.weaponDamage??9)),playerStaminaCost:context.weaponRange&&context.weaponRange>1.7?18:12,tiles,units:[],reinforcements:reinforcements.filter(w=>w&&typeof w.id==='string'&&Number.isInteger(w.atTick)&&w.atTick>=1&&w.count>0&&w.count<=30&&!!UNIT_DEFINITIONS[w.type]&&['friendly','enemy'].includes(w.side)&&inBounds(w.x,w.y)&&tiles[idx(w.x,w.y)]?.passable).map(w=>({...w})),selectedUnitId:'player_character',tick:0,elapsedSeconds:0,playerAttacks:0,resultReason:null,reported:false};
  this.addUnit('player_character','Oyuncu','foot_soldier','friendly',1,6,'hold',1,context);
  this.addUnit('frontier_militia','Yerel milis','defensive_militia','friendly',2,5,'hold');
  this.addUnit('frontier_archers','Okçular','archer','friendly',2,4,'hold');
  this.addUnit('raiders_east','Akıncı grubu','light_cavalry','enemy',9,3,'advance');
  this.addUnit('raiders_south','Atlı grup','light_cavalry','enemy',8,5,'advance');
  return {success:true,message:'Kurgusal sınır çatışması başladı. Oyuncu birliğini seçip hedef alabilir.'};
 }
 private addUnit(id:string,name:string,type:UnitType,side:BattleSide,x:number,y:number,order:UnitOrder,countOverride?:number,playerContext?:BattleStartContext):void{
  const def=UNIT_DEFINITIONS[type];if(this.state.year<def.minYear||(def.maxYear!==null&&this.state.year>def.maxYear))return;
  const count=countOverride??def.count;const isPlayer=id==='player_character';const fatiguePenalty=isPlayer?this.state.fatigue*0.32:0;const supplyPenalty=side==='friendly'&&!this.state.supplied?12:0;this.state.units.push({id,name,type,side,count,initialCount:count,health:isPlayer?playerContext?.health??100:100,maxHealth:isPlayer?playerContext?.maxHealth??100:100,stamina:isPlayer?Math.max(10,Math.min(playerContext?.maxStamina??100,playerContext?.stamina??100)-this.state.fatigue*.45):100,maxStamina:isPlayer?playerContext?.maxStamina??100:100,defenseBonus:isPlayer?playerContext?.armorDefense??0:def.defense,morale:Math.max(10,def.morale-fatiguePenalty-supplyPenalty),cohesion:def.cohesion,x,y,order,destination:null,targetId:null,retreating:false,casualties:0,detected:side==='friendly',path:[]});
 }
 getCommands(rank:MilitaryRank,missionAuthority=true):BattleCommandOption[]{const selected=this.getSelectedUnit();const player=selected?.id==='player_character';const rankLevel=RANK_ORDER.indexOf(rank);const allow=missionAuthority&&rankLevel>=1;return [
  {command:'follow',label:'İzle',available:allow&&!player,reason:!missionAuthority?'Görev yetkisi vermiyor.':rankLevel<1?'Azab rütbesi gerekir.':'Oyuncu karakterine atanamaz.'},
  {command:'hold',label:'Mevziyi tut',available:allow&&!player,reason:!missionAuthority?'Görev yetkisi vermiyor.':rankLevel<1?'Azab rütbesi gerekir.':'Oyuncu karakterine atanamaz.'},
  {command:'advance',label:'İlerle',available:missionAuthority&&rankLevel>=2&&!player,reason:!missionAuthority?'Görev yetkisi vermiyor.':rankLevel<2?'Yaya rütbesi gerekir.':'Oyuncu karakterine atanamaz.'},
  {command:'retreat',label:'Geri çekil',available:missionAuthority&&rankLevel>=2&&!player,reason:!missionAuthority?'Görev yetkisi vermiyor.':rankLevel<2?'Yaya rütbesi gerekir.':'Oyuncu karakterine atanamaz.'},
  {command:'protect',label:'Alanı koru',available:missionAuthority&&rankLevel>=2&&!player,reason:!missionAuthority?'Görev yetkisi vermiyor.':rankLevel<2?'Yaya rütbesi gerekir.':'Oyuncu karakterine atanamaz.'},
  {command:'focus',label:'Hedefe odaklan',available:missionAuthority&&rankLevel>=3&&!player,reason:!missionAuthority?'Görev yetkisi vermiyor.':rankLevel<3?'Akıncı rütbesi gerekir.':'Oyuncu karakterine atanamaz.'},
 ];}
 selectUnit(unitId:string):boolean{const unit=this.state.units.find(u=>u.id===unitId&&u.side==='friendly'&&!u.retreating&&u.count>0);if(!unit)return false;this.state.selectedUnitId=unitId;return true;}
 issueCommand(command:UnitOrder,rank:MilitaryRank,target?:{x:number;y:number},missionAuthority=true):{success:boolean;message:string}{
  if(!this.isActive())return {success:false,message:'Çatışma etkin değil.'};const unit=this.getSelectedUnit();if(!unit||unit.side!=='friendly')return {success:false,message:'Dost birlik seçin.'};
  if(unit.id==='player_character'){if(command!=='advance'&&command!=='follow')return {success:false,message:'Karakter yalnızca hareket hedefi alabilir.'};if(!target||!this.tileAt(target.x,target.y)?.passable)return {success:false,message:'Hedef arazi geçişe kapalı.'};unit.destination={...target};unit.path=this.findPath(unit,target);return {success:true,message:'Karakter için hareket hedefi verildi.'};}
  const option=this.getCommands(rank,missionAuthority).find(c=>c.command===command);if(!option?.available)return {success:false,message:option?.reason??'Bu komut kullanılamıyor.'};
  if((command==='protect'||command==='focus')&&!target)return {success:false,message:'Bu komut hedef gerektiriyor.'};
  if(target&&!this.tileAt(target.x,target.y)?.passable)return {success:false,message:'Hedef arazi geçişe kapalı.'};
  unit.order=command;unit.destination=target?{...target}:null;unit.targetId=command==='focus'?this.closestEnemy(unit,target)?.id??null:null;
  if(command==='follow'){const player=this.state.units.find(u=>u.id==='player_character');unit.destination=player?{x:Math.round(player.x),y:Math.round(player.y)}:null;}
  if(command==='advance'){const enemy=this.closestEnemy(unit);unit.destination=enemy?{x:enemy.x,y:enemy.y}:null;}
  if(command==='retreat'){unit.retreating=true;unit.destination={x:unit.side==='friendly'?0:W-1,y:unit.y};}
  if(command==='focus'){const focused=this.state.units.find(u=>u.id===unit.targetId);unit.destination=focused?{x:focused.x,y:focused.y}:null;}
  unit.path=unit.destination?this.findPath(unit,unit.destination):[];
  return {success:true,message:`${unit.name}: ${option.label}.`};
 }
 attackWithPlayer(targetId?:string):{success:boolean;message:string;damage:number;ammunitionUsed?:boolean}{
  if(!this.isActive())return {success:false,message:'Çatışma etkin değil.',damage:0};const player=this.state.units.find(u=>u.id==='player_character');if(!player||player.health<=0)return {success:false,message:'Karakter savaşamaz.',damage:0};if(player.stamina<this.state.playerStaminaCost)return {success:false,message:'Yorgunluk yüzünden saldırı için dayanıklılık yetmiyor.',damage:0};if(this.state.playerWeaponRange>1.7&&this.state.playerAmmunition<=0)return {success:false,message:'Yay için okunuz kalmadı.',damage:0};
  const target=targetId?this.state.units.find(u=>u.id===targetId&&u.side==='enemy'&&u.count>0):this.closestEnemy(player);
  if(!target)return {success:false,message:'Görünen düşman hedefi yok.',damage:0};if(!this.canSee(player,target))return {success:false,message:'Orman ve mesafe hedefi gizliyor.',damage:0};
  const distance=Math.hypot(player.x-target.x,player.y-target.y);if(distance>this.state.playerWeaponRange+0.5)return {success:false,message:'Düşman silah menzilinin dışında.',damage:0};
  const terrain=this.tileAt(target.x,target.y)!;const weatherPenalty=this.state.weather==='rain'||this.state.weather==='snow'?2:0;const fatiguePenalty=Math.floor(this.state.fatigue/35);const damage=Math.max(3,this.state.playerWeaponDamage-terrain.cover*6-UNIT_DEFINITIONS[target.type].defense*0.45-weatherPenalty-fatiguePenalty);player.stamina=Math.max(0,player.stamina-this.state.playerStaminaCost);if(this.state.playerWeaponRange>1.7)this.state.playerAmmunition--;this.applyCasualties(target,damage);this.state.playerAttacks++;this.state.tick++;this.checkResult();return {success:true,message:`Karakter saldırdı; ${target.name} birliği kayıp verdi.`,damage,ammunitionUsed:this.state.playerWeaponRange>1.7};
 }
 update(deltaSeconds:number):void{if(!this.isActive())return;this.state.elapsedSeconds+=Math.max(0,Math.min(deltaSeconds,1));if(this.state.elapsedSeconds<0.8)return;this.state.elapsedSeconds=0;this.state.tick++;const player=this.state.units.find(u=>u.id==='player_character');if(player)player.stamina=Math.min(player.maxStamina,player.stamina+5);const arrived=this.state.reinforcements.filter(w=>w.atTick<=this.state.tick);this.state.reinforcements=this.state.reinforcements.filter(w=>w.atTick>this.state.tick);for(const wave of arrived)this.addUnit(wave.id,`${UNIT_DEFINITIONS[wave.type].label} takviyesi`,wave.type,wave.side,wave.x,wave.y,wave.side==='enemy'?'advance':'hold',wave.count);const active=this.state.units.filter(u=>u.count>0);for(const unit of active){if(unit.side==='enemy'&&unit.order==='advance'){const goal=this.state.units.filter(u=>u.side==='friendly'&&u.count>0&&!u.retreating).sort((a,b)=>Math.hypot(a.x-unit.x,a.y-unit.y)-Math.hypot(b.x-unit.x,b.y-unit.y))[0];if(goal){unit.destination={x:Math.round(goal.x),y:Math.round(goal.y)};unit.path=this.findPath(unit,unit.destination);}}if(unit.destination)this.moveUnit(unit,0.8);}
  for(const unit of active){if(unit.count===0||unit.retreating)continue;const target=this.chooseTarget(unit);if(!target)continue;const d=Math.hypot(target.x-unit.x,target.y-unit.y);if(d<=this.effectiveRange(unit)&&this.canSee(unit,target)){const def=UNIT_DEFINITIONS[unit.type],tile=this.tileAt(target.x,target.y)!;const cohesion=Math.max(0.35,unit.cohesion/100), morale=Math.max(0.3,unit.morale/100),weatherPenalty=(this.state.weather==='rain'||this.state.weather==='snow')&&unit.type==='archer'?0.62:1,supplyPenalty=unit.side==='friendly'&&!this.state.supplied&&unit.type==='archer'?0.55:1;const damage=Math.max(2,Math.round(def.damage*cohesion*morale*(unit.count/Math.max(1,def.count))*weatherPenalty*supplyPenalty-tile.cover*4-target.defenseBonus*0.4));this.applyCasualties(target,damage);}}
  for(const unit of active){if(unit.count===0)continue;if(unit.morale<22&&unit.side==='friendly'&&!unit.retreating){unit.retreating=true;unit.order='retreat';unit.destination={x:0,y:unit.y};unit.path=this.findPath(unit,unit.destination);}}
  for(const unit of this.state.units){unit.detected=unit.side==='enemy'?this.state.units.some(f=>f.side==='friendly'&&f.count>0&&!f.retreating&&this.canSee(f,unit)):this.state.units.some(e=>e.side==='enemy'&&e.count>0&&this.canSee(unit,e));}
  this.checkResult();
 }
 private chooseTarget(unit:BattleUnit):BattleUnit|null{if(unit.side==='enemy')return this.state.units.filter(v=>v.side==='friendly'&&v.count>0&&!v.retreating).sort((a,b)=>Math.hypot(a.x-unit.x,a.y-unit.y)-Math.hypot(b.x-unit.x,b.y-unit.y))[0]??null;if(unit.order==='focus'&&unit.targetId)return this.state.units.find(v=>v.id===unit.targetId&&v.count>0)??null;if(unit.order==='hold'||unit.order==='protect'||unit.order==='follow')return this.state.units.filter(v=>v.side==='enemy'&&v.count>0&&this.canSee(unit,v)&&Math.hypot(v.x-unit.x,v.y-unit.y)<=UNIT_DEFINITIONS[unit.type].range).sort((a,b)=>Math.hypot(a.x-unit.x,a.y-unit.y)-Math.hypot(b.x-unit.x,b.y-unit.y))[0]??null;if(unit.order==='advance')return this.closestEnemy(unit);return null;}
 private applyCasualties(unit:BattleUnit,damage:number):void{if(unit.count<=0)return;unit.health=Math.max(0,unit.health-damage);const remaining=Math.max(0,Math.ceil(unit.health/100*unit.initialCount));const lost=Math.max(0,unit.count-remaining);unit.count=remaining;unit.casualties+=lost;if(lost>0){unit.morale=Math.max(0,unit.morale-lost*2.5);unit.cohesion=Math.max(0,unit.cohesion-lost*3);}if(unit.count===0){unit.morale=0;unit.cohesion=0;}}
 private checkResult():void{const enemies=this.state.units.some(u=>u.side==='enemy'&&u.count>0&&!u.retreating);const allies=this.state.units.some(u=>u.side==='friendly'&&u.count>0&&!u.retreating);const player=this.state.units.find(u=>u.id==='player_character');if(!enemies){this.state.status='victory';this.state.resultReason='Düşman grupları dağıldı.';}else if(!allies||!player||player.health<=0){this.state.status=this.state.units.some(u=>u.side==='friendly'&&u.retreating)?'retreated':'defeat';this.state.resultReason=this.state.status==='retreated'?'Dost birlikler geri çekildi.':'Dost birlikler dağıldı veya karakter savaşamaz hâle geldi.';}}
 private moveUnit(unit:BattleUnit,dt:number):void{if(!unit.path.length&&unit.destination)unit.path=this.findPath(unit,unit.destination);const next=unit.path[0];if(!next)return;const tile=this.tileAt(next.x,next.y);if(!tile?.passable){unit.path=[];return;}const cost=this.movementCost(unit,tile),step=UNIT_DEFINITIONS[unit.type].speed*dt/cost,dx=next.x-unit.x,dy=next.y-unit.y,d=Math.hypot(dx,dy);if(d<=step){unit.x=next.x;unit.y=next.y;unit.path.shift();if(unit.retreating&&((unit.side==='friendly'&&unit.x<=0)||(unit.side==='enemy'&&unit.x>=W-1)))unit.count=0;}else{unit.x+=dx/d*step;unit.y+=dy/d*step;}}
 private movementCost(unit:Pick<BattleUnit,'type'>,tile:BattleTile):number{const terrain=tile.terrain==='forest'?1.8:tile.terrain==='hill'?1.45:tile.terrain==='bridge'?1.2:unit.type==='light_cavalry'&&tile.terrain==='chokepoint'?2.1:1;return terrain+((this.state.weather==='rain'||this.state.weather==='snow')?0.18:0);}
 private effectiveRange(unit:BattleUnit):number{let range=unit.id==='player_character'?this.state.playerWeaponRange:UNIT_DEFINITIONS[unit.type].range;if(unit.type==='archer'&&(this.state.weather==='rain'||this.state.weather==='snow'))range*=0.72;return range;}
 findPath(unit:Pick<BattleUnit,'x'|'y'|'type'>,target:{x:number;y:number}):Array<{x:number;y:number}>{
  if(!inBounds(target.x,target.y)||!this.tileAt(target.x,target.y)?.passable)return[];
  const start={x:Math.round(unit.x),y:Math.round(unit.y)},key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
  const open=[start],came=new Map<string,string>(),g=new Map<string,number>([[key(start),0]]),f=new Map<string,number>([[key(start),Math.abs(start.x-target.x)+Math.abs(start.y-target.y)]]),coords=new Map([[key(start),start]]);
  while(open.length){
   open.sort((a,b)=>(f.get(key(a))??Infinity)-(f.get(key(b))??Infinity));const cur=open.shift()!;
   if(cur.x===target.x&&cur.y===target.y){const path:Array<{x:number;y:number}>=[];let k=key(cur);while(came.has(k)){const p=coords.get(k)!;path.unshift(p);k=came.get(k)!;}return path;}
   for(const delta of [[1,0],[-1,0],[0,1],[0,-1]]){const dx=delta[0]??0,dy=delta[1]??0,next={x:cur.x+dx,y:cur.y+dy},tile=this.tileAt(next.x,next.y);if(!tile?.passable)continue;const nk=key(next),tent=(g.get(key(cur))??Infinity)+this.movementCost(unit,tile);if(tent>=(g.get(nk)??Infinity))continue;came.set(nk,key(cur));coords.set(nk,next);g.set(nk,tent);f.set(nk,tent+Math.abs(next.x-target.x)+Math.abs(next.y-target.y));if(!open.some(p=>key(p)===nk))open.push(next);}
  }
  return[];
 }
 private closestEnemy(from:Pick<BattleUnit,'x'|'y'>,target?:{x:number;y:number}):BattleUnit|null{return this.state.units.filter(u=>u.side==='enemy'&&u.count>0&&!u.retreating).sort((a,b)=>{const da=target?Math.hypot(a.x-target.x,a.y-target.y):Math.hypot(a.x-from.x,a.y-from.y),db=target?Math.hypot(b.x-target.x,b.y-target.y):Math.hypot(b.x-from.x,b.y-from.y);return da-db;})[0]??null;}
 private canSee(a:BattleUnit,b:BattleUnit):boolean{const d=Math.hypot(a.x-b.x,a.y-b.y),range=this.effectiveRange(a)+(this.tileAt(a.x,a.y)?.elevation??0)*0.8,visibility=this.state.weather==='rain'||this.state.weather==='snow'?0.84:1;return d<=range*visibility&&!(this.state.tiles.some(t=>t.blocksSight&&Math.hypot(t.x-a.x,t.y-a.y)<d*0.48&&Math.hypot(t.x-b.x,t.y-b.y)<d*0.48));}
 private tileAt(x:number,y:number):BattleTile|null{return inBounds(Math.round(x),Math.round(y))?this.state.tiles[idx(Math.round(x),Math.round(y))]??null:null;}
 getCasualties(side:BattleSide):number{return this.state.units.filter(u=>u.side===side).reduce((n,u)=>n+u.casualties,0);}
 getTerrainAt(x:number,y:number):BattleTile|null{return this.tileAt(x,y);}
 hasLineOfSight(firstId:string,secondId:string):boolean{const a=this.state.units.find(u=>u.id===firstId),b=this.state.units.find(u=>u.id===secondId);return !!a&&!!b&&this.canSee(a,b);}
 getAvailableUnitTypes(year:number):UnitType[]{return (Object.keys(UNIT_DEFINITIONS) as UnitType[]).filter(id=>year>=UNIT_DEFINITIONS[id].minYear&&(UNIT_DEFINITIONS[id].maxYear===null||year<=UNIT_DEFINITIONS[id].maxYear));}
 markReported():boolean{if(this.state.reported||!['victory','defeat','retreated'].includes(this.state.status))return false;this.state.reported=true;return true;}
 restore(state:BattlefieldSaveState|undefined):void{if(!state||![1,2].includes(state.schema)||!Array.isArray(state.units)||!Array.isArray(state.tiles))return;const migrated=state as BattlefieldSaveState;this.state={...migrated,schema:2,weather:['clear','cloudy','rain','snow'].includes(migrated.weather)?migrated.weather:'clear',supplied:typeof migrated.supplied==='boolean'?migrated.supplied:true,fatigue:Number.isFinite(migrated.fatigue)?Math.max(0,Math.min(100,migrated.fatigue)):0,playerAmmunition:Number.isFinite(migrated.playerAmmunition)?Math.max(0,migrated.playerAmmunition):0,playerWeaponRange:Number.isFinite(migrated.playerWeaponRange)?migrated.playerWeaponRange:1.35,playerWeaponDamage:Number.isFinite(migrated.playerWeaponDamage)?migrated.playerWeaponDamage:9,playerStaminaCost:Number.isFinite(migrated.playerStaminaCost)?migrated.playerStaminaCost:12,tiles:migrated.tiles.filter(t=>inBounds(t.x,t.y)&&['open','hill','forest','road','bridge','defensive','settlement','obstacle','chokepoint'].includes(t.terrain)).map(t=>({...t})),units:migrated.units.filter(u=>typeof u.id==='string'&&['friendly','enemy'].includes(u.side)&&u.count>=0&&u.count<=30&&Number.isFinite(u.x)&&Number.isFinite(u.y)&&!!UNIT_DEFINITIONS[u.type]).map(u=>({...u,stamina:Number.isFinite(u.stamina)?u.stamina:100,maxStamina:Number.isFinite(u.maxStamina)?u.maxStamina:100,defenseBonus:Number.isFinite(u.defenseBonus)?u.defenseBonus:UNIT_DEFINITIONS[u.type].defense,initialCount:Number.isFinite(u.initialCount)?u.initialCount:UNIT_DEFINITIONS[u.type].count,path:Array.isArray(u.path)?u.path.filter(p=>inBounds(p.x,p.y)):[]})),reinforcements:Array.isArray(migrated.reinforcements)?migrated.reinforcements.filter(w=>w&&typeof w.id==='string'&&Number.isInteger(w.atTick)&&w.atTick>=1&&!!UNIT_DEFINITIONS[w.type]&&inBounds(w.x,w.y)&&w.count>0&&w.count<=30).map(w=>({...w})):[],selectedUnitId:typeof migrated.selectedUnitId==='string'?migrated.selectedUnitId:null};}
}
