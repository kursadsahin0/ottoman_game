import Phaser from 'phaser';
import { registerUi } from '@utils/CameraLayers';
import type { VillageSimulation } from '@/village/VillageSimulation';

/**
 * Live inspector for schedules, paths, needs and memory. It is deliberately
 * separate from the simulation so production code can ship without any debug
 * coupling beyond this read-only panel.
 */
export class VillageDebugPanel {
  private container: Phaser.GameObjects.Container | null = null;
  private body: Phaser.GameObjects.Text | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private footer: Phaser.GameObjects.Text | null = null;
  private selectedId: string | null = null;
  private lastRefresh = 0;
  private readonly resizeHandler: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly simulation: VillageSimulation,
  ) {
    this.selectedId = simulation.getRoster()[0]?.id ?? null;
    this.resizeHandler = () => { if (this.container) this.build(); };
    scene.scale.on('resize', this.resizeHandler);
    scene.events.once('shutdown', () => {
      scene.scale.off('resize', this.resizeHandler);
      this.hide();
    });
  }

  isOpen(): boolean { return this.container !== null; }
  getSelectedId(): string | null { return this.selectedId; }

  toggle(): void {
    if (this.container) this.hide();
    else this.show();
  }

  show(): void {
    if (!this.container) this.build();
    this.refresh(true);
  }

  hide(): void {
    this.container?.destroy(true);
    this.container = null;
    this.body = null;
    this.title = null;
    this.footer = null;
  }

  cycle(delta: number): void {
    const roster = this.simulation.getRoster();
    if (roster.length === 0) return;
    const current = Math.max(0, roster.findIndex(npc => npc.id === this.selectedId));
    const next = (current + delta + roster.length) % roster.length;
    this.selectedId = roster[next]?.id ?? null;
    if (!this.container) this.show();
    else this.refresh(true);
  }

  select(id: string): void {
    if (!this.simulation.getRoster().some(npc => npc.id === id)) return;
    this.selectedId = id;
    this.refresh(true);
  }

  update(now: number): void {
    if (!this.container) return;
    if (now - this.lastRefresh < 220) return;
    this.refresh(false);
  }

  private refresh(force: boolean): void {
    const now = this.scene.time.now;
    if (!force && now - this.lastRefresh < 180) return;
    this.lastRefresh = now;
    const roster = this.simulation.getRoster();
    const index = Math.max(0, roster.findIndex(npc => npc.id === this.selectedId));
    const npc = roster[index];
    if (!npc) return;
    if (this.title) {
      this.title.setText(`KÖY İNCELEME · ${index + 1}/${roster.length} · ${npc.name}`);
    }
    if (this.body) {
      this.body.setText(this.simulation.getDebugLines(npc.id).join('\n'));
    }
    if (this.footer) {
      const stats = this.simulation.getStats();
      this.footer.setText(
        `N: sonraki · V: kapat · yol araması ${stats.pathSearches} · önbellek ${stats.pathCacheHits} · sıkışma ${stats.stuckRecoveries} · ekran dışı ${stats.offscreenUpdates}`,
      );
    }
  }

  private build(): void {
    this.hide();
    const { width, height } = this.scene.scale;
    const mobile = width < 650;
    const panelWidth = mobile ? width - 20 : 460;
    const panelHeight = mobile ? Math.min(330, height * 0.46) : 352;
    const x = 12;
    const y = Math.max(120, height - panelHeight - 42);
    const container = this.container = this.scene.add.container(0, 0);
    const background = this.scene.add.graphics();
    background.fillStyle(0x120d09, 0.94);
    background.fillRoundedRect(x, y, panelWidth, panelHeight, 10);
    background.lineStyle(1, 0xb89150, 0.8);
    background.strokeRoundedRect(x, y, panelWidth, panelHeight, 10);
    background.fillStyle(0x4a211d, 0.96);
    background.fillRoundedRect(x + 8, y + 8, panelWidth - 16, 30, 6);
    container.add(background);

    this.title = this.scene.add.text(x + 16, y + 15, 'KÖY İNCELEME', {
      fontFamily: 'Georgia, serif', fontSize: mobile ? '12px' : '14px',
      color: '#e8c766', fontStyle: 'bold',
    });
    this.body = this.scene.add.text(x + 16, y + 46, '', {
      fontFamily: 'Arial', fontSize: mobile ? '9px' : '10px', color: '#d9cbb0',
      wordWrap: { width: panelWidth - 32 }, lineSpacing: 3,
    });
    this.footer = this.scene.add.text(x + 16, y + panelHeight - 38, '', {
      fontFamily: 'Arial', fontSize: mobile ? '8px' : '9px', color: '#9b8e76',
      wordWrap: { width: panelWidth - 32 },
    });
    const previous = this.scene.add.text(x + panelWidth - 112, y + 13, '◀', {
      fontFamily: 'Arial', fontSize: '15px', color: '#e2c98a',
      backgroundColor: '#2f2318', padding: { x: 7, y: 2 },
    }).setInteractive({ useHandCursor: true });
    previous.on('pointerdown', () => this.cycle(-1));
    const next = this.scene.add.text(x + panelWidth - 66, y + 13, '▶', {
      fontFamily: 'Arial', fontSize: '15px', color: '#e2c98a',
      backgroundColor: '#2f2318', padding: { x: 7, y: 2 },
    }).setInteractive({ useHandCursor: true });
    next.on('pointerdown', () => this.cycle(1));
    const close = this.scene.add.text(x + panelWidth - 36, y + 13, '✕', {
      fontFamily: 'Arial', fontSize: '14px', color: '#e0a69a',
      backgroundColor: '#3a211b', padding: { x: 6, y: 2 },
    }).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.hide());
    container.add([this.title, this.body, this.footer, previous, next, close]);
    registerUi(this.scene, container);
    this.refresh(true);
  }
}
