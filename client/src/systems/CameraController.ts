import Phaser from 'phaser';
import { TILE_SIZE, REALM_SIZE } from '@yggdrasil/shared';

/**
 * CameraController: Smooth follow camera with pixel-perfect rendering.
 *
 * Uses Phaser's built-in startFollow for reliable camera tracking.
 * Pixel-perfect mode prevents sub-pixel rendering artifacts on 8x8/16x16 sprites.
 */
export class CameraController {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private target: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite) {
    this.scene = scene;
    this.target = target;
    this.camera = scene.cameras.main;

    // Set camera bounds to world size
    const worldPixelSize = REALM_SIZE * TILE_SIZE;
    this.camera.setBounds(0, 0, worldPixelSize, worldPixelSize);

    // Pixel-perfect rendering
    this.camera.setRoundPixels(true);

    // Zoom level — 2x makes 16px tiles appear as 32px on screen
    this.camera.setZoom(2);

    // Use Phaser's built-in follow with lerp for smooth tracking
    this.camera.startFollow(target, true, 0.12, 0.12);
  }

  update(_dt: number): void {
    // Phaser's startFollow handles camera updates automatically
  }

  /** Instantly snap camera to the target (no lerp). Use after teleporting the player. */
  snapToTarget(): void {
    this.camera.centerOn(this.target.x, this.target.y);
  }

  /** Screen shake effect (for hits, explosions) */
  shake(intensity: number = 0.005, duration: number = 100): void {
    this.camera.shake(duration, intensity);
  }

  /** Flash effect (for level ups, big hits) */
  flash(color: string = '#ffffff', duration: number = 200): void {
    this.camera.flash(duration, parseInt(color.replace('#', ''), 16));
  }

  getZoom(): number {
    return this.camera.zoom;
  }

  setZoom(zoom: number): void {
    this.camera.setZoom(zoom);
  }
}
