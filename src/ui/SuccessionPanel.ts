import Phaser from 'phaser';
import { FamilySystem } from '@systems/FamilySystem';
import {
  INHERITANCE_RULE_LABELS,
  TRAIT_LABELS,
  lifeStageLabel,
  skillTotal,
  type FamilyMember,
  type InheritanceResult,
  type PendingSuccession,
} from '@data/FamilyData';
import { TimeManager } from '@systems/TimeManager';
import { registerUi } from '@utils/CameraLayers';

export interface SuccessionPanelCallbacks {
  onSelect: (heirId: string) => void;
  onRestart: () => void;
  onContest?: (heirId: string) => void;
}

/**
 * Modal succession / game-over screen. The player must explicitly choose an
 * heir (or restart the line); the simulation never invents a successor.
 */
export class SuccessionPanel {
  private scene: Phaser.Scene;
  private family: FamilySystem;
  private callbacks: SuccessionPanelCallbacks;
  private container: Phaser.GameObjects.Container | null = null;
  private timeManager: TimeManager;
  private pending: PendingSuccession | null = null;
  private page = 0;
  private wasPaused = false;
  private resizeHandler: (() => void) | null = null;

  constructor(scene: Phaser.Scene, family: FamilySystem, callbacks: SuccessionPanelCallbacks) {
    this.scene = scene;
    this.family = family;
    this.callbacks = callbacks;
    this.timeManager = TimeManager.getInstance();
  }

  isOpen(): boolean {
    return this.container !== null;
  }

  open(pending?: PendingSuccession | null): void {
    const next = pending ?? this.family.getPendingSuccession();
    if (!next) return;
    this.pending = next;
    if (this.isOpen()) {
      this.destroyOnly();
    } else {
      this.wasPaused = this.timeManager.isPaused();
      this.timeManager.pause();
    }
    this.page = 0;
    this.build();
    this.resizeHandler = () => this.rebuild();
    this.scene.scale.on('resize', this.resizeHandler);
  }

  close(): void {
    if (!this.isOpen()) return;
    this.destroyOnly();
    if (!this.wasPaused) {
      this.timeManager.resume(Date.now());
    }
    this.wasPaused = false;
    this.pending = null;
  }

  private destroyOnly(): void {
    if (this.resizeHandler) {
      this.scene.scale.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
  }

  private rebuild(): void {
    if (!this.isOpen()) return;
    this.destroyOnly();
    this.build();
    this.resizeHandler = () => this.rebuild();
    this.scene.scale.on('resize', this.resizeHandler);
  }

  private build(): void {
    if (!this.pending) return;
    const { width, height } = this.scene.scale;
    const compact = width < 720;
    const panelW = Math.min(width - 16, compact ? 470 : 920);
    const panelH = Math.min(height - 16, 680);
    const left = -panelW / 2;
    const top = -panelH / 2;
    const inheritance = this.pending.inheritance;
    const deceased = this.family.getMember(this.pending.deceasedId);
    const gameOver = inheritance.gameOver;

    this.container = this.scene.add.container(width / 2, height / 2).setDepth(840).setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1b1510, 0.99);
    bg.fillRoundedRect(left, top, panelW, panelH, 14);
    bg.lineStyle(2, gameOver ? 0xa2453a : 0x9a7b4f, 1);
    bg.strokeRoundedRect(left, top, panelW, panelH, 14);
    bg.fillStyle(gameOver ? 0x3a1c16 : 0x2c2216, 0.7);
    bg.fillRoundedRect(left + 16, top + 16, panelW - 32, 56, 8);
    this.container.add(bg);

    const title = this.scene.add.text(
      left + 28,
      top + 24,
      gameOver ? 'Aile Sona Erdi' : 'Veraset · Yeni Aile Reisi',
      {
        fontFamily: 'Georgia, serif',
        fontSize: compact ? '18px' : '22px',
        color: gameOver ? '#f0a08c' : '#e8c766',
        fontStyle: 'bold',
      },
    );
    this.container.add(title);

    const deceasedName = deceased ? `${deceased.firstName} ${deceased.familyName}` : 'Aile üyesi';
    const subtitle = this.scene.add.text(
      left + 28,
      top + 48,
      gameOver
        ? `${deceasedName} ${this.pending.reason === 'retirement' ? 'emekli oldu' : 'vefat etti'} ve geride geçerli bir varis kalmadı.`
        : `${deceasedName} ${this.pending.reason === 'retirement' ? 'aile reisliğini devretti' : 'vefat etti'} · ${deceased?.age ?? 0} yaş · ${INHERITANCE_RULE_LABELS[this.family.getConfig().inheritanceRule]}`,
      {
        fontFamily: 'Arial',
        fontSize: compact ? '10px' : '11px',
        color: '#c4b28f',
        wordWrap: { width: panelW - 56 },
      },
    );
    this.container.add(subtitle);

    let contentTop = top + 84;
    if (!gameOver) {
      contentTop = this.renderEstateSummary(inheritance, left + 22, contentTop, panelW - 44);
      this.renderHeirs(left + 22, contentTop + 8, panelW - 44, top + panelH - contentTop - 42);
    } else {
      this.renderGameOver(left + 22, contentTop, panelW - 44, panelH - 150, deceased);
    }

    const footer = this.scene.add.text(
      left + panelW / 2,
      top + panelH - 18,
      gameOver
        ? 'Yeni bir aile kurmadan önce geçmiş kayıtlarınızı düşünün.'
        : 'Bir varis seçilmeden hikâye devam etmez.',
      {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: '#8a7a65',
      },
    ).setOrigin(0.5);
    this.container.add(footer);

    registerUi(this.scene, this.container);
  }

  private renderEstateSummary(inheritance: InheritanceResult, x: number, y: number, width: number): number {
    if (!this.container) return y;
    const property = inheritance.property;
    const lines = [
      `Miras: ${property.wealth} akçe · Borç: ${property.debts} akçe · Ekipman: ${property.equipment.length} · Arazi: ${property.landPlots.length} · Aile ünü: ${property.familyReputation}`,
      ...inheritance.consequences,
      ...inheritance.disputes.map((line) => `⚠ ${line}`),
      ...(this.pending?.contestedBy?.length ? [`İtiraz edenler: ${this.pending.contestedBy.map(id => this.family.getMember(id)?.firstName ?? id).join(', ')}`] : []),
    ];
    const bg = this.scene.add.graphics();
    const boxHeight = Math.max(38, 12 + lines.length * 12);
    bg.fillStyle(0x231c13, 0.9);
    bg.fillRoundedRect(x, y, width, boxHeight, 6);
    bg.lineStyle(1, 0x4c4032, 1);
    bg.strokeRoundedRect(x, y, width, boxHeight, 6);
    this.container.add(bg);

    const text = this.scene.add.text(x + 8, y + 5, lines.join('\n'), {
      fontFamily: 'Arial',
      fontSize: width < 420 ? '9px' : '10px',
      color: '#cdbd9d',
      lineSpacing: 2,
      wordWrap: { width: width - 16 },
    });
    this.container.add(text);
    return y + boxHeight;
  }

  private renderHeirs(x: number, y: number, width: number, height: number): void {
    if (!this.container || !this.pending) return;
    const inheritance = this.pending.inheritance;
    const heirs = inheritance.eligibleHeirIds
      .map((id) => this.family.getMember(id))
      .filter((member): member is FamilyMember => member !== null && member.isAlive);

    const compact = this.scene.scale.width < 720;
    const columns = compact ? 1 : 2;
    const gap = 10;
    const cardW = (width - gap * (columns - 1)) / columns;
    const cardH = compact ? 94 : 100;
    const rowsPerPage = Math.max(1, Math.floor((height - 8) / (cardH + gap)));
    const pageSize = Math.max(1, rowsPerPage * columns);
    const pages = Math.max(1, Math.ceil(heirs.length / pageSize));
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    const visible = heirs.slice(this.page * pageSize, (this.page + 1) * pageSize);

    visible.forEach((heir, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cardX = x + column * (cardW + gap);
      const cardY = y + row * (cardH + gap);
      this.createHeirCard(heir, inheritance, cardX, cardY, cardW, cardH, compact);
    });

    if (pages > 1) {
      const prev = this.scene.add.text(x, y + height - 10, '‹', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: this.page > 0 ? '#e8c766' : '#5f5547',
      }).setOrigin(0, 0.5);
      const next = this.scene.add.text(x + width, y + height - 10, '›', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: this.page < pages - 1 ? '#e8c766' : '#5f5547',
      }).setOrigin(1, 0.5);
      if (this.page > 0) {
        prev.setInteractive({ useHandCursor: true });
        prev.on('pointerdown', () => {
          this.page--;
          this.rebuild();
        });
      }
      if (this.page < pages - 1) {
        next.setInteractive({ useHandCursor: true });
        next.on('pointerdown', () => {
          this.page++;
          this.rebuild();
        });
      }
      const pageText = this.scene.add.text(x + width / 2, y + height - 10, `${this.page + 1}/${pages}`, {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: '#8a7a65',
      }).setOrigin(0.5);
      this.container.add([prev, next, pageText]);
    }
  }

  private createHeirCard(
    heir: FamilyMember,
    inheritance: InheritanceResult,
    x: number,
    y: number,
    width: number,
    height: number,
    compact: boolean,
  ): void {
    if (!this.container) return;
    const primary = inheritance.primaryHeirId === heir.id;
    const share = inheritance.shares[heir.id] ?? 0;
    const claim = primary
      ? this.family.getConfig().inheritanceRule === 'partible'
        ? 'Eşit pay'
        : 'Birinci hak'
      : 'Varis';

    const card = this.scene.add.graphics();
    card.fillStyle(primary ? 0x35291a : 0x272017, 1);
    card.fillRoundedRect(x, y, width, height, 8);
    card.lineStyle(primary ? 2 : 1, primary ? 0xc9a648 : 0x4c4032, 1);
    card.strokeRoundedRect(x, y, width, height, 8);
    this.container.add(card);

    const name = this.scene.add.text(x + 10, y + 7, `${heir.firstName} ${heir.familyName}`, {
      fontFamily: 'Georgia, serif',
      fontSize: compact ? '14px' : '13px',
      color: '#f0dfbd',
      fontStyle: 'bold',
    });
    const claimTag = this.scene.add.text(x + width - 10, y + 8, claim, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: primary ? '#e8c766' : '#a99b80',
    }).setOrigin(1, 0);
    this.container.add([name, claimTag]);

    const traits = heir.traits.map((trait) => TRAIT_LABELS[trait]).join(' · ');
    const details = [
      `${heir.age} yaş · ${lifeStageLabel(heir.lifeStage)} · Kuşak ${heir.generation} · Ün ${heir.reputation}`,
      `${traits || 'Belirgin özellik yok'} · Beceri ${skillTotal(heir.skills)}`,
      `Pay: ${share} akçe · Borç: ${inheritance.property.debts} akçe`,
    ];
    const info = this.scene.add.text(x + 10, y + 28, details.join('\n'), {
      fontFamily: 'Arial',
      fontSize: compact ? '9px' : '9px',
      color: '#b9aa8c',
      lineSpacing: 2,
      wordWrap: { width: width - 92 },
    });
    this.container.add(info);

    const buttonW = 70;
    const buttonH = 28;
    const buttonX = x + width - buttonW - 10;
    const buttonY = y + height - buttonH - 10;
    const button = this.scene.add.graphics();
    button.fillStyle(primary ? 0x6a5128 : 0x4a3a26, 1);
    button.fillRoundedRect(buttonX, buttonY, buttonW, buttonH, 5);
    button.lineStyle(1, primary ? 0xd4af37 : 0x7a664a, 1);
    button.strokeRoundedRect(buttonX, buttonY, buttonW, buttonH, 5);
    const label = this.scene.add.text(buttonX + buttonW / 2, buttonY + buttonH / 2, 'Seç', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#f6e7c4',
    }).setOrigin(0.5);
    const zone = this.scene.add.zone(
      buttonX + buttonW / 2,
      buttonY + buttonH / 2,
      buttonW,
      buttonH,
    ).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.callbacks.onSelect(heir.id));
    this.container.add([button, label, zone]);

    if (this.callbacks.onContest && inheritance.eligibleHeirIds.length > 1 && heir.id !== inheritance.primaryHeirId) {
      const contestX = buttonX - 78;
      const contestW = 70;
      const contested = this.pending?.contestedBy?.includes(heir.id) ?? false;
      const contestBg = this.scene.add.graphics();
      contestBg.fillStyle(contested ? 0x55382e : 0x332b22, 1);
      contestBg.fillRoundedRect(contestX, buttonY, contestW, buttonH, 5);
      contestBg.lineStyle(1, contested ? 0xa96553 : 0x68553b, 1);
      contestBg.strokeRoundedRect(contestX, buttonY, contestW, buttonH, 5);
      const contestLabel = this.scene.add.text(contestX + contestW / 2, buttonY + buttonH / 2, contested ? 'İtiraz etti' : 'İtiraz et', {
        fontFamily: 'Arial', fontSize: '9px', color: '#e8c8b6',
      }).setOrigin(0.5);
      const contestZone = this.scene.add.zone(contestX + contestW / 2, buttonY + buttonH / 2, contestW, buttonH).setInteractive({ useHandCursor: true });
      contestZone.on('pointerdown', () => this.callbacks.onContest?.(heir.id));
      this.container.add([contestBg, contestLabel, contestZone]);
    }
  }

  private renderGameOver(
    x: number,
    y: number,
    width: number,
    height: number,
    deceased: FamilyMember | null,
  ): void {
    if (!this.container) return;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x241711, 0.9);
    bg.fillRoundedRect(x, y, width, height, 8);
    bg.lineStyle(1, 0x6e3a2d, 1);
    bg.strokeRoundedRect(x, y, width, height, 8);
    this.container.add(bg);

    const text = this.scene.add.text(
      x + 16,
      y + 16,
      `${deceased ? `${deceased.firstName} ${deceased.familyName}` : 'Son aile reisi'} öldü ve ailenin geçerli bir varisi yok.\n\n` +
        'Hikâye burada sona erdi. Aşağıdaki düğme yeni bir aile kurar ve simülasyonu baştan başlatır. ' +
        'Mevcut kayıt silinir; geçmiş hanedanın kayıtları yeni oyunda yer almaz.',
      {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: '#d3c3a4',
        lineSpacing: 5,
        wordWrap: { width: width - 32 },
      },
    );
    this.container.add(text);

    const buttonW = Math.min(230, width - 32);
    const buttonX = x + width / 2 - buttonW / 2;
    const buttonY = y + height - 54;
    const button = this.scene.add.graphics();
    button.fillStyle(0x6b2f24, 1);
    button.fillRoundedRect(buttonX, buttonY, buttonW, 34, 6);
    button.lineStyle(1, 0xd08a6e, 1);
    button.strokeRoundedRect(buttonX, buttonY, buttonW, 34, 6);
    const label = this.scene.add.text(buttonX + buttonW / 2, buttonY + 17, 'Yeni Aile Başlat', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: '#ffe2c9',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const zone = this.scene.add.zone(buttonX + buttonW / 2, buttonY + 17, buttonW, 34)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.callbacks.onRestart());
    this.container.add([button, label, zone]);
  }
}
