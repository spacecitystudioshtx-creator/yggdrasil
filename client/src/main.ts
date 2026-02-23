import Phaser from 'phaser';
import { gameConfig } from './config/game-config';

// Launch the game
const game = new Phaser.Game(gameConfig);

// For debugging in browser console
(window as any).__YGGDRASIL__ = game;
