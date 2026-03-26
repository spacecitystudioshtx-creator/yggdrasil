import Phaser from 'phaser';
import { FameManager, GraveyardEntry } from '../systems/FameManager';
import { getClass } from '../data/ClassDatabase';

/**
 * DeathScene: Permanent death screen showing fame earned.
 *
 * When a character dies (permadeath), this scene displays:
 *   - Character info (class, level)
 *   - Fame breakdown (how fame was calculated)
 *   - Graveyard history
 *   - Options: New Character / View Graveyard
 */

// Stardew palette
const C = {
  panelBorder: 0x3d2410,
  panelBg: 0x5c3a1e,
  panelInner: 0xdec9a0,
  gold: '#ddaa44',
  text: '#3d2410',
  red: '#cc3333',
};

interface DeathData {
  classId: string;
  level: number;
  killedBy: string;
  maxBiome: string;
  fameManager: FameManager;
}

export class DeathScene extends Phaser.Scene {
  private deathData!: DeathData;
  private showingGraveyard = false;
  private graveyardContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'DeathScene' });
  }

  init(data: any): void {
    this.deathData = data as DeathData;
  }

  create(): void {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;
    const fm = this.deathData.fameManager;
    const classDef = getClass(this.deathData.classId);

    // Record death and get fame
    const entry = fm.recordDeath(
      this.deathData.classId,
      classDef?.name ?? 'Unknown',
      this.deathData.level,
      this.deathData.killedBy,
      this.deathData.maxBiome,
    );

    // Dark background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a15, 1);
    bg.fillRect(0, 0, 800, 600);

    // Red vignette
    const vignette = this.add.graphics();
    vignette.fillStyle(0x110000, 0.5);
    vignette.fillRect(0, 0, 800, 600);

    // Skull / death title
    this.add.text(cx, 40, '☠ DEATH ☠', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#cc3333',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, 70, 'Your character has fallen in battle', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#887766',
    }).setOrigin(0.5);

    // Character info panel
    const pw = 500, ph = 330;
    const px = cx - pw / 2;
    const py = 90;

    const panel = this.add.graphics();
    panel.fillStyle(C.panelBorder);
    panel.fillRect(px, py, pw, ph);
    panel.fillStyle(C.panelBg);
    panel.fillRect(px + 2, py + 2, pw - 4, ph - 4);
    panel.fillStyle(C.panelInner, 0.9);
    panel.fillRect(px + 4, py + 4, pw - 8, ph - 8);

    // Character sprite
    const sprite = this.add.image(px + 40, py + 40, 'player');
    sprite.setScale(3);
    if (classDef) sprite.setTint(classDef.spriteTint);
    sprite.setAlpha(0.5);

    // Character info
    this.add.text(px + 80, py + 16, `${classDef?.name ?? 'Unknown'} — Level ${this.deathData.level}`, {
      fontFamily: 'monospace', fontSize: '12px', color: C.gold,
    });

    this.add.text(px + 80, py + 34, `Slain by: ${this.deathData.killedBy}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#cc4444',
    });

    this.add.text(px + 80, py + 48, `Last biome: ${this.deathData.maxBiome}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#8b6b3d',
    });

    // Divider
    panel.lineStyle(1, 0x8b6b3d, 0.5);
    panel.lineBetween(px + 12, py + 70, px + pw - 12, py + 70);

    // Fame breakdown
    this.add.text(px + pw / 2, py + 80, 'FAME EARNED', {
      fontFamily: 'monospace', fontSize: '12px', color: C.gold,
    }).setOrigin(0.5);

    const fameResult = fm.calculateFame(this.deathData.level, this.deathData.classId);
    let fy = py + 100;

    for (const item of fameResult.breakdown) {
      this.add.text(px + 30, fy, item.label, {
        fontFamily: 'monospace', fontSize: '9px', color: C.text,
      });
      this.add.text(px + pw - 30, fy, `+${item.value}`, {
        fontFamily: 'monospace', fontSize: '9px', color: C.gold,
      }).setOrigin(1, 0);
      fy += 16;
    }

    // Divider
    panel.lineBetween(px + 12, fy + 5, px + pw - 12, fy + 5);

    // Total fame
    this.add.text(px + 30, fy + 12, 'TOTAL FAME', {
      fontFamily: 'monospace', fontSize: '11px', color: C.gold, fontStyle: 'bold',
    });
    this.add.text(px + pw - 30, fy + 12, `★ ${entry.totalFame}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffdd44',
    }).setOrigin(1, 0);

    // Lifetime fame
    this.add.text(px + 30, fy + 30, `Lifetime Fame: ★ ${fm.getTotalFame()}`, {
      fontFamily: 'monospace', fontSize: '9px', color: '#aa8844',
    });

    // Stats summary
    this.add.text(px + 30, fy + 50, `Enemies slain: ${fm.enemiesKilled + entry.enemiesKilled}  |  Dungeons: ${entry.dungeonsCleared}`, {
      fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
    });

    // Buttons
    const btnY = py + ph + 20;

    // New Character button
    this.createButton(cx - 100, btnY, 180, 28, 'New Character  [ENTER]', 0x44aa33, () => {
      const sdk = (window as any).CrazyGames?.SDK;
      if (sdk?.game) { try { sdk.game.gameplayStop(); } catch (_e) { /* ignore */ } }
      this.scene.stop('UIScene');
      this.scene.stop('GameScene');
      this.scene.stop('DungeonScene');
      this.scene.stop('DeathScene');
      this.scene.start('CharacterSelectScene');
    });

    // Also allow ENTER key to start new character
    this.input.keyboard?.once('keydown-ENTER', () => {
      this.scene.stop('UIScene');
      this.scene.stop('GameScene');
      this.scene.stop('DungeonScene');
      this.scene.stop('DeathScene');
      this.scene.start('CharacterSelectScene');
    });

    // View Graveyard button
    this.createButton(cx + 100, btnY, 180, 28, 'Graveyard  [SPACE]', 0x6644aa, () => {
      this.toggleGraveyard();
    });

    // SPACE key toggles graveyard
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.toggleGraveyard();
    });

    // Hint
    this.add.text(cx, 580, 'Your vault items survive death', {
      fontFamily: 'monospace', fontSize: '8px', color: '#44aa44',
    }).setOrigin(0.5);
  }

  private createButton(
    x: number, y: number, w: number, h: number,
    label: string, color: number, callback: () => void,
  ): void {
    const btn = this.add.graphics();
    btn.fillStyle(0x000000, 0.3);
    btn.fillRect(x - w / 2, y, w, h);
    btn.fillStyle(color, 0.8);
    btn.fillRect(x - w / 2 + 1, y + 1, w - 2, h - 2);
    btn.lineStyle(1, 0xffffff, 0.3);
    btn.strokeRect(x - w / 2, y, w, h);

    this.add.text(x, y + h / 2, label, {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y + h / 2, w, h);
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerdown', callback);
  }

  private toggleGraveyard(): void {
    if (this.showingGraveyard && this.graveyardContainer) {
      this.graveyardContainer.destroy(true);
      this.graveyardContainer = null;
      this.showingGraveyard = false;
      return;
    }

    this.showingGraveyard = true;
    this.graveyardContainer = this.add.container(0, 0).setDepth(100);

    // Overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, 800, 600);
    this.graveyardContainer.add(overlay);

    // Panel
    const pw = 600, ph = 450;
    const px = 100, py = 50;

    const panel = this.add.graphics();
    panel.fillStyle(C.panelBorder);
    panel.fillRect(px, py, pw, ph);
    panel.fillStyle(C.panelBg);
    panel.fillRect(px + 2, py + 2, pw - 4, ph - 4);
    panel.fillStyle(C.panelInner, 0.9);
    panel.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    this.graveyardContainer.add(panel);

    this.graveyardContainer.add(this.add.text(400, py + 16, '☠ GRAVEYARD ☠', {
      fontFamily: 'monospace', fontSize: '14px', color: C.gold,
    }).setOrigin(0.5));

    const graveyard = this.deathData.fameManager.getGraveyard();

    if (graveyard.length === 0) {
      this.graveyardContainer.add(this.add.text(400, py + 200, 'No fallen characters yet...', {
        fontFamily: 'monospace', fontSize: '10px', color: '#8b6b3d',
      }).setOrigin(0.5));
    } else {
      // Header
      this.graveyardContainer.add(this.add.text(px + 16, py + 38, 'Class', {
        fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
      }));
      this.graveyardContainer.add(this.add.text(px + 120, py + 38, 'Lv', {
        fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
      }));
      this.graveyardContainer.add(this.add.text(px + 150, py + 38, 'Fame', {
        fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
      }));
      this.graveyardContainer.add(this.add.text(px + 210, py + 38, 'Killed By', {
        fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
      }));
      this.graveyardContainer.add(this.add.text(px + 400, py + 38, 'Date', {
        fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
      }));

      let gy = py + 54;
      const maxShow = Math.min(graveyard.length, 20);
      for (let i = 0; i < maxShow; i++) {
        const entry = graveyard[i];
        const isNew = i === 0;
        const color = isNew ? '#ddaa44' : '#5c3a1e';

        this.graveyardContainer.add(this.add.text(px + 16, gy, entry.className, {
          fontFamily: 'monospace', fontSize: '8px', color,
        }));
        this.graveyardContainer.add(this.add.text(px + 120, gy, `${entry.level}`, {
          fontFamily: 'monospace', fontSize: '8px', color,
        }));
        this.graveyardContainer.add(this.add.text(px + 150, gy, `★ ${entry.totalFame}`, {
          fontFamily: 'monospace', fontSize: '8px', color: '#aa8844',
        }));
        this.graveyardContainer.add(this.add.text(px + 210, gy, entry.killedBy.substring(0, 20), {
          fontFamily: 'monospace', fontSize: '8px', color: '#cc4444',
        }));

        const date = new Date(entry.timestamp);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        this.graveyardContainer.add(this.add.text(px + 400, gy, dateStr, {
          fontFamily: 'monospace', fontSize: '8px', color: '#8b6b3d',
        }));

        gy += 18;
      }
    }

    // Close button
    this.graveyardContainer.add(this.add.text(400, py + ph - 16, 'Click to close', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8b6b3d',
    }).setOrigin(0.5));

    // Close on click anywhere
    const closeZone = this.add.zone(400, 300, 800, 600);
    closeZone.setInteractive();
    closeZone.on('pointerdown', () => {
      this.toggleGraveyard();
      closeZone.destroy();
    });
    this.graveyardContainer.add(closeZone);
  }
}
