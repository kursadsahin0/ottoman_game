import Phaser from 'phaser';
import { IsometricUtils } from '@utils/IsometricUtils';
import { registerWorld } from '@utils/CameraLayers';
import { worldDepth } from '@utils/Depth';
import type { VillageSimulation } from './VillageSimulation';
import type { NpcAnimationState, VillageNpcState } from './types';

const CHARACTER_SCALE = 0.48;
const ACTIVITY_COLORS: Record<string, number> = {
  sleeping: 0x6f7d9c,
  eating: 0xc6a15d,
  working: 0xd9b25e,
  market: 0xe2c77a,
  socializing: 0x8fc3a5,
  patrolling: 0xc26b5d,
  fetching_water: 0x74a9c2,
  idle: 0xa59c82,
  fleeing: 0xe06f61,
  investigating: 0xe0a35d,
  mustering: 0xd45a4f,
};

interface NpcView {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  walkClock: number;
  direction: 'front' | 'back' | 'side';
  flip: boolean;
  lastActivity: string;
  visible: boolean;
}

/**
 * Rendering and animation only. The renderer reads simulation snapshots and
 * never chooses an NPC's goal. Off-screen residents are hidden and skipped
 * before any texture, depth or label work happens.
 */
export class VillageRenderer {
  private readonly views = new Map<string, NpcView>();
  private visibleIds = new Set<string>();
  private lastVisibilityUpdate = 0;
  private lastCameraKey = '';
  private readonly debugGraphics: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly simulation: VillageSimulation,
    private readonly playerMarker: () => { x: number; y: number },
  ) {
    this.debugGraphics = scene.add.graphics().setDepth(52);
    registerWorld(scene, this.debugGraphics);
    for (const npc of simulation.getRoster()) this.createView(npc);
  }

  private createView(npc: VillageNpcState): void {
    const sprite = this.scene.add.image(0, 0, this.textureKey(npc, 'front', 'idle'))
      .setOrigin(0.5, 0.9)
      .setScale(CHARACTER_SCALE);
    const label = this.scene.add.text(0, 0, npc.name, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#f0dfbb',
      backgroundColor: 'rgba(31, 23, 15, 0.72)',
      padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setVisible(false);
    registerWorld(this.scene, sprite, label);
    this.views.set(npc.id, {
      sprite, label, walkClock: 0, direction: 'front', flip: false,
      lastActivity: npc.activity, visible: true,
    });
    this.place(npc);
  }

  private texturePrefix(npc: VillageNpcState): string {
    return `player_${npc.gender === 'female' ? 'female_' : ''}${npc.appearance}_`;
  }

  private textureKey(npc: VillageNpcState, direction: NpcView['direction'], pose: string): string {
    return `${this.texturePrefix(npc)}${direction}_${pose}`;
  }

  private fallbackTexture(npc: VillageNpcState): string {
    const genderBase = `player_${npc.gender === 'female' ? 'female_' : ''}front_idle`;
    return this.scene.textures.exists(genderBase) ? genderBase : 'player_front_idle';
  }

  /**
   * Uses authored animation frames when they exist. Working, talking and
   * sleeping currently fall back to painted idle frames plus a restrained
   * procedural motion; adding `${prefix}${direction}_working` automatically
   * upgrades the state without touching this loop.
   */
  private applyAnimation(npc: VillageNpcState, view: NpcView, now: number): void {
    const state: NpcAnimationState = npc.animation;
    const moving = state === 'walking';
    if (moving) view.walkClock += this.scene.game.loop.delta;
    const frame = moving ? Math.floor(view.walkClock / 110) % 6 : 0;
    const preferredPose = state === 'walking' ? `walk_${frame}` : state;
    let key = this.textureKey(npc, view.direction, preferredPose);
    if (!this.scene.textures.exists(key)) {
      const numbered = this.textureKey(npc, view.direction, `${state}_0`);
      key = this.scene.textures.exists(numbered)
        ? numbered
        : this.textureKey(npc, view.direction, 'idle');
    }
    if (!this.scene.textures.exists(key)) key = this.fallbackTexture(npc);
    if (view.sprite.texture.key !== key) view.sprite.setTexture(key);
    view.sprite.setFlipX(view.direction === 'side' && view.flip);

    const bob = state === 'working' ? Math.sin(now / 180) * 1.1
      : state === 'talking' ? Math.sin(now / 280) * 0.65
        : state === 'idle' ? Math.sin(now / 620) * 0.25 : 0;
    const point = IsometricUtils.gridToScreen(npc.position.x, npc.position.y);
    view.sprite.setPosition(point.x, point.y + IsometricUtils.getTileDimensions().height / 2 + bob);

    if (state === 'sleeping') {
      view.sprite.setTint(0x93a2c2);
      view.sprite.setAlpha(0.72);
    } else if (state === 'working') {
      view.sprite.clearTint();
      view.sprite.setAlpha(1);
    } else {
      view.sprite.clearTint();
      view.sprite.setAlpha(1);
    }

    if (npc.activity !== view.lastActivity) {
      view.lastActivity = npc.activity;
    }
  }

  private facingFor(npc: VillageNpcState, view: NpcView): void {
    if (npc.animation === 'walking') {
      const next = npc.path.path[npc.path.index];
      const dx = (next?.x ?? npc.destination.x) - npc.position.x;
      const dy = (next?.y ?? npc.destination.y) - npc.position.y;
      if (Math.abs(dx) > Math.abs(dy) * 1.1) {
        view.direction = 'side';
        view.flip = dx < 0;
      } else if (Math.abs(dy) > 0.01) {
        view.direction = dy > 0 ? 'front' : 'back';
        view.flip = false;
      }
      return;
    }
    if (npc.animation === 'talking') {
      const player = this.playerMarker();
      const dx = player.x - npc.position.x;
      const dy = player.y - npc.position.y;
      if (Math.abs(dx) > Math.abs(dy) * 1.1) {
        view.direction = 'side';
        view.flip = dx < 0;
      } else if (Math.abs(dy) > 0.05) {
        view.direction = dy > 0 ? 'front' : 'back';
        view.flip = false;
      }
    }
  }

  private place(npc: VillageNpcState): void {
    const view = this.views.get(npc.id);
    if (!view) return;
    const point = IsometricUtils.gridToScreen(npc.position.x, npc.position.y);
    view.sprite.setPosition(point.x, point.y + IsometricUtils.getTileDimensions().height / 2);
    view.sprite.setDepth(worldDepth(npc.position.x, npc.position.y, 1));
    view.label.setDepth(worldDepth(npc.position.x, npc.position.y, 2));
  }

  /** Recomputes camera visibility at most four times per second. */
  getVisibleNpcIds(now: number, selectedId: string | null = null): Set<string> {
    const camera = this.scene.cameras.main;
    const key = `${Math.round(camera.worldView.x)}:${Math.round(camera.worldView.y)}:${Math.round(camera.worldView.width)}:${Math.round(camera.worldView.height)}`;
    if (now - this.lastVisibilityUpdate < 250 && key === this.lastCameraKey) return this.visibleIds;
    this.lastVisibilityUpdate = now;
    this.lastCameraKey = key;
    const player = this.playerMarker();
    const visible = new Set<string>();
    for (const npc of this.simulation.getRoster()) {
      const screen = IsometricUtils.gridToScreen(npc.position.x, npc.position.y);
      const inView = camera.worldView.contains(screen.x, screen.y)
        || (Math.abs(npc.position.x - player.x) < 5 && Math.abs(npc.position.y - player.y) < 5)
        || npc.id === selectedId;
      if (inView) visible.add(npc.id);
    }
    this.visibleIds = visible;
    return visible;
  }

  update(now: number, selectedId: string | null, overlayEnabled: boolean): void {
    const player = this.playerMarker();
    for (const npc of this.simulation.getRoster()) {
      const view = this.views.get(npc.id);
      if (!view) continue;
      const visible = this.visibleIds.has(npc.id);
      if (!visible) {
        if (view.visible) {
          view.sprite.setVisible(false);
          view.label.setVisible(false);
          view.visible = false;
        }
        continue;
      }
      if (!view.visible) {
        view.visible = true;
        view.sprite.setVisible(true);
      }
      this.facingFor(npc, view);
      this.applyAnimation(npc, view, now);
      view.sprite.setDepth(worldDepth(npc.position.x, npc.position.y, 1));
      view.label.setDepth(worldDepth(npc.position.x, npc.position.y, 2));
      const nearPlayer = Math.abs(npc.position.x - player.x) + Math.abs(npc.position.y - player.y) < 4;
      const showLabel = nearPlayer || npc.id === selectedId;
      view.label.setVisible(showLabel);
      if (showLabel) {
        const point = IsometricUtils.gridToScreen(npc.position.x, npc.position.y);
        view.label.setPosition(point.x, point.y - 40);
        const desired = `${npc.name} · ${npc.activity}`;
        if (view.label.text !== desired) view.label.setText(desired);
      }
    }
    this.drawDebug(selectedId, overlayEnabled);
  }

  private drawDebug(selectedId: string | null, overlayEnabled: boolean): void {
    const graphics = this.debugGraphics;
    graphics.clear();
    if (!overlayEnabled) return;
    const player = this.playerMarker();
    for (const npc of this.simulation.getRoster()) {
      if (!this.visibleIds.has(npc.id)) continue;
      const destination = IsometricUtils.gridToScreen(npc.destination.x, npc.destination.y);
      const color = ACTIVITY_COLORS[npc.activity] ?? 0xf0cf8a;
      graphics.lineStyle(1, color, 0.55);
      graphics.strokeRect(destination.x - 5, destination.y + 22, 10, 10);
      if (npc.id === selectedId) {
        graphics.lineStyle(2, 0xffe08a, 0.95);
        const start = IsometricUtils.gridToScreen(npc.position.x, npc.position.y);
        graphics.beginPath();
        graphics.moveTo(start.x, start.y + 24);
        for (let index = Math.max(0, npc.path.index); index < npc.path.path.length; index++) {
          const point = npc.path.path[index]!;
          const screen = IsometricUtils.gridToScreen(point.x, point.y);
          graphics.lineTo(screen.x, screen.y + 24);
        }
        graphics.strokePath();
        graphics.fillStyle(0xffe08a, 0.9);
        graphics.fillCircle(start.x, start.y + 24, 4);
        graphics.lineStyle(1, 0xffe08a, 0.8);
        graphics.strokeCircle(destination.x, destination.y + 26, 9);
      } else {
        graphics.fillStyle(color, 0.65);
        graphics.fillCircle(destination.x, destination.y + 26, 2.5);
      }
    }
    // The player's own grid marker anchors the overlay to an obvious point.
    const playerScreen = IsometricUtils.gridToScreen(player.x, player.y);
    graphics.lineStyle(1, 0xffffff, 0.35);
    graphics.strokeCircle(playerScreen.x, playerScreen.y + 26, 12);
  }

  destroy(): void {
    for (const view of this.views.values()) {
      view.sprite.destroy();
      view.label.destroy();
    }
    this.views.clear();
    this.debugGraphics.destroy();
  }
}
