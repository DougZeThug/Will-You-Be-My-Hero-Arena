import type { Vec } from './skeleton';

function halfPlane(points: Vec[], a: Vec, b: Vec, inside = true) {
  const result: Vec[] = [];
  const distance = (p: Vec) =>
    ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) * (inside ? 1 : -1);
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length],
      dp = distance(p),
      dq = distance(q);
    if (dp >= 0) result.push(p);
    if (dp < 0 !== dq < 0) {
      const t = dp / (dp - dq);
      result.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return result;
}

/** Convex source-space boundary, positive winding in image coordinates. */
function intersect(points: Vec[], boundary: Vec[]) {
  for (let i = 0; i < boundary.length && points.length >= 3; i++)
    points = halfPlane(
      points,
      boundary[i],
      boundary[(i + 1) % boundary.length],
    );
  return points;
}

/** Emit disjoint convex pieces outside a convex cutout. Each edge gets only
 * the remainder from the previous edge, preventing overlapping triangle fans. */
function subtract(polygon: Vec[], cutout: Vec[]) {
  const pieces: Vec[][] = [];
  let remaining = polygon;
  for (let i = 0; i < cutout.length && remaining.length >= 3; i++) {
    const a = cutout[i],
      b = cutout[(i + 1) % cutout.length];
    const outside = halfPlane(remaining, a, b, false);
    if (outside.length >= 3) pieces.push(outside);
    remaining = halfPlane(remaining, a, b);
  }
  return pieces;
}

export function clipMaterialCell(
  cell: Vec[],
  boundary?: Vec[],
  cutouts: Vec[][] = [],
) {
  let pieces = [boundary ? intersect(cell, boundary) : cell].filter(
    (p) => p.length >= 3,
  );
  for (const cutout of cutouts)
    pieces = pieces.flatMap((p) => subtract(p, cutout));
  return pieces;
}
