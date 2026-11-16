import * as Phaser from 'phaser';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../events/StageConstants';

interface PhaserGameSetup {
  backgroundColor: string;
  fps: Phaser.Types.Core.FPSConfig;
  scene: Phaser.Types.Scenes.SceneType[];
  callbacks: Phaser.Types.Core.CallbacksConfig;
  /** Options beyond the shared canvas setup; `render` and `scale` merge. */
  extra?: Partial<Phaser.Types.Core.GameConfig>;
}

/** The 1280x720 WebGL canvas both the Watch and Play games run on. */
export function createPhaserGame(
  parent: HTMLElement,
  { backgroundColor, fps, scene, callbacks, extra = {} }: PhaserGameSetup,
) {
  const { render, scale, ...rest } = extra;
  return new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    backgroundColor,
    ...rest,
    antialias: true,
    audio: { noAudio: true },
    render: { antialias: true, ...render },
    fps,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      ...scale,
    },
    scene,
    callbacks,
  });
}
