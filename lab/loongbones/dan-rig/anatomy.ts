/** Source-pixel anatomy of the approved 808×1947 Dan illustration.
 * L/R refer to image sides. Pivots are anatomical centers, not sprite edges.
 * Head pivots at the base of the skull; skull_center is a separate socket. */
export type Vec = { x: number; y: number };
export interface Joint {
  name: string;
  parent?: string;
  point: Vec;
  end?: Vec;
}
const v = (x: number, y: number): Vec => ({ x, y });
export const origin = v(404, 1918);
export const joints: Joint[] = [
  { name: 'root', point: origin },
  { name: 'pelvis', parent: 'root', point: v(407, 1080), end: v(394, 927) },
  {
    name: 'spine_lower',
    parent: 'pelvis',
    point: v(394, 927),
    end: v(391, 791),
  },
  {
    name: 'spine_mid',
    parent: 'spine_lower',
    point: v(391, 791),
    end: v(390, 650),
  },
  { name: 'chest', parent: 'spine_mid', point: v(390, 650), end: v(391, 398) },
  { name: 'neck', parent: 'chest', point: v(391, 398), end: v(390, 348) },
  { name: 'head', parent: 'neck', point: v(390, 348), end: v(389, 194) },
  { name: 'skull_center', parent: 'head', point: v(389, 194) },
  { name: 'clavicle_L', parent: 'chest', point: v(332, 418), end: v(170, 493) },
  {
    name: 'upper_arm_L',
    parent: 'clavicle_L',
    point: v(170, 493),
    end: v(150, 778),
  },
  {
    name: 'forearm_L',
    parent: 'upper_arm_L',
    point: v(150, 778),
    end: v(157, 1000),
  },
  {
    name: 'hand_L',
    parent: 'forearm_L',
    point: v(157, 1000),
    end: v(175, 1090),
  },
  { name: 'off_hand', parent: 'hand_L', point: v(175, 1090) },
  { name: 'clavicle_R', parent: 'chest', point: v(441, 425), end: v(557, 515) },
  {
    name: 'upper_arm_R',
    parent: 'clavicle_R',
    point: v(557, 515),
    end: v(593, 785),
  },
  {
    name: 'forearm_R',
    parent: 'upper_arm_R',
    point: v(593, 785),
    end: v(660, 1000),
  },
  {
    name: 'hand_R',
    parent: 'forearm_R',
    point: v(660, 1000),
    end: v(670, 1090),
  },
  { name: 'throwing_hand', parent: 'hand_R', point: v(670, 1090) },
  { name: 'thigh_L', parent: 'pelvis', point: v(313, 1085), end: v(296, 1338) },
  { name: 'shin_L', parent: 'thigh_L', point: v(296, 1338), end: v(280, 1770) },
  { name: 'foot_L', parent: 'shin_L', point: v(280, 1770), end: v(295, 1915) },
  { name: 'heel_L', parent: 'foot_L', point: v(254, 1915) },
  { name: 'toe_L', parent: 'foot_L', point: v(334, 1915) },
  { name: 'thigh_R', parent: 'pelvis', point: v(477, 1080), end: v(551, 1350) },
  { name: 'shin_R', parent: 'thigh_R', point: v(551, 1350), end: v(512, 1740) },
  { name: 'foot_R', parent: 'shin_R', point: v(512, 1740), end: v(622, 1860) },
  { name: 'heel_R', parent: 'foot_R', point: v(466, 1847) },
  { name: 'toe_R', parent: 'foot_R', point: v(716, 1868) },
  { name: 'foot_target_L', parent: 'root', point: v(280, 1770) },
  { name: 'foot_target_R', parent: 'root', point: v(512, 1740) },
];
export const jointByName = Object.fromEntries(joints.map((j) => [j.name, j]));
export const angle = (a: Vec, b: Vec) => Math.atan2(b.y - a.y, b.x - a.x);
export const angles = Object.fromEntries(
  joints.map((j) => [j.name, j.end ? angle(j.point, j.end) : 0]),
);
export function inverseRotate(p: Vec, a: number): Vec {
  return {
    x: Math.cos(a) * p.x + Math.sin(a) * p.y,
    y: -Math.sin(a) * p.x + Math.cos(a) * p.y,
  };
}
export const bones = joints.map((j) => {
  const p = j.parent ? jointByName[j.parent].point : origin;
  const parentAngle = j.parent ? angles[j.parent] : 0;
  const delta = inverseRotate(
    { x: j.point.x - p.x, y: j.point.y - p.y },
    parentAngle,
  );
  const planted = j.name === 'foot_L' || j.name === 'foot_R';
  const degrees =
    ((angles[j.name] - (planted ? 0 : parentAngle)) * 180) / Math.PI;
  return {
    name: j.name,
    ...(j.parent ? { parent: j.parent } : {}),
    ...(planted ? { inheritRotation: false } : {}),
    length: j.end ? Math.hypot(j.end.x - j.point.x, j.end.y - j.point.y) : 0,
    transform: { x: delta.x, y: delta.y, skX: degrees, skY: degrees },
  };
});
export const bonePose = joints.flatMap((j, i) => [
  i,
  Math.cos(angles[j.name]),
  Math.sin(angles[j.name]),
  -Math.sin(angles[j.name]),
  Math.cos(angles[j.name]),
  j.point.x - origin.x,
  j.point.y - origin.y,
]);
