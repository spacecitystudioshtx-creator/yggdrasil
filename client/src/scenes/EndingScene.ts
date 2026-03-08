import Phaser from 'phaser';

/**
 * EndingScene: Post-victory credits crawl.
 *
 * Mirrors the LoreScene opening style — dark background, stars, scrolling text.
 * Tells the cliffhanger epilogue. Ends at CharacterSelectScene.
 */
export class EndingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EndingScene' });
  }

  create(): void {
    const cx = this.cameras.main.width / 2;

    // Dark background
    const bg = this.add.graphics();
    bg.fillStyle(0x04040e, 1);
    bg.fillRect(0, 0, 800, 600);

    // Stars — slightly more than the intro, the sky is clearer now
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * 800;
      const sy = Math.random() * 600;
      const alpha = 0.15 + Math.random() * 0.6;
      const size = Math.random() < 0.15 ? 2 : 1;
      const star = this.add.graphics();
      star.fillStyle(0xffffff, alpha);
      star.fillRect(sx, sy, size, size);
    }

    // Fade in from black
    this.cameras.main.fadeIn(1200, 4, 4, 14);

    const lines = [
      '',
      '',
      '    . . .',
      '',
      '',
      '    The beast fell.',
      '',
      '    Fenrir — the Wolf that was foretold to',
      '    swallow the sun — lay still in the ash',
      '    and frost of Midgard\'s heart.',
      '',
      '    You stood over him, blade trembling,',
      '    the World Tree groaning above you.',
      '',
      '',
      '    For a moment, there was silence.',
      '',
      '',
      '    Then the ground cracked.',
      '',
      '    Deep beneath Midgard, something',
      '    older than Fenrir stirred.',
      '    Something that had been waiting.',
      '',
      '    The roots of Yggdrasil began to bleed.',
      '',
      '',
      '    In Asgard, Odin closed his one eye.',
      '',
      '    He had seen this.',
      '',
      '    He had not told you.',
      '',
      '',
      '    Fenrir was never the threat.',
      '',
      '    Fenrir was the lock.',
      '',
      '',
      '',
      '    ✦  ✦  ✦',
      '',
      '',
      '    Y G G D R A S I L',
      '',
      '    Chapter One: The Wolf\'s Gate',
      '',
      '    ━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '',
      '    Concept & Design',
      '    Space City Studios',
      '',
      '    Built with Phaser 3',
      '',
      '',
      '    Thank you for playing.',
      '',
      '    The Nine Realms are not yet saved.',
      '',
      '',
      '',
      '',
      '    [ Press any key to play again ]',
      '',
      '',
      '',
    ];

    const fullText = lines.join('\n');

    const loreText = this.add.text(cx, 640, fullText, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ccbb88',
      lineSpacing: 6,
      align: 'left',
      wordWrap: { width: 500, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    // Gold title highlight
    const titleHighlight = this.add.text(cx, 640, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffdd44',
    }).setOrigin(0.5, 0);

    const scrollDistance = loreText.height + 700;
    const scrollDuration = scrollDistance * 40;

    this.tweens.add({
      targets: loreText,
      y: -loreText.height,
      duration: scrollDuration,
      ease: 'Linear',
      onComplete: () => this.finish(),
    });

    // Top + bottom gradient overlays
    const gradTop = this.add.graphics().setDepth(40);
    for (let i = 0; i < 80; i++) {
      gradTop.fillStyle(0x04040e, 1 - i / 80);
      gradTop.fillRect(0, i, 800, 1);
    }

    const gradBot = this.add.graphics().setDepth(40);
    for (let i = 0; i < 80; i++) {
      gradBot.fillStyle(0x04040e, i / 80);
      gradBot.fillRect(0, 520 + i, 800, 1);
    }

    // Skip hint
    const skipText = this.add.text(cx, 574, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#554433',
    }).setOrigin(0.5).setDepth(50);

    this.time.delayedCall(2000, () => {
      skipText.setText('Press any key to continue...');
      this.tweens.add({
        targets: skipText, alpha: 0.3, duration: 1200, yoyo: true, repeat: -1,
      });

      this.input.keyboard!.once('keydown', () => this.finish());
      this.input.once('pointerdown', () => this.finish());
    });
  }

  private finish(): void {
    this.cameras.main.fadeOut(800, 4, 4, 14);
    this.time.delayedCall(800, () => {
      this.scene.stop('EndingScene');
      this.scene.start('CharacterSelectScene');
    });
  }
}
