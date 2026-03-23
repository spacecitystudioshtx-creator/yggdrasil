import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { GameScene } from '../scenes/GameScene';
import { DungeonScene } from '../scenes/DungeonScene';
import { NexusScene } from '../scenes/NexusScene';
import { CharacterSelectScene } from '../scenes/CharacterSelectScene';
import { DeathScene } from '../scenes/DeathScene';
import { LoreScene } from '../scenes/LoreScene';
import { EndingScene } from '../scenes/EndingScene';
import { UIScene } from '../scenes/UIScene';

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#111111',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 3, // support multi-touch (joystick + fire + ability)
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, LoreScene, CharacterSelectScene, GameScene, DungeonScene, NexusScene, DeathScene, UIScene],
};
