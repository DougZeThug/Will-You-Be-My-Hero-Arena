import { expect, test } from 'playwright/test';
import { readFile } from 'node:fs/promises';
import { compilePerformance } from '../../lab/performance/compile';
import {
  assertPerformanceEditorRoundTrip,
  installShippedPerformanceClips,
} from '../../lab/performance/PerformanceClipInstallation';
import type { PerformanceProfile } from '../../lib/arena/engine/performance/PerformanceTypes';
import type { WeightedRigDefinition } from '../../lab/loongbones/arena/RigDefinition';

const clone = <T>(value: T): T => structuredClone(value);

for (const id of ['dan', 'doug'] as const) {
  test(`${id} shipped motion has one validated authority and a complete editor round-trip gate`, async () => {
    const provenance = JSON.parse(
      await readFile(
        'lab/loongbones/assets/cornhole-side-v3/provenance.json',
        'utf8',
      ),
    )[id];
    const definition = {
      id,
      armature: `${id}_side_v3`,
      provenance: { sample: 'side-v3', ...provenance },
    } as WeightedRigDefinition;
    const skeleton = JSON.parse(
      await readFile(
        `lab/loongbones/assets/cornhole-side-v3/${id}_ske.json`,
        'utf8',
      ),
    );
    const arm = skeleton.armature[0];
    const profile = JSON.parse(
      await readFile(
        `lib/arena/engine/performance/profiles/${id}.json`,
        'utf8',
      ),
    ) as PerformanceProfile;
    const compiled = compilePerformance(profile);
    const installed = clone(arm);

    installShippedPerformanceClips(installed, definition, compiled);
    expect(installed.animation).toEqual(compiled.native);
    for (const field of ['bone', 'slot', 'skin', 'ik'] as const)
      expect(installed[field]).toEqual(arm[field]);
    expect(
      installed.animation.every((clip: { name: string }) =>
        clip.name.startsWith('performance_'),
      ),
    ).toBe(true);

    const wrongProfile = clone(compiled);
    wrongProfile.profileId = id === 'dan' ? 'doug' : 'dan';
    expect(() =>
      installShippedPerformanceClips(clone(arm), definition, wrongProfile),
    ).toThrow(/does not match/);
    const wrongCompiler = clone(compiled);
    wrongCompiler.compilerRevision = 'unreviewed-compiler';
    expect(() =>
      installShippedPerformanceClips(clone(arm), definition, wrongCompiler),
    ).toThrow(/compiler revision/);
    const wrongAsset = clone(definition);
    wrongAsset.provenance.attachmentRevision = 3;
    expect(() =>
      installShippedPerformanceClips(clone(arm), wrongAsset, compiled),
    ).toThrow(/asset revision/);
    const collidingAsset = clone(arm);
    collidingAsset.animation.push({
      name: 'performance_underhand',
      duration: 1,
    });
    expect(() =>
      installShippedPerformanceClips(collidingAsset, definition, compiled),
    ).toThrow(/editable performance_\* clip/);

    expect(() =>
      assertPerformanceEditorRoundTrip(
        arm,
        clone(arm),
        compiled,
        clone(compiled),
      ),
    ).not.toThrow();

    const wrongLoop = clone(compiled);
    wrongLoop.native[0].playTimes = 1;
    expect(() =>
      assertPerformanceEditorRoundTrip(arm, clone(arm), compiled, wrongLoop),
    ).toThrow(/curves, durations or loops/);

    const wrongMarker = clone(compiled);
    wrongMarker.clips.get('underhand')!.markers[0].at += 1 / 60;
    expect(() =>
      assertPerformanceEditorRoundTrip(arm, clone(arm), compiled, wrongMarker),
    ).toThrow(/semantic marker timing/);

    const wrongConstraint = clone(arm);
    wrongConstraint.ik[0].bendPositive = !wrongConstraint.ik[0].bendPositive;
    expect(() =>
      assertPerformanceEditorRoundTrip(
        arm,
        wrongConstraint,
        compiled,
        clone(compiled),
      ),
    ).toThrow(/authoritative ik/);

    const wrongPose = clone(compiled);
    const throwClip = wrongPose.native.find(
      (clip) => clip.name === wrongPose.clips.get('underhand')!.native,
    )!;
    for (const frame of throwClip.bone![0].rotateFrame! as {
      rotate: number;
    }[])
      frame.rotate += 1;
    expect(() =>
      assertPerformanceEditorRoundTrip(arm, clone(arm), compiled, wrongPose),
    ).toThrow(/representative performance_underhand pose/);
  });
}
