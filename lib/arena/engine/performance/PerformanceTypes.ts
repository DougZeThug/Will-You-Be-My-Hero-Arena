import type { AnimationGraph } from '../motion/AnimationGraph';
import type { MotionClip, Vec2 } from '../motion/MotionTypes';
import type { ReleaseKinematics } from '../equipment/AttachmentManager';

export type PerformanceState =
  | 'idle'
  | 'notice'
  | 'settle'
  | 'anticipate'
  | 'windup'
  | 'drive'
  | 'release'
  | 'followThrough'
  | 'watchTarget'
  | 'reactPositive'
  | 'reactNegative'
  | 'celebrate'
  | 'recover';
export type PerformanceEventName =
  | 'ACTION_STARTED'
  | 'STATE_CHANGED'
  | 'ANTICIPATION_STARTED'
  | 'WINDUP_STARTED'
  | 'OBJECT_ATTACHED'
  | 'OBJECT_RELEASED'
  | 'OBJECT_CONTACT'
  | 'FOLLOW_THROUGH_STARTED'
  | 'RESULT_CONFIRMED'
  | 'REACTION_STARTED'
  | 'CELEBRATION_STARTED'
  | 'CELEBRATION_CONTACT'
  | 'CELEBRATION_COMPLETED'
  | 'ACTION_COMPLETED'
  | 'ACTION_CANCELLED'
  | 'VALIDATION_WARNING';
export interface PerformanceEvent {
  name: PerformanceEventName;
  actionId: number;
  action: string;
  time: number;
  state: PerformanceState;
  detail?: string;
  objectId?: string;
  release?: ReleaseKinematics;
}
export interface PerformanceProfile {
  id: string;
  movementTempo: number;
  stanceWidth: number;
  posture: number;
  confidence: number;
  backswing: number;
  releaseLift: number;
  followThrough: number;
  finishRetention: number;
  recoveryDuration: number;
  weightTransfer: number;
  reactionIntensity: number;
  idleEnergy: number;
  restShift: number;
  restCompression: number;
  attentionLean: number;
  perception: number;
  celebration: 'chestTap' | 'nod';
}
/** Low-priority posture context. Fixed facial art permits small head/neck pitch,
 * not eye tracking or a turn to an unauthored body view. */
export interface PerformanceObservation {
  mode: 'rest' | 'prepare' | 'flight' | 'acknowledge';
  elapsed: number;
  attemptId?: string;
  targetActor?: number;
  target?: Vec2;
}
export interface PerformanceRequest {
  objectId?: string;
  target?: Vec2;
  priority?: number;
  queue?: boolean;
  onComplete?: (outcome: 'completed' | 'cancelled') => void;
}
export interface PerformanceSegment {
  state: PerformanceState;
  clip: string;
  duration?: number;
  interruptible?: boolean;
  waitForResult?: boolean;
  phases?: { at: number; state: PerformanceState }[];
}
export interface PerformanceAction {
  name: string;
  priority: number;
  requiresObject?: boolean;
  /** The caller already owns notice/settle (live input stages the ritual
   * before release). Only the FIRST segment may then begin from idle, and
   * only in a state a settled body enters. */
  preparation?: 'external';
  segments: PerformanceSegment[];
}
/** No Phaser, bone names, timers, scene objects or scoring in this contract. */
export interface CharacterAnimationRuntime {
  readonly clips: ReadonlyMap<string, MotionClip>;
  evaluate(
    graph: AnimationGraph,
    dt: number,
    time: number,
    target: Vec2 | undefined,
    held: boolean,
  ): void;
  attachment(name: 'rightHand' | 'leftHand'): {
    x: number;
    y: number;
    angle: number;
    scale?: number;
    flatten?: number;
  };
  reset(): void;
  destroy(): void;
}
