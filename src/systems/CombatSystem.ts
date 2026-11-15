import { COMBAT_CONFIG, WeaponType, WEAPON_DEFINITIONS, ArmorType, ARMOR_DEFINITIONS } from '@data/CombatData';

export interface CombatantStats {
  maxHealth: number;
  health: number;
  maxStamina: number;
  stamina: number;
  damage: number;
  defense: number;
  range: number;
  cooldownMs: number;
  staminaCost: number;
  alive: boolean;
}

export interface AttackResult {
  hit: boolean;
  damage: number;
  killed: boolean;
  message: string;
}

export class CombatSystem {
  calculateDamage(
    attackerDamage: number,
    defenderDefense: number,
    attackerWeapon: WeaponType,
    criticalChance: number = COMBAT_CONFIG.critChance,
  ): { damage: number; critical: boolean } {
    const weapon = WEAPON_DEFINITIONS[attackerWeapon];
    let damage = attackerDamage + weapon.damage;
    let critical = false;

    if (Math.random() < criticalChance) {
      damage = Math.floor(damage * COMBAT_CONFIG.critMultiplier);
      critical = true;
    }

    damage = Math.max(1, damage - defenderDefense);
    return { damage, critical };
  }

  applyDamage(combatant: CombatantStats, damage: number): AttackResult {
    if (!combatant.alive) {
      return { hit: false, damage: 0, killed: false, message: 'Target already defeated' };
    }

    combatant.health -= damage;
    if (combatant.health <= 0) {
      combatant.health = 0;
      combatant.alive = false;
      return { hit: true, damage, killed: true, message: 'Enemy defeated' };
    }

    return { hit: true, damage, killed: false, message: `Hit for ${damage} damage` };
  }

  /** Non-graphic field recovery restores health after the player takes days to rest. */
  recoverHealth(combatant: CombatantStats, amount: number): number {
    const before=combatant.health;
    combatant.health=Math.min(combatant.maxHealth,combatant.health+Math.max(0,amount));
    if(combatant.health>0)combatant.alive=true;
    return combatant.health-before;
  }

  canAttack(
    attacker: CombatantStats,
    lastAttackTime: number,
    currentTime: number,
  ): { canAttack: boolean; reason?: string } {
    if (!attacker.alive) {
      return { canAttack: false, reason: 'Attacker defeated' };
    }
    if (attacker.stamina < attacker.staminaCost) {
      return { canAttack: false, reason: 'Not enough stamina' };
    }
    if (currentTime - lastAttackTime < attacker.cooldownMs) {
      return { canAttack: false, reason: 'Attack on cooldown' };
    }
    return { canAttack: true };
  }

  performAttack(
    attacker: CombatantStats,
    defender: CombatantStats,
    attackerWeapon: WeaponType,
    currentTime: number,
    lastAttackTime: number,
  ): { result: AttackResult; newLastAttackTime: number; staminaConsumed: boolean } {
    const attackCheck = this.canAttack(attacker, lastAttackTime, currentTime);
    if (!attackCheck.canAttack) {
      return {
        result: { hit: false, damage: 0, killed: false, message: attackCheck.reason || 'Cannot attack' },
        newLastAttackTime: lastAttackTime,
        staminaConsumed: false,
      };
    }

    const distance = 1.0; // Simplified - actual range check done externally
    if (distance > attacker.range) {
      return {
        result: { hit: false, damage: 0, killed: false, message: 'Out of range' },
        newLastAttackTime: lastAttackTime,
        staminaConsumed: false,
      };
    }

    attacker.stamina -= attacker.staminaCost;
    const { damage, critical } = this.calculateDamage(attacker.damage, defender.defense, attackerWeapon);
    const result = this.applyDamage(defender, damage);
    
    if (critical && result.hit) {
      result.message = `Critical hit! ${result.message}`;
    }

    return {
      result,
      newLastAttackTime: currentTime,
      staminaConsumed: true,
    };
  }

  regenerateStamina(combatant: CombatantStats, deltaSeconds: number): void {
    if (!combatant.alive) return;
    combatant.stamina = Math.min(combatant.maxStamina, combatant.stamina + COMBAT_CONFIG.staminaRegenRate * deltaSeconds);
  }

  createPlayerCombatant(weapon: WeaponType, armor: ArmorType): CombatantStats {
    const weaponDef = WEAPON_DEFINITIONS[weapon];
    const armorDef = ARMOR_DEFINITIONS[armor];
    return {
      maxHealth: COMBAT_CONFIG.maxHealth,
      health: COMBAT_CONFIG.maxHealth,
      maxStamina: COMBAT_CONFIG.maxStamina,
      stamina: COMBAT_CONFIG.maxStamina,
      damage: COMBAT_CONFIG.baseDamage,
      defense: armorDef.defense,
      range: weaponDef.range,
      cooldownMs: weaponDef.cooldownMs,
      staminaCost: weaponDef.staminaCost,
      alive: true,
    };
  }

  createEnemyCombatant(health: number, damage: number, defense: number, range: number): CombatantStats {
    return {
      maxHealth: health,
      health: health,
      maxStamina: 50,
      stamina: 50,
      damage: damage,
      defense: defense,
      range: range,
      cooldownMs: 1000,
      staminaCost: 10,
      alive: true,
    };
  }
}
