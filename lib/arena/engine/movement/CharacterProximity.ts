import type { Vec2 } from '../motion/MotionTypes';
import type { MotorSweep } from './CharacterMotor';
export interface BodySpace {
  id: string;
  position: Vec2;
  radius: number;
  depthRadius: number;
  height: number;
}
/** Swept ellipse in the court plane; visual torso height is diagnostic, never a mesh collider.
 * Motor sweeps prevent tunnelling, including lane changes and authored lunges. No second physics clock.
 */
export class CharacterProximity {
  collisions = 0;
  sweep(
    id: string,
    from: Vec2,
    desired: Vec2,
    bodies: BodySpace[],
  ): MotorSweep {
    const self = bodies.find((b) => b.id === id);
    if (!self) return { position: desired };
    let end = { ...desired };
    for (const other of bodies) {
      if (other.id === id) continue;
      const rx = self.radius + other.radius,
        ry = self.depthRadius + other.depthRadius;
      const p = {
        x: (from.x - other.position.x) / rx,
        y: (from.y - other.position.y) / ry,
      };
      const v = { x: (end.x - from.x) / rx, y: (end.y - from.y) / ry };
      const a = v.x * v.x + v.y * v.y,
        b = 2 * (p.x * v.x + p.y * v.y),
        c = p.x * p.x + p.y * p.y - 1;
      if (a < 1e-12 || b >= 0) continue;
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) continue;
      const t = Math.max(0, (-b - Math.sqrt(discriminant)) / (2 * a));
      if (t > 1) continue;
      end = {
        x: from.x + (end.x - from.x) * Math.max(0, t - 0.0001),
        y: from.y + (end.y - from.y) * Math.max(0, t - 0.0001),
      };
      this.collisions++;
    }
    return {
      position: end,
      blockedX: Math.abs(end.x - desired.x) > 1e-6,
      blockedY: Math.abs(end.y - desired.y) > 1e-6,
    };
  }
  snapshot(bodies: BodySpace[]) {
    return structuredClone({
      collisions: this.collisions,
      shapes: bodies,
      kind: 'swept court-plane ellipses; independent of attack reach',
    });
  }
}
