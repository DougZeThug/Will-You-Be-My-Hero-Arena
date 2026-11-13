import type * as Phaser from 'phaser';

/** The tiled backdrop plus the warm tint, spanning `worldWidth` (a multiple of
 * the 1280px background art). */
export function addBackdrop(scene: Phaser.Scene, worldWidth: number) {
  for (let x = 0; x < worldWidth; x += 1280)
    scene.add
      .image(x, 0, 'arena-background')
      .setOrigin(0)
      .setDisplaySize(1280, 720);
  scene.add.rectangle(worldWidth / 2, 360, worldWidth, 720, 0x8c5c29, 0.025);
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
