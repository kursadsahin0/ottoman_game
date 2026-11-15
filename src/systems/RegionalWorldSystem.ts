import { REGIONAL_LOCATIONS, type RegionalLocation } from '@data/RegionalWorldData';
import type { GameTime } from './TimeManager';
import type { VillageWeather } from '../village/types';

export interface RegionalMarketState { stock: Record<string, Record<string, number>> }
export interface RegionalProperty { id:string; locationId:string; name:string; tenure:string; acquiredDay:number; plots:number }
export interface RegionalWorldState { currentLocationId:string; visited:string[]; markets:RegionalMarketState; properties:RegionalProperty[]; travelLog:string[] }
export interface TravelResult { success:boolean; message:string; days?:number; interrupted?:boolean }

const initialState = ():RegionalWorldState => ({ currentLocationId:'kizilca_village', visited:['kizilca_village'], markets:{stock:Object.fromEntries(REGIONAL_LOCATIONS.map(l=>[l.id,{...l.economy.stock}]))}, properties:[], travelLog:[] });
export class RegionalWorldSystem {
  private state=initialState();
  getState():RegionalWorldState { return JSON.parse(JSON.stringify(this.state)); }
  getCurrent():RegionalLocation { return this.getLocation(this.state.currentLocationId); }
  getLocation(id:string):RegionalLocation { const location=REGIONAL_LOCATIONS.find(l=>l.id===id); if(!location)throw new Error(`Unknown regional location: ${id}`); return location; }
  getLocations(year:number):RegionalLocation[] { return REGIONAL_LOCATIONS.filter(l=>year>=l.availableFrom&&(l.availableUntil===undefined||year<=l.availableUntil)); }
  getProperties():RegionalProperty[] { return this.state.properties.map(p=>({...p})); }
  canTravelTo(id:string,year:number):boolean { return this.getLocations(year).some(l=>l.id===id)&&this.getCurrent().neighbors.some(n=>n.id===id); }
  travel(id:string,year:number,time:GameTime,advanceDay:()=>void,weather:VillageWeather='clear',method:'foot'|'pack_animal'='foot',onDay?:(day:number)=>boolean):TravelResult {
    if(!this.canTravelTo(id,year))return {success:false,message:'Bu konumdan seçilen yere doğrudan yol yok.'};
    const route=this.getCurrent().neighbors.find(n=>n.id===id)!;
    const terrain=route.terrain.includes('orman')||route.terrain.includes('dağ')?1.45:route.terrain.includes('bozkır')?1.1:1;
    const pace=method==='pack_animal'?1.35:1;
    const weatherCost=weather==='snow'?1.5:weather==='rain'?1.2:weather==='fog'?1.18:weather==='wind'?1.12:1;
    const duration=Math.max(1,Math.ceil(route.distance*terrain*weatherCost/(20*pace)));
    for(let i=0;i<duration;i++){advanceDay();if(onDay?.(i+1)){this.state.travelLog.push(`${time.year}: ${this.getCurrent().name} yolunda tarihsel olay için konaklandı.`);return {success:true,message:'Önemli bir tarihsel gelişme yaklaşırken yolculuk durdu; önce olayları ele alın.',days:i+1,interrupted:true};}}
    this.state.currentLocationId=id;if(!this.state.visited.includes(id))this.state.visited.push(id);
    const food=this.state.travelLog.length; // Stable route/day event seed; no per-frame randomness.
    const event=(route.distance+Math.floor(time.totalDays)+food)%5===0;
    const loc=this.getLocation(id);const eventText=event?'Yolda bir kervanla karşılaşıldı; erzak tüketimi arttı.':'Yolculuk olaysız tamamlandı.';
    this.state.travelLog.push(`${loc.name}: ${duration} gün; ${eventText}`);
    return {success:true,message:`${loc.name} konumuna ${duration} günde ulaşıldı. ${eventText}`,days:duration};
  }
  getStock(locationId:string,itemId:string):number { return this.state.markets.stock[locationId]?.[itemId]??0; }
  getPrice(locationId:string,itemId:string):number { const loc=this.getLocation(locationId);const base=loc.economy.prices[itemId]??0;if(base<=0)return 0;const stock=this.getStock(locationId,itemId),demand=loc.economy.demand[itemId]??4;const supplyFactor=stock<=0?1.8:stock<demand?1.25:stock>demand*2?0.8:1;return Math.max(1,Math.ceil(base*supplyFactor*loc.economy.transportCost)); }
  trade(locationId:string,itemId:string,quantity:number,side:'buy'|'sell',inventory:{getItemCount(id:string):number;addItem(id:string,n:number):boolean;removeItem(id:string,n:number):boolean},currency:{getCurrency():number;addCurrency(n:number):void;removeCurrency(n:number):boolean}):{success:boolean;message:string} {
    const stock=this.getStock(locationId,itemId),price=this.getPrice(locationId,itemId);if(!price||quantity<1||!Number.isInteger(quantity))return {success:false,message:'Geçersiz ürün veya miktar.'};
    if(side==='buy'){const total=price*quantity;if(stock<quantity)return {success:false,message:'Yerel stok bu miktarı karşılamıyor.'};if(currency.getCurrency()<total)return {success:false,message:`${total} akçe gerekli.`};if(!inventory.addItem(itemId,quantity))return {success:false,message:'Envanterde yeterli yer yok.'};currency.removeCurrency(total);this.state.markets.stock[locationId]![itemId]=stock-quantity;return {success:true,message:`${quantity} adet alındı · ${total} akçe.`};}
    if(inventory.getItemCount(itemId)<quantity)return {success:false,message:'Satılacak yeterli ürün yok.'};if(!inventory.removeItem(itemId,quantity))return {success:false,message:'Satış tamamlanamadı.'};const total=Math.max(1,Math.floor(price*0.65))*quantity;currency.addCurrency(total);this.state.markets.stock[locationId]![itemId]=stock+quantity;return {success:true,message:`${quantity} adet satıldı · ${total} akçe.`};
  }
  acquireProperty(locationId:string,day:number,landRights:number,influence:number,currency:{getCurrency():number;removeCurrency(n:number):boolean}):{success:boolean;message:string;property?:RegionalProperty} {
    const loc=this.getLocation(locationId),rule=loc.tenure;if(!rule)return {success:false,message:'Bu konumda edinilebilir bir tarla/işletme bulunmuyor.'};if(landRights<1||influence<rule.requiresInfluence)return {success:false,message:'Yerel arazi hakkı ve yeterli nüfuz gerekli.'};if(currency.getCurrency()<rule.cost)return {success:false,message:`Kira bedeli ${rule.cost} akçe.`};if(!currency.removeCurrency(rule.cost))return {success:false,message:'Ödeme yapılamadı.'};
    const property:RegionalProperty={id:`lease_${locationId}_${day}_${this.state.properties.length+1}`,locationId,name:`${loc.name} ortak kullanım kirası`,tenure:rule.rule,acquiredDay:day,plots:rule.plots};this.state.properties.push(property);return {success:true,message:`${loc.name} için ${rule.rule==='market_lease'?'pazar kirası':'yerel kullanım hakkı'} alındı (${rule.plots} tarla). Bu oyun içi kullanım hakkıdır; modern tapu iddiası değildir.`,property};
  }
  serialize():RegionalWorldState { return this.getState(); }
  deserialize(raw:Partial<RegionalWorldState>|undefined):void { const id=raw?.currentLocationId;if(!raw||typeof id!=='string'||!REGIONAL_LOCATIONS.some(l=>l.id===id))return;const next=initialState();next.currentLocationId=id;next.visited=Array.isArray(raw.visited)?raw.visited.filter(id=>REGIONAL_LOCATIONS.some(l=>l.id===id)):next.visited;next.properties=Array.isArray(raw.properties)?raw.properties.filter(p=>!!p&&typeof p.id==='string'&&REGIONAL_LOCATIONS.some(l=>l.id===p.locationId)).map(p=>({...p})):[];next.travelLog=Array.isArray(raw.travelLog)?raw.travelLog.filter((x):x is string=>typeof x==='string').slice(-50):[];if(raw.markets?.stock)for(const loc of REGIONAL_LOCATIONS){const saved=raw.markets.stock[loc.id];if(saved)for(const [id,n] of Object.entries(saved))if(Number.isFinite(n)&&n>=0)next.markets.stock[loc.id]![id]=n;}this.state=next; }
}
