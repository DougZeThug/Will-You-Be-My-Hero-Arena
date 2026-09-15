/** Sparse, monotone cubic tracks. Shared key velocities are preserved instead
 * of stopping at every key. Release is an event inside the forward swing. */
export type Knot = readonly [frame: number, value: number];
/** Authoring-only sampler of the same monotone cubic used in exported curves.
 * Used to counter-rotate a wrist against authored parent tracks, not a second
 * runtime animation clock. */
export function sampleScalar(points: readonly Knot[], frame: number) {
  const track = scalarTrack(points, points.at(-1)![0], 'value');
  let i = points.length - 2;
  for (let j = 0; j < points.length - 1; j++)
    if (frame <= points[j + 1][0]) {
      i = j;
      break;
    }
  const a = points[i],
    b = points[i + 1],
    t = Math.max(0, Math.min(1, (frame - a[0]) / (b[0] - a[0]))),
    curve = track[i].curve as number[],
    u = 1 - t;
  const eased = 3 * u * u * t * curve[1] + 3 * u * t * t * curve[3] + t * t * t;
  return a[1] + (b[1] - a[1]) * eased;
}
export function scalarTrack(
  points: readonly Knot[],
  duration: number,
  field: string,
) {
  const slopes = points
    .slice(1)
    .map((p, i) => (p[1] - points[i][1]) / (p[0] - points[i][0]));
  const tangent = points.map((_, i) => {
    if (!i || i === points.length - 1) return 0;
    const a = slopes[i - 1],
      b = slopes[i];
    if (a * b <= 0) return 0;
    const h0 = points[i][0] - points[i - 1][0],
      h1 = points[i + 1][0] - points[i][0];
    return (3 * (h0 + h1)) / ((2 * h1 + h0) / a + (h1 + 2 * h0) / b);
  });
  return points.map(([frame, value], i) => {
    const next = points[i + 1],
      slope = slopes[i];
    return {
      duration: (next?.[0] ?? duration) - frame,
      [field]: value,
      curve:
        !next || !slope
          ? [1 / 3, 0, 2 / 3, 1]
          : [
              1 / 3,
              tangent[i] / slope / 3,
              2 / 3,
              1 - tangent[i + 1] / slope / 3,
            ],
    };
  });
}
