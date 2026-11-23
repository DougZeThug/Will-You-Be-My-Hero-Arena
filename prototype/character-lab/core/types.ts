// Shared contract types for the Character Lab (see ../INTERFACE.md).
// Space: right-handed, metres, +Y up, ground at Y = 0. Yaw follows the right-hand
// rule about +Y (counter-clockwise seen from above), so for a facing yaw t:
//   facing = (cos t, 0, -sin t)     anatomical right = (sin t, 0, cos t)
// Yaw 0 faces +X, +90 deg faces -Z (away from the viewer at camera yaw 0), -90 deg
// faces +Z. A character facing screen-right at camera yaw 0 shows its RIGHT side.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const JOINT_NAMES = [
  'pelvis',
  'spine',
  'chest',
  'neck',
  'head',
  'headTop',
  'shoulderL',
  'elbowL',
  'wristL',
  'handL',
  'shoulderR',
  'elbowR',
  'wristR',
  'handR',
  'hipL',
  'kneeL',
  'ankleL',
  'heelL',
  'toeL',
  'hipR',
  'kneeR',
  'ankleR',
  'heelR',
  'toeR',
] as const;

/**
 * Joint semantics beyond INTERFACE.md:
 * - `neck` is the base of the neck (35% of the way from `chest` to `head`);
 *   `head` is the skull pivot at jaw level; `headTop` the crown.
 * - `handL/R` is the palm centre (wrist + half the hand length).
 * - `heel` is the back-bottom of the heel, `toe` the tip of the toes.
 */
export type JointName = (typeof JOINT_NAMES)[number];

export type Side = 'L' | 'R';
export type HandPose = 'relaxed' | 'open' | 'grip';

export interface Basis {
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

export const SEGMENT_NAMES = [
  'pelvis',
  'spine',
  'chest',
  'head',
  'upperArmL',
  'upperArmR',
  'forearmL',
  'forearmR',
  'handL',
  'handR',
  'thighL',
  'thighR',
  'shinL',
  'shinR',
  'footL',
  'footR',
] as const;

/**
 * Segment bases (world axes, orthonormal, y = z cross x):
 * - x runs along the bone, parent -> child (pelvis/spine/chest/head: up the body;
 *   foot: heel -> ball along the sole; hand: toward the fingers).
 * - z is the anatomical front: pelvis/spine/chest front, the face, the kneecap
 *   side of thigh and shin, the top (instep) of the foot. For the arm, as the
 *   contract words it, the inner elbow crease is -z: upperArm z points to the
 *   elbow point; forearm z is the BACK-of-hand side at the wrist (it carries the
 *   forearm's pronation/supination); hand z is the palm normal, out of the palm.
 */
export type SegmentName = (typeof SEGMENT_NAMES)[number];

export interface PropState {
  id: string;
  pos: Vec3;
  vel: Vec3;
  heldBy: Side | null;
  /** Full orientation. The bag is flat across its local y (x and z span its face). Rigid in the hand's basis while held. */
  basis: Basis;
}

export interface Frame {
  step: number;
  joints: Record<JointName, Vec3>; // world positions
  yaw: { pelvis: number; chest: number; head: number }; // world facing of each block, wrapped to (-pi, pi]
  lean: { pitch: number; roll: number }; // chest relative to vertical (pitch + = forward, roll + = toward its right)
  basis: Record<SegmentName, Basis>; // world orientation of every segment (see SegmentName)
  hands: { L: HandPose; R: HandPose };
  contacts: { footL: boolean; footR: boolean }; // planted (world-locked) this step
  props: PropState[];
  squash: number; // root-level only, 1 = rest
  phase: string; // debug label of what the animator is doing
}

export interface Proportions {
  // metres
  height: number;
  pelvisHeight: number; // standing height of the pelvis joint with straight legs
  spine: number; // pelvis -> spine
  chestLen: number; // spine -> chest
  neck: number; // chest -> head (the `neck` joint sits 35% along it)
  headLen: number; // head -> headTop
  shoulderWidth: number; // shoulder joint to shoulder joint
  hipWidth: number; // hip joint to hip joint
  upperArm: number;
  forearm: number;
  hand: number; // wrist -> fingertips; the palm centre is at half of it
  thigh: number;
  shin: number;
  footLen: number; // heel -> toe tip
  ankleHeight: number;
}

/** Canonical view names; angles are `viewAngle(blockYaw, camYaw)` from ./camera (0 = profile facing screen-right, +90 deg = front). */
export type ViewName =
  | 'side' // facing camera-right (0)
  | 'threeQuarterFront' // +45 deg
  | 'front' // +90 deg, facing the camera
  | 'threeQuarterFrontLeft' // +135 deg
  | 'sideLeft' // 180 deg
  | 'threeQuarterBackLeft' // -135 deg
  | 'back' // -90 deg, facing away
  | 'threeQuarterBack'; // -45 deg

export const VIEW_ANGLE: Record<ViewName, number> = {
  side: 0,
  threeQuarterFront: Math.PI / 4,
  front: Math.PI / 2,
  threeQuarterFrontLeft: (3 * Math.PI) / 4,
  sideLeft: Math.PI,
  threeQuarterBackLeft: (-3 * Math.PI) / 4,
  back: -Math.PI / 2,
  threeQuarterBack: -Math.PI / 4,
};

export type Command =
  | { type: 'move'; x: number; z: number } // world ground direction, magnitude 0..1 = speed fraction
  | { type: 'stop' }
  | { type: 'face'; yaw: number } // world yaw
  | { type: 'turnTo'; view: ViewName; camYaw?: number } // view angle relative to the camera yaw (default 0)
  | { type: 'reach' } // go to the prop and put the open hand on it
  | { type: 'grip' } // close the hand; reaches first if needed
  | { type: 'place' } // put the held prop back on its stand
  | { type: 'toss'; power: number; yaw?: number } // 0..1, underhand, along the facing goal; `yaw` = turn to this world yaw WHILE throwing
  | { type: 'hit'; dirYaw: number; strength: 'light' | 'heavy' } // dirYaw = world direction the blow pushes toward
  | { type: 'placeProp'; x: number; z: number; relative?: boolean }; // move the stand (and the prop, unless it is in a hand); relative = offset from the character

export const DT = 1 / 60;
