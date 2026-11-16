import type * as Phaser from 'phaser';

/** Re-expresses a world-space placement in the local space of the sprite's
 * container (a held-object layer), or returns it unchanged without one. */
export function placeInLayer(
  sprite: Phaser.GameObjects.Image,
  world: { x: number; y: number; angle: number; scale: number },
) {
  let { x, y, angle, scale } = world;
  const parent = sprite.parentContainer;
  if (parent) {
    const matrix = parent.getWorldTransformMatrix(),
      point = matrix.applyInverse(x, y);
    x = point.x;
    y = point.y;
    scale /= Math.hypot(matrix.a, matrix.b);
    angle -= Math.atan2(matrix.b, matrix.a);
  }
  return { x, y, angle, scale };
}
