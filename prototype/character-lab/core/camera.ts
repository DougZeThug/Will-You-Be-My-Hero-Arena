// The ONLY projection both halves of the Character Lab use (see ../INTERFACE.md).
// Orthographic, yaw about +Y, small fixed downward pitch. Output is in metres on
// the view plane: +x = screen right, +y = screen UP, depth = toward the viewer
// (larger depth is nearer the camera, so draw in ascending depth order).
import type { Vec3 } from './types';

export interface Camera {
  yaw: number; // the lab's "viewing angle"; 0 looks along -Z with +X to the right
  pitch: number; // radians the camera looks down by
}

export const CAMERA_PITCH = (8 * Math.PI) / 180;

export function makeCamera(yaw = 0, pitch = CAMERA_PITCH): Camera {
  return { yaw, pitch };
}

export interface Projected {
  x: number;
  y: number;
  depth: number;
}

export function project(p: Vec3, cam: Camera): Projected {
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  const right = p.x * c + p.z * s; // camera-right = (cos yaw, 0, sin yaw)
  const toward = -p.x * s + p.z * c; // toward the viewer = (-sin yaw, 0, cos yaw)
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  return { x: right, y: p.y * cp - toward * sp, depth: toward * cp + p.y * sp };
}

/** View angle of a block (INTERFACE.md): 0 profile facing right, +90 deg front, 180 left, -90 deg back. */
export function viewAngle(worldYaw: number, cam: Camera): number {
  let a = (worldYaw - cam.yaw) % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/** World ground direction for a screen-space direction (dx right, dy "into the screen"), for camera-relative input. */
export function screenToGround(dx: number, dy: number, cam: Camera): { x: number; z: number } {
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  // right = (c, s); away from the viewer = (s, -c)
  return { x: dx * c + dy * s, z: dx * s - dy * c };
}
