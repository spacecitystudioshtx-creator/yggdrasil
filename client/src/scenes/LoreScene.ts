import Phaser from 'phaser';
import { MusicManager } from '../systems/MusicManager';

/**
 * LoreScene: Opening story crawl that sets up the Norse mythology setting.
 *
 * Displays scrolling text explaining the world of Yggdrasil, the threat,
 * and why the player is being called to action.
 * Skippable by pressing any key or clicking.
 */
export class LoreScene extends Phaser.Scene {
  private loreContainer!: Phaser.GameObjects.Container;
  private skipText!: Phaser.GameObjects.Text;
  private canSkip = false;
  private musicManager!: MusicManager;

  constructor() {
    super({ key: 'LoreScene' });
  }

  create(): void {
    // Start overworld music during lore/intro
    this.musicManager = new MusicManager(this);
    this.musicManager.playMusic('music_overworld');

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    // Dark background with subtle stars
    const bg = this.add.graphics();
    bg.fillStyle(0x060612, 1);
    bg.fillRect(0, 0, 800, 600);

    // Add subtle star particles
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * 800;
      const sy = Math.random() * 600;
      const alpha = 0.2 + Math.random() * 0.5;
      const star = this.add.graphics();
      star.fillStyle(0xffffff, alpha);
      star.fillRect(sx, sy, 1, 1);
    }

    // The lore text
    const loreLines = [
      '',
      '    Y G G D R A S I L',
      '',
      '    The World Tree trembles.',
      '',
      '',
      '    For ages uncounted, the Nine Realms hung',
      '    in balance upon the great ash tree Yggdrasil.',
      '    Gods, mortals, and monsters lived in an',
      '    uneasy peace, bound by the cosmic order.',
      '',
      '    But the threads of fate are unraveling.',
      '',
      '    The fire giant Surtr stirs in Muspelheim.',
      '    The dead rise in Helheim. The frost giants',
      '    march from Jotunheim. Darkness creeps',
      '    through the roots of the World Tree.',
      '',
      '    Ragnarok approaches.',
      '',
      '',
      '    Odin, the All-Father, has opened the',
      '    gates of Asgard to mortal heroes.',
      '',
      '    You have been chosen.',
      '',
      '    Take up arms. Venture into Midgard.',
      '    Slay the beasts that pour from the',
      '    corrupted realms. Enter the dungeons',
      '    of the Nine Worlds. Grow stronger.',
      '',
      '    But know this: death in these lands',
      '    is permanent. When you fall, your',
      '    deeds will be remembered in the',
      '    halls of Valhalla — as fame.',
      '',
      '    Rise, warrior. The Nine Realms',
      '    need you.',
      '',
      '',
      '',
    ];

    const fullText = loreLines.join('\n');

    // Create scrolling text container
    this.loreContainer = this.add.container(0, 0);

    const loreText = this.add.text(cx, 620, fullText, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ccbb88',
      lineSpacing: 6,
      align: 'left',
      wordWrap: { width: 480, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);

    this.loreContainer.add(loreText);

    // Scroll the text upward
    const scrollDistance = loreText.height + 700;
    const scrollDuration = scrollDistance * 35; // speed: ~35ms per pixel

    this.tweens.add({
      targets: loreText,
      y: -loreText.height,
      duration: scrollDuration,
      ease: 'Linear',
      onComplete: () => {
        this.goToCharacterSelect();
      },
    });

    // Skip prompt (appears after brief delay)
    this.skipText = this.add.text(cx, 580, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#665544',
    }).setOrigin(0.5).setDepth(50);

    this.time.delayedCall(1500, () => {
      this.skipText.setText('Press any key to skip...');
      this.canSkip = true;

      // Blink
      this.tweens.add({
        targets: this.skipText,
        alpha: 0.3,
        duration: 1200,
        yoyo: true,
        repeat: -1,
      });
    });

    // Skip on any key press
    this.input.keyboard!.on('keydown', () => {
      if (this.canSkip) this.goToCharacterSelect();
    });

    // Skip on click
    this.input.on('pointerdown', () => {
      if (this.canSkip) this.goToCharacterSelect();
    });

    // Top gradient overlay (darkens text as it approaches top)
    const gradient = this.add.graphics().setDepth(40);
    for (let i = 0; i < 60; i++) {
      const alpha = 1 - (i / 60);
      gradient.fillStyle(0x060612, alpha);
      gradient.fillRect(0, i, 800, 1);
    }

    // Bottom gradient overlay
    const gradientBottom = this.add.graphics().setDepth(40);
    for (let i = 0; i < 60; i++) {
      const alpha = i / 60;
      gradientBottom.fillStyle(0x060612, alpha);
      gradientBottom.fillRect(0, 540 + i, 800, 1);
    }
  }

  private goToCharacterSelect(): void {
    this.cameras.main.fadeOut(500, 6, 6, 18);
    this.time.delayedCall(500, () => {
      this.scene.start('CharacterSelectScene');
    });
  }
}
