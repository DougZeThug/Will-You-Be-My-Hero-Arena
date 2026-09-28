interface WeightedMesh {
  vertices?: number[];
  weights?: number[];
  uvs?: number[];
  triangles?: number[];
  edges?: number[];
  userEdges?: number[];
}
interface WeightedArmature {
  bone: { name: string }[];
  slot: { name: string; parent: string }[];
  skin: { slot: { name: string; display: WeightedMesh[] }[] }[];
}

/** Inspected painted ink line of the near thigh's front edge, below the
 * shorts hem, in atlas pixels (top to bottom). Everything right of it down to
 * the crotch is far-thigh skin. */
const nearThighOutline: Record<'dan' | 'doug', [number, number][]> = {
  dan: [
    [526.7, 818.9],
    [520.6, 836.7],
    [512.8, 846.7],
    [510.6, 862.2],
    [508.3, 867.8],
  ],
  doug: [
    [530, 804.4],
    [526.1, 815.6],
    [521.1, 824.4],
    [518.9, 844.4],
    [512.8, 852.2],
    [506.1, 860],
  ],
};
const outlineX = (line: [number, number][], y: number) => {
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1],
      [x1, y1] = line[i];
    if (y >= y0 && y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  }
  return undefined;
};

/** The source leg partition follows a projected inner-leg diagonal, so a wedge
 * of painted far-thigh skin below the hem is owned by the near thigh. The two
 * thighs pivot at different hips; once the knees soften that wedge shears away
 * from the rest of the far thigh and exposes the court through the crotch.
 * Reassign those WHOLE faces to the far leg (independent vertices at the new
 * seam, which is the near thigh's painted outline) and draw them with the far
 * leg, under the near thigh. Bind positions and UVs stay unchanged; only this
 * private runtime copy is derived. */
export function repairThighSeam(id: string, arm: WeightedArmature) {
  if (id !== 'dan' && id !== 'doug') return 0;
  const line = nearThighOutline[id];
  const index = (name: string) => arm.bone.findIndex((b) => b.name === name);
  const swap = new Map([
    [index('thigh_L'), index('thigh_R')],
    [index('shin_L'), index('shin_R')],
  ]);
  const mesh = arm.skin[0].slot.find((s) => s.name === 'body')?.display[0];
  if (
    !mesh?.vertices ||
    !mesh.weights ||
    !mesh.uvs ||
    !mesh.triangles ||
    [...swap].some(([a, b]) => a < 0 || b < 0)
  )
    return 0;
  const weights: number[][] = [];
  for (let cursor = 0; cursor < mesh.weights.length;) {
    const count = mesh.weights[cursor];
    weights.push(mesh.weights.slice(cursor, cursor + 1 + count * 2));
    cursor += 1 + count * 2;
  }
  const vertices: number[] = [],
    uvs: number[] = [],
    output: number[][] = [],
    original: number[][] = [],
    moved: number[] = [],
    kept: number[] = [],
    map = new Map<string, number>();
  let repaired = 0;
  for (let f = 0; f < mesh.triangles.length; f += 3) {
    const face = mesh.triangles.slice(f, f + 3);
    // Same 1254 px atlas as the foot material repair.
    const x = face.reduce((n, i) => n + mesh.uvs![i * 2] * 1254, 0) / 3;
    const y = face.reduce((n, i) => n + mesh.uvs![i * 2 + 1] * 1254, 0) / 3;
    const edge = outlineX(line, y);
    const owns =
      edge !== undefined &&
      x > edge &&
      face.some((i) => weights[i].some((b, j) => j % 2 === 1 && swap.has(b)));
    for (const i of face) {
      const key = i + ':' + owns;
      if (!map.has(key)) {
        map.set(key, vertices.length / 2);
        vertices.push(mesh.vertices[i * 2], mesh.vertices[i * 2 + 1]);
        uvs.push(mesh.uvs[i * 2], mesh.uvs[i * 2 + 1]);
        const w = [...weights[i]];
        if (owns)
          for (let k = 1; k < w.length; k += 2)
            if (swap.has(w[k])) {
              w[k] = swap.get(w[k])!;
              repaired++;
            }
        output.push(w);
        original.push(weights[i]);
      }
      (owns ? moved : kept).push(map.get(key)!);
    }
  }
  mesh.vertices = vertices;
  mesh.uvs = uvs;
  mesh.weights = output.flat();
  // Material order is far arm, far leg, near leg, torso: leading with the
  // reassigned far-thigh faces keeps them under the near thigh's outline.
  mesh.triangles = [...moved, ...kept];
  const remap = (edges: number[] = []) =>
    edges
      .map((i) => map.get(i + ':false') ?? map.get(i + ':true'))
      .filter((i): i is number => i !== undefined);
  mesh.edges = remap(mesh.edges);
  mesh.userEdges = remap(mesh.userEdges);
  // Behind the whole body, so these show only through an opened seam:
  // - the far thigh's own painted skin beside the outline, slid under the near
  //   thigh and moving with the far leg (the far thigh continues, unpainted,
  //   behind the near thigh);
  // - the reassigned wedge in place, still moving with the near thigh, and the
  //   far thigh's top in place on the pelvis: the far thigh vacates both spots
  //   under the hem when it swings forward.
  const near = (i: number) =>
    output[i].some((b, j) => j % 2 === 1 && swap.has(b));
  const wedge = new Set(moved),
    pelvis = index('pelvis');
  const underlay = structuredClone(mesh);
  const compact = new Map<string, number>(),
    underlayWeights: number[][] = [],
    faces: number[] = [];
  underlay.vertices = [];
  underlay.uvs = [];
  const add = (i: number, slide: number, w: number[]) => {
    const key = i + ':' + slide;
    if (!compact.has(key)) {
      compact.set(key, underlayWeights.length);
      underlay.vertices!.push(vertices[i * 2] - slide, vertices[i * 2 + 1]);
      underlay.uvs!.push(uvs[i * 2], uvs[i * 2 + 1]);
      underlayWeights.push(w);
    }
    faces.push(compact.get(key)!);
  };
  for (let f = 0; f < mesh.triangles.length; f += 3) {
    const face = mesh.triangles.slice(f, f + 3);
    const x = face.reduce((n, i) => n + uvs[i * 2] * 1254, 0) / 3;
    const y = face.reduce((n, i) => n + uvs[i * 2 + 1] * 1254, 0) / 3;
    if (y < line[0][1] - UNDERLAY_HEM_REACH) continue;
    // Reach up under the hem too: the seam opens right below it.
    const edge = outlineX(line, Math.max(y, line[0][1]));
    if (
      edge !== undefined &&
      x > edge &&
      x < edge + UNDERLAY_SOURCE_WIDTH &&
      !face.some(near)
    )
      for (const i of face) add(i, UNDERLAY_SLIDE, output[i]);
    if (face.every((i) => wedge.has(i)))
      for (const i of face) add(i, 0, original[i]);
    else if (
      edge !== undefined &&
      x > edge &&
      x < edge + UNDERLAY_SOURCE_WIDTH &&
      y < line[0][1] + UNDERLAY_HEM_REACH &&
      !face.some(near)
    )
      for (const i of face) add(i, 0, [1, pelvis, 1]);
  }
  underlay.triangles = faces;
  underlay.weights = underlayWeights.flat();
  underlay.edges = [];
  underlay.userEdges = [];
  (underlay as { name?: string }).name = 'thighUnderlay';
  arm.slot.unshift({ name: 'thighUnderlay', parent: 'root' });
  arm.skin[0].slot.unshift({ name: 'thighUnderlay', display: [underlay] });
  return repaired;
}
/** Far-thigh skin taken from beside the outline, in atlas pixels. */
const UNDERLAY_SOURCE_WIDTH = 62;
/** How far above the outline's top the backing reaches, in atlas pixels. */
const UNDERLAY_HEM_REACH = 32;
/** How far that skin slides under the near thigh, in atlas pixels. */
const UNDERLAY_SLIDE = 36;

/** The seam backing belongs to nearly parallel thighs, where the far thigh is
 * tucked behind the near one. Once they spread (release, follow-through) the
 * court between them is real and the backing would hang below the hem as a
 * lump. Opacity from the thighs' divergence from their rest angles (degrees):
 * a stateless pose function, so seeks and replays reproduce it. */
export function thighUnderlayAlpha(divergence: number) {
  const d = Math.abs(divergence);
  return Math.max(0, Math.min(1, (9 - d) / 4));
}
