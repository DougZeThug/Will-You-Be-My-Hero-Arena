import type { Attempt, Recording, Sport } from '../../model';
import type { DirectedAction } from '../core/BattlePlan';
export interface XY {
  x: number;
  y: number;
}
/** Optional evaluated release kinematics; absent on historical renderers. */
export interface ReleaseFrame extends XY {
  velocity?: XY;
  angle?: number;
  angularVelocity?: number;
  scale?: number;
  flatten?: number;
}
export interface ProjectileFrame extends XY {
  angle: number;
  scale: number;
  flatten: number;
  alpha: number;
  ground: XY;
  /** Registered front lip; mask only the part descending behind the board. */
  occlusion?: { x: number; y: number; slope: number };
  kinematics?: {
    model: string;
    velocity: XY;
    initialVelocity: XY;
    acceleration: XY;
    airTime: number;
    phase: string;
  };
}
export interface PersistentObject {
  id: string;
  actor: number;
  frame: ProjectileFrame;
}
export interface ArenaEvent {
  readonly sport: Sport;
  initialize(recording: Recording): void;
  playIntro(): { equipment: string; lanes: number };
  performAction(
    attempt: Attempt,
    direction: DirectedAction,
    release: ReleaseFrame,
    time: number,
  ): ProjectileFrame;
  resolveResult(attempt: Attempt): { points: number; outcome: string };
  persistentObjects(time: number): PersistentObject[];
  playReaction(direction: DirectedAction): string;
  finish(): void;
}
