import type { WeightedRigDefinition } from '../loongbones/arena/RigDefinition';
import type { NativeClip } from './NativeClip';
import type { CompiledPerformance } from './compile';
import {
  PERFORMANCE_ASSET_REVISION,
  PERFORMANCE_REVISION,
} from './PerformanceAuthority';

type ArmatureData = {
  name: string;
  bone: unknown[];
  slot: unknown[];
  skin: unknown[];
  ik: unknown[];
  animation: NativeClip[];
};

/**
 * Installs the shipped motion authority onto the side-v3 interchange rig.
 *
 * The JSON armature remains authoritative for bind geometry, bones, slots,
 * constraints, material registration and artwork. Its embedded clips are an
 * editor-facing reference library only; they are never a second shipped clip
 * source. Runtime curves, durations, loops and markers come from
 * BodyMechanics, the selected profile and compilePerformance.
 */
export function installShippedPerformanceClips(
  arm: ArmatureData,
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

  // Deliberately replace, rather than merge, the editor reference animations.
  arm.animation = compiled.native;
}

const canonical = (value: unknown) => JSON.stringify(value);
const keyframeAt = (track: object[] | undefined, frame: number) => {
  let cursor = 0;
  for (const key of track ?? []) {
    const duration = (key as { duration?: number }).duration ?? 0;
    if (frame <= cursor + duration) return key;
    cursor += duration;
  }
  return track?.at(-1);
};

/** Acceptance gate for a returned editor export and its motion package. */
export function assertPerformanceEditorRoundTrip(
  authoritativeArm: ArmatureData,
  returnedArm: ArmatureData,
  authoritativeMotion: CompiledPerformance,
  returnedMotion: CompiledPerformance,
): void {
  for (const field of ['bone', 'slot', 'skin', 'ik'] as const)
    if (canonical(returnedArm[field]) !== canonical(authoritativeArm[field]))
      throw Error(`Editor round trip changed authoritative ${field}`);

  const expectedClips = [...authoritativeMotion.clips.values()];
  const returnedClips = [...returnedMotion.clips.values()];
  if (
    canonical(
      returnedClips.map(({ id, duration, loop, markers }) => ({
        id,
        duration,
        loop: loop === true,
        markers,
      })),
    ) !==
    canonical(
      expectedClips.map(({ id, duration, loop, markers }) => ({
        id,
        duration,
        loop: loop === true,
        markers,
      })),
    )
  )
    throw Error('Editor round trip changed clip or semantic marker timing');

  // Named pose gates make the review intent explicit even though the complete
  // curves above are also compared. Frame indices correspond to preparation,
  // release, follow-through and recovery in the shipped underhand take.
  const underhand = authoritativeMotion.clips.get('underhand')!;
  const poses: [string, number][] = [
    [underhand.native, Math.round(underhand.duration * 60 * 0.29)],
    [
      underhand.native,
      Math.round(
        underhand.markers.find((m) => m.name === 'equipmentRelease')!.at * 60,
      ),
    ],
    [underhand.native, Math.round(underhand.duration * 60 * 0.71)],
    [
      authoritativeMotion.clips.get('recover')!.native,
      Math.round(authoritativeMotion.clips.get('recover')!.duration * 60),
    ],
  ];
  for (const [clipName, frame] of poses) {
    const expected = authoritativeMotion.native.find(
      (clip) => clip.name === clipName,
    )!;
    const returned = returnedMotion.native.find(
      (clip) => clip.name === clipName,
    )!;
    for (let bone = 0; bone < (expected.bone?.length ?? 0); bone++) {
      const a = expected.bone![bone];
      const b = returned.bone?.[bone];
      const pose = {
        rotate: keyframeAt(a.rotateFrame, frame),
        translate: keyframeAt(a.translateFrame, frame),
      };
      const candidate = {
        rotate: keyframeAt(b?.rotateFrame, frame),
        translate: keyframeAt(b?.translateFrame, frame),
      };
      if (canonical(candidate) !== canonical(pose))
        throw Error(
          `Editor round trip changed representative ${clipName} pose at frame ${frame}`,
        );
    }
  }
  if (
    canonical(returnedMotion.native) !== canonical(authoritativeMotion.native)
  )
    throw Error(
      'Editor round trip changed performance curves, durations or loops',
    );
}
