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
    // --- CrazyGames mute integration ---
    // Check initial mute state and listen for changes
    const sdk = (window as any).CrazyGames?.SDK;
    if (sdk?.game) {
      try {
        // Apply initial mute state (use game.sound — persists across all scenes)
        if (sdk.game.settings?.muteAudio) {
          this.game.sound.mute = true;
        }
        // Listen for mute/unmute changes from CrazyGames
        sdk.game.addSettingsChangeListener((settings: { muteAudio?: boolean }) => {
          this.game.sound.mute = !!settings.muteAudio;
        });
      } catch (_e) { /* ignore if settings API unavailable */ }
    }

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
