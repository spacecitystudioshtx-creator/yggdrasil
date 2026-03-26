import Phaser from 'phaser';

/**
 * InputManager: Abstracts keyboard + mouse + virtual touch input.
 * Reads WASD/Arrow keys for movement, mouse for aiming/shooting.
 * On touch devices, UIScene writes to static virtual joystick/shoot state.
 */
export class InputManager {
  private scene: Phaser.Scene;

  // Virtual touch input (written by UIScene, read by all game scenes)
  static virtualJoystick = { x: 0, y: 0 };
  static virtualShoot = false;
  static virtualAbility = false;
  static isMobile = false;

  // Key references (null on mobile/touch-only devices)
  private keyW: Phaser.Input.Keyboard.Key | null = null;
  private keyA: Phaser.Input.Keyboard.Key | null = null;
  private keyS: Phaser.Input.Keyboard.Key | null = null;
  private keyD: Phaser.Input.Keyboard.Key | null = null;
  private keyUp: Phaser.Input.Keyboard.Key | null = null;
  private keyDown: Phaser.Input.Keyboard.Key | null = null;
  private keyLeft: Phaser.Input.Keyboard.Key | null = null;
  private keyRight: Phaser.Input.Keyboard.Key | null = null;
  private keyP: Phaser.Input.Keyboard.Key | null = null;    // Portal summon
  private keySpace: Phaser.Input.Keyboard.Key | null = null; // Ability

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Detect mobile/touch device
    InputManager.isMobile = this.detectMobile();

    const kb = scene.input.keyboard;
    if (kb) {
      this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
      this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
      this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
      this.keyP = kb.addKey(Phaser.Input.Keyboard.KeyCodes.P);
      this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
  }

  private detectMobile(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    );
  }

  update(): void {
    // Input state is read directly from Phaser keys; nothing to update here
  }

  /** Get normalized movement direction vector */
  getMovementDirection(): { x: number; y: number } {
    let dx = 0;
    let dy = 0;

    if (this.keyW?.isDown || this.keyUp?.isDown) dy -= 1;
    if (this.keyS?.isDown || this.keyDown?.isDown) dy += 1;
    if (this.keyA?.isDown || this.keyLeft?.isDown) dx -= 1;
    if (this.keyD?.isDown || this.keyRight?.isDown) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    // Merge virtual joystick input (touch controls)
    const vj = InputManager.virtualJoystick;
    if (vj.x !== 0 || vj.y !== 0) {
      dx = vj.x;
      dy = vj.y;
    }

    return { x: dx, y: dy };
  }

  /** Is the player currently shooting? (left mouse button held or virtual fire button) */
  isShootingPressed(): boolean {
    if (InputManager.virtualShoot) return true;
    // On mobile, don't count pointer.isDown as shooting (it's used for joystick/buttons)
    if (InputManager.isMobile) return false;
    return this.scene.input.activePointer.isDown;
  }

  /** Is ability key pressed? */
  isAbilityPressed(): boolean {
    if (InputManager.virtualAbility) {
      InputManager.virtualAbility = false; // consume the press
      return true;
    }
    return this.keySpace ? Phaser.Input.Keyboard.JustDown(this.keySpace) : false;
  }

  /** Is portal key pressed? (P — summon current dungeon portal to player) */
  isPortalKeyPressed(): boolean {
    return this.keyP ? Phaser.Input.Keyboard.JustDown(this.keyP) : false;
  }
}
