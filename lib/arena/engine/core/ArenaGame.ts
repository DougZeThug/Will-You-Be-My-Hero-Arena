import * as Phaser from 'phaser';
import type { ArenaBridge, ArenaOptions } from './ArenaOptions';
import { BootScene } from '../scenes/BootScene';
import { ArenaScene } from '../scenes/ArenaScene';
import { createPhaserGame } from './createPhaserGame';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../events/StageConstants';
export class ArenaGame {
  readonly game: Phaser.Game;
  private bridge: ArenaBridge;
  constructor(parent: HTMLElement, options: ArenaOptions) {
    this.bridge = { current: options, started: performance.now() };
    options.clock.useGameDriver(true);
    if (!options.clock.duration)
      options.clock.start(
        options.clock.time,
        options.recording?.duration ?? Infinity,
      );
    this.game = createPhaserGame(parent, {
      backgroundColor: '#151714',
      fps: { target: 60, smoothStep: true },
      extra: {
        transparent: false,
        roundPixels: false,
        render: { powerPreference: 'high-performance' },
        scale: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
      },
      scene: [new BootScene(this.bridge), new ArenaScene(this.bridge)],
      callbacks: {
        postBoot: (game) => {
          game.canvas.setAttribute(
            'aria-label',
            options.canvasLabel ??
              'Animated sports arena. Scores and commentary are also shown as text.',
          );
          game.canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            options.clock.paused = true;
            options.onError(
              options.recording
                ? 'Graphics were interrupted. Reload to continue; nothing about the contest has changed.'
                : 'Graphics were interrupted. Reload to continue.',
            );
          });
        },
      },
    });
  }
  update(options: ArenaOptions) {
    this.bridge.current = {
      ...options,
      characterRigs: options.characterRigs ?? this.bridge.current.characterRigs,
    };
  }
  destroy() {
    this.bridge.current.clock.useGameDriver(false);
    this.game.destroy(true);
  }
}
