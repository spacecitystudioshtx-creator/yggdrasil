import Phaser from 'phaser';
import { SpriteGenerator } from '../utils/SpriteGenerator';

/**
 * PreloadScene: Generates all placeholder sprites programmatically,
 * then transitions to the main GameScene.
 *
 * In the future this will also load real art assets from files.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // Load audio assets
    const audioFiles = [
      // Music tracks
      ['music_overworld', 'assets/audio/music_overworld.mp3'],
      ['music_dungeon', 'assets/audio/music_dungeon.mp3'],
      ['music_boss', 'assets/audio/music_boss.mp3'],
      // Per-dungeon ambient tracks (loaded conditionally — missing files are silently skipped)
      ['music_dungeon_frost',      'assets/audio/music_dungeon_frost.mp3'],
      ['music_dungeon_verdant',    'assets/audio/music_dungeon_verdant.mp3'],
      ['music_dungeon_muspelheim', 'assets/audio/music_dungeon_muspelheim.mp3'],
      ['music_dungeon_helheim',    'assets/audio/music_dungeon_helheim.mp3'],
      // Sound effects
      ['sfx_ability', 'assets/audio/sfx_ability.mp3'],
      ['sfx_hit_enemy', 'assets/audio/sfx_hit_enemy.mp3'],
      ['sfx_player_hit', 'assets/audio/sfx_player_hit.mp3'],
      ['sfx_heal', 'assets/audio/sfx_heal.mp3'],
      ['sfx_level_up', 'assets/audio/sfx_level_up.mp3'],
      ['sfx_portal', 'assets/audio/sfx_portal.mp3'],
    ];

    for (const [key, path] of audioFiles) {
      this.load.audio(key, path);
    }
  }

  create(): void {
    // Generate all placeholder textures
    SpriteGenerator.generateAll(this);

    // Show brief "ready" message
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'YGGDRASIL',
      {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ddaa44',
      },
    ).setOrigin(0.5);

    const subtitle = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 40,
      'Press any key to begin',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#aaaaaa',
      },
    ).setOrigin(0.5);

    // Blink effect
    this.tweens.add({
      targets: subtitle,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Start on any key press or click
    this.input.keyboard!.on('keydown', () => {
      this.startGame();
    });
    this.input.on('pointerdown', () => {
      this.startGame();
    });
  }

  private startGame(): void {
    // Show lore intro → character select
    this.scene.start('LoreScene');
  }
}
