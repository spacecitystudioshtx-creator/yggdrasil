import Phaser from 'phaser';
import { gameConfig } from './config/game-config';

async function boot() {
  // Initialize CrazyGames SDK (must be awaited before any SDK calls)
  const sdk = (window as any).CrazyGames?.SDK;
  if (sdk) {
    try {
      await sdk.init();
      console.log('[CrazyGames] SDK initialized');
    } catch (e) {
      console.warn('[CrazyGames] SDK init failed', e);
    }
  }

  // Launch the game
  const game = new Phaser.Game(gameConfig);
  (window as any).__YGGDRASIL__ = game;
}

boot();
