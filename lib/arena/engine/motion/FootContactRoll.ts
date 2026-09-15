import { clamp, type Vec2 } from './MotionTypes';

/** Rotate a planted foot about its support region, rather than its ankle.
 * `pivot` is the unrotated ankle→contact vector in world pixels; angles are radians.
 * The caller owns IK and the immutable floor anchor. No bone length changes.
 */
export function rolledAnkle(anchor: Vec2, pivot: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return {
    x: anchor.x + pivot.x - (pivot.x * c - pivot.y * s),
    y: anchor.y + pivot.y - (pivot.x * s + pivot.y * c),
  };
}

export function contactRoll(angle: number) {
  const radians = clamp(angle, (-8 * Math.PI) / 180, (24 * Math.PI) / 180);
  return {
    radians,
    region:
      radians > 0.001
        ? ('forefoot' as const)
        : radians < -0.001
          ? ('heel' as const)
          : ('sole' as const),
  };
}
