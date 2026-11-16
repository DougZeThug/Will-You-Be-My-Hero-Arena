import type * as Phaser from 'phaser';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../events/StageConstants';

/** The tiled backdrop plus the warm tint, spanning `worldWidth` (a multiple of
 * the 1280px background art). */
export function addBackdrop(scene: Phaser.Scene, worldWidth: number) {
  for (let x = 0; x < worldWidth; x += STAGE_WIDTH)
    scene.add
      .image(x, 0, 'arena-background')
      .setOrigin(0)
      .setDisplaySize(STAGE_WIDTH, STAGE_HEIGHT);
  scene.add.rectangle(
    worldWidth / 2,
    STAGE_HEIGHT / 2,
    worldWidth,
    STAGE_HEIGHT,
    0x8c5c29,
    0.025,
  );
}

/** Expose the installed character runtime on the canvas for Lab and tests. */
export function tagCharacterRuntime(
  canvas: HTMLCanvasElement,
  runtimeRevision: unknown,
  backends: string[],
) {
  if (typeof runtimeRevision === 'string')
    canvas.dataset.characterRuntime = runtimeRevision;
  canvas.dataset.characterBackends = backends.join(',');
}
