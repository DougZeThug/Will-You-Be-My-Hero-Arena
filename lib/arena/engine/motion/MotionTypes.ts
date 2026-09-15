import {
  motionSignatures,
  type CharacterMotionSignature,
} from './CharacterMotionSignature';
export type Vec2 = { x: number; y: number };
export type MotionPhase =
  | 'settle'
  | 'anticipation'
  | 'load'
  | 'plant'
  | 'acceleration'
  | 'release'
  | 'airborne'
  | 'contact'
  | 'impact'
  | 'followThrough'
  | 'recovery'
  | 'startup'
  | 'active'
  | 'gather'
  | 'rise'
  | 'absorb';
export type MotionLayer =
  | 'base'
  | 'action'
  | 'gaze'
  | 'personality'
  | 'reaction';
export interface MotionMarker {
  name: string;
  at: number;
  foot?: 'left' | 'right';
}
export interface MotionClip {
  id: string;
  native: string;
  duration: number;
  loop?: boolean;
  layer: MotionLayer;
  priority: number;
  fade: number;
  phases: { phase: MotionPhase; at: number }[];
  markers: MotionMarker[];
  cancel?: [number, number][];
  root?: { at: number; x: number; y: number }[];
  rootInterpolation?: 'continuous';
  /** Authored kinetic-chain clips need less additive drive; micro-motion stays active. */
  performanceGain?: number;
  landmarks?: { name: string; at: number }[];
  stride?: number;
  gait?: { stance: number; referenceScale: number; lift: number };
  /** Permit authored heel/forefoot roll with a fixed support point. Other clips keep sole locks. */
  footContactRoll?: boolean;
  mask?: string[];
  moveControl?: number;
  technique?:
    | 'underhand'
    | 'overhead'
    | 'stride'
    | 'jump'
    | 'strike'
    | 'evade'
    | 'impact';
}
export interface MotionEvent extends MotionMarker {
  actionId?: number;
  eventId?: string;
  clip: string;
  time: number;
  cycle: number;
}
export interface MotionPose {
  time: number;
  joints: Record<string, Vec2>;
  root: Vec2;
  /** Visual mass proxy, never a measured biomechanical center of mass. */
  massProxy: Vec2;
}
export interface MotionProfile {
  signature: CharacterMotionSignature;
  id: string;
  handedness: 'right' | 'left';
  heightInches: number;
  acceleration: number;
  deceleration: number;
  turnAcceleration: number;
  topSpeed: number;
  strideScale: number;
  cadence: number;
  gazeLimit: number;
  secondaryGain: number;
  idle: string;
  success: string;
  failure: string;
  performance: {
    looseness: number;
    postureStability: number;
    gestureEnergy: number;
    recoverySpeed: number;
    breathPeriod: number;
    phase: number;
  };
}
export const motionProfiles: Record<'dan' | 'doug', MotionProfile> = {
  dan: {
    signature: motionSignatures.dan,
    id: 'dan',
    handedness: 'right',
    heightInches: 68,
    acceleration: 340,
    deceleration: 460,
    turnAcceleration: 560,
    topSpeed: 215,
    strideScale: 1,
    cadence: 1 / 1.025,
    gazeLimit: 0.055,
    secondaryGain: 0.00006,
    idle: 'idle_breathe',
    success: 'quiet_nod',
    failure: 'reset_nod',
    performance: {
      looseness: 0.28,
      postureStability: 0.9,
      gestureEnergy: 0.5,
      recoverySpeed: 1.18,
      breathPeriod: 4.3,
      phase: 0.7,
    },
  },
  doug: {
    signature: motionSignatures.doug,
    id: 'doug',
    handedness: 'right',
    heightInches: 68,
    acceleration: 430,
    deceleration: 390,
    turnAcceleration: 520,
    topSpeed: 225,
    strideScale: 1.02,
    cadence: 1 / 0.975,
    gazeLimit: 0.075,
    secondaryGain: 0.00008,
    idle: 'weight_shift',
    success: 'celebrate_open_hand',
    failure: 'inspect_hand',
    performance: {
      looseness: 0.72,
      postureStability: 0.7,
      gestureEnergy: 0.74,
      recoverySpeed: 0.88,
      breathPeriod: 3.8,
      phase: 2.4,
    },
  },
};
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export const approach = (a: number, b: number, max: number) =>
  a + clamp(b - a, -max, max);
