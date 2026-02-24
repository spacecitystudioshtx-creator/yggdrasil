import Phaser from 'phaser';
import { ClassDef, getAllClasses, getClass } from '../data/ClassDatabase';

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

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
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

    // Ability info
    this.detailPanel.add(this.add.text(px + 20, py + 170, `Ability: ${cls.abilityName}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#ddaa44',
    }));
    this.detailPanel.add(this.add.text(px + 20, py + 184, cls.abilityDescription, {
      fontFamily: 'monospace', fontSize: '8px', color: '#5c3a1e',
      wordWrap: { width: 200 },
    }));

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

  private confirmSelection(): void {
    const cls = this.classes[this.selectedIndex];

    // Flash effect
    this.cameras.main.flash(500, 255, 221, 68);

    this.time.delayedCall(500, () => {
      // Start the game with the selected class
      this.scene.start('GameScene', {
        classId: cls.id,
      });
      this.scene.launch('UIScene');
    });
  }
}
