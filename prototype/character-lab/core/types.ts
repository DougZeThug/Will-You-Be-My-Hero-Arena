// Shared contract types for the Character Lab (see ../INTERFACE.md).
// Space: right-handed, metres, +Y up, ground at Y = 0. Yaw is about +Y, yaw 0
// faces +X and positive yaw turns the facing toward +Z, so for a facing yaw t:
//   forward = (cos t, 0, sin t)     right = (-sin t, 0, cos t)
// (a character facing screen-right at camera yaw 0 shows the viewer its RIGHT side).

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

export interface PropState {
  id: string;
  pos: Vec3;
  vel: Vec3;
  angle: number;
  heldBy: Side | null;
}

export interface Frame {
  step: number;
  joints: Record<JointName, Vec3>; // world positions
  yaw: { pelvis: number; chest: number; head: number }; // world facing of each block, wrapped to (-pi, pi]
  lean: { pitch: number; roll: number }; // chest relative to vertical (pitch + = forward, roll + = toward its right)
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

/** Canonical view names; a view angle is a block's world yaw minus the camera yaw. */
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
  | { type: 'toss'; power: number } // 0..1, underhand, along the facing
  | { type: 'hit'; dirYaw: number; strength: 'light' | 'heavy' } // dirYaw = world direction the blow pushes toward
  | { type: 'placeProp'; x: number; z: number }; // move the stand (and the prop, unless it is in a hand)

export const DT = 1 / 60;
