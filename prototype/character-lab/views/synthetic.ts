// Synthetic Frames for the view test: a small forward-kinematics pose builder
// that follows INTERFACE.md (right-handed, metres, +Y up, yaw by the right-hand
// rule about +Y, anatomical left/right, a basis per segment). It exists so the
// poser can be judged without core/; it is not an animator.
import { facing, type Basis, type HandPose, type JointName, type Proportions, type SegmentName, type Side, type Vec3, type ViewFrame, type ViewProp } from './contract';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => v(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
const scale = (a: Vec3, k: number): Vec3 => v(a.x * k, a.y * k, a.z * k);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return v(a.x / l, a.y / l, a.z / l);
};
/** cos * a + sin * b */
const mix = (a: Vec3, b: Vec3, angle: number): Vec3 => add(scale(a, Math.cos(angle)), b, Math.sin(angle));
const UP = v(0, 1, 0);
export const rad = (deg: number) => (deg * Math.PI) / 180;

export interface ArmPose {
  /** Shoulder flexion, deg: 0 hangs, 90 points forward, 180 up. */
  forward?: number;
  /** Abduction, deg: + away from the body, - across it. */
  out?: number;
  /** Elbow flexion, deg. */
  elbow?: number;
  /** Where the palm faces: toward the body (default), up, down, forward or back. */
  palm?: 'in' | 'up' | 'down' | 'forward' | 'back';
  hand?: HandPose;
}
export interface LegPose {
  /** Hip flexion, deg: + swings the thigh forward. */
  swing?: number;
  out?: number;
  /** Knee flexion, deg. */
  knee?: number;
  /** Foot pitch, deg: + toes down. */
  foot?: number;
}
export interface Pose {
  /** World facing of the pelvis, deg (right-hand rule about +Y: -90 faces +Z). */
  yaw?: number;
  /** Chest yaw minus pelvis yaw, deg. */
  twist?: number;
  /** Head yaw minus chest yaw, deg. */
  headTurn?: number;
  /** Chest lean, deg: pitch + forward, roll + to its right. */
  pitch?: number;
  roll?: number;
  x?: number;
  z?: number;
  armL?: ArmPose;
  armR?: ArmPose;
  legL?: LegPose;
  legR?: LegPose;
  /** Bean bag held in this hand. */
  bag?: Side;
  /** World-locked feet: keep ankle/heel/toe where a yaw-0 stance puts them. */
  feetLocked?: boolean;
  squash?: number;
}

function basisFrom(x: Vec3, frontHint: Vec3): Basis {
  const bx = norm(x);
  let z = add(frontHint, bx, -dot(frontHint, bx));
  if (Math.hypot(z.x, z.y, z.z) < 1e-4) z = add(UP, bx, -dot(UP, bx));
  z = norm(z);
  return { x: bx, y: cross(z, bx), z };
}

export function buildFrame(p: Proportions, pose: Pose, step = 0): ViewFrame {
  const yaw = rad(pose.yaw ?? -90),
    chestYaw = yaw + rad(pose.twist ?? 0),
    headYaw = chestYaw + rad(pose.headTurn ?? 0),
    f = facing(yaw),
    left = cross(UP, f),
    fc = facing(chestYaw),
    leftC = cross(UP, fc),
    pitch = rad(pose.pitch ?? 0),
    roll = rad(pose.roll ?? 0),
    upC = norm(add(mix(UP, fc, pitch), leftC, -Math.sin(roll))),
    upMid = norm(add(UP, upC)),
    J = {} as Record<JointName, Vec3>,
    B = {} as Record<SegmentName, Basis>;
  J.pelvis = v(pose.x ?? 0, p.pelvisHeight, pose.z ?? 0);
  J.spine = add(J.pelvis, upMid, p.spine);
  J.chest = add(J.spine, upC, p.chestLen);
  J.neck = add(J.chest, upC, p.neck * 0.35);
  J.head = add(J.chest, upC, p.neck);
  J.headTop = add(J.head, norm(add(UP, upC)), p.headLen);
  B.pelvis = basisFrom(upMid, f);
  B.spine = basisFrom(upC, fc);
  B.chest = basisFrom(upC, fc);
  B.head = basisFrom(UP, facing(headYaw));
  for (const s of ['L', 'R'] as Side[]) {
    const sign = s === 'L' ? 1 : -1,
      arm = (s === 'L' ? pose.armL : pose.armR) ?? {},
      leg = (s === 'L' ? pose.legL : pose.legR) ?? {},
      outward = scale(leftC, sign);
    // Arm.
    const a = rad(arm.forward ?? 0),
      shoulder = add(J.chest, outward, p.shoulderWidth / 2),
      down = scale(upC, -1),
      upperDir = norm(mix(mix(down, fc, a), outward, rad(arm.out ?? 4))),
      bend = norm(mix(fc, upC, a)),
      foreDir = norm(mix(upperDir, bend, rad(arm.elbow ?? 8))),
      elbow = add(shoulder, upperDir, p.upperArm),
      wrist = add(elbow, foreDir, p.forearm),
      inward = scale(outward, -1),
      palm = { in: inward, up: UP, down: scale(UP, -1), forward: fc, back: scale(fc, -1) }[arm.palm ?? 'in'];
    J[`shoulder${s}`] = shoulder;
    J[`elbow${s}`] = elbow;
    J[`wrist${s}`] = wrist;
    J[`hand${s}`] = add(wrist, foreDir, p.hand / 2);
    B[`upperArm${s}`] = basisFrom(upperDir, fc);
    B[`forearm${s}`] = basisFrom(foreDir, fc);
    B[`hand${s}`] = basisFrom(foreDir, palm);
    // Leg.
    const hip = add(J.pelvis, scale(left, sign), p.hipWidth / 2),
      swing = rad(leg.swing ?? 0),
      thighDir = norm(mix(mix(scale(UP, -1), f, swing), scale(left, sign), rad(leg.out ?? 0))),
      back = scale(mix(f, UP, swing), -1),
      shinDir = norm(mix(thighDir, back, rad(leg.knee ?? 0))),
      knee = add(hip, thighDir, p.thigh),
      ankle = add(knee, shinDir, p.shin),
      footDir = norm(mix(f, scale(UP, -1), rad(leg.foot ?? 0))),
      heel = add(add(ankle, UP, -p.ankleHeight), footDir, -0.25 * p.footLen);
    J[`hip${s}`] = hip;
    J[`knee${s}`] = knee;
    J[`ankle${s}`] = ankle;
    J[`heel${s}`] = heel;
    J[`toe${s}`] = add(heel, footDir, p.footLen);
    B[`thigh${s}`] = basisFrom(thighDir, f);
    B[`shin${s}`] = basisFrom(shinDir, f);
    B[`foot${s}`] = basisFrom(footDir, UP);
  }
  // Stand on the ground: the lowest heel or toe at y = 0.
  const low = Math.min(J.heelL.y, J.heelR.y, J.toeL.y, J.toeR.y);
  for (const name of Object.keys(J) as JointName[]) J[name] = add(J[name], UP, -low);
  if (pose.feetLocked) {
    const rest = buildFrame(p, { yaw: -90, x: pose.x, z: pose.z });
    for (const name of ['ankleL', 'heelL', 'toeL', 'ankleR', 'heelR', 'toeR'] as JointName[]) J[name] = rest.joints[name];
  }
  const props: ViewProp[] = [];
  if (pose.bag) {
    const hand = B[`hand${pose.bag}`];
    props.push({
      id: 'bag',
      pos: add(J[`hand${pose.bag}`], hand.z, 0.012),
      vel: v(0, 0, 0),
      heldBy: pose.bag,
      basis: { x: hand.x, y: hand.z, z: cross(hand.x, hand.z) },
    });
  }
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  return {
    step,
    joints: J,
    yaw: { pelvis: wrap(yaw), chest: wrap(chestYaw), head: wrap(headYaw) },
    lean: { pitch, roll },
    basis: B,
    hands: { L: pose.armL?.hand ?? 'relaxed', R: pose.armR?.hand ?? 'relaxed' },
    contacts: { footL: true, footR: true },
    props,
    squash: pose.squash ?? 1,
    phase: 'synthetic',
  };
}

/** The same drawings on a deliberately different skeleton. */
export function alterProportions(p: Proportions, change: { legs?: number; torso?: number; shoulders?: number; arms?: number }): Proportions {
  const legs = change.legs ?? 1,
    torso = change.torso ?? 1,
    out = { ...p };
  out.thigh *= legs;
  out.shin *= legs;
  out.pelvisHeight = p.ankleHeight + (p.pelvisHeight - p.ankleHeight) * legs;
  out.spine *= torso;
  out.chestLen *= torso;
  out.shoulderWidth *= change.shoulders ?? 1;
  out.upperArm *= change.arms ?? 1;
  out.forearm *= change.arms ?? 1;
  out.height = out.pelvisHeight + out.spine + out.chestLen + out.neck + out.headLen;
  return out;
}
