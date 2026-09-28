interface WeightedMesh {
  vertices?: number[];
  weights?: number[];
  uvs?: number[];
}
interface WeightedArmature {
  bone: { name: string }[];
  skin: { slot: { name: string; display: WeightedMesh[] }[] }[];
}

/** Atlas rows (px): hip joints, where the shorts start following the thighs,
 * and the existing pelvis-to-thigh blend end just below the hem. */
const HIP_Y = 690;
const HEM_Y = 815;
/** Atlas column (px) where the near shorts leg meets the far one at the hem. */
const LEG_SPLIT_X = 550;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The source binds the whole shorts to the pelvis down to the hem, while the
 * performance keeps the knees softly bent: each thigh turns ~15° under a rigid
 * shorts leg, so the leg slides forward out of the hem. Blend the shorts legs
 * from the pelvis at hip height onto their own thigh by the hem, as fabric
 * does. Bind positions, UVs and topology are unchanged; only this private
 * runtime copy's weights are derived. Returns the reweighted vertex count. */
export function followShortsToThighs(id: string, arm: WeightedArmature) {
  if (id !== 'dan' && id !== 'doug') return 0;
  const index = (name: string) => arm.bone.findIndex((b) => b.name === name);
  const pelvis = index('pelvis'),
    near = index('thigh_L'),
    far = index('thigh_R');
  const mesh = arm.skin[0].slot.find((s) => s.name === 'body')?.display[0];
  if (!mesh?.weights || !mesh.uvs || pelvis < 0 || near < 0 || far < 0)
    return 0;
  const output: number[] = [];
  let changed = 0;
  for (let cursor = 0, v = 0; cursor < mesh.weights.length; v++) {
    const count = mesh.weights[cursor];
    const influences = new Map<number, number>();
    for (let j = 0; j < count; j++)
      influences.set(
        mesh.weights[cursor + 1 + j * 2],
        mesh.weights[cursor + 2 + j * 2],
      );
    cursor += 1 + count * 2;
    const x = mesh.uvs[v * 2] * 1254,
      y = mesh.uvs[v * 2 + 1] * 1254;
    const cloth = [...influences.keys()].every((b) =>
      [pelvis, near, far].includes(b),
    );
    const follow = smooth(HIP_Y, HEM_Y, y);
    const thigh = (influences.get(near) ?? 0) + (influences.get(far) ?? 0);
    if (!cloth || !influences.has(pelvis) || y > HEM_Y || follow <= thigh) {
      output.push(count, ...[...influences].flat());
      continue;
    }
    // Keep an existing leg partition; otherwise split at the hem seam.
    const farShare =
      thigh > 0
        ? (influences.get(far) ?? 0) / thigh
        : smooth(LEG_SPLIT_X - 12, LEG_SPLIT_X + 12, x);
    const next = [
      [pelvis, 1 - follow],
      [near, follow * (1 - farShare)],
      [far, follow * farShare],
    ].filter(([, w]) => w > 1e-4);
    output.push(next.length, ...next.flat());
    changed++;
  }
  // The source splits the mesh between the two legs from the shorts seam down
  // to the crotch. Both thighs now carry cloth, and they pivot at hips ~80px
  // apart, so the split opens. Weld coincident seam vertices to their shared
  // average (fully under the shorts, fading out by the crotch so the legs
  // still part below it); the neighbouring faces keep their own leg.
  const vertices: Map<number, number>[] = [];
  for (let cursor = 0; cursor < output.length;) {
    const count = output[cursor],
      influences = new Map<number, number>();
    for (let j = 0; j < count; j++)
      influences.set(output[cursor + 1 + j * 2], output[cursor + 2 + j * 2]);
    vertices.push(influences);
    cursor += 1 + count * 2;
  }
  const seams = new Map<string, number[]>();
  vertices.forEach((_, v) => {
    const y = mesh.uvs![v * 2 + 1] * 1254;
    if (y < HIP_Y || y > WELD_END_Y) return;
    const key = (mesh.uvs![v * 2] * 1254).toFixed(1) + ',' + y.toFixed(1);
    seams.set(key, [...(seams.get(key) ?? []), v]);
  });
  const leg = new Set(
    ['pelvis', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R'].map(index),
  );
  let welded = 0;
  for (const group of seams.values()) {
    // Only the leg seam: never weld cloth to the far hand's cut edge.
    if (
      group.length < 2 ||
      group.some((v) => [...vertices[v].keys()].some((b) => !leg.has(b)))
    )
      continue;
    const average = new Map<number, number>();
    for (const v of group)
      for (const [bone, w] of vertices[v])
        average.set(bone, (average.get(bone) ?? 0) + w / group.length);
    const y = mesh.uvs![group[0] * 2 + 1] * 1254,
      weld = 1 - smooth(WELD_FULL_Y, WELD_END_Y, y);
    for (const v of group) {
      const own = vertices[v],
        next = new Map<number, number>();
      for (const bone of new Set([...own.keys(), ...average.keys()]))
        next.set(
          bone,
          (own.get(bone) ?? 0) * (1 - weld) + (average.get(bone) ?? 0) * weld,
        );
      vertices[v] = new Map([...next].filter(([, w]) => w > 1e-4));
      welded++;
    }
  }
  mesh.weights = vertices.flatMap((influences) => [
    influences.size,
    ...[...influences].flat(),
  ]);
  return changed + welded;
}
/** Atlas rows (px) over which the leg seam weld fades out toward the crotch. */
const WELD_FULL_Y = 830;
const WELD_END_Y = 865;
