import Phaser from 'phaser';
import { FamilySystem } from '@systems/FamilySystem';
import {
  TRAIT_LABELS,
  lifeStageLabel,
  type FamilyMember,
  type SkillKey,
} from '@data/FamilyData';
import { TimeManager } from '@systems/TimeManager';
import { registerUi } from '@utils/CameraLayers';

const SKILL_ORDER: SkillKey[] = ['farming', 'combat', 'trade', 'leadership', 'craftsmanship', 'diplomacy'];

interface TreeRow {
  kind: 'header' | 'member';
  generation: number;
  member: FamilyMember | null;
}

/**
 * Responsive family tree and legacy screen. On wide viewports it lays the
 * dynasty out in generation columns; on phones it becomes a paged list so the
 * records stay readable without horizontal scrolling.
 */
export class FamilyTreePanel {
  private scene: Phaser.Scene;
  private family: FamilySystem;
  private container: Phaser.GameObjects.Container | null = null;
  private timeManager: TimeManager;
  private wasPaused = false;
  private selectedId: string | null = null;
  private page = 0;
  private resizeHandler: (() => void) | null = null;
  private onCloseCallback: (() => void) | null = null;
  private onRetireCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene, family: FamilySystem, onClose?: () => void, onRetire?: () => void) {
    this.scene = scene;
    this.family = family;
    this.timeManager = TimeManager.getInstance();
    this.onCloseCallback = onClose ?? null;
    this.onRetireCallback = onRetire ?? null;
  }

  isOpen(): boolean {
    return this.container !== null;
  }

  open(memberId?: string): void {
    if (this.isOpen()) this.destroyOnly();
    if (!this.wasPaused) this.wasPaused = this.timeManager.isPaused();
    this.timeManager.pause();
    this.selectedId = memberId ?? this.family.getCurrentCharacter()?.id ?? null;
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
    this.onCloseCallback?.();
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
    const { width, height } = this.scene.scale;
    const compact = width < 720;
    const panelW = Math.min(width - 16, compact ? 460 : 1020);
    const panelH = Math.min(height - 16, 680);
    const left = -panelW / 2;
    const top = -panelH / 2;

    this.container = this.scene.add.container(width / 2, height / 2).setDepth(820).setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1d1710, 0.985);
    bg.fillRoundedRect(left, top, panelW, panelH, 14);
    bg.lineStyle(2, 0x9a7b4f, 1);
    bg.strokeRoundedRect(left, top, panelW, panelH, 14);
    bg.lineStyle(1, 0x5a4732, 0.8);
    bg.lineBetween(left + 18, top + 64, left + panelW - 18, top + 64);
    this.container.add(bg);

    const living = this.family.getLivingMembers().length;
    const title = this.scene.add.text(left + 22, top + 16, `Aile Ağacı · ${this.family.getFamily().name}`, {
      fontFamily: 'Georgia, serif',
      fontSize: compact ? '18px' : '22px',
      color: '#e8c766',
      fontStyle: 'bold',
    });
    const subtitle = this.scene.add.text(
      left + 22,
      top + 42,
      `${living} yaşayan üye · ${this.family.getLegacy().generationsSurvived} kuşak · Aile ünü ${this.family.getLegacy().reputationAcrossGenerations}`,
      {
        fontFamily: 'Georgia, serif',
        fontSize: compact ? '11px' : '12px',
        color: '#b8a88c',
      },
    );
    this.container.add([title, subtitle]);

    const closeBtn = this.scene.add.text(left + panelW - 26, top + 22, '✕', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#e08a72',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    this.container.add(closeBtn);

    const detailH = compact ? 156 : 132;
    const contentTop = top + 78;
    const contentBottom = top + panelH - detailH - 16;
    const contentHeight = Math.max(80, contentBottom - contentTop);
    const contentLeft = left + 22;
    const contentWidth = panelW - 44;

    const tree = this.family.getFamilyTree();
    const totalMembers = tree.reduce((sum, generation) => sum + generation.length, 0);
    const maxGenerationSize = tree.reduce((max, generation) => Math.max(max, generation.length), 0);
    const useColumns = !compact && tree.length <= 5 && maxGenerationSize <= 6 && totalMembers <= 20;

    if (useColumns) {
      this.renderColumns(tree, contentLeft, contentTop, contentWidth, contentHeight);
    } else {
      this.renderList(tree, contentLeft, contentTop, contentWidth, contentHeight);
    }

    this.renderDetail(contentLeft, top + panelH - detailH, contentWidth, detailH - 8);
    registerUi(this.scene, this.container);
  }

  private renderColumns(
    tree: FamilyMember[][],
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (!this.container || tree.length === 0) return;
    const columnW = width / tree.length;
    const cardH = 54;
    const gap = 10;
    const positions = new Map<string, { x: number; y: number }>();

    const connectors = this.scene.add.graphics();
    connectors.lineStyle(1, 0x8b7355, 0.45);
    this.container.add(connectors);

    tree.forEach((generation, columnIndex) => {
      const colX = x + columnIndex * columnW + 10;
      const cardW = columnW - 20;
      const header = this.scene.add.text(
        colX,
        y - 2,
        `${columnIndex + 1}. KUŞAK`,
        {
          fontFamily: 'Georgia, serif',
          fontSize: '10px',
          color: '#a08d72',
        },
      );
      this.container!.add(header);

      const maxCards = Math.max(1, Math.floor((height - 18) / (cardH + gap)));
      const visible = generation.slice(0, maxCards);
      visible.forEach((member, rowIndex) => {
        const cardY = y + 18 + rowIndex * (cardH + gap);
        this.createMemberCard(member, colX, cardY, cardW, cardH, false);
        positions.set(member.id, { x: colX + cardW / 2, y: cardY });
      });
      if (generation.length > maxCards) {
        const more = this.scene.add.text(
          colX,
          y + 18 + maxCards * (cardH + gap),
          `+${generation.length - maxCards} üye`,
          { fontFamily: 'Arial', fontSize: '10px', color: '#8a7a65' },
        );
        this.container!.add(more);
      }
    });

    // Connect parent cards to their children's cards with elbow lines.
    for (const generation of tree) {
      for (const member of generation) {
        const from = positions.get(member.id);
        if (!from) continue;
        const childIds = [...member.childrenIds];
        for (const childId of childIds) {
          const to = positions.get(childId);
          if (!to) continue;
          connectors.beginPath();
          connectors.moveTo(from.x, from.y + 54);
          connectors.lineTo(from.x, from.y + 62);
          connectors.lineTo(to.x, from.y + 62);
          connectors.lineTo(to.x, to.y);
          connectors.strokePath();
        }
      }
    }
  }

  private renderList(
    tree: FamilyMember[][],
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (!this.container) return;
    const rows: TreeRow[] = [];
    for (const generation of tree) {
      const first = generation[0];
      if (!first) continue;
      rows.push({ kind: 'header', generation: first.generation, member: null });
      for (const member of generation) {
        rows.push({ kind: 'member', generation: member.generation, member });
      }
    }

    const rowH = 30;
    const headerH = 24;
    const pageSize = Math.max(4, Math.floor((height - (rows.length > 0 ? 12 : 0)) / rowH));
    // Pagination is computed in rows; headers count as one row each.
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    const start = this.page * pageSize;
    const visible = rows.slice(start, start + pageSize);

    let cursorY = y;
    for (const row of visible) {
      if (row.kind === 'header') {
        const header = this.scene.add.text(x, cursorY + 4, `${row.generation}. KUŞAK`, {
          fontFamily: 'Georgia, serif',
          fontSize: '10px',
          color: '#a08d72',
        });
        this.container.add(header);
        cursorY += headerH;
        continue;
      }
      if (row.member) {
        this.createMemberCard(row.member, x, cursorY, width, rowH - 4, true);
      }
      cursorY += rowH;
    }

    if (pages > 1) {
      const prev = this.scene.add.text(x, y + height - 14, '‹ Önceki', {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: this.page > 0 ? '#e8c766' : '#5f5547',
      }).setOrigin(0, 0.5);
      const next = this.scene.add.text(x + width, y + height - 14, 'Sonraki ›', {
        fontFamily: 'Arial',
        fontSize: '11px',
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
      const pageText = this.scene.add.text(x + width / 2, y + height - 14, `${this.page + 1}/${pages}`, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#8a7a65',
      }).setOrigin(0.5);
      this.container.add([prev, next, pageText]);
    }
  }

  private createMemberCard(
    member: FamilyMember,
    x: number,
    y: number,
    width: number,
    height: number,
    compactRow: boolean,
  ): void {
    if (!this.container) return;
    const isCurrent = this.family.getCurrentCharacter()?.id === member.id;
    const selected = this.selectedId === member.id;

    const card = this.scene.add.graphics();
    const fill = !member.isAlive
      ? 0x241f18
      : isCurrent
        ? 0x3a2d1c
        : selected
          ? 0x33291c
          : 0x2a2319;
    card.fillStyle(fill, 1);
    card.fillRoundedRect(x, y, width, height, 6);
    card.lineStyle(selected || isCurrent ? 2 : 1, isCurrent ? 0xd4af37 : selected ? 0xa88b54 : 0x4c4032, 1);
    card.strokeRoundedRect(x, y, width, height, 6);
    this.container.add(card);

    const nameColor = member.isAlive ? '#efdfbd' : '#8d8172';
    const name = `${isCurrent ? '★ ' : ''}${member.firstName} ${member.familyName}`;
    const title = this.scene.add.text(x + 8, y + 5, name, {
      fontFamily: 'Georgia, serif',
      fontSize: compactRow ? '12px' : '11px',
      color: nameColor,
      fontStyle: isCurrent ? 'bold' : 'normal',
    });
    this.container.add(title);

    const traitNames = member.traits.map((trait) => TRAIT_LABELS[trait]).join(' · ');
    const second = member.isAlive
      ? `${member.age} yaş · ${lifeStageLabel(member.lifeStage)}${traitNames ? ` · ${traitNames}` : ''}`
      : `${member.age} yaşında öldü · ${member.causeOfDeath === 'battle' ? 'savaş' : member.causeOfDeath === 'natural_age' ? 'yaşlılık' : 'hastalık'}`;
    const info = this.scene.add.text(x + 8, y + (compactRow ? 18 : 22), second, {
      fontFamily: 'Arial',
      fontSize: compactRow ? '10px' : '9px',
      color: member.isAlive ? '#b9aa8c' : '#776d5f',
      wordWrap: { width: width - 16 },
    });
    this.container.add(info);

    if (!compactRow && height >= 50) {
      const badge = this.scene.add.text(x + width - 8, y + 5, `${member.generation}.k`, {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: '#8f7f64',
      }).setOrigin(1, 0);
      this.container.add(badge);
    }

    const hit = this.scene.add.zone(x + width / 2, y + height / 2, width, height)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.selectedId = member.id;
      this.rebuild();
    });
    this.container.add(hit);
  }

  private renderDetail(x: number, y: number, width: number, height: number): void {
    if (!this.container) return;
    const selected = this.selectedId ? this.family.getMember(this.selectedId) : null;
    const member = selected ?? this.family.getCurrentCharacter();
    if (!member) return;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x15110c, 0.9);
    bg.fillRoundedRect(x, y, width, height, 8);
    bg.lineStyle(1, 0x4c4032, 1);
    bg.strokeRoundedRect(x, y, width, height, 8);
    this.container.add(bg);

    const skills = SKILL_ORDER.map((key: SkillKey) => `${key}:${member.skills[key]}`).join(' · ');
    const history = member.personalHistory.slice(-2).map((entry) => `${entry.year}: ${entry.text}`);
    const familyMemories = this.family.getLegacyRecords().slice(-2).map(entry => `Aile kaydı · ${entry.year}: ${entry.description}`);
    const lines = [
      `${member.firstName} ${member.familyName} · ${member.gender === 'male' ? 'Erkek' : 'Kadın'} · Kuşak ${member.generation}`,
      `Doğum ${member.birthDate.year}${member.deathDate ? ` · Ölüm ${member.deathDate.year}` : member.retirementDate ? ` · Emeklilik ${member.retirementDate.year}` : ''} · ${member.appearance} · Ün ${member.reputation}`,
      `Beceriler: ${skills}`,
      ...history,
      ...familyMemories,
    ];

    const text = this.scene.add.text(x + 10, y + 7, lines.join('\n'), {
      fontFamily: 'Arial',
      fontSize: width < 420 ? '9px' : '10px',
      color: '#cbbd9e',
      lineSpacing: 3,
      wordWrap: { width: width - 20 },
    });
    this.container.add(text);

    const legacy = this.family.getLegacy();
    const legacyLine = this.scene.add.text(
      x + width - 10,
      y + height - 8,
      `Arazi +${legacy.landAcquired}/-${legacy.landLost} · Askeri ${legacy.militaryAchievements} · Olay ${legacy.historicalEventsInfluenced.length}`,
      {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: '#8f7f64',
      },
    ).setOrigin(1, 1);
    this.container.add(legacyLine);

    if (member.id === this.family.getCurrentCharacter()?.id && member.isAlive && this.onRetireCallback && width >= 300) {
      const buttonW = Math.min(176, width - 20);
      const buttonX = x + 10;
      const buttonY = y + height - 31;
      const button = this.scene.add.graphics();
      button.fillStyle(0x4b3822, 1);
      button.fillRoundedRect(buttonX, buttonY, buttonW, 23, 5);
      button.lineStyle(1, 0xa88b54, 1);
      button.strokeRoundedRect(buttonX, buttonY, buttonW, 23, 5);
      const label = this.scene.add.text(buttonX + buttonW / 2, buttonY + 11, 'Aile reisliğini devret', {
        fontFamily: 'Arial', fontSize: '10px', color: '#f0dfbd',
      }).setOrigin(0.5);
      const hit = this.scene.add.zone(buttonX + buttonW / 2, buttonY + 11, buttonW, 23).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.onRetireCallback?.());
      this.container.add([button, label, hit]);
    }
  }
}
