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
  skin: { slot: { name: string; display: WeightedMesh[] }[] }[];
}
/** The source x=493 partition cuts through the near shoe tips. Material is
 * reassigned by WHOLE faces, with independent vertices at the ownership seam.
 * All bind positions/UVs stay unchanged. Only this private Lab copy is derived;
 * original atlases, editor files, anatomy and production remain untouched.
 */
export function repairFootMaterial(id: string, arm: WeightedArmature) {
  if (!['dan', 'doug'].includes(id)) return 0;
  const near = arm.bone.findIndex((b) => b.name === 'foot_L');
  const far = arm.bone.findIndex((b) => b.name === 'foot_R');
  const mesh = arm.skin[0].slot.find((s) => s.name === 'body')?.display[0];
  if (
    !mesh?.vertices ||
    !mesh.weights ||
    !mesh.uvs ||
    !mesh.triangles ||
    near < 0 ||
    far < 0
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
    output: number[] = [],
    triangles: number[] = [],
    map = new Map<string, number>();
  let repaired = 0;
  for (let f = 0; f < mesh.triangles.length; f += 3) {
    const face = mesh.triangles.slice(f, f + 3);
    const x = face.reduce((n, i) => n + mesh.uvs![i * 2] * 1254, 0) / 3;
    const y = face.reduce((n, i) => n + mesh.uvs![i * 2 + 1] * 1254, 0) / 3;
    // Inspected transparent gap for Dan; Doug's shoes meet, so preserve their
    // painted diagonal overlap seam instead of the old vertical leg divider.
    const tip =
      id === 'dan'
        ? y > 1150 && x < 527
        : y > 1100 && (x < 533 || (x < 558 && y > 1186));
    const owns =
      tip &&
      face.some((i) => weights[i].some((b, j) => j % 2 === 1 && b === far));
    for (const i of face) {
      const key = i + ':' + owns;
      if (!map.has(key)) {
        map.set(key, vertices.length / 2);
        vertices.push(mesh.vertices[i * 2], mesh.vertices[i * 2 + 1]);
        uvs.push(mesh.uvs[i * 2], mesh.uvs[i * 2 + 1]);
        const w = [...weights[i]];
        if (owns)
          for (let k = 1; k < w.length; k += 2)
            if (w[k] === far) {
              w[k] = near;
              repaired++;
            }
        output.push(...w);
      }
      triangles.push(map.get(key)!);
    }
  }
  mesh.vertices = vertices;
  mesh.uvs = uvs;
  mesh.weights = output;
  mesh.triangles = triangles;
  // Runtime doesn't consume editor edge hints. Remap them rather than retain
  // stale source indices; this private copy is never advertised as an export.
  const remap = (edges: number[] = []) =>
    edges
      .map((i) => map.get(i + ':false') ?? map.get(i + ':true'))
      .filter((i): i is number => i !== undefined);
  mesh.edges = remap(mesh.edges);
  mesh.userEdges = remap(mesh.userEdges);
  return repaired;
}
