import { clamp, type Vec2 } from './MotionTypes';
/** Shape-preserving Hermite velocity through intermediate root samples.
 * Extremes stop, monotone breakdowns do not. No overshoot beyond authored reach. */
export function sampleRoot(points: (Vec2 & { at: number })[], t: number): Vec2 {
  if (t <= points[0].at) return { ...points[0] };
  if (t >= points.at(-1)!.at) return { ...points.at(-1)! };
  let i = 0;
  while (i < points.length - 2 && t > points[i + 1].at) i++;
  const a = points[i],
    b = points[i + 1],
    h = b.at - a.at,
    u = clamp((t - a.at) / h, 0, 1);
  const sample = (axis: 'x' | 'y') => {
    const tangent = (n: number) => {
      if (!n || n === points.length - 1) return 0;
      const l = points[n].at - points[n - 1].at,
        r = points[n + 1].at - points[n].at;
      const s0 = (points[n][axis] - points[n - 1][axis]) / l,
        s1 = (points[n + 1][axis] - points[n][axis]) / r;
      return s0 * s1 <= 0
        ? 0
        : (3 * (l + r)) / ((2 * r + l) / s0 + (r + 2 * l) / s1);
    };
    return (
      (2 * u ** 3 - 3 * u * u + 1) * a[axis] +
      (u ** 3 - 2 * u * u + u) * h * tangent(i) +
      (-2 * u ** 3 + 3 * u * u) * b[axis] +
      (u ** 3 - u * u) * h * tangent(i + 1)
    );
  };
  return { x: sample('x'), y: sample('y') };
}
