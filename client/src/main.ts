import Phaser from 'phaser';
import { gameConfig } from './config/game-config';

async function boot() {
  // Initialize CrazyGames SDK with a timeout — game starts regardless
  const sdk = (window as any).CrazyGames?.SDK;
  if (sdk) {
    try {
      await Promise.race([
        sdk.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
      console.log('[CrazyGames] SDK initialized');
    } catch (e) {
      console.warn('[CrazyGames] SDK init skipped:', e);
    }
  }

  // Launch the game
  const game = new Phaser.Game(gameConfig);
  (window as any).__YGGDRASIL__ = game;
}

boot();
