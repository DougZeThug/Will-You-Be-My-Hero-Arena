import type { Joint, Vec } from './skeleton';
import { clipMaterialCell } from './material-contour';
export type Influence = Record<string, number>;
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const at = (name: string): Influence => ({ [name]: 1 });
export function blend(a: Influence, b: Influence, t: number): Influence {
  const out: Influence = {};
  for (const [n, w] of Object.entries(a)) out[n] = (out[n] ?? 0) + w * (1 - t);
  for (const [n, w] of Object.entries(b)) out[n] = (out[n] ?? 0) + w * t;
  return out;
}
export interface SkinDefinition {
  name: string;
  origin: Vec;
  joints: Joint[];
  bonePose: number[];
  step: number;
  region(x: number, y: number): string;
  influence(x: number, y: number, owner: string): Influence;
  /** Optional convex material boundary in source pixels. Clip geometry, not
   * just the occupancy mask: a coarse occupied cell otherwise leaks its UVs. */
  boundary?: Vec[];
  /** Convex source-space regions behind another layer (e.g. sleeve interior).
   * Subtract geometry so opaque interior paint cannot cover the inserted arm. */
  cutouts?: Vec[][];
  /** Explicit material partitions prevent a triangle from stretching across
   * two independently moving limbs. Boundaries partition, rather than paint,
   * the source image; each polygon is convex in source coordinates. */
  materials?: { name: string; boundary: Vec[] }[];
}
/** Alpha-aware topology with separate vertices across anatomical ownership
 * seams. Keeps sleeve joins blended without letting fingertips drag the shirt. */
export function createWeightedMesh(
  width: number,
  height: number,
  alpha: Uint8ClampedArray,
  rig: SkinDefinition,
) {
  const vertices: number[] = [],
    uvs: number[] = [],
    weights: number[] = [],
    triangles: number[] = [];
  const indices = new Map<string, number>();
  const materialFaces = new Map<string, number[]>();
  let blended = 0;
  const point = (x: number, y: number, owner: string) => {
    const key = `${owner}:${x}:${y}`;
    if (indices.has(key)) return indices.get(key)!;
    const i = vertices.length / 2;
    indices.set(key, i);
    vertices.push(x - rig.origin.x, y - rig.origin.y);
    uvs.push(x / width, y / height);
    const entries = Object.entries(rig.influence(x, y, owner)).filter(
        ([, w]) => w > 0.00001,
      ),
      total = entries.reduce((n, [, w]) => n + w, 0);
    if (!total) throw Error(`Unweighted ${rig.name} vertex ${x},${y}`);
    if (entries.length > 1) blended++;
    weights.push(
      entries.length,
      ...entries.flatMap(([name, w]) => {
        const index = rig.joints.findIndex((j) => j.name === name);
        if (index < 0) throw Error('Unknown influence ' + name);
        return [index, w / total];
      }),
    );
    return i;
  };
  for (let y = 0; y < height; y += rig.step)
    for (let x = 0; x < width; x += rig.step) {
      const x2 = Math.min(width, x + rig.step),
        y2 = Math.min(height, y + rig.step);
      let count = 0,
        cx = 0,
        cy = 0;
      for (let sy = y; sy < y2; sy++)
        for (let sx = x; sx < x2; sx++)
          if (alpha[(sy * width + sx) * 4 + 3] > 0) {
            count++;
            cx += sx;
            cy += sy;
          }
      if (!count) continue;
      if (rig.boundary || rig.cutouts?.length || rig.materials?.length) {
        const cells = clipMaterialCell(
          [
            { x, y },
            { x: x2, y },
            { x: x2, y: y2 },
            { x, y: y2 },
          ],
          rig.boundary,
          rig.cutouts,
        );
        const polygons = rig.materials
          ? cells.flatMap((cell) =>
              rig.materials!.flatMap((material) =>
                clipMaterialCell(cell, material.boundary).map((polygon) => ({
                  polygon,
                  owner: material.name,
                })),
              ),
            )
          : cells.map((polygon) => ({
              polygon,
              owner: rig.region(cx / count, cy / count),
            }));
        for (const { polygon, owner } of polygons) {
          const ids = polygon.map((p) => point(p.x, p.y, owner));
          for (let i = 1; i < ids.length - 1; i++) {
            const [a, b, c] = [polygon[0], polygon[i], polygon[i + 1]];
            // An edge through a grid corner can repeat its intersection. Keep
            // zero-area faces out of editor topology and native rendering.
            const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
            if (area > 1e-7) {
              if (rig.materials) {
                if (!materialFaces.has(owner)) materialFaces.set(owner, []);
                materialFaces.get(owner)!.push(ids[0], ids[i], ids[i + 1]);
              } else triangles.push(ids[0], ids[i], ids[i + 1]);
            }
          }
        }
        continue;
      }
      const owner = rig.region(cx / count, cy / count),
        a = point(x, y, owner),
        b = point(x2, y, owner),
        c = point(x, y2, owner),
        d = point(x2, y2, owner);
      triangles.push(a, b, c, b, d, c);
    }
  // Paint whole material surfaces back-to-front. Interleaving their triangles
  // row-by-row creates striped occlusion when one limb crosses another.
  if (rig.materials)
    for (const owner of new Set(rig.materials.map((m) => m.name)))
      triangles.push(...(materialFaces.get(owner) ?? []));
  const uses = new Map<string, { count: number; pair: number[] }>();
  for (let i = 0; i < triangles.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = triangles[i + j],
        b = triangles[i + ((j + 1) % 3)],
        key = a < b ? `${a}:${b}` : `${b}:${a}`,
        edge = uses.get(key);
      if (edge) edge.count++;
      else uses.set(key, { count: 1, pair: [a, b] });
    }
  const edges = [...uses.values()]
    .filter((e) => e.count === 1)
    .flatMap((e) => e.pair);
  return {
    display: {
      name: rig.name,
      path: rig.name,
      type: 'mesh',
      width,
      height,
      edges,
      userEdges: [],
      vertices,
      uvs,
      triangles,
      weights,
      slotPose: [1, 0, 0, 1, 0, 0],
      bonePose: rig.bonePose,
    },
    metrics: {
      vertices: vertices.length / 2,
      triangles: triangles.length / 3,
      blendedVertices: blended,
    },
  };
}
