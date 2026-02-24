import Phaser from 'phaser';
import { getItem } from '../data/ItemDatabase';

/**
 * UIScene: Stardew Valley-inspired warm HUD overlay.
 *
 * Improvements:
 *   - Bigger fonts, better contrast for all pop-ups
 *   - Longer notification display time
 *   - World map overlay (M key)
 *   - Ability cooldown display in hotbar
 *   - Item tooltips on hover
 *   - Controls hint at bottom
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

  // World map overlay
  private mapPanel!: Phaser.GameObjects.Container;
  private mapOpen = false;
  private lastMinimapData: any = null;

  // Minimap
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private minimapMask!: Phaser.GameObjects.Graphics;
  private minimapQuestTexts: Phaser.GameObjects.Text[] = [];
  private readonly mmRadius = 55;
  private readonly mmX = 66;
  private mmCenterY = 0;

  // Ability display
  private abilityGfx!: Phaser.GameObjects.Graphics;
  private abilityTexts: Phaser.GameObjects.Text[] = [];

  private readonly barW = 150;
  private readonly barH = 14;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // --- HP/MP/XP panel (top-left) --- BIGGER AND MORE READABLE
    const panel = this.add.graphics().setDepth(99);
    this.drawPanel(panel, 6, 4, 180, 72);

    this.hpGfx = this.add.graphics().setDepth(100);
    this.mpGfx = this.add.graphics().setDepth(100);
    this.xpGfx = this.add.graphics().setDepth(100);

    this.hpText = this.add.text(14 + this.barW / 2, 18, '200/200', {
      fontFamily: 'monospace', fontSize: '11px', color: '#f0e4cc',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(101);

    this.mpText = this.add.text(14 + this.barW / 2, 38, '100/100', {
      fontFamily: 'monospace', fontSize: '11px', color: '#f0e4cc',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(101);

    this.levelText = this.add.text(14 + this.barW / 2, 56, 'Lv. 1', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(101);

    this.goldText = this.add.text(10, 80, 'Gold: 0', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 2,
    }).setDepth(100);

    // --- Bottom hotbar with equipment slots + ability display ---
    const hotbar = this.add.graphics().setDepth(99);
    const cx = this.cameras.main.width / 2;
    const hy = this.cameras.main.height - 52;
    const sw = 32, gap = 6;
    const tw = sw * 4 + gap * 3 + 20;
    this.drawPanel(hotbar, cx - tw / 2, hy - 6, tw, sw + 14);
    const labels = ['WPN', 'ABL', 'ARM', 'RNG'];
    for (let i = 0; i < 4; i++) {
      const sx = cx - tw / 2 + 6 + i * (sw + gap) + 4;
      hotbar.fillStyle(C.slotBg);
      hotbar.fillRect(sx, hy, sw, sw);
      hotbar.lineStyle(1, C.slotBorder);
      hotbar.strokeRect(sx, hy, sw, sw);
      this.add.text(sx + sw / 2, hy + sw / 2, labels[i], {
        fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
      }).setOrigin(0.5).setDepth(101);
    }

    // Ability cooldown display (below hotbar)
    this.abilityGfx = this.add.graphics().setDepth(100);

    // --- Quest tracker (top-right) --- BIGGER TEXT
    this.questGfx = this.add.graphics().setDepth(99);

    // --- Minimap (bottom-left) ---
    this.mmCenterY = this.cameras.main.height - this.mmRadius - 12;
    this.minimapGfx = this.add.graphics().setDepth(98);

    // Circular mask for minimap
    this.minimapMask = this.add.graphics();
    this.minimapMask.fillStyle(0xffffff);
    this.minimapMask.fillCircle(this.mmX, this.mmCenterY, this.mmRadius);
    const mask = this.minimapMask.createGeometryMask();
    this.minimapGfx.setMask(mask);

    this.add.text(this.mmX, this.mmCenterY - this.mmRadius - 6, 'N', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(100);

    const mmBorder = this.add.graphics().setDepth(100);
    mmBorder.lineStyle(3, C.panelBorder);
    mmBorder.strokeCircle(this.mmX, this.mmCenterY, this.mmRadius + 1);
    mmBorder.lineStyle(1, C.panelBg);
    mmBorder.strokeCircle(this.mmX, this.mmCenterY, this.mmRadius + 3);

    // --- Death overlay ---
    this.deathOverlay = this.add.graphics().setDepth(200).setVisible(false);
    this.deathText = this.add.text(
      this.cameras.main.width / 2, this.cameras.main.height / 2, '',
      { fontFamily: 'monospace', fontSize: '22px', color: '#cc3333', stroke: '#000', strokeThickness: 4, align: 'center' },
    ).setOrigin(0.5).setDepth(201).setVisible(false);

    // --- Toggle panels ---
    this.invPanel = this.add.container(0, 0).setDepth(150).setVisible(false);
    this.questPanel = this.add.container(0, 0).setDepth(150).setVisible(false);
    this.mapPanel = this.add.container(0, 0).setDepth(150).setVisible(false);

    // --- Controls hint (BIGGER, MORE READABLE) ---
    const hint = this.add.text(
      this.cameras.main.width / 2, this.cameras.main.height - 8,
      'WASD: Move | Click: Shoot | Space: Ability | I: Inventory | J: Quests | M: Map | R: Asgard',
      { fontFamily: 'monospace', fontSize: '9px', color: '#998877', stroke: '#000', strokeThickness: 1 },
    ).setOrigin(0.5).setDepth(100);
    this.time.delayedCall(10000, () => this.tweens.add({ targets: hint, alpha: 0, duration: 2000 }));

    // --- Keyboard ---
    this.input.keyboard!.on('keydown-I', () => {
      this.invOpen = !this.invOpen;
      if (this.invOpen) { this.questOpen = false; this.mapOpen = false; this.questPanel.setVisible(false); this.mapPanel.setVisible(false); this.rebuildInventory(); }
      this.invPanel.setVisible(this.invOpen);
    });
    this.input.keyboard!.on('keydown-J', () => {
      this.questOpen = !this.questOpen;
      if (this.questOpen) { this.invOpen = false; this.mapOpen = false; this.invPanel.setVisible(false); this.mapPanel.setVisible(false); this.rebuildQuestLog(); }
      this.questPanel.setVisible(this.questOpen);
    });
    this.input.keyboard!.on('keydown-M', () => {
      this.mapOpen = !this.mapOpen;
      if (this.mapOpen) { this.invOpen = false; this.questOpen = false; this.invPanel.setVisible(false); this.questPanel.setVisible(false); this.rebuildWorldMap(); }
      this.mapPanel.setVisible(this.mapOpen);
    });

    // --- Listen to game events ---
    const gs = this.scene.get('GameScene');
    gs.events.on('playerUpdate', this.onPlayerUpdate, this);
    gs.events.on('playerDeath', this.onDeath, this);
    gs.events.on('playerRespawn', this.onRespawn, this);
    gs.events.on('questUpdate', this.onQuestTrackerUpdate, this);
    gs.events.on('notification', this.showNotification, this);
    gs.events.on('minimapUpdate', this.onMinimapUpdate, this);

    const ds = this.scene.get('DungeonScene');
    if (ds) {
      ds.events.on('playerUpdate', this.onPlayerUpdate, this);
      ds.events.on('playerDeath', this.onDeath, this);
      ds.events.on('playerRespawn', this.onRespawn, this);
      ds.events.on('notification', this.showNotification, this);
      ds.events.on('minimapUpdate', this.onMinimapUpdate, this);
    }

    const ns = this.scene.get('NexusScene');
    if (ns) {
      ns.events.on('playerUpdate', this.onPlayerUpdate, this);
      ns.events.on('notification', this.showNotification, this);
      ns.events.on('minimapUpdate', this.onMinimapUpdate, this);
    }
  }

  // ---- Bars update ----
  private onPlayerUpdate(d: {
    hp: number; maxHp: number; mp: number; maxMp: number;
    level: number; xp: number; xpToNext: number; gold?: number;
    abilities?: { name: string; cooldownRemaining: number; cooldownTotal: number; mpCost: number; unlocked: boolean; color: string }[];
  }): void {
    const hpR = Math.max(0, d.hp / d.maxHp);
    this.hpGfx.clear();
    this.hpGfx.fillStyle(C.hpBg); this.hpGfx.fillRect(14, 10, this.barW, this.barH);
    this.hpGfx.fillStyle(C.hpRed); this.hpGfx.fillRect(14, 10, this.barW * hpR, this.barH);
    this.hpGfx.lineStyle(1, 0x000000, 0.3); this.hpGfx.strokeRect(14, 10, this.barW, this.barH);
    this.hpText.setText(`${Math.ceil(d.hp)}/${d.maxHp}`);

    const mpR = d.maxMp > 0 ? Math.max(0, d.mp / d.maxMp) : 0;
    this.mpGfx.clear();
    this.mpGfx.fillStyle(C.mpBg); this.mpGfx.fillRect(14, 30, this.barW, this.barH);
    this.mpGfx.fillStyle(C.mpBlue); this.mpGfx.fillRect(14, 30, this.barW * mpR, this.barH);
    this.mpGfx.lineStyle(1, 0x000000, 0.3); this.mpGfx.strokeRect(14, 30, this.barW, this.barH);
    this.mpText.setText(`${Math.ceil(d.mp)}/${d.maxMp}`);

    const xpR = d.xpToNext > 0 ? Math.max(0, d.xp / d.xpToNext) : 1;
    this.xpGfx.clear();
    this.xpGfx.fillStyle(0x555544); this.xpGfx.fillRect(14, 50, this.barW, 8);
    this.xpGfx.fillStyle(C.xpGold); this.xpGfx.fillRect(14, 50, this.barW * xpR, 8);
    this.xpGfx.lineStyle(1, 0x000000, 0.3); this.xpGfx.strokeRect(14, 50, this.barW, 8);
    this.levelText.setText(`Lv. ${d.level}`);

    if (d.gold !== undefined) this.goldText.setText(`Gold: ${d.gold}`);

    // Update ability cooldown display
    if (d.abilities) {
      this.updateAbilityDisplay(d.abilities);
    }
  }

  // ---- Ability cooldown display ----
  private updateAbilityDisplay(abilities: { name: string; cooldownRemaining: number; cooldownTotal: number; mpCost: number; unlocked: boolean; color: string }[]): void {
    this.abilityGfx.clear();
    this.abilityTexts.forEach(t => t.destroy());
    this.abilityTexts = [];

    const cx = this.cameras.main.width / 2;
    const abY = this.cameras.main.height - 80;
    const abW = 48, abGap = 6;
    const totalW = abW * 3 + abGap * 2;
    const startX = cx - totalW / 2;

    for (let i = 0; i < abilities.length; i++) {
      const ab = abilities[i];
      const ax = startX + i * (abW + abGap);

      // Background
      this.abilityGfx.fillStyle(0x222222, 0.6);
      this.abilityGfx.fillRect(ax, abY, abW, 18);

      if (ab.unlocked) {
        // Cooldown fill
        if (ab.cooldownRemaining > 0) {
          const cdRatio = ab.cooldownRemaining / ab.cooldownTotal;
          this.abilityGfx.fillStyle(0x444444, 0.5);
          this.abilityGfx.fillRect(ax, abY, abW * cdRatio, 18);
        } else {
          // Ready — show colored
          const tint = parseInt(ab.color.replace('#', ''), 16);
          this.abilityGfx.fillStyle(tint, 0.3);
          this.abilityGfx.fillRect(ax, abY, abW, 18);
        }

        this.abilityGfx.lineStyle(1, 0x888888, 0.5);
        this.abilityGfx.strokeRect(ax, abY, abW, 18);

        // Ability name (short)
        const shortName = ab.name.length > 6 ? ab.name.substring(0, 6) : ab.name;
        const isReady = ab.cooldownRemaining <= 0;
        const textColor = isReady ? ab.color : '#666666';

        const nameText = this.add.text(ax + abW / 2, abY + 5, shortName, {
          fontFamily: 'monospace', fontSize: '7px', color: textColor,
          stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(101);
        this.abilityTexts.push(nameText);

        // Cooldown number
        if (ab.cooldownRemaining > 0) {
          const cdText = this.add.text(ax + abW / 2, abY + 13, `${Math.ceil(ab.cooldownRemaining)}s`, {
            fontFamily: 'monospace', fontSize: '7px', color: '#cc8844',
          }).setOrigin(0.5).setDepth(101);
          this.abilityTexts.push(cdText);
        } else {
          const mpText = this.add.text(ax + abW / 2, abY + 13, `${ab.mpCost}mp`, {
            fontFamily: 'monospace', fontSize: '6px', color: '#5577aa',
          }).setOrigin(0.5).setDepth(101);
          this.abilityTexts.push(mpText);
        }
      } else {
        // Locked
        this.abilityGfx.lineStyle(1, 0x444444, 0.3);
        this.abilityGfx.strokeRect(ax, abY, abW, 18);
        const lockText = this.add.text(ax + abW / 2, abY + 9, '🔒', {
          fontFamily: 'monospace', fontSize: '8px', color: '#444444',
        }).setOrigin(0.5).setDepth(101);
        this.abilityTexts.push(lockText);
      }
    }

    // Space bar label
    const spaceText = this.add.text(cx, abY - 6, '[SPACE]', {
      fontFamily: 'monospace', fontSize: '7px', color: '#776655',
    }).setOrigin(0.5).setDepth(100);
    this.abilityTexts.push(spaceText);
  }

  // ---- Death ----
  private deathCountdown: Phaser.Time.TimerEvent | null = null;

  private onDeath(d: { level: number }): void {
    this.deathOverlay.clear();
    this.deathOverlay.fillStyle(0x110000, 0.7);
    this.deathOverlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    this.deathOverlay.setVisible(true);

    let countdown = 3;
    this.deathText.setText(`YOU DIED\n\nRespawning in ${countdown}...`).setVisible(true);

    if (this.deathCountdown) this.deathCountdown.destroy();
    this.deathCountdown = this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          this.deathText.setText(`YOU DIED\n\nRespawning in ${countdown}...`);
        } else {
          this.deathText.setText(`YOU DIED\n\nRespawning...`);
        }
      },
    });
  }

  private onRespawn(): void {
    this.deathOverlay.setVisible(false);
    this.deathText.setVisible(false);
    if (this.deathCountdown) {
      this.deathCountdown.destroy();
      this.deathCountdown = null;
    }
  }

  // ---- Quest tracker (top-right) ---- BIGGER TEXT
  private onQuestTrackerUpdate(quests: { name: string; objectives: { desc: string; current: number; target: number; done: boolean }[] }[]): void {
    this.questTexts.forEach(t => t.destroy());
    this.questTexts = [];
    this.questGfx.clear();
    if (quests.length === 0) return;

    const x = this.cameras.main.width - 195;
    let y = 6;
    let lines = 0;
    for (const q of quests) { lines += 1 + q.objectives.length; }
    this.drawPanel(this.questGfx, x - 4, 2, 195, lines * 15 + 16);

    for (const q of quests) {
      const nt = this.add.text(x + 2, y + 2, q.name, {
        fontFamily: 'monospace', fontSize: '11px', color: '#ddaa44', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 1,
      }).setDepth(101);
      this.questTexts.push(nt);
      y += 15;
      for (const o of q.objectives) {
        const ch = o.done ? '✓' : '○';
        const c = o.done ? '#44aa44' : '#3d2410';
        const ot = this.add.text(x + 8, y + 2, `${ch} ${o.desc} (${o.current}/${o.target})`, {
          fontFamily: 'monospace', fontSize: '10px', color: c,
        }).setDepth(101);
        this.questTexts.push(ot);
        y += 15;
      }
    }
  }

  // ---- Inventory panel ---- WITH TOOLTIPS & BETTER UX
  private rebuildInventory(): void {
    this.invPanel.removeAll(true);
    const pw = 300, ph = 260;
    const px = (this.cameras.main.width - pw) / 2;
    const py = (this.cameras.main.height - ph) / 2;

    const bg = this.add.graphics();
    this.drawPanel(bg, px, py, pw, ph);
    this.invPanel.add(bg);

    this.invPanel.add(this.add.text(px + pw / 2, py + 12, 'Inventory', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5));

    const gs = this.scene.get('GameScene') as any;
    const inv = gs?.inventoryManager;

    // Equipment row
    const eqY = py + 34;
    const eqLabels = ['Weapon', 'Ability', 'Armor', 'Ring'];
    const eqSlots = inv ? [inv.equipment.weapon, inv.equipment.ability, inv.equipment.armor, inv.equipment.ring] : [null, null, null, null];

    for (let i = 0; i < 4; i++) {
      const sx = px + 14 + i * 70;
      bg.fillStyle(C.slotBorder); bg.fillRect(sx, eqY, 58, 40);
      bg.fillStyle(C.slotBg); bg.fillRect(sx + 1, eqY + 1, 56, 38);

      this.invPanel.add(this.add.text(sx + 29, eqY - 4, eqLabels[i], {
        fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
      }).setOrigin(0.5));

      if (eqSlots[i]) {
        const item = getItem(eqSlots[i]);
        if (item) {
          const ig = this.add.graphics();
          ig.fillStyle(item.spriteColor); ig.fillRect(sx + 18, eqY + 6, 22, 22);
          ig.fillStyle(item.spriteAccent); ig.fillRect(sx + 22, eqY + 10, 14, 14);
          this.invPanel.add(ig);
          this.invPanel.add(this.add.text(sx + 29, eqY + 32, item.name.split(' ')[0].substring(0, 8), {
            fontFamily: 'monospace', fontSize: '7px', color: '#3d2410',
          }).setOrigin(0.5));
        }
      }
    }

    // Bag grid (4x2) with item names
    const bx = px + 14, by = eqY + 60;
    this.invPanel.add(this.add.text(bx, by - 4, 'Bag (walk over loot bags to pick up):', {
      fontFamily: 'monospace', fontSize: '10px', color: '#5c3a1e',
      stroke: '#000', strokeThickness: 1,
    }));

    const ss = 36, sg = 6;
    for (let i = 0; i < 8; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const sx = bx + col * (ss + sg), sy = by + 18 + row * (ss + sg + 14);
      bg.fillStyle(C.slotBorder); bg.fillRect(sx, sy, ss, ss);
      bg.fillStyle(C.slotBg); bg.fillRect(sx + 1, sy + 1, ss - 2, ss - 2);

      // Slot number
      this.invPanel.add(this.add.text(sx + 2, sy + 1, `${i + 1}`, {
        fontFamily: 'monospace', fontSize: '7px', color: '#8b6b3d',
      }));

      if (inv?.inventory[i]?.itemId) {
        const sd = inv.inventory[i];
        const item = getItem(sd.itemId);
        if (item) {
          const ig = this.add.graphics();
          ig.fillStyle(item.spriteColor); ig.fillRect(sx + 6, sy + 6, ss - 12, ss - 12);
          ig.fillStyle(item.spriteAccent); ig.fillRect(sx + 10, sy + 10, ss - 20, ss - 20);
          this.invPanel.add(ig);
          if (sd.quantity > 1) {
            this.invPanel.add(this.add.text(sx + ss - 3, sy + ss - 3, `${sd.quantity}`, {
              fontFamily: 'monospace', fontSize: '9px', color: '#f0e4cc', stroke: '#000', strokeThickness: 2,
            }).setOrigin(1, 1));
          }
          // Item name below slot
          this.invPanel.add(this.add.text(sx + ss / 2, sy + ss + 2, item.name.substring(0, 10), {
            fontFamily: 'monospace', fontSize: '7px', color: '#5c3a1e',
          }).setOrigin(0.5));
        }
      } else {
        // Empty slot hint
        this.invPanel.add(this.add.text(sx + ss / 2, sy + ss / 2, '—', {
          fontFamily: 'monospace', fontSize: '12px', color: '#b0a080',
        }).setOrigin(0.5));
      }
    }

    this.invPanel.add(this.add.text(px + pw / 2, py + ph - 14, 'Press I to close  |  Walk over loot bags to pick up items', {
      fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
    }).setOrigin(0.5));
  }

  // ---- Quest Log panel ---- BIGGER TEXT
  private rebuildQuestLog(): void {
    this.questPanel.removeAll(true);
    const pw = 360, ph = 300;
    const px = (this.cameras.main.width - pw) / 2;
    const py = (this.cameras.main.height - ph) / 2;

    const bg = this.add.graphics();
    this.drawPanel(bg, px, py, pw, ph);
    this.questPanel.add(bg);

    this.questPanel.add(this.add.text(px + pw / 2, py + 12, 'Quest Journal', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5));

    const gs = this.scene.get('GameScene') as any;
    const qm = gs?.questManager;
    let y = py + 34;

    if (!qm || qm.activeQuests.length === 0) {
      this.questPanel.add(this.add.text(px + pw / 2, y + 20,
        'No active quests.\nExplore Midgard to find quest givers!',
        { fontFamily: 'monospace', fontSize: '11px', color: '#8b6b3d', align: 'center' },
      ).setOrigin(0.5, 0));
    } else {
      for (const quest of qm.activeQuests) {
        const status = quest.isComplete ? ' ✓ COMPLETE' : '';
        const nc = quest.isComplete ? '#44aa44' : '#ddaa44';
        this.questPanel.add(this.add.text(px + 14, y, `${quest.def.name}${status}`, {
          fontFamily: 'monospace', fontSize: '12px', color: nc, fontStyle: 'bold',
        }));
        y += 16;

        const desc = this.add.text(px + 18, y, quest.def.description, {
          fontFamily: 'monospace', fontSize: '10px', color: '#5c3a1e', wordWrap: { width: pw - 36 },
        });
        this.questPanel.add(desc);
        y += desc.height + 8;

        for (const obj of quest.objectives) {
          const ch = obj.current >= obj.targetCount ? '✓' : '○';
          const oc = obj.current >= obj.targetCount ? '#44aa44' : '#3d2410';
          this.questPanel.add(this.add.text(px + 22, y,
            `${ch} ${obj.description} (${obj.current}/${obj.targetCount})`,
            { fontFamily: 'monospace', fontSize: '10px', color: oc },
          ));
          y += 14;
        }

        this.questPanel.add(this.add.text(px + 22, y,
          `Rewards: ${quest.def.rewards.xp} XP, ${quest.def.rewards.gold} gold`,
          { fontFamily: 'monospace', fontSize: '10px', color: '#aa7722' },
        ));
        y += 20;
      }
    }

    this.questPanel.add(this.add.text(px + pw / 2, py + ph - 12, 'Press J to close', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8b6b3d',
    }).setOrigin(0.5));
  }

  // ---- World Map overlay (M key) ----
  private rebuildWorldMap(): void {
    this.mapPanel.removeAll(true);
    const pw = 500, ph = 440;
    const px = (this.cameras.main.width - pw) / 2;
    const py = (this.cameras.main.height - ph) / 2;

    const bg = this.add.graphics();
    this.drawPanel(bg, px, py, pw, ph);
    this.mapPanel.add(bg);

    this.mapPanel.add(this.add.text(px + pw / 2, py + 14, 'World Map — Midgard', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5));

    // Draw the world map as concentric biome rings
    const mapCX = px + pw / 2;
    const mapCY = py + ph / 2 + 10;
    const mapR = 170;

    const mapGfx = this.add.graphics();

    // Biome rings (outermost to innermost)
    const biomes = [
      { maxR: 1.0, color: 0x8aabbf, name: 'Frozen Shores', textR: 0.87 },
      { maxR: 0.75, color: 0x5a7a4a, name: 'Birch Forest', textR: 0.57 },
      { maxR: 0.40, color: 0x6b3a2e, name: 'Volcanic Wastes', textR: 0.28 },
      { maxR: 0.15, color: 0x2a1a3e, name: 'Niflheim Depths', textR: 0.07 },
    ];

    for (const biome of biomes) {
      mapGfx.fillStyle(biome.color, 0.8);
      mapGfx.fillCircle(mapCX, mapCY, biome.maxR * mapR);
    }

    // Biome ring borders
    for (const biome of biomes) {
      mapGfx.lineStyle(1, 0x000000, 0.3);
      mapGfx.strokeCircle(mapCX, mapCY, biome.maxR * mapR);
    }

    this.mapPanel.add(mapGfx);

    // Biome labels
    for (const biome of biomes) {
      const labelR = biome.textR * mapR;
      this.mapPanel.add(this.add.text(mapCX, mapCY - labelR, biome.name, {
        fontFamily: 'monospace', fontSize: '9px', color: '#f0e4cc',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5));
    }

    // Player position (if we have data)
    if (this.lastMinimapData) {
      const d = this.lastMinimapData;
      const worldCenter = d.worldSize / 2;
      const normalizedX = (d.playerX - worldCenter) / worldCenter;
      const normalizedY = (d.playerY - worldCenter) / worldCenter;

      const playerMapX = mapCX + normalizedX * mapR;
      const playerMapY = mapCY + normalizedY * mapR;

      // Player dot
      mapGfx.fillStyle(0xffffff, 1);
      mapGfx.fillCircle(playerMapX, playerMapY, 5);
      mapGfx.lineStyle(2, 0x000000, 0.8);
      mapGfx.strokeCircle(playerMapX, playerMapY, 5);

      this.mapPanel.add(this.add.text(playerMapX + 8, playerMapY - 4, 'YOU', {
        fontFamily: 'monospace', fontSize: '8px', color: '#ffffff',
        stroke: '#000', strokeThickness: 3,
      }));

      // Enemy dots on map
      for (const e of d.enemies) {
        const enx = (e.x - worldCenter) / worldCenter;
        const eny = (e.y - worldCenter) / worldCenter;
        const emx = mapCX + enx * mapR;
        const emy = mapCY + eny * mapR;
        const eDist = Math.sqrt((emx - mapCX) ** 2 + (emy - mapCY) ** 2);
        if (eDist < mapR) {
          mapGfx.fillStyle(0xcc3333, 0.5);
          mapGfx.fillCircle(emx, emy, 1);
        }
      }

      // Portals
      if (d.portals) {
        for (const p of d.portals) {
          const pnx = (p.x - worldCenter) / worldCenter;
          const pny = (p.y - worldCenter) / worldCenter;
          const pmx = mapCX + pnx * mapR;
          const pmy = mapCY + pny * mapR;
          mapGfx.fillStyle(0xcc88ff, 0.8);
          mapGfx.fillCircle(pmx, pmy, 4);
        }
      }
    }

    // Compass directions
    const dirs = [
      { label: 'N', x: mapCX, y: mapCY - mapR - 14 },
      { label: 'S', x: mapCX, y: mapCY + mapR + 4 },
      { label: 'E', x: mapCX + mapR + 6, y: mapCY - 5 },
      { label: 'W', x: mapCX - mapR - 12, y: mapCY - 5 },
    ];
    for (const dir of dirs) {
      this.mapPanel.add(this.add.text(dir.x, dir.y, dir.label, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ddaa44',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));
    }

    // Asgard marker
    this.mapPanel.add(this.add.text(mapCX + mapR + 14, mapCY - mapR + 10, 'Asgard\n  (R)', {
      fontFamily: 'monospace', fontSize: '8px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 2,
    }));

    // Legend
    const ly = py + ph - 60;
    const legendItems = [
      { color: 0xffffff, label: '● You' },
      { color: 0xcc3333, label: '● Enemies' },
      { color: 0xcc88ff, label: '● Portals' },
    ];
    for (let i = 0; i < legendItems.length; i++) {
      const li = legendItems[i];
      const dot = this.add.graphics();
      dot.fillStyle(li.color, 1);
      dot.fillCircle(px + 20, ly + i * 14, 3);
      this.mapPanel.add(dot);
      this.mapPanel.add(this.add.text(px + 30, ly + i * 14 - 5, li.label, {
        fontFamily: 'monospace', fontSize: '9px', color: '#5c3a1e',
      }));
    }

    this.mapPanel.add(this.add.text(px + pw / 2, py + ph - 12, 'Press M to close', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8b6b3d',
    }).setOrigin(0.5));
  }

  // ---- Minimap ----
  private onMinimapUpdate(d: {
    playerX: number; playerY: number;
    playerVelX: number; playerVelY: number;
    worldSize: number;
    enemies: { x: number; y: number }[];
    questWaypoints: { x: number; y: number; index: number }[];
    portals?: { x: number; y: number }[];
  }): void {
    // Store for world map
    this.lastMinimapData = d;

    const g = this.minimapGfx;
    const cx = this.mmX;
    const cy = this.mmCenterY as number;
    const r = this.mmRadius;
    g.clear();

    const viewRadius = 900;
    const scale = r / viewRadius;

    // Biome rings
    const worldCenter = d.worldSize / 2;
    const wcMmX = (worldCenter - d.playerX) * scale;
    const wcMmY = (worldCenter - d.playerY) * scale;

    const worldRadius = d.worldSize / 2;
    const biomeRings = [
      { maxDist: 1.0, color: 0x8aabbf },
      { maxDist: 0.75, color: 0x5a7a4a },
      { maxDist: 0.40, color: 0x6b3a2e },
      { maxDist: 0.15, color: 0x2a1a3e },
    ];
    for (const ring of biomeRings) {
      const ringR = ring.maxDist * worldRadius * scale;
      g.fillStyle(ring.color, 0.7);
      g.fillCircle(cx + wcMmX, cy + wcMmY, ringR);
    }

    // Enemy dots
    for (const e of d.enemies) {
      const ex = (e.x - d.playerX) * scale;
      const ey = (e.y - d.playerY) * scale;
      const distFromCenter = Math.sqrt(ex * ex + ey * ey);
      if (distFromCenter < r - 2) {
        g.fillStyle(0xcc3333, 0.9);
        g.fillCircle(cx + ex, cy + ey, 1.5);
      }
    }

    // Portal dots
    if (d.portals) {
      for (const p of d.portals) {
        const px = (p.x - d.playerX) * scale;
        const py = (p.y - d.playerY) * scale;
        const distFromCenter = Math.sqrt(px * px + py * py);
        if (distFromCenter < r - 2) {
          const pulse = Math.sin(Date.now() * 0.006) * 0.3 + 0.7;
          g.fillStyle(0xcc88ff, pulse);
          g.fillCircle(cx + px, cy + py, 3);
          g.lineStyle(1, 0x6622aa, pulse);
          g.strokeCircle(cx + px, cy + py, 3);
        }
      }
    }

    // Player direction arrow
    const velLen = Math.sqrt(d.playerVelX ** 2 + d.playerVelY ** 2);
    if (velLen > 10) {
      const angle = Math.atan2(d.playerVelY, d.playerVelX);
      const arrowLen = 10;
      const tipX = cx + Math.cos(angle) * arrowLen;
      const tipY = cy + Math.sin(angle) * arrowLen;

      g.lineStyle(2, 0xffffff, 1);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(tipX, tipY);
      g.strokePath();

      const headLen = 4;
      const headAngle = 0.5;
      g.beginPath();
      g.moveTo(tipX, tipY);
      g.lineTo(tipX - Math.cos(angle - headAngle) * headLen, tipY - Math.sin(angle - headAngle) * headLen);
      g.moveTo(tipX, tipY);
      g.lineTo(tipX - Math.cos(angle + headAngle) * headLen, tipY - Math.sin(angle + headAngle) * headLen);
      g.strokePath();
    }

    // Player dot
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy, 3);
    g.lineStyle(1, 0x000000, 0.5);
    g.strokeCircle(cx, cy, 3);

    // Quest waypoint markers
    this.minimapQuestTexts.forEach(t => t.destroy());
    this.minimapQuestTexts = [];

    if (d.questWaypoints) {
      for (const wp of d.questWaypoints) {
        const dx = wp.x - d.playerX;
        const dy = wp.y - d.playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) continue;

        const angle = Math.atan2(dy, dx);
        const mmDist = dist * scale;

        let markerX: number, markerY: number;
        if (mmDist > r - 8) {
          markerX = cx + Math.cos(angle) * (r - 6);
          markerY = cy + Math.sin(angle) * (r - 6);
        } else {
          markerX = cx + dx * scale;
          markerY = cy + dy * scale;
        }

        g.fillStyle(0xddaa44, 1);
        g.fillCircle(markerX, markerY, 5);
        g.lineStyle(1, 0x3d2410, 1);
        g.strokeCircle(markerX, markerY, 5);

        const numText = this.add.text(markerX, markerY, `${wp.index}`, {
          fontFamily: 'monospace', fontSize: '8px', color: '#3d2410',
        }).setOrigin(0.5).setDepth(102);
        this.minimapQuestTexts.push(numText);
      }
    }
  }

  // ---- Notification toast ---- BIGGER, LONGER DISPLAY
  showNotification(message: string, color: string = '#ddaa44'): void {
    const t = this.add.text(this.cameras.main.width / 2, 80, message, {
      fontFamily: 'monospace', fontSize: '13px', color,
      stroke: '#000', strokeThickness: 3,
      backgroundColor: '#00000066',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    }).setOrigin(0.5).setDepth(120);
    this.tweens.add({
      targets: t,
      y: 40,
      alpha: 0,
      duration: 4000, // Longer display (was 3000)
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  // ---- Panel drawing helper ----
  private drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(C.panelBorder); g.fillRect(x, y, w, h);
    g.fillStyle(C.panelBg); g.fillRect(x + 2, y + 2, w - 4, h - 4);
    g.fillStyle(C.panelInner, 0.9); g.fillRect(x + 4, y + 4, w - 8, h - 8);
  }
}
