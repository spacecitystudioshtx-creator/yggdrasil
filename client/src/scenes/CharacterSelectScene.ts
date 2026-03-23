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
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
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
      if (this.stageOverlay) return; // stage select handles navigation
      this.selectedIndex = (this.selectedIndex - 1 + this.classes.length) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard!.on('keydown-RIGHT', () => {
      if (this.stageOverlay) return;
      this.selectedIndex = (this.selectedIndex + 1) % this.classes.length;
      this.updateSelection();
    });
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.stageOverlay) return; // stage select ENTER handler takes priority
      this.confirmSelection();
    });
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.stageOverlay) return;
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
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5));

    // Description
    this.detailPanel.add(this.add.text(px + pw / 2, py + 36, cls.description, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#000000',
      fontStyle: 'bold',
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

  private showStageSelect(cls: ClassDef, checkpoints: StageCheckpoint[]): void {
    this.stageSelectedIndex = 0;
    this.stageCheckpoints = checkpoints;
    this.stageCards = [];

    if (this.stageOverlay) { this.stageOverlay.destroy(); this.stageOverlay = null; }
    this.stageKeys.forEach(k => k.destroy());
    this.stageKeys = [];
    this.stageOverlay = this.add.container(0, 0).setDepth(200);

    // --- Coffee Golf tour-style: circles ARE the selectable items ---

    // Dim backdrop
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.72);
    backdrop.fillRect(0, 0, 800, 600);
    this.stageOverlay.add(backdrop);

    // Compact panel — just enough for the circle path + info below
    const pw = 520, ph = 210;
    const px = 400 - pw / 2, py = 195;
    const panel = this.add.graphics();
    panel.fillStyle(0x2a1a0e); panel.fillRect(px, py, pw, ph);
    panel.fillStyle(0x5c3a1e); panel.fillRect(px + 2, py + 2, pw - 4, ph - 4);
    panel.fillStyle(0xdec9a0, 0.95); panel.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    this.stageOverlay.add(panel);

    // Title
    this.stageOverlay.add(this.add.text(400, py + 18, `${cls.name}`, {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#3d2410',
      stroke: '#ddc090', strokeThickness: 1,
    }).setOrigin(0.5));

    // --- Selectable circle path ---
    const pm2 = new ProgressManager();
    const highestStage = pm2.getHighestStage(cls.id);
    const circleCount = checkpoints.length;
    const circleSpacing = Math.min(90, Math.floor((pw - 80) / Math.max(1, circleCount - 1)));
    const totalPathW = (circleCount - 1) * circleSpacing;
    const pathStartX = 400 - totalPathW / 2;
    const circleY = py + 70;
    const circleR = 20;  // main radius for selectable circles

    for (let i = 0; i < circleCount; i++) {
      const cp = checkpoints[i];
      const cx = pathStartX + i * circleSpacing;
      const isSelected = i === this.stageSelectedIndex;
      const isContinue = cp.stageIndex === 99;

      // Map checkpoint to stage index for unlock check
      const stageIdx = isContinue ? highestStage : cp.stageIndex;
      const isUnlocked = stageIdx <= highestStage;

      const circleGfx = this.add.graphics();

      // Connecting line to next circle
      if (i < circleCount - 1) {
        const nextX = pathStartX + (i + 1) * circleSpacing;
        circleGfx.lineStyle(3, 0x8b6b3d, 0.4);
        circleGfx.beginPath();
        circleGfx.moveTo(cx + circleR + 2, circleY);
        circleGfx.lineTo(nextX - circleR - 2, circleY);
        circleGfx.strokePath();
      }

      if (isSelected) {
        // Selected circle — large, bright, with glow ring
        circleGfx.fillStyle(0xffdd44, 0.3);
        circleGfx.fillCircle(cx, circleY, circleR + 6);
        circleGfx.fillStyle(0xffcc22, 1);
        circleGfx.fillCircle(cx, circleY, circleR);
        circleGfx.lineStyle(3, 0x3d2410, 1);
        circleGfx.strokeCircle(cx, circleY, circleR);
        // Inner highlight
        circleGfx.fillStyle(0xffee88, 0.6);
        circleGfx.fillCircle(cx - 3, circleY - 3, circleR * 0.35);
      } else if (isUnlocked) {
        // Unlocked but not selected — medium, warm
        circleGfx.fillStyle(0xc8a870, 1);
        circleGfx.fillCircle(cx, circleY, circleR - 2);
        circleGfx.lineStyle(2, 0x8b6b3d, 0.8);
        circleGfx.strokeCircle(cx, circleY, circleR - 2);
      } else {
        // Locked — small, dim
        circleGfx.fillStyle(0x888878, 0.5);
        circleGfx.fillCircle(cx, circleY, circleR - 4);
        circleGfx.lineStyle(1, 0x666658, 0.4);
        circleGfx.strokeCircle(cx, circleY, circleR - 4);
      }
      this.stageOverlay!.add(circleGfx);

      // Circle label — short name inside or below
      const shortLabels = checkpoints.map(c => {
        if (c.stageIndex === 99) return 'RUN';
        if (c.stageIndex === 0) return 'NEW';
        return ['', 'I', 'II', 'III', 'IV'][c.stageIndex] ?? `${c.stageIndex}`;
      });
      const circleLabel = this.add.text(cx, circleY, shortLabels[i], {
        fontFamily: 'monospace',
        fontSize: isSelected ? '11px' : '9px',
        fontStyle: 'bold',
        color: isSelected ? '#3d2410' : (isUnlocked ? '#5c3a1e' : '#888878'),
      }).setOrigin(0.5);
      this.stageOverlay!.add(circleLabel);

      // Tiny stage name below circle
      const shortName = isContinue ? 'Continue' : ['Midgard', 'Frost', 'Verdant', 'Forge', 'Helheim'][stageIdx] ?? '';
      this.stageOverlay!.add(this.add.text(cx, circleY + circleR + 8, shortName, {
        fontFamily: 'monospace', fontSize: '7px',
        color: isSelected ? '#3d2410' : '#8b7b5d',
      }).setOrigin(0.5));

      // Clickable zone on each circle
      const zone = this.add.zone(cx, circleY, circleR * 2 + 10, circleR * 2 + 10);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => {
        if (i === this.stageSelectedIndex) {
          // Second click on selected = confirm
          this.confirmStageAndLaunch(cls);
        } else {
          this.stageSelectedIndex = i;
          this.refreshStageCards(cls);
        }
      });
      this.stageOverlay!.add(zone);
    }

    // --- Info panel below circles for selected checkpoint ---
    const sel = checkpoints[this.stageSelectedIndex];
    const infoY = circleY + circleR + 28;

    this.stageOverlay.add(this.add.text(400, infoY, sel.label, {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#3d2410',
    }).setOrigin(0.5));
    this.stageOverlay.add(this.add.text(400, infoY + 18, sel.description, {
      fontFamily: 'monospace', fontSize: '9px', color: '#6b4a28',
    }).setOrigin(0.5));
    this.stageOverlay.add(this.add.text(400, infoY + 34, `Starting Level: ${sel.startLevel}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#44aa44', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Confirm / nav hint
    this.stageOverlay.add(this.add.text(400, infoY + 56, '< >  navigate   ENTER  play   ESC  back', {
      fontFamily: 'monospace', fontSize: '8px', color: '#8b7b5d',
    }).setOrigin(0.5));

    // Keyboard navigation — LEFT/RIGHT between circles, ENTER to confirm
    if (this.input.keyboard) {
      const navigate = (dir: number) => {
        this.stageSelectedIndex = Math.max(0, Math.min(this.stageCheckpoints.length - 1, this.stageSelectedIndex + dir));
        this.refreshStageCards(cls);
      };
      const upKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      const downKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
      const leftKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
      const rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
      const enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      const escKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      this.stageKeys = [upKey, downKey, leftKey, rightKey, enterKey, escKey];

      leftKey.on('down',  () => navigate(-1));
      rightKey.on('down', () => navigate(1));
      upKey.on('down',    () => navigate(-1));
      downKey.on('down',  () => navigate(1));
      enterKey.on('down', () => this.confirmStageAndLaunch(cls));
      escKey.on('down', () => {
        this.stageOverlay?.destroy();
        this.stageOverlay = null;
        this.stageKeys.forEach(k => k.destroy());
        this.stageKeys = [];
      });
    }
  }

  private refreshStageCards(cls?: ClassDef): void {
    if (!this.stageOverlay) return;
    const c = cls ?? this.classes[this.selectedIndex];
    this.stageOverlay.destroy();
    this.stageOverlay = null;
    this.showStageSelect(c, this.stageCheckpoints);
  }

  private confirmStageAndLaunch(cls: ClassDef): void {
    const checkpoint = this.stageCheckpoints[this.stageSelectedIndex];
    this.stageOverlay?.destroy();
    this.stageOverlay = null;
    this.stageKeys.forEach(k => k.destroy());
    this.stageKeys = [];

    const pm = new ProgressManager();

    if (checkpoint.stageIndex === 99) {
      // "Continue" sentinel — restoreRunState in GameScene handles exact level
      this.launchGame(cls.id, 0);
    } else if (checkpoint.stageIndex === 0) {
      // "Midgard (Fresh Start)" — wipe saved run so restoreRunState doesn't restore it
      pm.clearRunState();
      this.launchGame(cls.id, 0);
    } else {
      // Named checkpoint (Frostheim Cleared, etc.) — wipe run state, start at checkpoint
      pm.clearRunState();
      this.launchGame(cls.id, checkpoint.stageIndex);
    }
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
