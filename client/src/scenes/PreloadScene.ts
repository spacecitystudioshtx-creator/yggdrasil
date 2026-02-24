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
