export type Vec = { x: number; y: number };
export interface Joint {
  name: string;
  parent?: string;
  point: Vec;
  end?: Vec;
}

/** Source-space joints converted to DragonBones parent-local bind transforms. */
export function buildSkeleton(joints: Joint[], origin: Vec) {
  const byName = Object.fromEntries(joints.map((joint) => [joint.name, joint]));
  const angles = Object.fromEntries(
    joints.map((joint) => [
      joint.name,
      joint.end
        ? Math.atan2(joint.end.y - joint.point.y, joint.end.x - joint.point.x)
        : 0,
    ]),
  );
  const bones = joints.map((joint) => {
    const parentPoint = joint.parent ? byName[joint.parent].point : origin;
    const parentAngle = joint.parent ? angles[joint.parent] : 0;
    const x = joint.point.x - parentPoint.x;
    const y = joint.point.y - parentPoint.y;
    const planted = joint.name === 'foot_L' || joint.name === 'foot_R';
    const degrees =
      ((angles[joint.name] - (planted ? 0 : parentAngle)) * 180) / Math.PI;
    return {
      name: joint.name,
      ...(joint.parent ? { parent: joint.parent } : {}),
      ...(planted ? { inheritRotation: false } : {}),
      length: joint.end
        ? Math.hypot(joint.end.x - joint.point.x, joint.end.y - joint.point.y)
        : 0,
      transform: {
        x: Math.cos(parentAngle) * x + Math.sin(parentAngle) * y,
        y: -Math.sin(parentAngle) * x + Math.cos(parentAngle) * y,
        skX: degrees,
        skY: degrees,
      },
    };
  });
  const bonePose = joints.flatMap((joint, index) => [
    index,
    Math.cos(angles[joint.name]),
    Math.sin(angles[joint.name]),
    -Math.sin(angles[joint.name]),
    Math.cos(angles[joint.name]),
    joint.point.x - origin.x,
    joint.point.y - origin.y,
  ]);
  return { bones, bonePose };
}
