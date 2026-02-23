import { ItemSlot, ItemType, StatType } from '@yggdrasil/shared';
import { GameItem, getItem } from '../data/ItemDatabase';

/**
 * InventoryManager: Manages player inventory and equipment.
 *
 * RotMG-style: 4 equipment slots + 8 bag slots.
 * Items can be equipped, used (consumables), or dropped.
 */

export interface InventorySlot {
  itemId: string | null;
  quantity: number;
}

export interface EquipmentSlots {
  weapon: string | null;
  ability: string | null;
  armor: string | null;
  ring: string | null;
}

export class InventoryManager {
  // 4 equipment slots
  equipment: EquipmentSlots = {
    weapon: null,
    ability: null,
    armor: null,
    ring: null,
  };

  // 8 inventory bag slots
  inventory: InventorySlot[] = [];
  readonly maxSlots: number = 8;

  // Gold
  gold: number = 0;

  // Event callbacks
  private onChanged: (() => void)[] = [];

  constructor() {
    // Initialize empty inventory
    for (let i = 0; i < this.maxSlots; i++) {
      this.inventory.push({ itemId: null, quantity: 0 });
    }
  }

  /** Subscribe to inventory changes */
  onChange(callback: () => void): void {
    this.onChanged.push(callback);
  }

  private notifyChanged(): void {
    this.onChanged.forEach(cb => cb());
  }

  /** Add item to inventory. Returns true if added, false if full. */
  addItem(itemId: string, quantity: number = 1): boolean {
    const item = getItem(itemId);
    if (!item) return false;

    // Try to stack with existing
    if (item.stackable) {
      for (const slot of this.inventory) {
        if (slot.itemId === itemId && slot.quantity < item.maxStack) {
          const canAdd = Math.min(quantity, item.maxStack - slot.quantity);
          slot.quantity += canAdd;
          quantity -= canAdd;
          if (quantity <= 0) {
            this.notifyChanged();
            return true;
          }
        }
      }
    }

    // Find empty slot
    for (const slot of this.inventory) {
      if (slot.itemId === null) {
        slot.itemId = itemId;
        slot.quantity = Math.min(quantity, item.maxStack);
        this.notifyChanged();
        return true;
      }
    }

    return false; // inventory full
  }

  /** Remove item from a specific slot */
  removeFromSlot(slotIndex: number, quantity: number = 1): void {
    const slot = this.inventory[slotIndex];
    if (!slot || !slot.itemId) return;

    slot.quantity -= quantity;
    if (slot.quantity <= 0) {
      slot.itemId = null;
      slot.quantity = 0;
    }
    this.notifyChanged();
  }

  /** Equip item from inventory slot */
  equip(slotIndex: number): GameItem | null {
    const slot = this.inventory[slotIndex];
    if (!slot || !slot.itemId) return null;

    const item = getItem(slot.itemId);
    if (!item || !item.slot) return null;

    // Get current equipped item in that slot
    const equipSlotKey = item.slot as keyof EquipmentSlots;
    const currentEquipped = this.equipment[equipSlotKey];

    // Equip new item
    this.equipment[equipSlotKey] = item.id;
    slot.itemId = null;
    slot.quantity = 0;

    // Put old item back in inventory
    if (currentEquipped) {
      this.addItem(currentEquipped);
    }

    this.notifyChanged();
    return item;
  }

  /** Unequip item from equipment slot to inventory */
  unequip(slotKey: keyof EquipmentSlots): boolean {
    const itemId = this.equipment[slotKey];
    if (!itemId) return false;

    // Check if inventory has space
    const hasSpace = this.inventory.some(s => s.itemId === null);
    if (!hasSpace) return false;

    this.equipment[slotKey] = null;
    this.addItem(itemId);
    this.notifyChanged();
    return true;
  }

  /** Use a consumable from inventory */
  useConsumable(slotIndex: number): GameItem | null {
    const slot = this.inventory[slotIndex];
    if (!slot || !slot.itemId) return null;

    const item = getItem(slot.itemId);
    if (!item) return null;
    if (item.type !== ItemType.Consumable && item.type !== ItemType.StatPotion) return null;

    // Remove one from stack
    this.removeFromSlot(slotIndex, 1);
    return item;
  }

  /** Get all stat bonuses from equipped items */
  getEquipmentBonuses(): Partial<Record<StatType, number>> {
    const bonuses: Partial<Record<StatType, number>> = {};

    for (const itemId of Object.values(this.equipment)) {
      if (!itemId) continue;
      const item = getItem(itemId);
      if (!item?.statBonuses) continue;

      for (const [stat, value] of Object.entries(item.statBonuses)) {
        const s = stat as StatType;
        bonuses[s] = (bonuses[s] || 0) + (value as number);
      }
    }

    return bonuses;
  }

  /** Get equipped weapon (if any) */
  getEquippedWeapon(): GameItem | null {
    if (!this.equipment.weapon) return null;
    return getItem(this.equipment.weapon) ?? null;
  }

  /** Check if inventory has room */
  hasSpace(): boolean {
    return this.inventory.some(s => s.itemId === null);
  }

  /** Count items of a given ID across all inventory */
  countItem(itemId: string): number {
    let count = 0;
    for (const slot of this.inventory) {
      if (slot.itemId === itemId) count += slot.quantity;
    }
    return count;
  }

  /** Give the player starting equipment for their class */
  equipStartingGear(weaponId: string, abilityId: string, armorId: string, ringId: string): void {
    this.equipment.weapon = weaponId;
    this.equipment.ability = abilityId;
    this.equipment.armor = armorId;
    this.equipment.ring = ringId;
    this.notifyChanged();
  }
}
