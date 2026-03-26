import Phaser from 'phaser';
import { InputManager } from '../systems/InputManager';

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
 *   - Virtual joystick + fire button for mobile
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
  // goldText removed — gold system removed

  private deathOverlay!: Phaser.GameObjects.Graphics;
  private deathText!: Phaser.GameObjects.Text;

  private questTexts: Phaser.GameObjects.Text[] = [];
  private questGfx!: Phaser.GameObjects.Graphics;

  private questPanel!: Phaser.GameObjects.Container;
  private questOpen = false;

  // World map overlay
  private mapPanel!: Phaser.GameObjects.Container;
  private mapOpen = false;
  private lastMinimapData: any = null;

  // Minimap — position varies: bottom-left on desktop, top-right on mobile (avoids joystick overlap)
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private minimapMask!: Phaser.GameObjects.Graphics;
  private minimapQuestTexts: Phaser.GameObjects.Text[] = [];
  private readonly mmRadius = 55;
  private mmX = 66;  // overridden on mobile
  private mmCenterY = 0;

  // Ability display
  private abilityGfx!: Phaser.GameObjects.Graphics;
  private abilityTexts: Phaser.GameObjects.Text[] = [];

  private readonly barW = 150;
  private readonly barH = 14;

  // Mobile touch controls — modern Brawl Stars / Archero inspired
  private joystickGfx!: Phaser.GameObjects.Graphics;
  private joystickThumbGfx!: Phaser.GameObjects.Graphics;
  private fireButtonGfx!: Phaser.GameObjects.Graphics;
  private abilityButtonGfx!: Phaser.GameObjects.Graphics;
  private joystickPointerId: number = -1;
  private firePointerId: number = -1;
  private readonly joyX = 120;      // joystick center X — moved right to avoid edge
  private readonly joyY = 0;       // set in create()
  private readonly joyRadius = 65;  // outer ring radius — BIGGER
  private readonly joyThumbR = 26;  // thumb radius — BIGGER
  private readonly fireRadius = 42; // fire button — BIGGER
  private readonly abilityBtnRadius = 36; // ability button — BIGGER

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
      fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(101);

    this.mpText = this.add.text(14 + this.barW / 2, 38, '100/100', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(101);

    this.levelText = this.add.text(14 + this.barW / 2, 56, 'Lv. 1', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffdd44', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(101);

    // Gold display removed — gold system gone
    // Equipment hotbar removed — no inventory system

    // Ability cooldown display (bottom-center)
    this.abilityGfx = this.add.graphics().setDepth(100);

    // --- Quest tracker (top-right) --- BIGGER TEXT
    this.questGfx = this.add.graphics().setDepth(99);

    // --- Minimap --- On mobile: smaller, top-right to avoid joystick overlap
    if (InputManager.isMobile) {
      this.mmX = this.cameras.main.width - 50;
      this.mmCenterY = 110; // below the quest panel
    } else {
      this.mmCenterY = this.cameras.main.height - this.mmRadius - 12;
    }
    this.minimapGfx = this.add.graphics().setDepth(98);

    // Circular mask for minimap
    this.minimapMask = this.add.graphics();
    this.minimapMask.fillStyle(0xffffff);
    this.minimapMask.fillCircle(this.mmX, this.mmCenterY, InputManager.isMobile ? 35 : this.mmRadius);
    const mask = this.minimapMask.createGeometryMask();
    this.minimapGfx.setMask(mask);

    this.add.text(this.mmX, this.mmCenterY - (InputManager.isMobile ? 35 : this.mmRadius) - 6, 'N', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ddaa44',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(100);

    const effectiveR = InputManager.isMobile ? 35 : this.mmRadius;
    const mmBorder = this.add.graphics().setDepth(100);
    mmBorder.lineStyle(3, C.panelBorder);
    mmBorder.strokeCircle(this.mmX, this.mmCenterY, effectiveR + 1);
    mmBorder.lineStyle(1, C.panelBg);
    mmBorder.strokeCircle(this.mmX, this.mmCenterY, effectiveR + 3);

    // --- Death overlay ---
    this.deathOverlay = this.add.graphics().setDepth(200).setVisible(false);
    this.deathText = this.add.text(
      this.cameras.main.width / 2, this.cameras.main.height / 2, '',
      { fontFamily: 'monospace', fontSize: '22px', color: '#cc3333', stroke: '#000', strokeThickness: 4, align: 'center' },
    ).setOrigin(0.5).setDepth(201).setVisible(false);

    // --- Toggle panels ---
    this.questPanel = this.add.container(0, 0).setDepth(150).setVisible(false);
    this.mapPanel = this.add.container(0, 0).setDepth(150).setVisible(false);

    // --- Controls hint (always visible at bottom, hidden on mobile) ---
    const controlsHint = this.add.text(
      this.cameras.main.width / 2, this.cameras.main.height - 8,
      'WASD: Move  |  Click: Shoot  |  Space: Ability  |  P: Portal  |  M: Map',
      { fontFamily: 'monospace', fontSize: '9px', color: '#000000', fontStyle: 'bold',
        stroke: '#ffffff', strokeThickness: 2, backgroundColor: '#ffffffaa',
        padding: { left: 4, right: 4, top: 1, bottom: 1 } },
    ).setOrigin(0.5).setDepth(100);

    // --- Mobile touch controls ---
    if (InputManager.isMobile) {
      controlsHint.setVisible(false);
      this.setupMobileControls();
    }

    // --- Keyboard ---
    this.input.keyboard?.on('keydown-M', () => {
      this.mapOpen = !this.mapOpen;
      if (this.mapOpen) { this.rebuildWorldMap(); }
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

    // DungeonScene's event emitter is wiped on each scene.start() restart.
    // Use game.events as a persistent bus: DungeonScene emits 'dungeonSceneReady'
    // at the end of create(), triggering us to re-wire listeners each run.
    const wireDungeonScene = () => {
      const ds = this.scene.get('DungeonScene');
      if (!ds) return;
      // Remove stale listeners before re-adding to avoid duplicates
      ds.events.off('playerUpdate', this.onPlayerUpdate, this);
      ds.events.off('playerDeath', this.onDeath, this);
      ds.events.off('playerRespawn', this.onRespawn, this);
      ds.events.off('notification', this.showNotification, this);
      ds.events.off('minimapUpdate', this.onMinimapUpdate, this);
      ds.events.on('playerUpdate', this.onPlayerUpdate, this);
      ds.events.on('playerDeath', this.onDeath, this);
      ds.events.on('playerRespawn', this.onRespawn, this);
      ds.events.on('notification', this.showNotification, this);
      ds.events.on('minimapUpdate', this.onMinimapUpdate, this);
    };
    wireDungeonScene(); // wire now if DungeonScene already exists in registry
    this.game.events.on('dungeonSceneReady', wireDungeonScene, this);

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

    const xpR = d.xpToNext > 0 ? Math.min(1, Math.max(0, d.xp / d.xpToNext)) : 1;
    this.xpGfx.clear();
    this.xpGfx.fillStyle(0x555544); this.xpGfx.fillRect(14, 50, this.barW, 8);
    this.xpGfx.fillStyle(C.xpGold); this.xpGfx.fillRect(14, 50, this.barW * xpR, 8);
    this.xpGfx.lineStyle(1, 0x000000, 0.3); this.xpGfx.strokeRect(14, 50, this.barW, 8);
    this.levelText.setText(`Lv. ${d.level}`);

    // gold display removed

    // Update ability cooldown display
    if (d.abilities) {
      this.updateAbilityDisplay(d.abilities);
    }
  }

  // ---- Ability cooldown display (single ability slot) ----
  private updateAbilityDisplay(abilities: { name: string; cooldownRemaining: number; cooldownTotal: number; mpCost: number; unlocked: boolean; color: string }[]): void {
    this.abilityGfx.clear();
    this.abilityTexts.forEach(t => t.destroy());
    this.abilityTexts = [];

    if (!abilities.length) return;
    const ab = abilities[0]; // single ability only
    const cx = this.cameras.main.width / 2;
    const abW = 110, abH = 28;
    const abY = this.cameras.main.height - 50;
    const ax = cx - abW / 2;
    const tint = parseInt(ab.color.replace('#', ''), 16);
    const isReady = ab.cooldownRemaining <= 0;

    // Background
    this.abilityGfx.fillStyle(0x111111, 0.88);
    this.abilityGfx.fillRect(ax, abY, abW, abH);

    if (ab.cooldownRemaining > 0) {
      // Cooldown: dark bg + grey sweep showing time remaining
      const cdRatio = ab.cooldownRemaining / ab.cooldownTotal;
      this.abilityGfx.fillStyle(0x222222, 0.9);
      this.abilityGfx.fillRect(ax, abY, abW, abH);
      this.abilityGfx.fillStyle(0x444444, 0.6);
      this.abilityGfx.fillRect(ax, abY, abW * cdRatio, abH);
      this.abilityGfx.lineStyle(1, 0x444444, 1.0);
      this.abilityGfx.strokeRect(ax, abY, abW, abH);
    } else {
      // Ready — class-colored fill + bright border
      this.abilityGfx.fillStyle(tint, 0.25);
      this.abilityGfx.fillRect(ax, abY, abW, abH);
      this.abilityGfx.lineStyle(2, tint, 1.0);
      this.abilityGfx.strokeRect(ax, abY, abW, abH);
    }

    // Ability name
    this.abilityTexts.push(this.add.text(cx, abY + 8, ab.name, {
      fontFamily: 'monospace', fontSize: '9px', fontStyle: 'bold',
      color: isReady ? ab.color : '#888888',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(101));

    // Cooldown number or READY + mp cost
    const subLabel = ab.cooldownRemaining > 0
      ? `${Math.ceil(ab.cooldownRemaining)}s`
      : `READY  ${ab.mpCost}mp`;
    this.abilityTexts.push(this.add.text(cx, abY + 20, subLabel, {
      fontFamily: 'monospace', fontSize: '8px', fontStyle: 'bold',
      color: isReady ? '#aaddff' : '#ffcc44',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(101));

    // SPACE label above
    this.abilityTexts.push(this.add.text(cx, abY - 9, '[SPACE] Ability', {
      fontFamily: 'monospace', fontSize: '8px', color: '#998866', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(100));
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

  // ---- Objective / Quest tracker (top-right) ----
  private onQuestTrackerUpdate(quests: { name: string; objectives: { desc: string; current: number; target: number; done: boolean }[] }[]): void {
    this.questTexts.forEach(t => t.destroy());
    this.questTexts = [];
    this.questGfx.clear();
    if (quests.length === 0) return;

    const x = this.cameras.main.width - 210;
    let y = 6;
    let lines = 0;
    for (const q of quests) { lines += 1 + q.objectives.length; }
    this.drawPanel(this.questGfx, x - 6, 2, 210, lines * 17 + 16);

    for (const q of quests) {
      // Panel header (e.g. "Objectives")
      const nt = this.add.text(x + 2, y + 2, q.name.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '10px', color: '#ddaa44', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setDepth(101);
      this.questTexts.push(nt);
      y += 17;
      for (const o of q.objectives) {
        const ch = o.done ? '✓' : '▶';
        // Show progress bar style for non-done with numeric goals
        const showBar = !o.done && o.target > 1;
        const progText = showBar ? ` (${o.current}/${o.target})` : '';
        const c = o.done ? '#22aa22' : '#000000';
        const ot = this.add.text(x + 6, y + 2, `${ch} ${o.desc}${progText}`, {
          fontFamily: 'monospace', fontSize: '10px', color: c, fontStyle: 'bold',
          stroke: '#ffffff', strokeThickness: 3,
          wordWrap: { width: 190 },
        }).setDepth(101);
        this.questTexts.push(ot);
        y += Math.max(17, ot.height + 4);
      }
    }
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
    isDungeon?: boolean;
    dungeonRooms?: { x: number; y: number; w: number; h: number; type: string; cleared: boolean }[];
  }): void {
    // Store for world map
    this.lastMinimapData = d;

    const g = this.minimapGfx;
    const cx = this.mmX;
    const cy = this.mmCenterY as number;
    const r = this.mmRadius;
    g.clear();

    if (d.isDungeon && d.dungeonRooms && d.dungeonRooms.length > 0) {
      // ---- DUNGEON minimap: player-centered, map scrolls around player ----
      // Use a fixed zoom so rooms are large enough to see, centered on the player
      let minRX = Infinity, minRY = Infinity, maxRX = 0, maxRY = 0;
      for (const room of d.dungeonRooms) {
        minRX = Math.min(minRX, room.x);
        minRY = Math.min(minRY, room.y);
        maxRX = Math.max(maxRX, room.x + room.w);
        maxRY = Math.max(maxRY, room.y + room.h);
      }
      const dungeonW = maxRX - minRX;
      const dungeonH = maxRY - minRY;
      // Zoom: show ~600px of dungeon space in the minimap radius (player-local view)
      const viewRange = 600;
      const dungeonScale = (r * 1.8) / viewRange;

      // Dark background
      g.fillStyle(0x111111, 0.85);
      g.fillCircle(cx, cy, r);

      // Offset: player is always at minimap center
      const offsetX = d.playerX;
      const offsetY = d.playerY;

      for (const room of d.dungeonRooms) {
        const rx = cx + (room.x - offsetX) * dungeonScale;
        const ry = cy + (room.y - offsetY) * dungeonScale;
        const rw = room.w * dungeonScale;
        const rh = room.h * dungeonScale;

        // Skip rooms entirely outside the minimap circle (optimization)
        if (rx + rw < cx - r - 10 || rx > cx + r + 10 || ry + rh < cy - r - 10 || ry > cy + r + 10) continue;

        // Room fill based on type and cleared state
        const roomColor = room.type === 'boss' ? 0xcc3333
          : room.type === 'start' ? 0x44aa44
          : room.cleared ? 0x446688 : 0x335566;
        g.fillStyle(roomColor, room.cleared ? 0.9 : 0.5);
        g.fillRect(rx, ry, rw, rh);

        // Border
        g.lineStyle(1, room.cleared ? 0x88ccff : 0x445566, 0.8);
        g.strokeRect(rx, ry, rw, rh);

        // Boss room X marker
        if (room.type === 'boss') {
          g.lineStyle(1, 0xff8888, 0.9);
          g.beginPath();
          g.moveTo(rx + 2, ry + 2); g.lineTo(rx + rw - 2, ry + rh - 2);
          g.moveTo(rx + rw - 2, ry + 2); g.lineTo(rx + 2, ry + rh - 2);
          g.strokePath();
        }
      }

      // Draw corridors as thin lines between adjacent room centers
      for (let i = 0; i < d.dungeonRooms.length - 1; i++) {
        const a = d.dungeonRooms[i];
        const b = d.dungeonRooms[i + 1];
        const ax = cx + (a.x + a.w / 2 - offsetX) * dungeonScale;
        const ay = cy + (a.y + a.h / 2 - offsetY) * dungeonScale;
        const bx = cx + (b.x + b.w / 2 - offsetX) * dungeonScale;
        const by_ = cy + (b.y + b.h / 2 - offsetY) * dungeonScale;
        g.lineStyle(2, 0x334455, 0.7);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by_); g.strokePath();
      }

      // Player dot — always at center
      g.fillStyle(0xffffff, 1);
      g.fillCircle(cx, cy, 3);
      g.lineStyle(1, 0x000000, 0.8);
      g.strokeCircle(cx, cy, 3);

      // Enemy dots (relative to player)
      for (const e of d.enemies) {
        const ex = cx + (e.x - offsetX) * dungeonScale;
        const ey = cy + (e.y - offsetY) * dungeonScale;
        // Skip enemies outside minimap circle
        const dist2 = (ex - cx) * (ex - cx) + (ey - cy) * (ey - cy);
        if (dist2 > r * r) continue;
        g.fillStyle(0xff4444, 0.9);
        g.fillCircle(ex, ey, 2);
      }

    } else {
      // ---- OVERWORLD minimap ----
      // Two scales: world scale for biome rings, local scale for enemy/portal dots
      const worldRadius = d.worldSize / 2;
      const worldScale = r / worldRadius;   // maps full world into minimap circle
      const localScale = r / 900;           // local view: 900px radius around player

      const worldCenter = d.worldSize / 2;
      const wcMmX = (worldCenter - d.playerX) * worldScale;
      const wcMmY = (worldCenter - d.playerY) * worldScale;

      // Biome rings drawn at correct world scale (matches getBiomeForDistance thresholds)
      const biomeRings = [
        { maxDist: 1.0, color: 0x8aabbf },  // Frozen Shores (outer)
        { maxDist: 0.75, color: 0x5a7a4a }, // Birch Forest
        { maxDist: 0.40, color: 0x6b3a2e }, // Volcanic Wastes
        { maxDist: 0.15, color: 0x2a1a3e }, // Niflheim Depths (center)
      ];
      for (const ring of biomeRings) {
        const ringR = ring.maxDist * worldRadius * worldScale;
        g.fillStyle(ring.color, 0.7);
        g.fillCircle(cx + wcMmX, cy + wcMmY, ringR);
      }

      // Enemy dots — use local scale so nearby enemies are visible
      for (const e of d.enemies) {
        const ex = (e.x - d.playerX) * localScale;
        const ey = (e.y - d.playerY) * localScale;
        const distFromCenter = Math.sqrt(ex * ex + ey * ey);
        if (distFromCenter < r - 2) {
          g.fillStyle(0xcc3333, 0.9);
          g.fillCircle(cx + ex, cy + ey, 1.5);
        }
      }

      // Portal dots — use local scale so nearby portals are visible
      if (d.portals) {
        for (const p of d.portals) {
          const px = (p.x - d.playerX) * localScale;
          const py = (p.y - d.playerY) * localScale;
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
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(tipX, tipY); g.strokePath();
        const headLen = 4, headAngle = 0.5;
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
    }

    // Quest waypoint markers (overworld only — no quests in dungeon)
    this.minimapQuestTexts.forEach(t => t.destroy());
    this.minimapQuestTexts = [];

    if (!d.isDungeon && d.questWaypoints) {
      const wpScale = r / 900;
      for (const wp of d.questWaypoints) {
        const dx = wp.x - d.playerX;
        const dy = wp.y - d.playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) continue;

        const angle = Math.atan2(dy, dx);
        const mmDist = dist * wpScale;

        let markerX: number, markerY: number;
        if (mmDist > r - 8) {
          markerX = cx + Math.cos(angle) * (r - 6);
          markerY = cy + Math.sin(angle) * (r - 6);
        } else {
          markerX = cx + dx * wpScale;
          markerY = cy + dy * wpScale;
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

  // ---- Notification toast ----
  showNotification(message: string, color: string = '#ddaa44'): void {
    const t = this.add.text(this.cameras.main.width / 2, 80, message, {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#000000aa',
      padding: { left: 10, right: 10, top: 5, bottom: 5 },
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

  // ---- Mobile touch controls — modern clean design ----
  private setupMobileControls(): void {
    const h = this.cameras.main.height;
    const w = this.cameras.main.width;
    const joyY = h - 110; // moved up slightly for bigger joystick
    // Store joyY for use in handlers (readonly joyY can't be set in create)
    (this as any)._joyY = joyY;

    // Enable multi-touch
    this.input.addPointer(2); // allow up to 3 pointers total

    // --- Virtual Joystick (bottom-left) ---
    this.joystickGfx = this.add.graphics().setDepth(200);
    this.joystickThumbGfx = this.add.graphics().setDepth(201);
    this.drawJoystickBase(this.joyX, joyY);
    this.drawJoystickThumb(this.joyX, joyY);

    // --- Fire button (bottom-right) ---
    const fireX = w - 80;
    const fireY = h - 100;
    (this as any)._fireX = fireX;
    (this as any)._fireY = fireY;

    this.fireButtonGfx = this.add.graphics().setDepth(200);
    this.drawFireButton(fireX, fireY, false);

    // --- Ability button (left of fire button) ---
    const abX = w - 165;
    const abY = h - 100;
    (this as any)._abX = abX;
    (this as any)._abY = abY;

    this.abilityButtonGfx = this.add.graphics().setDepth(200);
    this.drawAbilityButton(abX, abY, false);

    // --- Touch handlers via Phaser pointer events ---
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const px = pointer.x;
      const py = pointer.y;

      // Check joystick zone (left half of screen, lower area)
      if (px < w / 2 && py > h / 2 && this.joystickPointerId === -1) {
        this.joystickPointerId = pointer.id;
        this.updateJoystick(pointer);
        return;
      }

      // Check fire button
      const fdx = px - fireX;
      const fdy = py - fireY;
      if (fdx * fdx + fdy * fdy < (this.fireRadius + 15) ** 2) {
        this.firePointerId = pointer.id;
        InputManager.virtualShoot = true;
        this.drawFireButton(fireX, fireY, true);
        return;
      }

      // Check ability button
      const adx = px - abX;
      const ady = py - abY;
      if (adx * adx + ady * ady < (this.abilityBtnRadius + 15) ** 2) {
        InputManager.virtualAbility = true;
        this.drawAbilityButton(abX, abY, true);
        this.time.delayedCall(150, () => this.drawAbilityButton(abX, abY, false));
        return;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.joystickPointerId) {
        this.updateJoystick(pointer);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.joystickPointerId) {
        this.joystickPointerId = -1;
        InputManager.virtualJoystick.x = 0;
        InputManager.virtualJoystick.y = 0;
        this.drawJoystickThumb(this.joyX, joyY);
      }
      if (pointer.id === this.firePointerId) {
        this.firePointerId = -1;
        InputManager.virtualShoot = false;
        this.drawFireButton(fireX, fireY, false);
      }
    });
  }

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const joyY = (this as any)._joyY as number;
    const dx = pointer.x - this.joyX;
    const dy = pointer.y - joyY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = this.joyRadius;

    let normX = dx;
    let normY = dy;

    if (dist > maxDist) {
      normX = (dx / dist) * maxDist;
      normY = (dy / dist) * maxDist;
    }

    // Set virtual joystick (-1 to 1)
    InputManager.virtualJoystick.x = normX / maxDist;
    InputManager.virtualJoystick.y = normY / maxDist;

    // Apply a small deadzone
    if (dist < 8) {
      InputManager.virtualJoystick.x = 0;
      InputManager.virtualJoystick.y = 0;
      this.drawJoystickThumb(this.joyX, joyY);
    } else {
      this.drawJoystickThumb(this.joyX + normX, joyY + normY);
    }
  }

  private drawJoystickBase(x: number, y: number): void {
    const g = this.joystickGfx;
    g.clear();
    // Outer glow ring
    g.fillStyle(0x000000, 0.15);
    g.fillCircle(x, y, this.joyRadius + 4);
    // Base circle — dark with subtle gradient look
    g.fillStyle(0x111111, 0.4);
    g.fillCircle(x, y, this.joyRadius);
    // Inner ring
    g.lineStyle(2, 0xffffff, 0.2);
    g.strokeCircle(x, y, this.joyRadius);
    // Directional guides (subtle cross)
    g.lineStyle(1, 0xffffff, 0.08);
    g.beginPath(); g.moveTo(x - this.joyRadius + 10, y); g.lineTo(x + this.joyRadius - 10, y); g.strokePath();
    g.beginPath(); g.moveTo(x, y - this.joyRadius + 10); g.lineTo(x, y + this.joyRadius - 10); g.strokePath();
    // Inner deadzone circle
    g.lineStyle(1, 0xffffff, 0.1);
    g.strokeCircle(x, y, 10);
  }

  private drawJoystickThumb(x: number, y: number): void {
    const g = this.joystickThumbGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(x + 1, y + 2, this.joyThumbR);
    // Main thumb — clean white with gradient effect
    g.fillStyle(0xdddddd, 0.7);
    g.fillCircle(x, y, this.joyThumbR);
    // Highlight (inner bright circle)
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(x - 3, y - 3, this.joyThumbR * 0.5);
    // Border
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeCircle(x, y, this.joyThumbR);
  }

  private drawFireButton(x: number, y: number, pressed: boolean): void {
    const g = this.fireButtonGfx;
    g.clear();
    const r = this.fireRadius;
    const baseAlpha = pressed ? 0.75 : 0.45;
    const glowAlpha = pressed ? 0.3 : 0.1;

    // Outer glow
    g.fillStyle(0xff3333, glowAlpha);
    g.fillCircle(x, y, r + 6);
    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(x + 1, y + 2, r);
    // Main button
    g.fillStyle(0xcc2222, baseAlpha);
    g.fillCircle(x, y, r);
    // Inner highlight (top-left shine)
    g.fillStyle(0xff6644, baseAlpha * 0.6);
    g.fillCircle(x - r * 0.2, y - r * 0.2, r * 0.6);
    // Border
    g.lineStyle(3, 0xff4444, pressed ? 1.0 : 0.6);
    g.strokeCircle(x, y, r);

    // Crosshair icon — clean and bold
    const s = r * 0.4;
    g.lineStyle(3, 0xffffff, pressed ? 1.0 : 0.8);
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.strokePath();
    g.beginPath(); g.moveTo(x, y - s); g.lineTo(x, y + s); g.strokePath();
    // Aim ring
    g.lineStyle(2, 0xffffff, pressed ? 0.7 : 0.4);
    g.strokeCircle(x, y, r * 0.35);
  }

  private drawAbilityButton(x: number, y: number, pressed: boolean): void {
    const g = this.abilityButtonGfx;
    g.clear();
    const r = this.abilityBtnRadius;
    const baseAlpha = pressed ? 0.75 : 0.45;
    const glowAlpha = pressed ? 0.3 : 0.1;

    // Outer glow
    g.fillStyle(0x4488ff, glowAlpha);
    g.fillCircle(x, y, r + 5);
    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(x + 1, y + 2, r);
    // Main button
    g.fillStyle(0x2244aa, baseAlpha);
    g.fillCircle(x, y, r);
    // Inner highlight
    g.fillStyle(0x4488ff, baseAlpha * 0.5);
    g.fillCircle(x - r * 0.2, y - r * 0.2, r * 0.55);
    // Border
    g.lineStyle(3, 0x6699ff, pressed ? 1.0 : 0.6);
    g.strokeCircle(x, y, r);

    // Lightning bolt / star burst icon — 6-point star
    g.lineStyle(3, 0xffffff, pressed ? 1.0 : 0.8);
    const spikes = 6;
    for (let i = 0; i < spikes; i++) {
      const angle = (i * Math.PI * 2) / spikes - Math.PI / 2;
      const innerR = r * 0.2;
      const outerR = r * 0.55;
      g.beginPath();
      g.moveTo(x + Math.cos(angle) * innerR, y + Math.sin(angle) * innerR);
      g.lineTo(x + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR);
      g.strokePath();
    }
    // Center dot
    g.fillStyle(0xffffff, pressed ? 0.9 : 0.6);
    g.fillCircle(x, y, 3);
  }

  // ---- Panel drawing helper ----
  private drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(C.panelBorder); g.fillRect(x, y, w, h);
    g.fillStyle(C.panelBg); g.fillRect(x + 2, y + 2, w - 4, h - 4);
    g.fillStyle(C.panelInner, 0.9); g.fillRect(x + 4, y + 4, w - 8, h - 8);
  }
}
