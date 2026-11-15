import { Scene } from 'phaser';
import { Economy } from './Economy';
import { Inventory } from './Inventory';
import { TimeManager } from './TimeManager';
import { ITEM_DEFINITIONS, MARKET_CAPITAL_CONFIG, MARKET_CONFIG, MARKET_STOCK_CONFIG } from '@data/EconomyData';
import { CROP_DEFINITIONS } from '@data/CropData';
import { registerUi } from '@utils/CameraLayers';
import { ProfessionSystem } from './ProfessionSystem';
import { getMarketPriceFactor } from './MarketPricing';

export interface MarketSerializedState {
  stock: Array<[string, number]>;
  lastRestockDay: number;
  demand?: Record<string, number>;
  merchantCapital?: number;
  routeDisruption?: number;
}

/**
 * The village market. Buys the player's surplus crops and sells seeds/tools.
 * Stock is consumed on purchase and replenished on a configurable cadence.
 */
export class MarketSystem {
  private scene: Scene;
  private economy: Economy;
  private inventory: Inventory;
  private timeManager: TimeManager;
  private menu: Phaser.GameObjects.Container | null = null;
  private stock = new Map<string, number>();
  private lastRestockDay = 0;
  private businessOpen = true;
  private professions: ProfessionSystem | null;
  private politicalStanding = 8;
  private demand = new Map<string, number>();
  private merchantCapital: number = MARKET_CAPITAL_CONFIG.starting;
  private routeDisruption = 0;

  constructor(scene: Scene, economy: Economy, inventory: Inventory, professions?: ProfessionSystem) {
    this.scene = scene;
    this.economy = economy;
    this.inventory = inventory;
    this.professions = professions ?? null;
    this.timeManager = TimeManager.getInstance();
    this.restock();
    this.lastRestockDay = this.timeManager.getTime().totalDays;

    this.scene.events.once('shutdown', () => this.destroy());
  }

  /** Called each frame; restocks when the configured number of days pass. */
  public update(): void {
    const currentDay = this.timeManager.getTime().totalDays;
    if (currentDay - this.lastRestockDay >= MARKET_CONFIG.stockRefreshDays) {
      this.restock();
      this.lastRestockDay = currentDay;
      this.merchantCapital = Math.min(MARKET_CAPITAL_CONFIG.maximum, this.merchantCapital + MARKET_CAPITAL_CONFIG.weeklyCaravanCapital);
      for (const [itemId, amount] of this.demand) this.demand.set(itemId, Math.max(0, amount - 1));
    }
  }

  private restock(): void {
    for (const [itemId, quantity] of Object.entries(MARKET_STOCK_CONFIG)) {
      this.stock.set(itemId, Math.min(quantity, (this.stock.get(itemId) ?? 0) + quantity));
    }
  }

  public getStock(itemId: string): number {
    return this.stock.get(itemId) ?? 0;
  }

  public setTradeRouteDisruption(amount: number): void { this.routeDisruption = Math.max(0, Math.min(1, Number.isFinite(amount) ? amount : 0)); }
  public getMerchantCapital(): number { return this.merchantCapital; }

  /** Price pressure follows finite local stock, recorded purchases and route costs, bounded to avoid runaway prices. */
  private getMarketFactor(itemId: string): number {
    return getMarketPriceFactor(this.getStock(itemId), MARKET_STOCK_CONFIG[itemId] ?? 8, this.demand.get(itemId) ?? 0, this.routeDisruption);
  }

  public isOpen(): boolean {
    return this.menu !== null;
  }

  public openMarket(): void {
    if (!this.businessOpen) {
      this.showFeedback('Pazar kapalı; satıcılar gündüz vakti tezgâhta.', false);
      return;
    }
    this.showMarketMenu();
  }

  public setBusinessOpen(open: boolean): void {
    this.businessOpen = open;
    if (!open) this.closeMarket();
  }

  /** Merchant trust improves buying and selling terms; hostility can modestly worsen them. */
  public setPoliticalStanding(standing: number): void {
    this.politicalStanding = Math.max(0, Math.min(100, Math.floor(standing)));
    if (this.menu) this.refreshMenu();
  }

  private getPoliticalTradeModifier(): number {
    return Math.max(-0.06, Math.min(0.06, (this.politicalStanding - 10) * 0.0012));
  }

  private getBuyModifier(): number {
    return Math.max(-0.06, Math.min(0.1, (this.professions?.getTradeDiscount() ?? 0) + this.getPoliticalTradeModifier()));
  }

  private getSellModifier(): number {
    return Math.max(-0.06, Math.min(0.1, (this.professions?.getTradeDiscount() ?? 0) + this.getPoliticalTradeModifier()));
  }

  private getSellableQuantity(itemId: string): number {
    const capacity = Math.max(0, (MARKET_STOCK_CONFIG[itemId] ?? 8) * MARKET_CAPITAL_CONFIG.unitsPerItem - this.getStock(itemId));
    const unitPrice = Math.max(1, Math.floor(this.economy.getSellPrice(itemId) * this.getMarketFactor(itemId) * (1 + this.getSellModifier())));
    return Math.min(this.inventory.getItemCount(itemId), capacity, Math.floor(this.merchantCapital / unitPrice));
  }

  private requestConfirmation(message: string, callback: () => void): void {
    if (!this.menu) return;
    const modal = this.scene.add.container(0, 0);
    const shade = this.scene.add.graphics();shade.fillStyle(0x100c08,0.96);shade.fillRoundedRect(-210,-54,420,108,9);shade.lineStyle(2,0xb18a52,1);shade.strokeRoundedRect(-210,-54,420,108,9);
    const text=this.scene.add.text(0,-32,message,{fontFamily:'Arial',fontSize:'11px',color:'#f0dfbd',align:'center',wordWrap:{width:380}}).setOrigin(0.5,0.5);
    modal.add([shade,text]);
    modal.add(this.createButton(-105,25,'Onayla',true,()=>{modal.destroy();callback();}));
    modal.add(this.createButton(105,25,'İptal',true,()=>modal.destroy()));
    this.menu.add(modal);
  }

  public isBusinessOpen(): boolean { return this.businessOpen; }

  public closeMarket(): void {
    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
    }
  }

  public buy(itemId: string): void {
    if (this.getStock(itemId) <= 0) {
      this.showFeedback('Pazarda stok kalmadı (Out of stock)', false);
      return;
    }

    const result = this.economy.buyItem(itemId, 1, this.getBuyModifier(), this.getMarketFactor(itemId));
    this.showFeedback(result.message, result.success);
    if (result.success) {
      this.stock.set(itemId, this.getStock(itemId) - 1);
      this.demand.set(itemId, (this.demand.get(itemId) ?? 0) + 1);
      this.merchantCapital = Math.min(MARKET_CAPITAL_CONFIG.maximum, this.merchantCapital + Math.abs(result.amount ?? 0));
      this.professions?.recordTrade('buy', itemId, 1, Math.floor(this.timeManager.getTime().totalDays));
      this.refreshMenu();
    }
  }

  public sellAll(itemId: string): void {
    const owned = this.inventory.getItemCount(itemId);
    if (owned <= 0) {
      this.showFeedback('Satılacak ürün yok (Nothing to sell)', false);
      return;
    }

    const quantity = this.getSellableQuantity(itemId);
    if (quantity <= 0) { this.showFeedback('Tüccarın sermayesi veya deposu bu ürün için yetersiz.', false); return; }
    const result = this.economy.sellItem(itemId, quantity, this.getSellModifier(), this.getMarketFactor(itemId));
    this.showFeedback(result.message, result.success);
    if (result.success) { this.merchantCapital = Math.max(0, this.merchantCapital - (result.amount ?? 0)); this.stock.set(itemId, this.getStock(itemId) + quantity); this.professions?.recordTrade('sell', itemId, quantity, Math.floor(this.timeManager.getTime().totalDays)); this.refreshMenu(); }
  }

  private refreshMenu(): void {
    if (this.menu) this.showMarketMenu();
  }

  private showMarketMenu(): void {
    this.closeMarket();

    const { width, height } = this.scene.scale;
    this.menu = this.scene.add.container(width / 2, height / 2);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x241a10, 0.97);
    bg.fillRoundedRect(-230, -190, 460, 380, 12);
    bg.lineStyle(2, 0x8b7355, 1);
    bg.strokeRoundedRect(-230, -190, 460, 380, 12);

    const title = this.scene.add.text(0, -165, `Köy Pazarı · Akçe ${this.economy.getCurrency()} · Tüccar ${this.merchantCapital}`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#d4af37',
    });
    title.setOrigin(0.5, 0.5);

    const sellHeader = this.scene.add.text(-115, -132, 'SAT / SELL', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#b7e4a0',
    });
    sellHeader.setOrigin(0.5, 0.5);

    const buyHeader = this.scene.add.text(115, -132, 'AL / BUY', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#f0cf8a',
    });
    buyHeader.setOrigin(0.5, 0.5);

    const children: Phaser.GameObjects.GameObject[] = [bg, title, sellHeader, buyHeader];

    let sellY = -105;
    for (const crop of Object.values(CROP_DEFINITIONS)) {
      const count = this.inventory.getItemCount(crop.harvestItemId);
      const price = Math.max(1, Math.floor(this.economy.getSellPrice(crop.harvestItemId) * this.getMarketFactor(crop.harvestItemId) * (1 + this.getSellModifier())));
      const label = count > 0
        ? `${crop.name} x${count} — ${price} akçe/adet`
        : `${crop.name} — yok (none)`;
      children.push(this.createButton(-115, sellY, label, count > 0, () => {
        const quantity=this.getSellableQuantity(crop.harvestItemId);
        const unit=Math.max(1,Math.floor(this.economy.getSellPrice(crop.harvestItemId)*this.getMarketFactor(crop.harvestItemId)*(1+this.getSellModifier())));
        this.requestConfirmation(`${quantity} birim ${crop.name} · yaklaşık ${quantity*unit} akçe`,()=>this.sellAll(crop.harvestItemId));
      }));
      sellY += 36;
    }

    let buyY = -105;
    const buyables = ['seed_wheat', 'seed_barley', 'seed_oats', 'wheat', 'barley', 'oats', 'arrows'];
    // Only offer a hoe if the player actually lacks one.
    if (!this.inventory.hasItem('hoe')) buyables.push('hoe');

    for (const itemId of buyables) {
      const def = ITEM_DEFINITIONS[itemId];
      if (!def) continue;
      const price = Math.max(1, Math.floor(this.economy.getBuyPrice(itemId) * this.getMarketFactor(itemId) * (1 - this.getBuyModifier())));
      const stock = this.getStock(itemId);
      children.push(this.createButton(
        115,
        buyY,
        `${def.name} — ${price} akçe (stok ${stock})`,
        stock > 0,
        () => {
          const cost=Math.max(1,Math.floor(this.economy.getBuyPrice(itemId)*this.getMarketFactor(itemId)*(1-this.getBuyModifier())));
          this.requestConfirmation(`1 ${def.name} · ${cost} akçe`,()=>this.buy(itemId));
        },
      ));
      buyY += 36;
    }

    const hint = this.scene.add.text(0, 118, `Envanter ${this.inventory.getUsedSlots()}/${this.inventory.getMaxSlots()} · Stok azaldıkça fiyat yükselir · Haftalık kervan yeniler`, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#b8a88c',
    });
    hint.setOrigin(0.5, 0.5);
    children.push(hint);

    const closeBtn = this.scene.add.text(205, -165, 'X', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ff7b6b',
    });
    closeBtn.setOrigin(0.5, 0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeMarket());
    children.push(closeBtn);

    const resumeHint = this.scene.add.text(0, 150, 'Kapatmak için X', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: '#8a7a65',
    });
    resumeHint.setOrigin(0.5, 0.5);
    children.push(resumeHint);

    this.menu.add(children);
    this.menu.setScrollFactor(0);
    this.menu.setDepth(500);
    registerUi(this.scene, this.menu);
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    enabled: boolean,
    callback: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();

    const draw = (hover: boolean): void => {
      const fill = !enabled ? 0x2f2a22 : hover ? 0x5a4738 : 0x453526;
      bg.clear();
      bg.fillStyle(fill, 1);
      bg.fillRoundedRect(-105, -14, 210, 28, 5);
      bg.lineStyle(1, enabled ? 0x8b7355 : 0x554a3c, 1);
      bg.strokeRoundedRect(-105, -14, 210, 28, 5);
    };
    draw(false);

    const label = this.scene.add.text(0, 0, text, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: enabled ? '#ffffff' : '#7a6f60',
    });
    label.setOrigin(0.5, 0.5);

    container.add([bg, label]);
    container.setSize(210, 28);

    if (enabled) {
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', callback);
      container.on('pointerover', () => draw(true));
      container.on('pointerout', () => draw(false));
    }

    return container;
  }

  private showFeedback(message: string, success: boolean): void {
    const { width, height } = this.scene.scale;
    const feedback = this.scene.add.text(width / 2, height - 150, message, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: success ? '#b7e4a0' : '#ff9b8d',
      backgroundColor: '#1a120bcc',
      padding: { x: 10, y: 6 },
    });
    feedback.setOrigin(0.5, 0.5);
    feedback.setScrollFactor(0);
    feedback.setDepth(510);
    registerUi(this.scene, feedback);

    this.scene.tweens.add({
      targets: feedback,
      alpha: 0,
      y: feedback.y - 20,
      delay: 1200,
      duration: 500,
      onComplete: () => feedback.destroy(),
    });
  }

  public serialize(): MarketSerializedState {
    return {
      stock: Array.from(this.stock.entries()),
      lastRestockDay: this.lastRestockDay,
      demand: Object.fromEntries(this.demand),
      merchantCapital: this.merchantCapital,
      routeDisruption: this.routeDisruption,
    };
  }

  public deserialize(data: MarketSerializedState | null | undefined): void {
    if (!data) return;
    if (Array.isArray(data.stock)) {
      for (const [itemId, quantity] of data.stock) {
        if (typeof itemId === 'string' && typeof quantity === 'number') {
          this.stock.set(itemId, quantity);
        }
      }
    }
    if (typeof data.lastRestockDay === 'number') {
      this.lastRestockDay = data.lastRestockDay;
    }
    if (data.demand && typeof data.demand === 'object') this.demand = new Map(Object.entries(data.demand).filter((entry): entry is [string, number] => Number.isFinite(entry[1]) && entry[1] >= 0));
    if (Number.isFinite(data.merchantCapital)) this.merchantCapital = Math.max(0, Math.min(MARKET_CAPITAL_CONFIG.maximum, data.merchantCapital as number));
    if (Number.isFinite(data.routeDisruption)) this.routeDisruption = Math.max(0, Math.min(1, data.routeDisruption as number));
  }

  public destroy(): void {
    this.closeMarket();
  }
}
