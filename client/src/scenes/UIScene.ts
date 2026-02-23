import Phaser from 'phaser';
import { getItem } from '../data/ItemDatabase';

/**
 * UIScene: Stardew Valley-inspired warm HUD overlay.
 *
 * Design:
 *   - Warm earth tones (browns, creams, gold accents)
 *   - Wooden panel frames with parchment interiors
 *   - Cozy, inviting feel
 *
 * Panels:
 *   - Top-left: HP/MP/XP bars in wooden frame
 *   - Bottom: Equipment hotbar
 *   - Right: Quest tracker
 *   - Toggle: Inventory (I), Quest Log (J)
 */

// Stardew color palette
const C = {
  panelBorder: 0x3d2410,
  panelBg: 0x5c3a1e,
  panelInner: 0xdec9a0,
  gold: 0xddaa44,
  hpRed: 0xcc3333,
  hpBg: 0x882222,
  mpBlue: 0x3355aa,
  mpBg: 0x223377,
  xpGold: 0xccaa22,
  slotBg: 0xc4a87a,
  slotBorder: 0x8b6b3d,
};

export class UIScene extends Phaser.Scene {
  private hpGfx!: Phaser.GameObjects.Graphics;
  private mpGfx!: Phaser.GameObjects.Graphics;
  private xpGfx!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;

  private deathOverlay!: Phaser.GameObjects.Graphics;
  private deathText!: Phaser.GameObjects.Text;

  private questTexts: Phaser.GameObjects.Text[] = [];
  private questGfx!: Phaser.GameObjects.Graphics;

  private invPanel!: Phaser.GameObjects.Container;
  private invOpen = false;
  private questPanel!: Phaser.GameObjects.Container;
  private questOpen = false;

  private readonly barW = 140;
  private readonly barH = 12;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // --- HP/MP/XP panel (top-left) ---
    const panel = this.add.graphics().setDepth(99);
    this.drawPanel(panel, 6, 4, 170, 58);

    this.hpGfx = this.add.graphics().setDepth(100);
    this.mpGfx = this.add.graphics().setDepth(100);
    this.xpGfx = this.add.graphics().setDepth(100);

    this.hpText = this.add.text(12 + this.barW / 2, 16, '200/200', {
      fontFamily: 'monospace', fontSize: '9px', color: '#f0e4cc',
    }).setOrigin(0.5).setDepth(101);

    this.mpText = this.add.text(12 + this.barW / 2, 32, '100/100', {
      fontFamily: 'monospace', fontSize: '9px', color: '#f0e4cc',
    }).setOrigin(0.5).setDepth(101);

    this.levelText = this.add.text(12 + this.barW / 2, 48, 'Lv. 1', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ddaa44',
    }).setOrigin(0.5).setDepth(101);

    this.goldText = this.add.text(10, 66, 'Gold: 0', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 1,
    }).setDepth(100);

    // --- Bottom hotbar ---
    const hotbar = this.add.graphics().setDepth(99);
    const cx = this.cameras.main.width / 2;
    const hy = this.cameras.main.height - 42;
    const sw = 28, gap = 4;
    const tw = sw * 4 + gap * 3 + 16;
    this.drawPanel(hotbar, cx - tw / 2, hy - 4, tw, sw + 8);
    const labels = ['WPN', 'ABL', 'ARM', 'RNG'];
    for (let i = 0; i < 4; i++) {
      const sx = cx - tw / 2 + 4 + i * (sw + gap) + 4;
      hotbar.fillStyle(C.slotBg);
      hotbar.fillRect(sx, hy, sw, sw);
      hotbar.lineStyle(1, C.slotBorder);
      hotbar.strokeRect(sx, hy, sw, sw);
      this.add.text(sx + sw / 2, hy + sw / 2, labels[i], {
        fontFamily: 'monospace', fontSize: '7px', color: '#8b6b3d',
      }).setOrigin(0.5).setDepth(101);
    }

    // --- Quest tracker (top-right) ---
    this.questGfx = this.add.graphics().setDepth(99);

    // --- Death overlay ---
    this.deathOverlay = this.add.graphics().setDepth(200).setVisible(false);
    this.deathText = this.add.text(
      this.cameras.main.width / 2, this.cameras.main.height / 2, '',
      { fontFamily: 'monospace', fontSize: '18px', color: '#cc3333', stroke: '#000', strokeThickness: 3, align: 'center' },
    ).setOrigin(0.5).setDepth(201).setVisible(false);

    // --- Toggle panels ---
    this.invPanel = this.add.container(0, 0).setDepth(150).setVisible(false);
    this.questPanel = this.add.container(0, 0).setDepth(150).setVisible(false);

    // --- Controls hint ---
    const hint = this.add.text(
      this.cameras.main.width / 2, this.cameras.main.height - 14,
      'WASD: Move | Click: Shoot | I: Inventory | J: Quests',
      { fontFamily: 'monospace', fontSize: '9px', color: '#887766' },
    ).setOrigin(0.5).setDepth(100);
    this.time.delayedCall(8000, () => this.tweens.add({ targets: hint, alpha: 0, duration: 2000 }));

    // --- Keyboard ---
    this.input.keyboard!.on('keydown-I', () => {
      this.invOpen = !this.invOpen;
      if (this.invOpen) { this.questOpen = false; this.questPanel.setVisible(false); this.rebuildInventory(); }
      this.invPanel.setVisible(this.invOpen);
    });
    this.input.keyboard!.on('keydown-J', () => {
      this.questOpen = !this.questOpen;
      if (this.questOpen) { this.invOpen = false; this.invPanel.setVisible(false); this.rebuildQuestLog(); }
      this.questPanel.setVisible(this.questOpen);
    });

    // --- Listen to game events ---
    const gs = this.scene.get('GameScene');
    gs.events.on('playerUpdate', this.onPlayerUpdate, this);
    gs.events.on('playerDeath', this.onDeath, this);
    gs.events.on('playerRespawn', this.onRespawn, this);
    gs.events.on('questUpdate', this.onQuestTrackerUpdate, this);
    gs.events.on('notification', this.showNotification, this);
  }

  // ---- Bars update ----
  private onPlayerUpdate(d: {
    hp: number; maxHp: number; mp: number; maxMp: number;
    level: number; xp: number; xpToNext: number; gold?: number;
  }): void {
    const hpR = Math.max(0, d.hp / d.maxHp);
    this.hpGfx.clear();
    this.hpGfx.fillStyle(C.hpBg); this.hpGfx.fillRect(12, 10, this.barW, this.barH);
    this.hpGfx.fillStyle(C.hpRed); this.hpGfx.fillRect(12, 10, this.barW * hpR, this.barH);
    this.hpText.setText(`${Math.ceil(d.hp)}/${d.maxHp}`);

    const mpR = d.maxMp > 0 ? Math.max(0, d.mp / d.maxMp) : 0;
    this.mpGfx.clear();
    this.mpGfx.fillStyle(C.mpBg); this.mpGfx.fillRect(12, 26, this.barW, this.barH);
    this.mpGfx.fillStyle(C.mpBlue); this.mpGfx.fillRect(12, 26, this.barW * mpR, this.barH);
    this.mpText.setText(`${Math.ceil(d.mp)}/${d.maxMp}`);

    const xpR = d.xpToNext > 0 ? Math.max(0, d.xp / d.xpToNext) : 1;
    this.xpGfx.clear();
    this.xpGfx.fillStyle(0x555544); this.xpGfx.fillRect(12, 42, this.barW, 6);
    this.xpGfx.fillStyle(C.xpGold); this.xpGfx.fillRect(12, 42, this.barW * xpR, 6);
    this.levelText.setText(`Lv. ${d.level}`);

    if (d.gold !== undefined) this.goldText.setText(`Gold: ${d.gold}`);
  }

  // ---- Death ----
  private onDeath(d: { level: number }): void {
    this.deathOverlay.clear();
    this.deathOverlay.fillStyle(0x000000, 0.6);
    this.deathOverlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    this.deathOverlay.setVisible(true);
    this.deathText.setText(`YOU DIED\nLevel ${d.level}\nRespawning...`).setVisible(true);
  }
  private onRespawn(): void {
    this.deathOverlay.setVisible(false);
    this.deathText.setVisible(false);
  }

  // ---- Quest tracker (top-right, always visible) ----
  private onQuestTrackerUpdate(quests: { name: string; objectives: { desc: string; current: number; target: number; done: boolean }[] }[]): void {
    this.questTexts.forEach(t => t.destroy());
    this.questTexts = [];
    this.questGfx.clear();
    if (quests.length === 0) return;

    const x = this.cameras.main.width - 180;
    let y = 6;
    let lines = 0;
    for (const q of quests) { lines += 1 + q.objectives.length; }
    this.drawPanel(this.questGfx, x - 4, 2, 178, lines * 12 + 14);

    for (const q of quests) {
      const nt = this.add.text(x + 2, y + 2, q.name, {
        fontFamily: 'monospace', fontSize: '9px', color: '#ddaa44', fontStyle: 'bold',
      }).setDepth(101);
      this.questTexts.push(nt);
      y += 12;
      for (const o of q.objectives) {
        const ch = o.done ? '✓' : '○';
        const c = o.done ? '#44aa44' : '#3d2410';
        const ot = this.add.text(x + 8, y + 2, `${ch} ${o.desc} (${o.current}/${o.target})`, {
          fontFamily: 'monospace', fontSize: '8px', color: c,
        }).setDepth(101);
        this.questTexts.push(ot);
        y += 12;
      }
    }
  }

  // ---- Inventory panel ----
  private rebuildInventory(): void {
    this.invPanel.removeAll(true);
    const pw = 260, ph = 220;
    const px = (this.cameras.main.width - pw) / 2;
    const py = (this.cameras.main.height - ph) / 2;

    const bg = this.add.graphics();
    this.drawPanel(bg, px, py, pw, ph);
    this.invPanel.add(bg);

    this.invPanel.add(this.add.text(px + pw / 2, py + 10, 'Inventory', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ddaa44',
    }).setOrigin(0.5));

    const gs = this.scene.get('GameScene') as any;
    const inv = gs?.inventoryManager;

    // Equipment row
    const eqY = py + 28;
    const eqLabels = ['Weapon', 'Ability', 'Armor', 'Ring'];
    const eqSlots = inv ? [inv.equipment.weapon, inv.equipment.ability, inv.equipment.armor, inv.equipment.ring] : [null, null, null, null];

    for (let i = 0; i < 4; i++) {
      const sx = px + 12 + i * 62;
      bg.fillStyle(C.slotBorder); bg.fillRect(sx, eqY, 52, 36);
      bg.fillStyle(C.slotBg); bg.fillRect(sx + 1, eqY + 1, 50, 34);

      this.invPanel.add(this.add.text(sx + 26, eqY - 2, eqLabels[i], {
        fontFamily: 'monospace', fontSize: '7px', color: '#8b6b3d',
      }).setOrigin(0.5));

      if (eqSlots[i]) {
        const item = getItem(eqSlots[i]);
        if (item) {
          const ig = this.add.graphics();
          ig.fillStyle(item.spriteColor); ig.fillRect(sx + 16, eqY + 8, 20, 20);
          ig.fillStyle(item.spriteAccent); ig.fillRect(sx + 20, eqY + 12, 12, 12);
          this.invPanel.add(ig);
          this.invPanel.add(this.add.text(sx + 26, eqY + 30, item.name.split(' ')[0].substring(0, 7), {
            fontFamily: 'monospace', fontSize: '6px', color: '#3d2410',
          }).setOrigin(0.5));
        }
      }
    }

    // Bag grid (4x2)
    const bx = px + 12, by = eqY + 52;
    this.invPanel.add(this.add.text(bx, by - 2, 'Bag:', {
      fontFamily: 'monospace', fontSize: '9px', color: '#3d2410',
    }));
    const ss = 32, sg = 4;
    for (let i = 0; i < 8; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const sx = bx + col * (ss + sg), sy = by + 14 + row * (ss + sg);
      bg.fillStyle(C.slotBorder); bg.fillRect(sx, sy, ss, ss);
      bg.fillStyle(C.slotBg); bg.fillRect(sx + 1, sy + 1, ss - 2, ss - 2);

      if (inv?.inventory[i]?.itemId) {
        const sd = inv.inventory[i];
        const item = getItem(sd.itemId);
        if (item) {
          const ig = this.add.graphics();
          ig.fillStyle(item.spriteColor); ig.fillRect(sx + 4, sy + 4, ss - 8, ss - 8);
          ig.fillStyle(item.spriteAccent); ig.fillRect(sx + 8, sy + 8, ss - 16, ss - 16);
          this.invPanel.add(ig);
          if (sd.quantity > 1) {
            this.invPanel.add(this.add.text(sx + ss - 3, sy + ss - 3, `${sd.quantity}`, {
              fontFamily: 'monospace', fontSize: '8px', color: '#f0e4cc', stroke: '#000', strokeThickness: 2,
            }).setOrigin(1, 1));
          }
        }
      }
    }

    this.invPanel.add(this.add.text(px + pw / 2, py + ph - 10, 'Press I to close', {
      fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
    }).setOrigin(0.5));
  }

  // ---- Quest Log panel ----
  private rebuildQuestLog(): void {
    this.questPanel.removeAll(true);
    const pw = 320, ph = 280;
    const px = (this.cameras.main.width - pw) / 2;
    const py = (this.cameras.main.height - ph) / 2;

    const bg = this.add.graphics();
    this.drawPanel(bg, px, py, pw, ph);
    this.questPanel.add(bg);

    this.questPanel.add(this.add.text(px + pw / 2, py + 10, 'Quest Journal', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ddaa44',
    }).setOrigin(0.5));

    const gs = this.scene.get('GameScene') as any;
    const qm = gs?.questManager;
    let y = py + 30;

    if (!qm || qm.activeQuests.length === 0) {
      this.questPanel.add(this.add.text(px + pw / 2, y + 20,
        'No active quests.\nExplore Midgard to find quest givers!',
        { fontFamily: 'monospace', fontSize: '9px', color: '#8b6b3d', align: 'center' },
      ).setOrigin(0.5, 0));
    } else {
      for (const quest of qm.activeQuests) {
        const status = quest.isComplete ? ' ✓ COMPLETE' : '';
        const nc = quest.isComplete ? '#44aa44' : '#ddaa44';
        this.questPanel.add(this.add.text(px + 12, y, `${quest.def.name}${status}`, {
          fontFamily: 'monospace', fontSize: '10px', color: nc, fontStyle: 'bold',
        }));
        y += 14;

        const desc = this.add.text(px + 16, y, quest.def.description, {
          fontFamily: 'monospace', fontSize: '8px', color: '#5c3a1e', wordWrap: { width: pw - 32 },
        });
        this.questPanel.add(desc);
        y += desc.height + 6;

        for (const obj of quest.objectives) {
          const ch = obj.current >= obj.targetCount ? '✓' : '○';
          const oc = obj.current >= obj.targetCount ? '#44aa44' : '#3d2410';
          this.questPanel.add(this.add.text(px + 20, y,
            `${ch} ${obj.description} (${obj.current}/${obj.targetCount})`,
            { fontFamily: 'monospace', fontSize: '8px', color: oc },
          ));
          y += 12;
        }

        this.questPanel.add(this.add.text(px + 20, y,
          `Rewards: ${quest.def.rewards.xp} XP, ${quest.def.rewards.gold} gold`,
          { fontFamily: 'monospace', fontSize: '8px', color: '#aa7722' },
        ));
        y += 18;
      }
    }

    this.questPanel.add(this.add.text(px + pw / 2, py + ph - 10, 'Press J to close', {
      fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
    }).setOrigin(0.5));
  }

  // ---- Notification toast ----
  showNotification(message: string, color: string = '#ddaa44'): void {
    const t = this.add.text(this.cameras.main.width / 2, 80, message, {
      fontFamily: 'monospace', fontSize: '10px', color, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(120);
    this.tweens.add({ targets: t, y: 50, alpha: 0, duration: 3000, ease: 'Power2', onComplete: () => t.destroy() });
  }

  // ---- Panel drawing helper ----
  private drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(C.panelBorder); g.fillRect(x, y, w, h);
    g.fillStyle(C.panelBg); g.fillRect(x + 2, y + 2, w - 4, h - 4);
    g.fillStyle(C.panelInner, 0.9); g.fillRect(x + 4, y + 4, w - 8, h - 8);
  }
}
