import { WeaponType, ArmorType, WEAPON_DEFINITIONS, ARMOR_DEFINITIONS } from '@data/CombatData';
import { Inventory } from './Inventory';

export interface Equipment {
  weapon: WeaponType;
  armor: ArmorType;
}

export class EquipmentSystem {
  private equipment: Equipment = {
    weapon: WeaponType.MELEE_DAGGER,
    armor: ArmorType.NONE,
  };

  constructor(_inventory?: Inventory, startingEquipment?: Partial<Equipment>) {
    this.deserialize(startingEquipment);
  }

  getEquipment(): Equipment {
    return { ...this.equipment };
  }

  equipWeapon(weapon: WeaponType, year?: number): { success: boolean; message: string } {
    if (!WEAPON_DEFINITIONS[weapon]) {
      return { success: false, message: 'Invalid weapon' };
    }
    if (!WEAPON_DEFINITIONS[weapon].historicallyPlausible) {
      return { success: false, message: 'Weapon not historically appropriate' };
    }
    const earliest=WEAPON_DEFINITIONS[weapon].minYear;
    if(year!==undefined&&earliest!==undefined&&year<earliest)return {success:false,message:'Bu silah bu tarih döneminde henüz uygun değil.'};
    this.equipment.weapon = weapon;
    return { success: true, message: `Equipped ${WEAPON_DEFINITIONS[weapon].name}` };
  }

  equipArmor(armor: ArmorType): { success: boolean; message: string } {
    if (!ARMOR_DEFINITIONS[armor]) {
      return { success: false, message: 'Invalid armor' };
    }
    if (!ARMOR_DEFINITIONS[armor].historicallyPlausible) {
      return { success: false, message: 'Armor not historically appropriate' };
    }
    this.equipment.armor = armor;
    return { success: true, message: `Equipped ${ARMOR_DEFINITIONS[armor].name}` };
  }

  getWeaponStats() {
    return WEAPON_DEFINITIONS[this.equipment.weapon];
  }

  getArmorStats() {
    return ARMOR_DEFINITIONS[this.equipment.armor];
  }

  serialize(): Equipment {
    return { ...this.equipment };
  }

  deserialize(data: Partial<Equipment> | null | undefined): void {
    if (!data) return;
    if (data.weapon && WEAPON_DEFINITIONS[data.weapon]) {
      this.equipment.weapon = data.weapon;
    }
    if (data.armor && ARMOR_DEFINITIONS[data.armor]) {
      this.equipment.armor = data.armor;
    }
  }
}
