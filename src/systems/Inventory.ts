import { ITEM_DEFINITIONS, FARM_ECONOMY_CONFIG } from '@data/EconomyData';

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export class Inventory {
  private items: Map<string, number> = new Map();
  private maxSlots = 20;
  private maxStackSize = 99;

  constructor(startingItems?: Record<string, number>) {
    const items = startingItems ?? { hoe: 1, ...FARM_ECONOMY_CONFIG.startingSeeds };
    for (const [itemId, quantity] of Object.entries(items)) this.addItem(itemId, quantity);
  }

  public addItem(itemId: string, quantity: number): boolean {
    const def = ITEM_DEFINITIONS[itemId];
    if (!def) return false;
    if (quantity <= 0) return false;

    if (def.stackable) {
      const current = this.items.get(itemId) ?? 0;
      const capacity = Math.min(def.maxStack || this.maxStackSize, this.maxStackSize);
      if (current + quantity > capacity) return false;
      this.items.set(itemId, current + quantity);
      return true;
    }

    if (quantity !== 1) return false;
    if (this.items.has(itemId)) return false;
    if (this.getUsedSlots() >= this.maxSlots) return false;
    this.items.set(itemId, 1);
    return true;
  }

  public removeItem(itemId: string, quantity: number): boolean {
    const current = this.items.get(itemId) ?? 0;
    if (quantity <= 0 || current < quantity) return false;

    const remaining = current - quantity;
    if (remaining === 0) {
      this.items.delete(itemId);
    } else {
      this.items.set(itemId, remaining);
    }
    return true;
  }

  public hasItem(itemId: string, quantity = 1): boolean {
    return (this.items.get(itemId) ?? 0) >= quantity;
  }

  public getItemCount(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  public getAllItems(): InventoryItem[] {
    return Array.from(this.items.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  public getUsedSlots(): number {
    return this.items.size;
  }

  public getMaxSlots(): number {
    return this.maxSlots;
  }

  public isFull(): boolean {
    return this.getUsedSlots() >= this.maxSlots;
  }

  public serialize(): { items: Array<[string, number]>; maxSlots: number } {
    return {
      items: Array.from(this.items.entries()),
      maxSlots: this.maxSlots,
    };
  }

  public deserialize(data: { items?: Array<[string, number]>; maxSlots?: number } | null | undefined): void {
    this.items.clear();
    if (data?.items) {
      for (const [itemId, quantity] of data.items) {
        if (typeof itemId === 'string' && typeof quantity === 'number' && quantity > 0) {
          this.items.set(itemId, quantity);
        }
      }
    }
    if (typeof data?.maxSlots === 'number' && data.maxSlots > 0) {
      this.maxSlots = data.maxSlots;
    }
  }
}
