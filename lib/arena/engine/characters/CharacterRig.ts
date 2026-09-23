import type * as Phaser from 'phaser';
import type { PuppetPose } from '../../puppet-motion';
import type { XY } from '../events/ArenaEvent';
import type { ReleaseFrame } from '../events/ArenaEvent';
import type { LoadedCharacter } from '../scenes/CharacterAssetLoader';
import type { CharacterProfile } from './CharacterProfile';
import type { CharacterPerformanceController } from '../performance/CharacterPerformanceController';
export type SocketName =
  | 'throwingHand'
  | 'offHand'
  | 'head'
  | 'chest'
  | 'waist'
  | 'footL'
  | 'footR'
  | 'effect';
/** Simulated body state for a rig that animates and places itself from it
 * (a side-view motion rig). Presentation skips its root transform. */
export interface RigDriveFrame {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  facing: number;
  /** Body scale (lane depth). */
  scale: number;
  /** Presented session time and the time since the previous drive. */
  time: number;
  dt: number;
  /** Current simulation action clip and its start revision. */
  clip: string;
  clipRevision: number;
  /** Seconds the simulation scheduled for that clip (e.g. a jump's airtime). */
  clipDuration: number;
  substate: string;
  reduced: boolean;
  /** Presentation-only whole-figure squash (volume-preserving scales). */
  squash: { x: number; y: number };
}
export interface CharacterRig {
  readonly root: Phaser.GameObjects.Container;
  drive?(frame: RigDriveFrame): void;
  /** Horizontal draw width during a view turn (1 = open, 0 = edge-on). */
  setViewWidth?(width: number): void;
  readonly backend?: string;
  readonly performance?: CharacterPerformanceController;
  readonly heldObjectLayer?: Phaser.GameObjects.Container;
  debugInfo?(): Record<string, unknown>;
  apply(pose: PuppetPose, clip?: string, progress?: number): void;
  socket(name: SocketName): XY;
  socketTransform?(name: SocketName): XY & { angle: number };
  destroy(): void;
}
/** Authored timelines expose semantic markers and deterministic socket sampling.
 * The host owns the implementation; the engine never imports an editor runtime. */
export interface AuthoredCharacterRig extends CharacterRig {
  readonly continuousThrow?: boolean;
  applyBlend?(
    from: string,
    fromProgress: number,
    to: string,
    toProgress: number,
    weight: number,
  ): void;
  duration(clip: string): number;
  marker(clip: string, name: string): number;
  sampleSocket(name: SocketName, clip: string, progress: number): XY;
  releaseMotion?(clip: string): ReleaseFrame;
}
export function isAuthoredRig(rig: CharacterRig): rig is AuthoredCharacterRig {
  const authored = rig as Partial<AuthoredCharacterRig>;
  return (
    typeof authored.duration === 'function' &&
    typeof authored.marker === 'function' &&
    typeof authored.sampleSocket === 'function'
  );
}
/** Per-game injection avoids global rig registrations leaking between Lab runs. */
export interface CharacterRigProvider {
  preload(scene: Phaser.Scene): void;
  create(
    scene: Phaser.Scene,
    character: LoadedCharacter,
    profile: CharacterProfile,
    placement: { lane: number; scale?: number },
  ): CharacterRig | undefined;
}
