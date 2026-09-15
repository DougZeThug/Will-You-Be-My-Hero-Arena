import type * as Phaser from 'phaser';
import type { PuppetPose } from '../../puppet-motion';
import type { XY } from '../events/ArenaEvent';
import type { ReleaseFrame } from '../events/ArenaEvent';
import type { LoadedCharacter } from '../scenes/CharacterAssetLoader';
import type { CharacterProfile } from './CharacterProfile';
export type SocketName =
  | 'throwingHand'
  | 'offHand'
  | 'head'
  | 'chest'
  | 'waist'
  | 'footL'
  | 'footR'
  | 'effect';
export interface CharacterRig {
  readonly root: Phaser.GameObjects.Container;
  readonly backend?: string;
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
    placement: { lane: number },
  ): CharacterRig | undefined;
}
