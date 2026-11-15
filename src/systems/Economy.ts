import { ITEM_DEFINITIONS, MARKET_CONFIG, FARM_ECONOMY_CONFIG } from '@data/EconomyData';
import { CROP_DEFINITIONS } from '@data/CropData';
import { Inventory } from './Inventory';
import { Season, TimeManager } from './TimeManager';

export interface TransactionResult {
  success: boolean;
  message: string;
  amount?: number;
}

/**
 * Akçe-based local economy. Prices come exclusively from data tables so they
 * can be rebalanced without touching this class.
 */
export class Economy {
  private currency: number;
  private inventory: Inventory;

  constructor(inventory: Inventory, startingCurrency = FARM_ECONOMY_CONFIG.startingCurrency) {
    this.inventory = inventory;
    this.currency = Math.max(0, Math.floor(startingCurrency));
  }

  public getCurrency(): number {
    return this.currency;
  }

  public addCurrency(amount: number): void {
    this.currency += Math.max(0, Math.floor(amount));
  }

  public removeCurrency(amount: number): boolean {
    if (amount < 0 || this.currency < amount) return false;
    this.currency -= amount;
    return true;
  }

  public canAfford(amount: number): boolean {
    return this.currency >= amount;
  }

  /** Price the market charges the player. */
  public getBuyPrice(itemId: string): number {
    const def = ITEM_DEFINITIONS[itemId];
    if (!def) return 0;
    return Math.max(1, Math.ceil(def.baseValue * MARKET_CONFIG.sellMultiplier));
  }

  /** Price the market pays the player. */
  public getSellPrice(itemId: string): number {
    const def = ITEM_DEFINITIONS[itemId];
    if (!def) return 0;
    const crop = Object.values(CROP_DEFINITIONS).find(c => c.harvestItemId === itemId);
    const base = crop ? crop.sellPrice : def.baseValue;
    const season = TimeManager.getInstance().getTime().season;
    const scarcity = crop && season === Season.WINTER ? 1.2 : crop && season === Season.SUMMER ? 1.05 : crop && season === Season.AUTUMN ? 0.92 : 1;
    return Math.max(1, Math.floor(base * MARKET_CONFIG.buyMultiplier * scarcity));
  }

  public buyItem(itemId: string, quantity = 1, discount = 0, marketFactor = 1): TransactionResult {
    const def = ITEM_DEFINITIONS[itemId];
    if (!def) return { success: false, message: 'Bilinmeyen ürün (Unknown item)' };
    if (quantity <= 0) return { success: false, message: 'Geçersiz miktar (Invalid quantity)' };

    const factor = Math.max(0.75, Math.min(1.4, Number.isFinite(marketFactor) ? marketFactor : 1));
    const price = Math.max(1, Math.floor(this.getBuyPrice(itemId) * factor * (1 - Math.max(-0.1, Math.min(0.1, discount)))));
    const totalCost = price * quantity;

    if (!this.canAfford(totalCost)) {
      return {
        success: false,
        message: `Yetersiz akçe — ${totalCost} gerekli (Insufficient funds)`,
      };
    }

    if (!this.inventory.addItem(itemId, quantity)) {
      return { success: false, message: 'Envanter dolu (Inventory full)' };
    }

    this.removeCurrency(totalCost);
    return {
      success: true,
      message: `${quantity}x ${def.name} alındı — ${totalCost} akçe`,
      amount: -totalCost,
    };
  }

  public sellItem(itemId: string, quantity = 1, premium = 0, marketFactor = 1): TransactionResult {
    const def = ITEM_DEFINITIONS[itemId];
    if (!def) return { success: false, message: 'Bilinmeyen ürün (Unknown item)' };
    if (quantity <= 0) return { success: false, message: 'Geçersiz miktar (Invalid quantity)' };
    if (!this.inventory.hasItem(itemId, quantity)) {
      return { success: false, message: 'Yeterli ürün yok (Not enough goods)' };
    }

    const factor = Math.max(0.75, Math.min(1.4, Number.isFinite(marketFactor) ? marketFactor : 1));
    const price = Math.max(1, Math.floor(this.getSellPrice(itemId) * factor * (1 + Math.max(-0.1, Math.min(0.1, premium)))));
    const totalEarned = price * quantity;

    if (!this.inventory.removeItem(itemId, quantity)) {
      return { success: false, message: 'İşlem başarısız (Transaction failed)' };
    }

    this.addCurrency(totalEarned);
    return {
      success: true,
      message: `${quantity}x ${def.name} satıldı +${totalEarned} akçe`,
      amount: totalEarned,
    };
  }

  public serialize(): { currency: number } {
    return { currency: this.currency };
  }

  public deserialize(data: { currency?: number } | null | undefined): void {
    if (data && typeof data.currency === 'number' && data.currency >= 0) {
      this.currency = Math.floor(data.currency);
    }
  }
}
