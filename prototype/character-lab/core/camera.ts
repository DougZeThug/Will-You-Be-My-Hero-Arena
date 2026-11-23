// The ONLY projection both halves of the Character Lab use (see ../INTERFACE.md),
// and the owner of the yaw convention: `facing()` and `viewAngle()`.
// Orthographic, yaw about +Y (right-hand rule), small fixed downward pitch.
// Output is in metres on the view plane: +x = screen right, +y = screen UP,
// depth = toward the viewer (larger depth is nearer the camera, so draw in
// ascending depth order).
import type { Vec3 } from './types';

export interface Camera {
  yaw: number; // the lab's "viewing angle"; at 0, +X is screen-right and +Z is toward the viewer
  pitch: number; // radians the camera looks down by
}

export const CAMERA_PITCH = (8 * Math.PI) / 180;

export function makeCamera(yaw = 0, pitch = CAMERA_PITCH): Camera {
  return { yaw, pitch };
}

/** World facing of a yaw: right-hand rule about +Y. Yaw 0 -> +X, +90 deg -> -Z, -90 deg -> +Z. */
export function facing(yaw: number): Vec3 {
  return { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
}

/** Yaw whose facing is the ground direction (x, z). */
export function yawOfDirection(x: number, z: number): number {
  return Math.atan2(-z, x);
}

export interface Projected {
  x: number;
  y: number;
  depth: number;
}

export function project(p: Vec3, cam: Camera): Projected {
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  const right = p.x * c - p.z * s; // camera-right = facing(cam.yaw) = (cos, 0, -sin)
  const toward = p.x * s + p.z * c; // toward the viewer = (sin, 0, cos)
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  return { x: right, y: p.y * cp - toward * sp, depth: toward * cp + p.y * sp };
}

/**
 * A block's facing relative to the camera, wrapped to (-pi, pi]:
 *   0 = profile facing screen-right (`side`), +90 deg = facing the viewer (`front`),
 *   180 deg = profile facing screen-left (mirrored `side`), -90 deg = facing away (`back`).
 * Orbiting the camera by +a is the same as turning the character by -a.
 */
export function viewAngle(blockYaw: number, camYaw: number): number {
  let a = (camYaw - blockYaw) % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/** The world yaw a block needs so that it shows the given view angle to a camera. */
export function yawForViewAngle(angle: number, camYaw: number): number {
  return camYaw - angle;
}

/** World ground direction for a screen-space direction (dx right, dy "into the screen"), for camera-relative input. */
export function screenToGround(dx: number, dy: number, cam: Camera): { x: number; z: number } {
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  // right = (c, -s); away from the viewer = (-s, -c)
  return { x: dx * c - dy * s, z: -dx * s - dy * c };
}
