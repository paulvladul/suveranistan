import Phaser from 'phaser';

import { MainScene } from './scenes/MainScene';

import { PreloadScene } from './scenes/PreloadScene';

const BASE_W = 960;

const BASE_H = 720;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  parent: 'game-container',

  width: BASE_W,

  height: BASE_H,

  backgroundColor: '#0a0a12',

  pixelArt: false,

  roundPixels: false,

  physics: {
    default: 'arcade',

    arcade: {
      gravity: { x: 0, y: 0 },

      debug: false,
    },
  },

  scale: {
    mode: Phaser.Scale.RESIZE,

    autoCenter: Phaser.Scale.CENTER_BOTH,

    width: BASE_W,

    height: BASE_H,
  },

  scene: [PreloadScene, MainScene],
};

new Phaser.Game(config);
