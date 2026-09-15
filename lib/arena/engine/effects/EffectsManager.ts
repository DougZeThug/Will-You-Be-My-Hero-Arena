import * as Phaser from 'phaser';
import type { ArenaCue } from '../core/LiveTypes';
export class EffectsManager {
  private bursts: {
    x: number;
    y: number;
    age: number;
    color: number;
    size: number;
  }[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(1500);
  }
  cue(c: ArenaCue) {
    if (c.kind !== 'effect' || c.x === undefined || c.y === undefined) return;
    this.bursts.push({
      x: c.x,
      y: c.y,
      age: 0,
      color: c.name === 'block' ? 0x18a1ad : 0xffd025,
      size: 12 + (c.intensity ?? 0.3) * 20,
    });
    this.bursts = this.bursts.slice(-12);
  }
  update(dt: number, reduced: boolean) {
    this.graphics.clear();
    this.bursts = this.bursts.filter((b) => b.age < 0.3);
    for (const b of this.bursts) {
      b.age += dt;
      if (reduced) continue;
      const a = 1 - b.age / 0.3;
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3,
          r = b.size * (1 - a);
        this.graphics
          .lineStyle(3, b.color, a)
          .lineBetween(
            b.x + Math.cos(angle) * r,
            b.y + Math.sin(angle) * r,
            b.x + Math.cos(angle) * (r + 8),
            b.y + Math.sin(angle) * (r + 8),
          );
      }
    }
  }
  destroy() {
    this.graphics.destroy();
  }
}
