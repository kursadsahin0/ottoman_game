export enum AIState {
  IDLE = 'idle',
  PATROL = 'patrol',
  DETECTION = 'detection',
  PURSUIT = 'pursuit',
  ATTACK = 'attack',
  RETREAT = 'retreat',
  DEFEAT = 'defeat',
}

export interface AIConfig {
  detectionRange: number;
  attackRange: number;
  pursuitRange: number;
  retreatHealthThreshold: number;
  patrolSpeed: number;
  pursuitSpeed: number;
  attackCooldown: number;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  detectionRange: 4.0,
  attackRange: 1.5,
  pursuitRange: 8.0,
  retreatHealthThreshold: 0.3,
  patrolSpeed: 0.8,
  pursuitSpeed: 1.2,
  attackCooldown: 1000,
};

export class AIStateMachine {
  private currentState: AIState = AIState.IDLE;
  private stateTime: number = 0;
  private lastAttackTime: number = 0;
  private patrolTarget: { x: number; y: number } | null = null;
  private config: AIConfig;

  constructor(config: AIConfig = DEFAULT_AI_CONFIG) {
    this.config = config;
  }

  getState(): AIState {
    return this.currentState;
  }

  setState(state: AIState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.stateTime = 0;
  }

  update(
    delta: number,
    enemyPos: { x: number; y: number },
    playerPos: { x: number; y: number },
    enemyHealthPercent: number,
    canSeePlayer: boolean,
    obstacles: Array<{ x: number; y: number }>,
  ): { action: string; target?: { x: number; y: number }; shouldAttack?: boolean } {
    this.stateTime += delta;

    // Defeat state takes precedence
    if (enemyHealthPercent <= 0) {
      this.setState(AIState.DEFEAT);
      return { action: 'idle' };
    }

    // Retreat if health low
    if (enemyHealthPercent < this.config.retreatHealthThreshold && this.currentState !== AIState.RETREAT) {
      this.setState(AIState.RETREAT);
      return { action: 'retreat', target: this.getRetreatPosition(enemyPos, playerPos) };
    }

    const distanceToPlayer = Math.sqrt(
      Math.pow(playerPos.x - enemyPos.x, 2) + Math.pow(playerPos.y - enemyPos.y, 2)
    );

    switch (this.currentState) {
      case AIState.IDLE:
        if (canSeePlayer && distanceToPlayer <= this.config.detectionRange) {
          this.setState(AIState.DETECTION);
          return { action: 'alert' };
        }
        if (this.stateTime > 2000) {
          this.setState(AIState.PATROL);
          this.patrolTarget = this.getRandomPatrolPoint(enemyPos, obstacles);
        }
        return { action: 'idle' };

      case AIState.DETECTION:
        if (this.stateTime < 500) {
          return { action: 'alert' };
        }
        if (distanceToPlayer <= this.config.attackRange) {
          this.setState(AIState.ATTACK);
          return { action: 'prepare_attack' };
        }
        if (distanceToPlayer <= this.config.pursuitRange) {
          this.setState(AIState.PURSUIT);
        } else {
          this.setState(AIState.IDLE);
        }
        return { action: 'chase' };

      case AIState.PATROL:
        if (canSeePlayer && distanceToPlayer <= this.config.detectionRange) {
          this.setState(AIState.DETECTION);
          return { action: 'alert' };
        }
        if (!this.patrolTarget || distanceToPlayer < 0.3) {
          if (this.stateTime > 3000) {
            this.setState(AIState.IDLE);
            this.patrolTarget = null;
          }
          return { action: 'idle' };
        }
        return { action: 'move', target: this.patrolTarget };

      case AIState.PURSUIT:
        if (distanceToPlayer > this.config.pursuitRange) {
          this.setState(AIState.IDLE);
          return { action: 'idle' };
        }
        if (distanceToPlayer <= this.config.attackRange) {
          this.setState(AIState.ATTACK);
          return { action: 'prepare_attack' };
        }
        return { action: 'chase', target: playerPos };

      case AIState.ATTACK:
        if (distanceToPlayer > this.config.attackRange * 1.2) {
          this.setState(AIState.PURSUIT);
          return { action: 'chase' };
        }
        if (Date.now() - this.lastAttackTime > this.config.attackCooldown) {
          this.lastAttackTime = Date.now();
          return { action: 'attack', shouldAttack: true };
        }
        return { action: 'attack_ready' };

      case AIState.RETREAT:
        if (enemyHealthPercent >= this.config.retreatHealthThreshold * 1.5) {
          this.setState(AIState.IDLE);
          return { action: 'idle' };
        }
        return { action: 'retreat', target: this.getRetreatPosition(enemyPos, playerPos) };

      case AIState.DEFEAT:
        return { action: 'dead' };

      default:
        return { action: 'idle' };
    }
  }

  private getRandomPatrolPoint(currentPos: { x: number; y: number }, obstacles: Array<{ x: number; y: number }>): { x: number; y: number } {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * 3;
      const point = {
        x: currentPos.x + Math.cos(angle) * distance,
        y: currentPos.y + Math.sin(angle) * distance,
      };
      
      // Check if point is blocked by obstacles
      const blocked = obstacles.some(obs => 
        Math.sqrt(Math.pow(obs.x - point.x, 2) + Math.pow(obs.y - point.y, 2)) < 0.8
      );
      
      if (!blocked) {
        return point;
      }
    }
    return currentPos;
  }

  private getRetreatPosition(enemyPos: { x: number; y: number }, playerPos: { x: number; y: number }): { x: number; y: number } {
    const dx = enemyPos.x - playerPos.x;
    const dy = enemyPos.y - playerPos.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return enemyPos;
    
    return {
      x: enemyPos.x + (dx / length) * 3,
      y: enemyPos.y + (dy / length) * 3,
    };
  }

  isInCombatRange(distance: number): boolean {
    return distance <= this.config.attackRange;
  }

  canDetect(distance: number): boolean {
    return distance <= this.config.detectionRange;
  }
}
