import Phaser from 'phaser';
import { gameConfig } from './config/game-config';

// Initialize CrazyGames SDK (no-op if not running on CrazyGames)
const crazySdk = (window as any).CrazyGames?.SDK;
if (crazySdk) {
  try { crazySdk.init(); } catch (_e) { /* ignore if SDK init fails */ }
}

// Launch the game
const game = new Phaser.Game(gameConfig);

// For debugging in browser console
(window as any).__YGGDRASIL__ = game;
