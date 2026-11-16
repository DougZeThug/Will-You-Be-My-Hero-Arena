import * as Phaser from 'phaser';
import { EQUIPMENT_ART } from '../../equipment-art';
import { ARENA_THEME, BOARD_FINISH } from '../presentation/ArenaTheme';
/** Registered silhouette is shared by recorded and playable events. */
export function equipmentSprite(
  scene: Phaser.Scene,
  p: { name: string; x: number; y: number; scale: number },
  depth: number,
) {
  const sprite = scene.add
    .image(p.x, p.y, 'equipment:' + p.name, '__BASE')
    .setOrigin(0)
    .setScale(p.scale)
    .setTint(ARENA_THEME.warmTint)
    .setDepth(depth);
  if (p.name === 'board') {
    // Fit the quieter finish to the existing board's source-pixel coordinate system.
    // The measured printed hole lands on the unchanged scoring anchor.
    // The canonical board drawing is EQUIPMENT_ART.board (2206 x 713 source px).
    const sx = EQUIPMENT_ART.board.width / BOARD_FINISH.width,
      sy = EQUIPMENT_ART.board.height / BOARD_FINISH.height;
    sprite
      .setScale(p.scale * sx, p.scale * sy)
      .setPosition(
        p.x + (EQUIPMENT_ART.board.hole.x - BOARD_FINISH.hole.x * sx) * p.scale,
        p.y + (EQUIPMENT_ART.board.hole.y - BOARD_FINISH.hole.y * sy) * p.scale,
      );
    sprite.setData('presentationRegistration', {
      source: BOARD_FINISH.hole,
      expected: {
        x: p.x + EQUIPMENT_ART.board.hole.x * p.scale,
        y: p.y + EQUIPMENT_ART.board.hole.y * p.scale,
      },
    });
    const outline = EQUIPMENT_ART.board.outline,
      mask = scene.make.graphics({ x: p.x, y: p.y }).setScale(p.scale);
    mask.fillStyle(0xffffff).fillPoints(
      Array.from(
        { length: outline.length / 2 },
        (_, i) => new Phaser.Geom.Point(outline[i * 2], outline[i * 2 + 1]),
      ),
      true,
    );
    sprite.setMask(mask.createGeometryMask());
    sprite.once('destroy', () => mask.destroy());
  }
  return sprite;
}
