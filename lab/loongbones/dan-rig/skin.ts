import { joints, origin, bonePose } from './anatomy';
type Influence = Record<string, number>;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const blend = (a: Influence, b: Influence, t: number): Influence => {
  const out: Influence = {};
  for (const [n, w] of Object.entries(a)) out[n] = (out[n] ?? 0) + w * (1 - t);
  for (const [n, w] of Object.entries(b)) out[n] = (out[n] ?? 0) + w * t;
  return out;
};
const at = (name: string): Influence => ({ [name]: 1 });
/** Anatomical regions prevent nearby hand bones from capturing shirt/shorts.
 * The connected shoulder surface blends into the arm; cells bordering the
 * transparent arm/torso gap retain separate vertices so a hand cannot drag cloth. */
const boundary = (y: number, side: 'L' | 'R') => {
  const p =
    side === 'R'
      ? [
          [700, 540],
          [800, 544],
          [850, 555],
          [900, 577],
          [950, 598],
          [1000, 608],
          [1100, 618],
          [1160, 622],
        ]
      : [
          [700, 208],
          [800, 210],
          [900, 196],
          [950, 192],
          [1000, 209],
          [1050, 222],
          [1100, 233],
          [1160, 204],
        ];
  for (let i = 1; i < p.length; i++)
    if (y < p[i][0])
      return (
        p[i - 1][1] +
        (p[i][1] - p[i - 1][1]) *
          clamp((y - p[i - 1][0]) / (p[i][0] - p[i - 1][0]))
      );
  return p[p.length - 1][1];
};
const region = (x: number, y: number) =>
  y > 710 && y < 1165
    ? x < boundary(y, 'L')
      ? 'L'
      : x > boundary(y, 'R')
        ? 'R'
        : 'body'
    : 'body';
export function influence(x: number, y: number, owner = 'body'): Influence {
  if (y < 355) return at('head');
  if (y < 435 && x > 255 && x < 505)
    return blend(at('head'), at('chest'), smooth(348, 435, y));
  let torso = at('chest');
  if (y > 845) torso = blend(at('chest'), at('spine_mid'), smooth(845, 900, y));
  if (y > 900)
    torso = blend(at('spine_mid'), at('spine_lower'), smooth(900, 950, y));
  if (y > 950)
    torso = blend(at('spine_lower'), at('pelvis'), smooth(950, 1040, y));
  // Left hand is in front of the edge of the shorts; register that silhouette.
  const leftEdge = y > 960 ? 220 : y > 650 ? 225 : 245;
  const rightEdge = y > 650 ? 540 + (y - 650) * 0.2 : 521;
  for (const side of ['L', 'R'] as const) {
    if (owner === 'body' && y > 810) continue;
    const edge =
      y > 700 ? boundary(y, side) : side === 'L' ? leftEdge : rightEdge;
    const outward = side === 'L' ? edge - x : x - edge;
    if (y > 400 && y < 1175 && (outward > 0 || owner === side)) {
      const shoulder = side === 'L' ? 493 : 515;
      let arm = blend(
        at(`clavicle_${side}`),
        at(`upper_arm_${side}`),
        smooth(shoulder - 60, shoulder + 100, y),
      );
      arm = blend(arm, at(`forearm_${side}`), smooth(710, 845, y));
      arm = blend(arm, at(`hand_${side}`), smooth(955, 1040, y));
      const base = smooth(0, y < 650 ? 90 : 22, outward) * smooth(400, 480, y);
      const amount =
        owner === side
          ? base + (1 - base) * smooth(700, 810, y)
          : base * (1 - smooth(700, 790, y));
      return blend(torso, arm, amount);
    }
  }
  if (y > 1070) {
    const side = x < 408 ? 'L' : 'R';
    let leg = blend(at('pelvis'), at(`thigh_${side}`), smooth(1070, 1220, y));
    leg = blend(leg, at(`shin_${side}`), smooth(1285, 1410, y));
    leg = blend(
      leg,
      at(`foot_${side}`),
      smooth(side === 'L' ? 1695 : 1665, side === 'L' ? 1780 : 1750, y),
    );
    return leg;
  }
  return torso;
}
export function createSkin(
  width: number,
  height: number,
  alpha: Uint8ClampedArray,
) {
  const vertices: number[] = [],
    uvs: number[] = [],
    weights: number[] = [],
    triangles: number[] = [];
  const indices = new Map<string, number>();
  let blended = 0;
  const point = (x: number, y: number, owner: string) => {
    const key = `${owner}:${x}:${y}`;
    if (indices.has(key)) return indices.get(key)!;
    const i = vertices.length / 2;
    indices.set(key, i);
    vertices.push(x - origin.x, y - origin.y);
    uvs.push(x / width, y / height);
    const entries = Object.entries(influence(x, y, owner)).filter(
      ([, w]) => w > 0.00001,
    );
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (entries.length > 1) blended++;
    weights.push(
      entries.length,
      ...entries.flatMap(([n, w]) => [
        joints.findIndex((j) => j.name === n),
        w / total,
      ]),
    );
    return i;
  };
  const step = 10;
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step) {
      const x2 = Math.min(width, x + step),
        y2 = Math.min(height, y + step);
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
      const owner = region(cx / count, cy / count);
      const a = point(x, y, owner),
        b = point(x2, y, owner),
        c = point(x, y2, owner),
        d = point(x2, y2, owner);
      triangles.push(a, b, c, b, d, c);
    }
  // LoongBones 1.2.3 copies DragonBones `edges` into mesh.outlines without
  // a fallback. Its mesh editor dereferences outlines.length even though the
  // playback runtime accepts a mesh without this authoring-only boundary.
  const edgeUses = new Map<string, { count: number; pair: [number, number] }>();
  for (let i = 0; i < triangles.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = triangles[i + j],
        b = triangles[i + ((j + 1) % 3)];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const entry = edgeUses.get(key);
      if (entry) entry.count++;
      else edgeUses.set(key, { count: 1, pair: [a, b] });
    }
  }
  const edges = [...edgeUses.values()]
    .filter((e) => e.count === 1)
    .flatMap((e) => e.pair);
  return {
    display: {
      name: 'dan_approved_body',
      path: 'dan_approved_body',
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
      bonePose,
    },
    metrics: {
      vertices: vertices.length / 2,
      triangles: triangles.length / 3,
      blendedVertices: blended,
    },
  };
}
