import type * as Phaser from 'phaser';
import type { VisualObject } from '../core/LiveTypes';
import { PROJECTILE_WIDTH, BAG_FLIGHT_FLATTEN } from '../../equipment-layout';

export interface VisualPresentation {
  setVisible(value: boolean): void;
  update(object: VisualObject): void;
}
type VisualFactory = (
  scene: Phaser.Scene,
  initial: VisualObject,
  team: number,
) => VisualPresentation;
const factories = new Map<string, VisualFactory>();
/** Event modules register their own equipment renderers without editing the scene. */
export function registerVisualObject(kind: string, factory: VisualFactory) {
  if (factories.has(kind))
    throw Error('Visual object already registered: ' + kind);
  factories.set(kind, factory);
}
export function createVisualObject(
  scene: Phaser.Scene,
  object: VisualObject,
  team: number,
) {
  const factory = factories.get(object.kind);
  if (!factory)
    throw Error('Register a renderer for visual object: ' + object.kind);
  return factory(scene, object, team);
}

registerVisualObject('bag', (scene, _object, team) => {
  const sprite = scene.add
    .image(
      0,
      0,
      'equipment:' + (team % 2 ? 'bag-teal' : 'bag-yellow'),
      '__BASE',
    )
    .setScale(1)
    .setDepth(1300);
  return {
    setVisible: (visible) => {
      sprite.setVisible(visible);
    },
    update: (o) => {
      const scale=PROJECTILE_WIDTH.cornhole/sprite.width;
      sprite.setPosition(o.x, o.y).setRotation(o.angle ?? 0).setScale(scale,scale*(o.flatten??BAG_FLIGHT_FLATTEN));
    },
  };
});
registerVisualObject('finish', (scene) => {
  const g = scene.add.graphics();
  for (let x = 0; x < 2; x++)
    for (let y = 0; y < 12; y++)
      g.fillStyle((x + y) % 2 ? 0x111713 : 0xfff2dc).fillRect(
        x * 14 - 14,
        y * 16 - 95,
        14,
        16,
      );
  return {
    setVisible: (visible) => {
      g.setVisible(visible);
    },
    update: (o) => {
      g.setPosition(o.x, o.y).setDepth(o.y + 4);
    },
  };
});
registerVisualObject('obstacle', (scene, o) => {
  const g = scene.add
    .graphics()
    .fillStyle(0x211d16, 0.2)
    .fillEllipse(0, 3, 64, 12)
    .lineStyle(4, 0x171b15)
    .fillStyle(o.color ?? 0xffcf25);
  if ((o.height ?? 0) > 70)
    g.fillRect(-30, -93, 60, 17)
      .strokeRect(-30, -93, 60, 17)
      .lineBetween(-25, -78, -25, 0)
      .lineBetween(25, -78, 25, 0);
  else
    g.fillTriangle(-27, 0, 0, -(o.height ?? 42), 27, 0).strokeTriangle(
      -27,
      0,
      0,
      -(o.height ?? 42),
      27,
      0,
    );
  return {
    setVisible: (visible) => {
      g.setVisible(visible);
    },
    update: (object) => {
      g.setPosition(object.x, object.y).setDepth(object.y + 4);
    },
  };
});
