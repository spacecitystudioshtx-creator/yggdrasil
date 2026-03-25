import Phaser from 'phaser';
import { SpriteGenerator } from '../utils/SpriteGenerator';

export class PreloadScene extends Phaser.Scene {
  // Loading UI objects — destroyed when create() runs
  private loadingObjs: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // Signal loading start to CrazyGames SDK
    const crazySdk = (window as any).CrazyGames?.SDK;
    if (crazySdk?.game) {
      try { crazySdk.game.sdkGameLoadingStart(); } catch (_e) { /* ignore */ }
    }

    const { centerX, centerY } = this.cameras.main;

    const title = this.add.text(centerX, centerY - 40, 'YGGDRASIL', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ddaa44',
    }).setOrigin(0.5);

    const barBg = this.add.rectangle(centerX, centerY + 10, 300, 16, 0x333333).setOrigin(0.5);
    const bar   = this.add.rectangle(centerX - 150, centerY + 10, 0, 16, 0xddaa44).setOrigin(0, 0.5);
    const label = this.add.text(centerX, centerY + 36, 'Loading...', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5);

    this.loadingObjs = [title, barBg, bar, label];

    this.load.on('progress', (v: number) => { bar.width = 300 * v; });
    this.load.on('fileprogress', (file: { key: string }) => { label.setText(`Loading: ${file.key}`); });

    // Skip failed files instead of hanging
    this.load.on('loaderror', (file: { key: string; url: string }) => {
      console.warn(`[PreloadScene] Failed to load: ${file.key} (${file.url}) — skipping`);
    });

    // Use ./ prefix so paths resolve correctly inside iframes / subdirectory hosting
    const audioFiles = [
      ['music_overworld',          './assets/audio/music_overworld.mp3'],
      ['music_dungeon',            './assets/audio/music_dungeon.mp3'],
      ['music_boss',               './assets/audio/music_boss.mp3'],
      ['music_dungeon_frost',      './assets/audio/music_dungeon_frost.mp3'],
      ['music_dungeon_verdant',    './assets/audio/music_dungeon_verdant.mp3'],
      ['music_dungeon_muspelheim', './assets/audio/music_dungeon_muspelheim.mp3'],
      ['music_dungeon_helheim',    './assets/audio/music_dungeon_helheim.mp3'],
      ['sfx_ability',              './assets/audio/sfx_ability.mp3'],
      ['sfx_hit_enemy',            './assets/audio/sfx_hit_enemy.mp3'],
      ['sfx_player_hit',           './assets/audio/sfx_player_hit.mp3'],
      ['sfx_heal',                 './assets/audio/sfx_heal.mp3'],
      ['sfx_level_up',             './assets/audio/sfx_level_up.mp3'],
      ['sfx_portal',               './assets/audio/sfx_portal.mp3'],
    ];

    for (const [key, path] of audioFiles) {
      this.load.audio(key, path);
    }
  }

  create(): void {
    // Signal loading complete to CrazyGames SDK
    const crazySdk = (window as any).CrazyGames?.SDK;
    if (crazySdk?.game) {
      try { crazySdk.game.sdkGameLoadingStop(); } catch (_e) { /* ignore */ }
    }

    // Remove loading bar UI before drawing the "press any key" screen
    this.loadingObjs.forEach(o => o.destroy());
    this.loadingObjs = [];

    SpriteGenerator.generateAll(this);

    const { centerX, centerY } = this.cameras.main;

    this.add.text(centerX, centerY, 'YGGDRASIL', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ddaa44',
    }).setOrigin(0.5);

    const subtitle = this.add.text(centerX, centerY + 40, 'Press any key to begin', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: subtitle,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard!.on('keydown', () => this.startGame());
    this.input.on('pointerdown', () => this.startGame());
  }

  private startGame(): void {
    this.scene.start('LoreScene');
  }
}
