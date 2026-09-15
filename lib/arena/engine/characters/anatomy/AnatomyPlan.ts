/** Authoring landmarks, not a replacement animation runtime or a Spine export.
 * Coordinates are character-local pixels, +Y down, ground at zero.
 * L/R preserve Arena's image-left/image-right convention. */
export const JOINTS = [
  'root',
  'pelvis',
  'spine_lower',
  'spine_mid',
  'chest',
  'neck',
  'head',
  'crown',
  'clavicle_L',
  'shoulder_L',
  'elbow_L',
  'wrist_L',
  'hand_L',
  'clavicle_R',
  'shoulder_R',
  'elbow_R',
  'wrist_R',
  'hand_R',
  'hip_L',
  'knee_L',
  'ankle_L',
  'heel_L',
  'toe_L',
  'hip_R',
  'knee_R',
  'ankle_R',
  'heel_R',
  'toe_R',
] as const;
export type AnatomicalJoint = (typeof JOINTS)[number];
export type Point = { x: number; y: number };
export type LandmarkPose = Record<AnatomicalJoint, Point>;
export const PARENTS: Partial<Record<AnatomicalJoint, AnatomicalJoint>> = {
  pelvis: 'root',
  spine_lower: 'pelvis',
  spine_mid: 'spine_lower',
  chest: 'spine_mid',
  neck: 'chest',
  head: 'neck',
  crown: 'head',
  clavicle_L: 'chest',
  shoulder_L: 'clavicle_L',
  elbow_L: 'shoulder_L',
  wrist_L: 'elbow_L',
  hand_L: 'wrist_L',
  clavicle_R: 'chest',
  shoulder_R: 'clavicle_R',
  elbow_R: 'shoulder_R',
  wrist_R: 'elbow_R',
  hand_R: 'wrist_R',
  hip_L: 'pelvis',
  knee_L: 'hip_L',
  ankle_L: 'knee_L',
  heel_L: 'ankle_L',
  toe_L: 'heel_L',
  hip_R: 'pelvis',
  knee_R: 'hip_R',
  ankle_R: 'knee_R',
  heel_R: 'ankle_R',
  toe_R: 'heel_R',
};
export interface AnatomyPlan {
  id: string;
  revision: number;
  status: 'landmark-proposal';
  coordinates: 'character-local-y-down';
  sideConvention: 'image-left-right';
  setup: LandmarkPose;
  idle: LandmarkPose;
  support: 'L' | 'R';
  targetSupportShare: [number, number];
  sockets: Record<string, AnatomicalJoint>;
  notes: string[];
}
const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
/** A design proxy for projected mass, not a biomechanical measurement or force simulation. */
export function balanceEstimate(p: LandmarkPose) {
  const samples: [Point, number][] = [
    [p.head, 0.08],
    [midpoint(p.chest, p.spine_lower), 0.38],
    [p.pelvis, 0.16],
    ...(['L', 'R'] as const).flatMap(
      (side) =>
        [
          [midpoint(p[`shoulder_${side}`], p[`elbow_${side}`]), 0.025],
          [midpoint(p[`elbow_${side}`], p[`wrist_${side}`]), 0.025],
          [midpoint(p[`hip_${side}`], p[`knee_${side}`]), 0.1],
          [midpoint(p[`knee_${side}`], p[`ankle_${side}`]), 0.04],
        ] as [Point, number][],
    ),
  ];
  const total = samples.reduce((sum, [, weight]) => sum + weight, 0);
  const center = samples.reduce(
    (sum, [point, weight]) => ({
      x: sum.x + (point.x * weight) / total,
      y: sum.y + (point.y * weight) / total,
    }),
    { x: 0, y: 0 },
  );
  const left = midpoint(p.heel_L, p.toe_L),
    right = midpoint(p.heel_R, p.toe_R);
  const span = right.x - left.x,
    shareL = span ? (right.x - center.x) / span : 0.5;
  const supportInterval = [
    Math.min(p.heel_L.x, p.toe_L.x, p.heel_R.x, p.toe_R.x),
    Math.max(p.heel_L.x, p.toe_L.x, p.heel_R.x, p.toe_R.x),
  ];
  return {
    method: 'illustration-mass-proxy' as const,
    center,
    shareL,
    shareR: 1 - shareL,
    supportInterval,
    withinFeet:
      center.x >= supportInterval[0] && center.x <= supportInterval[1],
    note: 'Estimated static load split on level ground; not measured human biomechanics.',
  };
}
export function validateAnatomyPlan(plan: AnatomyPlan): string[] {
  const errors: string[] = [];
  for (const [name, pose] of [
    ['setup', plan.setup],
    ['idle', plan.idle],
  ] as const) {
    const previousErrors = errors.length;
    for (const joint of JOINTS)
      if (
        !pose[joint] ||
        !Number.isFinite(pose[joint].x) ||
        !Number.isFinite(pose[joint].y)
      )
        errors.push(`${name}: invalid ${joint}`);
    if (errors.length > previousErrors) continue;
    if (
      (pose.heel_R.x + pose.toe_R.x) / 2 <=
      (pose.heel_L.x + pose.toe_L.x) / 2
    )
      errors.push(
        `${name}: setup/idle feet must preserve image-left/right order`,
      );
    for (const side of ['L', 'R'] as const) {
      if (
        !(
          pose[`shoulder_${side}`].y > pose.neck.y &&
          pose[`elbow_${side}`].y > pose[`shoulder_${side}`].y
        )
      )
        errors.push(`${name}: shoulder/arm chain ${side}`);
      if (
        !(
          pose[`knee_${side}`].y > pose[`hip_${side}`].y &&
          pose[`ankle_${side}`].y > pose[`knee_${side}`].y
        )
      )
        errors.push(`${name}: leg chain ${side}`);
      if (
        Math.abs(pose[`heel_${side}`].y) > 0.01 ||
        Math.abs(pose[`toe_${side}`].y) > 0.01
      )
        errors.push(`${name}: unplanted foot ${side}`);
    }
    if (!balanceEstimate(pose).withinFeet)
      errors.push(`${name}: projected mass outside support`);
  }
  if (!errors.length) {
    const balance = balanceEstimate(plan.idle),
      share = plan.support === 'L' ? balance.shareL : balance.shareR;
    if (
      share < plan.targetSupportShare[0] ||
      share > plan.targetSupportShare[1]
    )
      errors.push('Idle does not favor the declared support leg.');
  }
  return errors;
}
