/** DragonBones 5.5 packs geometry/weight offsets into 16-bit integer arrays.
 * Reject oversized layered exports before those offsets can wrap silently.
 * Formulas mirror the pinned upstream ObjectDataParser._parseGeometry. */
export function assertInterchangeBudget(
  meshes: {
    vertices: number[];
    triangles: number[];
    weights: number[];
    bonePose: number[];
  }[],
) {
  let floats = 0,
    ints = 0;
  for (const mesh of meshes) {
    const vertices = mesh.vertices.length / 2,
      influences = (mesh.weights.length - vertices) / 2;
    if (vertices >= 32768 || mesh.triangles.length / 3 >= 32768)
      throw Error(
        'LoongBones mesh count exceeds the supported interchange range',
      );
    ints +=
      4 +
      mesh.triangles.length +
      2 +
      mesh.bonePose.length / 7 +
      vertices +
      influences;
    floats += vertices * 4 + influences * 3;
    if (floats >= 65536 || ints >= 65536)
      throw Error(
        'LoongBones layered geometry exceeds 16-bit offsets; reduce topology density, not texture resolution',
      );
  }
  return { floats, ints, maxOffset: 65535 };
}
