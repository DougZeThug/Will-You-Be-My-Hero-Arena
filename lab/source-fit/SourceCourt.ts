import * as Phaser from 'phaser';
import { Equipment } from '../../lib/arena/engine/objects/Equipment';
import { CardPortal } from '../../lib/arena/engine/objects/CardPortal';
import { project } from '../../lib/arena/simulation';

/** Static court-scale source review using the exact production art/placement code. */
export class SourceCourt {
  readonly root: Phaser.GameObjects.Container;
  readonly base = project({ x: 1, y: 0, z: 0 });
  constructor(scene: Phaser.Scene, cardKey: string) {
    const before = new Set(scene.children.list);
    this.root = scene.add.container(0, 0).setDepth(10).setVisible(false);
    scene.add
      .image(0, 0, 'arena-background')
      .setOrigin(0)
      .setDisplaySize(1280, 720);
    scene.add.rectangle(640, 360, 1280, 720, 0x8c5c29, 0.025);
    scene.add
      .graphics()
      .lineStyle(2, 0xf3e6c7, 0.45)
      .lineBetween(
        this.base.x - 62,
        this.base.y + 6,
        this.base.x + 63,
        this.base.y + 6,
      );
    new Equipment(scene).update('cornhole', []);
    new CardPortal(scene, cardKey, this.base, 0xf07830).settle();
    this.root.add(
      scene.children.list.filter(
        (object) => object !== this.root && !before.has(object),
      ),
    );
  }
}
