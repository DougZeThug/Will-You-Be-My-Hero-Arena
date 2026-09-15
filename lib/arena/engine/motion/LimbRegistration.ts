import type { Vec2 } from './MotionTypes';

/** Fit a drawn two-segment limb without the transverse inflation of a near-collinear affine fit.
 * Each segment uses only uniform length ratio + rotation. Blend around the actual elbow.
 * Authoring utility: never applied as runtime bone scale or IK stretch.
 */
export function registerLimbPoint(
  point: Vec2,
  source: readonly [Vec2, Vec2, Vec2],
  target: readonly [Vec2, Vec2, Vec2],
  blendRadius = 32,
): Vec2 {
  const fit = (i: number) => {
    const s = source[i],
      e = source[i + 1],
      a = target[i],
      b = target[i + 1];
    const sx = e.x - s.x,
      sy = e.y - s.y,
      tx = b.x - a.x,
      ty = b.y - a.y;
    const length2 = sx * sx + sy * sy;
    if (length2 < 1e-8) throw Error('Limb source segment has no length');
    const along = ((point.x - s.x) * sx + (point.y - s.y) * sy) / length2;
    const normal = (-(point.x - s.x) * sy + (point.y - s.y) * sx) / length2;
    return {
      x: a.x + along * tx - normal * ty,
      y: a.y + along * ty + normal * tx,
    };
  };
  const axis = { x: source[2].x - source[0].x, y: source[2].y - source[0].y };
  const distance =
    ((point.x - source[1].x) * axis.x + (point.y - source[1].y) * axis.y) /
    Math.hypot(axis.x, axis.y);
  const t = Math.max(
    0,
    Math.min(1, (distance + blendRadius) / (2 * blendRadius)),
  );
  const blend = t * t * (3 - 2 * t),
    a = fit(0),
    b = fit(1);
  return { x: a.x + (b.x - a.x) * blend, y: a.y + (b.y - a.y) * blend };
}
