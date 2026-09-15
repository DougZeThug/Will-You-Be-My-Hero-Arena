export type Vec = { x: number; y: number };
export interface Joint {
  name: string;
  parent?: string;
  point: Vec;
  end?: Vec;
}
/** Source-space joints → DragonBones parent-local bind transforms. */
export function buildSkeleton(joints: Joint[], origin: Vec) {
  const byName = Object.fromEntries(joints.map((j) => [j.name, j]));
  const angles = Object.fromEntries(
    joints.map((j) => [
      j.name,
      j.end ? Math.atan2(j.end.y - j.point.y, j.end.x - j.point.x) : 0,
    ]),
  );
  const bones = joints.map((j) => {
    const p = j.parent ? byName[j.parent].point : origin,
      a = j.parent ? angles[j.parent] : 0;
    const x = j.point.x - p.x,
      y = j.point.y - p.y,
      planted = j.name === 'foot_L' || j.name === 'foot_R';
    const degrees = ((angles[j.name] - (planted ? 0 : a)) * 180) / Math.PI;
    return {
      name: j.name,
      ...(j.parent ? { parent: j.parent } : {}),
      ...(planted ? { inheritRotation: false } : {}),
      length: j.end ? Math.hypot(j.end.x - j.point.x, j.end.y - j.point.y) : 0,
      transform: {
        x: Math.cos(a) * x + Math.sin(a) * y,
        y: -Math.sin(a) * x + Math.cos(a) * y,
        skX: degrees,
        skY: degrees,
      },
    };
  });
  const bonePose = joints.flatMap((j, i) => [
    i,
    Math.cos(angles[j.name]),
    Math.sin(angles[j.name]),
    -Math.sin(angles[j.name]),
    Math.cos(angles[j.name]),
    j.point.x - origin.x,
    j.point.y - origin.y,
  ]);
  return { bones, bonePose };
}
