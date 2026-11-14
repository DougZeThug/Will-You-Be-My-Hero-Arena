import type { PerformanceProfile } from '../../lib/arena/engine/performance/PerformanceTypes';
import type { MotionClip } from '../../lib/arena/engine/motion/MotionTypes';
import type { NativeClip } from './NativeClip';
import type { WeightedRigDefinition } from '../loongbones/arena/RigDefinition';
import { createClipEmitter } from './ClipEmitter';
import { authorPerformancePoses } from './PerformancePoses';
import { PERFORMANCE_REVISION } from './revision';
export { PERFORMANCE_REVISION };
const PERFORMANCE_ASSET_REVISION = 'side-v3-attachment-r4';

export type PerformanceArmatureData = {
  name: string;
  bone: unknown[];
  slot: unknown[];
  skin: unknown[];
  ik: unknown[];
  animation: NativeClip[];
};

/** One full-body pose compiler. Action owns articulated support, spine and arms;
 * the adapter then applies bounded gaze, native contact IK and hand exposure. */
export interface CompiledPerformance {
  profileId: string;
  compilerRevision: string;
  assetRevision: string;
  native: NativeClip[];
  clips: Map<string, MotionClip>;
}

/** Validate the side-v3/profile/compiler contract before replacing reference clips. */
export function installShippedPerformanceClips(
  arm: PerformanceArmatureData,
  definition: WeightedRigDefinition,
  compiled: CompiledPerformance,
): void {
  const provenance = definition.provenance;
  if (compiled.profileId !== definition.id)
    throw Error(
      `Performance profile ${compiled.profileId} does not match ${definition.id}`,
    );
  if (compiled.compilerRevision !== PERFORMANCE_REVISION)
    throw Error(
      `Performance compiler revision ${compiled.compilerRevision} does not match ${PERFORMANCE_REVISION}`,
    );
  if (
    provenance.sample !== 'side-v3' ||
    provenance.attachmentRevision !== 4 ||
    compiled.assetRevision !== PERFORMANCE_ASSET_REVISION
  )
    throw Error(
      `Performance asset revision is not ${PERFORMANCE_ASSET_REVISION}`,
    );
  if (arm.name !== definition.armature)
    throw Error(
      `Performance armature ${arm.name} does not match ${definition.armature}`,
    );
  if (arm.animation.some((clip) => clip.name.startsWith('performance_')))
    throw Error(
      'Side-v3 asset must not contain an editable performance_* clip',
    );

  // Replace rather than merge: embedded clips are editor references, not a
  // second shipped source for curves, durations, loops, or semantic markers.
  arm.animation = compiled.native;
}


/**
 * Sole compiler for shipped cornhole motion. The character's take supplies
 * the curves (authored now, captured later), the validated profile supplies
 * timing/amplitude gains, and this function owns native per-frame curves,
 * durations, loop counts, overlap and semantic markers.
 */
export function compilePerformance(p: PerformanceProfile): CompiledPerformance {
  const native: NativeClip[] = [],
    clips = new Map<string, MotionClip>();
  const emit = createClipEmitter(p, native, clips);
  authorPerformancePoses(p, emit);
  return {
    profileId: p.id,
    compilerRevision: PERFORMANCE_REVISION,
    assetRevision: PERFORMANCE_ASSET_REVISION,
    native,
    clips,
  };
}
