import type { JointPoint } from './puppet-geometry';

type Arm = { root: JointPoint; joint: JointPoint; end: JointPoint };
const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

/** A separate wrist inside the existing continuous illustration. Angle is a
 * local bend, not a rotation of the sleeve. The hand socket follows this same
 * transform, so held equipment cannot lag behind a wrist articulation. */
export function handFrame(arm: Arm, angle = 0) {
  const length = Math.max(.001, Math.hypot(arm.end.x - arm.joint.x, arm.end.y - arm.joint.y));
  const dx = (arm.end.x - arm.joint.x) / length, dy = (arm.end.y - arm.joint.y) / length;
  const palmLength = 12;
  const wrist = { x: arm.end.x - dx * palmLength, y: arm.end.y - dy * palmLength };
  const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const direction = { x: dx * c - dy * s, y: dx * s + dy * c };
  return { wrist, direction, palm: { x: wrist.x + direction.x * palmLength, y: wrist.y + direction.y * palmLength }, c, s };
}

export function deformHand(point: JointPoint, frame: ReturnType<typeof handFrame>, arc: number, totalLength: number, width = 1): JointPoint {
  const weight = smooth((arc - (1 - 12 / totalLength) + .025) / .065);
  if (!weight) return point;
  const dx = point.x - frame.wrist.x, dy = point.y - frame.wrist.y;
  const x = dx * frame.c - dy * frame.s, y = dx * frame.s + dy * frame.c;
  const along = x * frame.direction.x + y * frame.direction.y;
  const cross = (-x * frame.direction.y + y * frame.direction.x) * width;
  const target = { x: frame.wrist.x + frame.direction.x * along - frame.direction.y * cross, y: frame.wrist.y + frame.direction.y * along + frame.direction.x * cross };
  return { x: point.x + (target.x - point.x) * weight, y: point.y + (target.y - point.y) * weight };
}
