// The cartoonist's cheat for a corrective piece: a forearm and hand that point
// along the camera's view axis are turned back toward the picture plane and given
// a drawn length, so an open palm stays readable instead of being seen end-on.
// It is a camera-dependent rule applied to the FRAME (joints and bases) that drives
// the corrective mesh; the body volume keeps the true frame. `amount` 0 = the true
// frame, 1 = the full cheat; the hand-off ramps it over a few frames (no fades).
import { project, type Camera } from '../core/camera';
import { add, cross, dot, len, mul, norm, rotate, sub } from '../core/math';
import type { Basis, Side, Vec3 } from '../core/types';
import type { PoseFrame } from './rig';

export interface CheatSettings {
  side: Side;
  /** Share of the view-axis component removed from the forearm / hand direction. */
  forearmFlatten: number;
  handFlatten: number;
  /** Drawn lengths (m): elbow -> wrist, wrist -> palm centre. */
  forearmLength: number;
  palmLength: number;
}

function swingBasis(b: Basis, from: Vec3, to: Vec3): Basis {
  const axis = cross(from, to),
    s = len(axis),
    c = dot(from, to);
  if (s < 1e-9) return b;
  const k = norm(axis),
    a = Math.atan2(s, c);
  return { x: rotate(b.x, k, a), y: rotate(b.y, k, a), z: rotate(b.z, k, a) };
}

export function cheatFrame<T extends PoseFrame>(frame: T, camera: Camera, C: CheatSettings, amount: number): T {
  if (amount <= 0) return frame;
  const s = C.side,
    ex = project({ x: 1, y: 0, z: 0 }, camera),
    ey = project({ x: 0, y: 1, z: 0 }, camera),
    ez = project({ x: 0, y: 0, z: 1 }, camera),
    n: Vec3 = { x: ex.depth, y: ey.depth, z: ez.depth }, // the view axis in the world
    flatten = (v: Vec3, share: number) => norm(sub(v, mul(n, dot(v, n) * share * amount)), v),
    elbow = frame.joints[`elbow${s}`],
    fore = sub(frame.joints[`wrist${s}`], elbow),
    foreDir = norm(fore),
    foreNew = flatten(foreDir, C.forearmFlatten),
    foreLength = len(fore) + (C.forearmLength - len(fore)) * amount,
    wrist = add(elbow, mul(foreNew, foreLength)),
    forearm = swingBasis(frame.basis[`forearm${s}`], foreDir, foreNew),
    handTurned = swingBasis(frame.basis[`hand${s}`], foreDir, foreNew),
    palm = sub(frame.joints[`hand${s}`], frame.joints[`wrist${s}`]),
    palmDir = norm(rotateLike(palm, foreDir, foreNew)),
    palmNew = flatten(palmDir, C.handFlatten),
    palmLength = len(palm) + (C.palmLength - len(palm)) * amount,
    hand = swingBasis(handTurned, palmDir, palmNew);
  return {
    ...frame,
    joints: { ...frame.joints, [`wrist${s}`]: wrist, [`hand${s}`]: add(wrist, mul(palmNew, palmLength)) },
    basis: { ...frame.basis, [`forearm${s}`]: forearm, [`hand${s}`]: hand },
  };
}

function rotateLike(v: Vec3, from: Vec3, to: Vec3): Vec3 {
  const axis = cross(from, to),
    s = len(axis);
  if (s < 1e-9) return v;
  return rotate(v, norm(axis), Math.atan2(s, dot(from, to)));
}
