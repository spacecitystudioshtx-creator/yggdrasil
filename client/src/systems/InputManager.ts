import Phaser from 'phaser';

/**
 * InputManager: Abstracts keyboard + mouse input.
 * Reads WASD/Arrow keys for movement, mouse for aiming/shooting.
 */
export class InputManager {
  private scene: Phaser.Scene;

  // Key references
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;    // Nexus (future)
  private keySpace!: Phaser.Input.Keyboard.Key; // Ability (future)

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const kb = scene.input.keyboard!;
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyR = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  update(): void {
    // Input state is read directly from Phaser keys; nothing to update here
  }

  /** Get normalized movement direction vector */
  getMovementDirection(): { x: number; y: number } {
    let dx = 0;
    let dy = 0;

    if (this.keyW.isDown || this.keyUp.isDown) dy -= 1;
    if (this.keyS.isDown || this.keyDown.isDown) dy += 1;
    if (this.keyA.isDown || this.keyLeft.isDown) dx -= 1;
    if (this.keyD.isDown || this.keyRight.isDown) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    return { x: dx, y: dy };
  }

  /** Is the player currently shooting? (left mouse button held) */
  isShootingPressed(): boolean {
    return this.scene.input.activePointer.isDown;
  }

  /** Is ability key pressed? */
  isAbilityPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keySpace);
  }

  /** Is nexus key pressed? */
  isNexusPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keyR);
  }
}
