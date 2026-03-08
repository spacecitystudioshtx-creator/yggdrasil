import Phaser from 'phaser';
import { ClassDef, getAllClasses, getClass } from '../data/ClassDatabase';
import { ProgressManager, STAGE_CHECKPOINTS, StageCheckpoint } from '../systems/ProgressManager';
import { CLASS_ABILITIES } from '../systems/AbilitySystem';
import { MusicManager } from '../systems/MusicManager';

/**
 * CharacterSelectScene: Choose your class before entering the game.
 *
 * Stardew Valley-inspired warm aesthetic with Norse theme.
 * Shows all 6 classes with stats and descriptions.
 * Selected class determines starting gear and stat progression.
 */

// Stardew colors
const C = {
  panelBorder: 0x3d2410,
  panelBg: 0x5c3a1e,
  panelInner: 0xdec9a0,
  gold: 0xddaa44,
  text: '#3d2410',
  textLight: '#8b6b3d',
  selected: 0xffdd44,
};

export class CharacterSelectScene extends Phaser.Scene {
  private classes: ClassDef[] = [];
  private selectedIndex: number = 0;
  private classCards: Phaser.GameObjects.Container[] = [];
  private detailPanel!: Phaser.GameObjects.Container;
  private selectionBorder!: Phaser.GameObjects.Graphics;
  private musicManager!: MusicManager;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    // Keep overworld music playing through character select (started in LoreScene)
    // If coming directly (e.g. no lore), start it here
    if (!this.sound.get('music_overworld')?.isPlaying) {
      this.musicManager = new MusicManager(this);
      this.musicManager.playMusic('music_overworld');
    }

    this.classes = getAllClasses();
    this.selectedIndex = 0;

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e);
    bg.fillRect(0, 0, 800, 600);

    // Title
    this.add.text(cx, 30, 'CHOOSE YOUR CLASS', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ddaa44',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(cx, 52, 'Prove yourself worthy of Asgard\'s blessing', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#887766',
    }).setOrigin(0.5);

    // Class cards (top row)
    const cardW = 110, cardH = 90, cardGap = 12;
    const totalW = this.classes.length * cardW + (this.classes.length - 1) * cardGap;
    const startX = cx - totalW / 2;
    const cardY = 80;

    for (let i = 0; i < this.classes.length; i++) {
      const cls = this.classes[i];
      const x = startX + i * (cardW + cardGap);

      const card = this.add.container(x, cardY);

      // Card background
      const cardBg = this.add.graphics();
      cardBg.fillStyle(C.panelBorder);
      cardBg.fillRect(0, 0, cardW, cardH);
      cardBg.fillStyle(C.panelBg);
      cardBg.fillRect(2, 2, cardW - 4, cardH - 4);
      cardBg.fillStyle(C.panelInner, 0.9);
      cardBg.fillRect(4, 4, cardW - 8, cardH - 8);
      card.add(cardBg);

      // Class sprite preview (tinted player)
      const preview = this.add.image(cardW / 2, 30, 'player');
      preview.setTint(cls.spriteTint);
      preview.setScale(2);
      card.add(preview);

      // Class name
      card.add(this.add.text(cardW / 2, 55, cls.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ddaa44',
      }).setOrigin(0.5));

      // Weapon type
      card.add(this.add.text(cardW / 2, 68, cls.weaponType, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#8b6b3d',
      }).setOrigin(0.5));

      // Armor type
      card.add(this.add.text(cardW / 2, 78, cls.armorType + ' armor', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#8b6b3d',
      }).setOrigin(0.5));

      // Make clickable
      const hitArea = this.add.zone(cardW / 2, cardH / 2, cardW, cardH);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        this.selectedIndex = i;
        this.updateSelection();
      });
      card.add(hitArea);

      this.classCards.push(card);
    }

    // Selection border
    this.selectionBorder = this.add.graphics().setDepth(10);

    // Detail panel (bottom section)
    this.detailPanel = this.add.container(0, 0).setDepth(5);

    // Controls hint
    this.add.text(cx, 580, 'Click a class to select  •  Press ENTER to begin', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#887766',
    }).setOrigin(0.5);

    // Keyboard controls
    this.input.keyboard!.on('keydown-LEFT', () => {
      this.selectedIndex = (this.selectedIndex - 1 + this.classes.length) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard!.on('keydown-RIGHT', () => {
      this.selectedIndex = (this.selectedIndex + 1) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard!.on('keydown-ENTER', () => {
      this.confirmSelection();
    });
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.confirmSelection();
    });

    // Initial selection
    this.updateSelection();
  }

  private updateSelection(): void {
    const cls = this.classes[this.selectedIndex];
    const cardW = 110, cardGap = 12;
    const cx = this.cameras.main.width / 2;
    const totalW = this.classes.length * cardW + (this.classes.length - 1) * cardGap;
    const startX = cx - totalW / 2;
    const cardY = 80;

    // Update selection border
    this.selectionBorder.clear();
    const selX = startX + this.selectedIndex * (cardW + cardGap);
    this.selectionBorder.lineStyle(3, C.selected);
    this.selectionBorder.strokeRect(selX - 2, cardY - 2, cardW + 4, 94);

    // Update detail panel
    this.detailPanel.removeAll(true);

    const px = 60, py = 190;
    const pw = 680, ph = 360;

    // Panel background
    const bg = this.add.graphics();
    bg.fillStyle(C.panelBorder);
    bg.fillRect(px, py, pw, ph);
    bg.fillStyle(C.panelBg);
    bg.fillRect(px + 2, py + 2, pw - 4, ph - 4);
    bg.fillStyle(C.panelInner, 0.9);
    bg.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    this.detailPanel.add(bg);

    // Class name (large)
    this.detailPanel.add(this.add.text(px + pw / 2, py + 16, cls.name, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ddaa44',
    }).setOrigin(0.5));

    // Description
    this.detailPanel.add(this.add.text(px + pw / 2, py + 36, cls.description, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#5c3a1e',
      wordWrap: { width: pw - 40 },
    }).setOrigin(0.5));

    // Lore (italic)
    this.detailPanel.add(this.add.text(px + pw / 2, py + 56, `"${cls.lore}"`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#8b6b3d',
      fontStyle: 'italic',
      wordWrap: { width: pw - 60 },
    }).setOrigin(0.5));

    // Large sprite preview
    const largePreview = this.add.image(px + 60, py + 130, 'player');
    largePreview.setTint(cls.spriteTint);
    largePreview.setScale(4);
    this.detailPanel.add(largePreview);

    // Ability info — full box with name, description, MP cost, cooldown
    const abDef = CLASS_ABILITIES[cls.id]?.ability1;
    const abBoxX = px + 14, abBoxY = py + 160, abBoxW = 220, abBoxH = 74;
    const abBox = this.add.graphics();
    abBox.fillStyle(0x2a1a0e, 0.9);
    abBox.fillRect(abBoxX, abBoxY, abBoxW, abBoxH);
    abBox.lineStyle(2, 0x8b6b3d, 0.9);
    abBox.strokeRect(abBoxX, abBoxY, abBoxW, abBoxH);
    if (abDef) {
      // Colored accent bar using ability color
      const abColor = parseInt(abDef.color.replace('#', ''), 16);
      abBox.fillStyle(abColor, 0.5);
      abBox.fillRect(abBoxX, abBoxY, abBoxW, 4);
    }
    this.detailPanel.add(abBox);

    this.detailPanel.add(this.add.text(abBoxX + abBoxW / 2, abBoxY + 12, '[SPACE] SPECIAL ABILITY', {
      fontFamily: 'monospace', fontSize: '7px', color: '#887766',
    }).setOrigin(0.5));
    this.detailPanel.add(this.add.text(abBoxX + abBoxW / 2, abBoxY + 26, cls.abilityName, {
      fontFamily: 'monospace', fontSize: '11px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5));
    this.detailPanel.add(this.add.text(abBoxX + abBoxW / 2, abBoxY + 42, cls.abilityDescription, {
      fontFamily: 'monospace', fontSize: '7px', color: '#c8a870',
      wordWrap: { width: abBoxW - 16 }, align: 'center',
    }).setOrigin(0.5, 0));
    if (abDef) {
      this.detailPanel.add(this.add.text(abBoxX + 8, abBoxY + abBoxH - 12,
        `${abDef.mpCost} MP  ·  ${abDef.cooldown}s cooldown`, {
          fontFamily: 'monospace', fontSize: '7px', color: '#6688bb',
        }));
    }

    // Stats panel (right side)
    const sx = px + 250, sy = py + 85;

    this.detailPanel.add(this.add.text(sx, sy, 'BASE STATS', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ddaa44',
    }));

    const stats = [
      { label: 'HP', base: cls.baseStats.maxHp, cap: cls.statCaps.maxHp, color: '#cc3333' },
      { label: 'MP', base: cls.baseStats.maxMp, cap: cls.statCaps.maxMp, color: '#3355aa' },
      { label: 'ATK', base: cls.baseStats.attack, cap: cls.statCaps.attack, color: '#cc6633' },
      { label: 'DEF', base: cls.baseStats.defense, cap: cls.statCaps.defense, color: '#668833' },
      { label: 'SPD', base: cls.baseStats.speed, cap: cls.statCaps.speed, color: '#33aacc' },
      { label: 'DEX', base: cls.baseStats.dexterity, cap: cls.statCaps.dexterity, color: '#ccaa33' },
      { label: 'VIT', base: cls.baseStats.vitality, cap: cls.statCaps.vitality, color: '#cc4466' },
      { label: 'WIS', base: cls.baseStats.wisdom, cap: cls.statCaps.wisdom, color: '#6644cc' },
    ];

    let statY = sy + 16;
    for (const stat of stats) {
      // Label
      this.detailPanel.add(this.add.text(sx, statY, stat.label, {
        fontFamily: 'monospace', fontSize: '8px', color: '#3d2410',
      }));

      // Bar background
      const barBg = this.add.graphics();
      barBg.fillStyle(0x888888, 0.3);
      barBg.fillRect(sx + 30, statY + 1, 140, 8);
      this.detailPanel.add(barBg);

      // Bar fill (base as fraction of cap)
      const ratio = Math.min(1, stat.base / stat.cap);
      const barFill = this.add.graphics();
      const c = Phaser.Display.Color.HexStringToColor(stat.color);
      barFill.fillStyle(c.color, 0.8);
      barFill.fillRect(sx + 30, statY + 1, 140 * ratio, 8);
      this.detailPanel.add(barFill);

      // Values
      this.detailPanel.add(this.add.text(sx + 175, statY, `${stat.base} / ${stat.cap}`, {
        fontFamily: 'monospace', fontSize: '8px', color: '#5c3a1e',
      }));

      statY += 14;
    }

    // Per-level gains
    const gx = px + 450, gy = py + 85;
    this.detailPanel.add(this.add.text(gx, gy, 'PER LEVEL', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ddaa44',
    }));

    const gains = [
      { label: 'HP', value: cls.levelGains.maxHp },
      { label: 'MP', value: cls.levelGains.maxMp },
      { label: 'ATK', value: cls.levelGains.attack },
      { label: 'DEF', value: cls.levelGains.defense },
      { label: 'SPD', value: cls.levelGains.speed },
      { label: 'DEX', value: cls.levelGains.dexterity },
      { label: 'VIT', value: cls.levelGains.vitality },
      { label: 'WIS', value: cls.levelGains.wisdom },
    ];

    let gainY = gy + 16;
    for (const g of gains) {
      this.detailPanel.add(this.add.text(gx, gainY, `${g.label}: +${g.value}`, {
        fontFamily: 'monospace', fontSize: '8px', color: '#5c3a1e',
      }));
      gainY += 14;
    }

    // Equipment info
    this.detailPanel.add(this.add.text(px + 20, py + ph - 50, `Weapon: ${cls.weaponType}  |  Armor: ${cls.armorType}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#8b6b3d',
    }));

    // Big "SELECT" button
    const btnX = px + pw / 2 - 60;
    const btnY = py + ph - 30;
    const btn = this.add.graphics();
    btn.fillStyle(0x3d7a28);
    btn.fillRect(btnX, btnY, 120, 22);
    btn.fillStyle(0x44aa33);
    btn.fillRect(btnX + 1, btnY + 1, 118, 20);
    this.detailPanel.add(btn);

    this.detailPanel.add(this.add.text(btnX + 60, btnY + 10, `Play as ${cls.name}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#ffffff',
    }).setOrigin(0.5));

    // Make button clickable
    const btnZone = this.add.zone(btnX + 60, btnY + 11, 120, 22);
    btnZone.setInteractive({ useHandCursor: true });
    btnZone.on('pointerdown', () => this.confirmSelection());
    this.detailPanel.add(btnZone);
  }

  // ---- Stage select overlay ----
  private stageOverlay: Phaser.GameObjects.Container | null = null;
  private stageSelectedIndex: number = 0;
  private stageCheckpoints: typeof STAGE_CHECKPOINTS = [];
  private stageCards: Phaser.GameObjects.Container[] = [];
  private stageKeys: Phaser.Input.Keyboard.Key[] = [];

  private confirmSelection(): void {
    const cls = this.classes[this.selectedIndex];
    const pm = new ProgressManager();
    const unlocked = pm.getUnlockedCheckpoints(cls.id);
    const runState = pm.loadRunState(cls.id);

    // Build option list: "Continue" first (if run exists), then unlocked checkpoints
    const allOptions: StageCheckpoint[] = [];

    // "Continue" is a sentinel entry (stageIndex 99) — always at the top
    if (runState && runState.level > 1) {
      allOptions.push({
        stageIndex: 99,  // sentinel — detected in confirmStageAndLaunch
        label: `► Continue  (Lv.${runState.level})`,
        startLevel: runState.level,
        description: `Resume your run at level ${runState.level}.`,
      });
    }

    // Unlocked checkpoints (stage 0 = Midgard is always here)
    for (const cp of unlocked) {
      // Rename stage 0 to make clear it's a fresh start when Continue is present
      if (cp.stageIndex === 0 && allOptions.length > 0) {
        allOptions.push({
          ...cp,
          label: 'Midgard  (Fresh Start)',
          description: 'Start over from level 1.',
        });
      } else {
        allOptions.push(cp);
      }
    }

    // If only Midgard and no run state, skip overlay and go straight in
    if (allOptions.length === 1 && allOptions[0].stageIndex === 0) {
      this.launchGame(cls.id, 0);
      return;
    }

    // Show Mario World-style stage select
    this.showStageSelect(cls, allOptions);
  }

  private showStageSelect(cls: ClassDef, checkpoints: typeof STAGE_CHECKPOINTS): void {
    this.stageSelectedIndex = 0;
    this.stageCheckpoints = checkpoints;
    this.stageCards = [];

    if (this.stageOverlay) { this.stageOverlay.destroy(); this.stageOverlay = null; }
    this.stageOverlay = this.add.container(0, 0).setDepth(200);

    // Dim backdrop
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.75);
    backdrop.fillRect(0, 0, 800, 600);
    this.stageOverlay.add(backdrop);

    // Panel
    const pw = 420, ph = 80 + checkpoints.length * 56 + 30;
    const px = 400 - pw / 2, py = 300 - ph / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x2a1a0e); panel.fillRect(px, py, pw, ph);
    panel.fillStyle(0x5c3a1e); panel.fillRect(px + 2, py + 2, pw - 4, ph - 4);
    panel.fillStyle(0xdec9a0, 0.95); panel.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    this.stageOverlay.add(panel);

    this.stageOverlay.add(this.add.text(400, py + 18, `${cls.name} — Choose Starting Point`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#3d2410',
      stroke: '#ddc090', strokeThickness: 1,
    }).setOrigin(0.5));
    this.stageOverlay.add(this.add.text(400, py + 34, '← → or Arrow Keys  •  ENTER to confirm', {
      fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
    }).setOrigin(0.5));

    // Build stage cards
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const cardX = px + 14, cardY = py + 54 + i * 56;
      const cardW = pw - 28, cardH = 48;

      const card = this.add.container(0, 0);

      const bg = this.add.graphics();
      const isSelected = i === this.stageSelectedIndex;
      bg.fillStyle(isSelected ? 0xffdd44 : 0xc8a870, isSelected ? 1 : 0.7);
      bg.fillRect(cardX, cardY, cardW, cardH);
      bg.lineStyle(2, isSelected ? 0x3d2410 : 0x8b6b3d);
      bg.strokeRect(cardX, cardY, cardW, cardH);
      card.add(bg);

      // Stage dot sequence (Mario World style)
      const dotCount = STAGE_CHECKPOINTS.length;
      for (let d = 0; d < dotCount; d++) {
        const dotX = cardX + 12 + d * 22;
        const dotY = cardY + 10;
        const dot = this.add.graphics();
        const isUnlocked = d < checkpoints.length;
        const isThis = d === cp.stageIndex;
        dot.fillStyle(isThis ? 0xff4444 : isUnlocked ? 0x44aa44 : 0x888888);
        dot.fillCircle(dotX, dotY, 5);
        if (d < dotCount - 1) {
          dot.lineStyle(1, isUnlocked && d + 1 < checkpoints.length ? 0x44aa44 : 0x888888);
          dot.beginPath(); dot.moveTo(dotX + 5, dotY); dot.lineTo(dotX + 17, dotY); dot.strokePath();
        }
        card.add(dot);
      }

      card.add(this.add.text(cardX + 14, cardY + 22, cp.label, {
        fontFamily: 'monospace', fontSize: '11px',
        color: isSelected ? '#3d2410' : '#5c3a1e',
        stroke: isSelected ? '#ffee88' : '#dec9a0', strokeThickness: 1,
      }));
      card.add(this.add.text(cardX + cardW - 14, cardY + 22, cp.description, {
        fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
      }).setOrigin(1, 0.5));
      card.add(this.add.text(cardX + 14, cardY + 36, `Start at Level ${cp.startLevel}`, {
        fontFamily: 'monospace', fontSize: '8px', color: '#44aa44',
      }));

      // Click to select
      const zone = this.add.zone(cardX + cardW / 2, cardY + cardH / 2, cardW, cardH);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.stageSelectedIndex = i;
        this.refreshStageCards();
      });
      zone.on('pointerup', () => {
        if (this.stageSelectedIndex === i) {
          this.confirmStageAndLaunch(cls);
        }
      });
      card.add(zone);

      this.stageOverlay!.add(card);
      this.stageCards.push(card);
    }

    // Keyboard navigation
    if (this.input.keyboard) {
      const upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      const downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
      const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      this.stageKeys = [upKey, downKey, enterKey, escKey];

      upKey.on('down', () => {
        this.stageSelectedIndex = Math.max(0, this.stageSelectedIndex - 1);
        this.refreshStageCards();
      });
      downKey.on('down', () => {
        this.stageSelectedIndex = Math.min(this.stageCheckpoints.length - 1, this.stageSelectedIndex + 1);
        this.refreshStageCards();
      });
      enterKey.on('down', () => this.confirmStageAndLaunch(cls));
      escKey.on('down', () => {
        this.stageOverlay?.destroy();
        this.stageOverlay = null;
        this.stageKeys.forEach(k => k.destroy());
        this.stageKeys = [];
      });
    }
  }

  private refreshStageCards(): void {
    // Rebuild the overlay with the new selection — cheapest approach
    if (!this.stageOverlay) return;
    const cls = this.classes[this.selectedIndex];
    this.stageOverlay.destroy();
    this.stageOverlay = null;
    this.showStageSelect(cls, this.stageCheckpoints);
  }

  private confirmStageAndLaunch(cls: ClassDef): void {
    const checkpoint = this.stageCheckpoints[this.stageSelectedIndex];
    this.stageOverlay?.destroy();
    this.stageOverlay = null;
    this.stageKeys.forEach(k => k.destroy());
    this.stageKeys = [];

    // stageIndex 99 = "Continue" sentinel — restoreRunState in GameScene handles exact level
    const isContinue = checkpoint.stageIndex === 99;
    this.launchGame(cls.id, isContinue ? 0 : checkpoint.stageIndex);
  }

  private launchGame(classId: string, startStage: number): void {
    if (this.scene.isActive('GameScene') || this.scene.isSleeping('GameScene')) this.scene.stop('GameScene');
    if (this.scene.isActive('UIScene') || this.scene.isSleeping('UIScene')) this.scene.stop('UIScene');
    if (this.scene.isActive('DungeonScene') || this.scene.isSleeping('DungeonScene')) this.scene.stop('DungeonScene');
    this.scene.stop('CharacterSelectScene');
    this.scene.start('GameScene', { classId, startStage });
    this.scene.launch('UIScene');
  }
}
