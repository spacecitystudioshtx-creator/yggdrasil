import Phaser from 'phaser';

/**
 * BootScene: First scene to load. Sets up any global config,
 * then immediately transitions to PreloadScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Show a simple loading message while PreloadScene loads assets
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

    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY + 40,
      'Loading...',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#888888',
      },
    ).setOrigin(0.5);

    // Move to preload after a brief flash
    this.time.delayedCall(300, () => {
      this.scene.start('PreloadScene');
    });
  }
}
