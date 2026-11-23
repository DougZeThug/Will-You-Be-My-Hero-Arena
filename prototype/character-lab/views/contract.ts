// What the views half consumes. Joint and segment names, Vec3, Basis,
// Proportions, `facing()` and the projection all come from core/; the frame
// type here is core's Frame with every orientation field optional, so the
// poser also runs on frames that only carry positions and yaws.
import { facing } from '../core/camera';
import type { Basis, JointName, Proportions, SegmentName, Vec3 } from '../core/types';

export { facing };
export type { Basis, JointName, Proportions, SegmentName, Vec3 };

export type HandPose = 'relaxed' | 'open' | 'grip';
export type Side = 'L' | 'R';

export interface ViewProp {
  id: string;
  pos: Vec3;
  vel?: Vec3;
  heldBy: Side | null;
  /** Full orientation. The bag is flat across its local y (x and z span its face). */
  basis?: Basis;
  /** Older frames: one spin angle about the vertical. */
  angle?: number;
}

export interface ViewFrame {
  step: number;
  joints: Record<JointName, Vec3>;
  yaw: { pelvis: number; chest: number; head: number };
  lean?: { pitch: number; roll: number };
  basis?: Partial<Record<SegmentName, Basis>>;
  hands: { L: HandPose; R: HandPose };
  contacts?: { footL: boolean; footR: boolean };
  props?: ViewProp[];
  squash?: number;
  phase?: string;
}

export interface ViewCamera {
  yaw: number;
  pitch: number;
}
export interface Projected {
  x: number;
  y: number;
  depth: number;
}
export type ProjectFn = (p: Vec3, cam: ViewCamera) => Projected;

/**
 * View angle of a world direction, defined through the projection itself so it
 * cannot disagree with it: 0 = points screen-right (profile), +90 deg = points
 * at the viewer (front), 180 = screen-left (mirrored profile), -90 = away (back).
 */
export function viewAngleOf(direction: Vec3, cam: ViewCamera, project: ProjectFn): number {
  const flat: ViewCamera = { yaw: cam.yaw, pitch: 0 },
    o = project({ x: 0, y: 0, z: 0 }, flat),
    p = project({ x: direction.x, y: 0, z: direction.z }, flat);
  return Math.atan2(p.depth - o.depth, p.x - o.x);
}

export type ViewKind = 'side' | 'sideRear' | 'front' | 'back';
export type CanonicalAngle =
  | 'side' | 'threeQuarterFront' | 'front' | 'threeQuarterBack' | 'back';
