import type { CharacterId } from '../characters/CharacterIds';
import type { CharacterMotionSignature } from './CharacterMotionSignature';
export type Vec2 = { x: number; y: number };
export type { CharacterId };
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
    breathPeriod: number;
    phase: number;
  };
}
