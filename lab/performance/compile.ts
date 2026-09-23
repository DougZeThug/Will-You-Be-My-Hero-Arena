import {
  underhandMechanics,
  type BodyChannel,
  type BodyTake,
} from '../../lib/arena/engine/performance/BodyMechanics';
import type { PerformanceProfile } from '../../lib/arena/engine/performance/PerformanceTypes';
import type { MotionClip } from '../../lib/arena/engine/motion/MotionTypes';
import { NATIVE_LIMITS } from '../../lib/arena/engine/performance/NativeLimits';
import { bakeOverlap } from '../../lib/arena/engine/motion/OverlapSprings';
import {
  scalarTrack,
  sampleScalar,
  type Knot,
} from '../loongbones/cornhole-motion/curves';
import type { NativeClip } from './NativeClip';
import type { WeightedRigDefinition } from '../loongbones/arena/RigDefinition';
export const PERFORMANCE_REVISION = 'cornhole-cartoon-take-v1';
export const PERFORMANCE_ASSET_REVISION = 'side-v3-attachment-r4';
export const PERFORMANCE_HAND_LIMITS = NATIVE_LIMITS.hand_L;

export type PerformanceArmatureData = {
  name: string;
  bone: unknown[];
  slot: unknown[];
  skin: unknown[];
  ik: unknown[];
  animation: NativeClip[];
};

const map = {
  hips: 'pelvis',
  lowerSpine: 'spine_lower',
  upperSpine: 'spine_mid',
  chest: 'chest',
  shoulder: 'clavicle_L',
  upperArm: 'upper_arm_L',
  elbow: 'forearm_L',
  counterArm: 'upper_arm_R',
  counterElbow: 'forearm_R',
} as const;
type Pose = Record<BodyChannel, number>;
const TORSO = ['hips', 'lowerSpine', 'upperSpine', 'chest'] as const;
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

/** Cartoon follow-through: children trail and overshoot their parents. Baked
 * per frame from the authored/captured signal, so playback stays exact under
 * seek and the result exports to the editor like any other curve. */
const OVERLAP = {
  head: { frequency: 2.3, damping: 0.38, gain: 0.55, limit: 7 },
  chest: { frequency: 2.8, damping: 0.42, gain: 0.35, limit: 3 },
  counterArm: { frequency: 1.7, damping: 0.34, gain: 0.8, limit: 14 },
  wrist: { frequency: 3.4, damping: 0.45, gain: 0.14, limit: 9 },
};

/**
 * Sole compiler for shipped cornhole motion. The character's take supplies
 * the curves (authored now, captured later), the validated profile supplies
 * timing/amplitude gains, and this function owns native per-frame curves,
 * durations, loop counts, overlap and semantic markers.
 */
export function compilePerformance(p: PerformanceProfile): CompiledPerformance {
  const native: NativeClip[] = [],
    clips = new Map<string, MotionClip>();
  const emit = (
    id: string,
    take: BodyTake,
    options: Partial<MotionClip> = {},
  ) => {
    const end = Math.round(take.seconds * 60),
      loop = options.loop === true;
    // Sample each channel at every native frame. Knots stay at fractional
    // frames (tempo changes never snap them to uneven whole frames); a loop
    // borrows its neighbours across the seam so the cycle never stalls there.
    const series = Object.fromEntries(
      Object.entries(take.channels).map(([key, values]) => {
        let knots: Knot[] = values.map((v, i) => [take.times[i] * end, v]);
        if (loop && knots.length > 2)
          knots = [
            [knots.at(-2)![0] - end, knots.at(-2)![1]],
            ...knots,
            [knots[1][0] + end, knots[1][1]],
          ];
        return [
          key,
          Array.from({ length: end + 1 }, (_, f) => sampleScalar(knots, f)),
        ];
      }),
    ) as Record<BodyChannel, number[]>;
    const at = (key: BodyChannel, f: number) => series[key][f];
    const torsoAt = (f: number) => TORSO.reduce((n, k) => n + at(k, f), 0);
    const torso = series.hips.map((_, f) => torsoAt(f));
    // Overlap layers (degrees), from the pre-overlap parent signals.
    const lower = series.hips.map((h, f) => h + series.lowerSpine[f]);
    const swing = series.hips.map(
      (_, f) => torso[f] + at('shoulder', f) + at('upperArm', f),
    );
    const headLag = bakeOverlap(torso, 60, OVERLAP.head, loop),
      chestLag = bakeOverlap(lower, 60, OVERLAP.chest, loop),
      counterLag = bakeOverlap(torso, 60, OVERLAP.counterArm, loop),
      wristLag = bakeOverlap(swing, 60, OVERLAP.wrist, loop);
    const chest = series.chest.map((v, f) => v + chestLag[f]);
    const fullTorso = (f: number) => torso[f] - series.chest[f] + chest[f];
    const local: Record<string, number[]> = {
      pelvis: series.hips,
      spine_lower: series.lowerSpine,
      spine_mid: series.upperSpine,
      chest,
      clavicle_L: series.shoulder,
      upper_arm_L: series.upperArm,
      forearm_L: series.elbow,
      upper_arm_R: series.counterArm.map((v, f) => v + counterLag[f]),
      forearm_R: series.counterElbow,
      // The world hand target is authored; its local rotation is what remains
      // after every parent, then trails the swing slightly (wrist lag/snap).
      hand_L: series.palm.map(
        (palm, f) =>
          palm -
          fullTorso(f) -
          at('shoulder', f) -
          at('upperArm', f) -
          at('elbow', f) +
          wristLag[f],
      ),
      // Head leads/drags: it keeps only part of the counter-rotation that used
      // to pin it level, and overshoots when the torso stops.
      neck: torso.map((t) => -0.5 * t),
      head: torso.map((t, f) => at('gaze', f) - 0.3 * t + headLag[f]),
    };
    for (const [bone, values] of Object.entries(local)) {
      const limit = NATIVE_LIMITS[bone];
      if (!limit) continue;
      const outside = values.find((v) => v < limit[0] || v > limit[1]);
      if (outside !== undefined)
        throw Error(
          `${p.id} ${id} authors ${bone} outside native limits: ${outside.toFixed(2)}`,
        );
    }
    const bake = (values: number[]) =>
      scalarTrack(
        values.map((v, f): Knot => [f, v]),
        end,
        'rotate',
      );
    const bones: NonNullable<NativeClip['bone']> = Object.entries(local).map(
      ([name, values]) => ({ name, rotateFrame: bake(values) }),
    );
    bones.find((b) => b.name === 'pelvis')!.translateFrame = Array.from(
      { length: end + 1 },
      (_, f) => ({
        duration: f === end ? 0 : 1,
        tweenEasing: 0,
        x: at('weightX', f),
        y: at('compression', f),
      }),
    );
    native.push({
      name: 'performance_' + id,
      duration: end,
      playTimes: loop ? 0 : 1,
      bone: bones,
    });
    const metadata: MotionClip = {
      id,
      native: 'performance_' + id,
      duration: end / 60,
      layer: 'action',
      priority: 10,
      fade: 0.16,
      phases: [],
      markers: [],
      ...options,
    };
    clips.set(id, metadata);
    return metadata;
  };
  const take = underhandMechanics(p);
  const endFrames = Math.round(take.seconds * 60);
  const frame = (key: BodyChannel, u: number) =>
    sampleScalar(
      take.channels[key].map((v, i): Knot => [take.times[i] * endFrames, v]),
      u * endFrames,
    );
  const poseAt = (u: number) =>
    Object.fromEntries(
      Object.keys(take.channels).map((key) => [
        key,
        frame(key as BodyChannel, u),
      ]),
    ) as Pose;
  const ready = poseAt(0),
    finish = poseAt(1);
  const torsoOf = (pose: Pose) => TORSO.reduce((n, k) => n + pose[k], 0);
  /** Keep the hand at a local wrist angle: palm is the world hand target. */
  const wrist = (pose: Pose, angle: number): Pose => ({
    ...pose,
    palm: angle + torsoOf(pose) + pose.shoulder + pose.upperArm + pose.elbow,
  });
  const neutral = Object.fromEntries(
    Object.keys(ready).map((key) => [key, 0]),
  ) as Pose;
  neutral.palm = 58;
  neutral.compression = p.restCompression;
  neutral.weightX = p.restShift;
  neutral.hips = -0.4;
  neutral.upperArm = 5;
  neutral.elbow = -5;
  neutral.counterArm = -5;
  neutral.counterElbow = -9;
  const pose = (
    id: string,
    seconds: number,
    rows: [number, Pose][],
    options: Partial<MotionClip> = {},
  ) =>
    emit(
      id,
      {
        seconds,
        release: 0,
        markers: {},
        times: rows.map((r) => r[0]),
        channels: Object.fromEntries(
          Object.keys(ready).map((key) => [
            key,
            rows.map((r) => r[1][key as BodyChannel]),
          ]),
        ) as Record<BodyChannel, number[]>,
      },
      options,
    );
  // Alive idle: breath, a weight shift and a glance, looped seamlessly.
  const idleEnergy = 0.6 + p.idleEnergy;
  pose(
    'idle',
    3.8,
    [
      [0, neutral],
      [
        0.22,
        {
          ...neutral,
          chest: 1.4 * idleEnergy,
          compression: neutral.compression + 2,
          gaze: 0.6 * idleEnergy,
        },
      ],
      [
        0.5,
        {
          ...neutral,
          weightX: neutral.weightX + 4 * idleEnergy,
          hips: 0.6,
          chest: 0.5 * idleEnergy,
          counterArm: -7,
          gaze: -1.2 * idleEnergy,
        },
      ],
      [
        0.74,
        {
          ...neutral,
          chest: 1.1 * idleEnergy,
          compression: neutral.compression + 1.5,
          gaze: 0.3,
        },
      ],
      [1, neutral],
    ],
    { layer: 'base', priority: 0, loop: true, fade: 0.24 },
  );
  const attentive = {
    ...neutral,
    weightX: p.restShift + 10,
    compression: p.restCompression + 5,
    lowerSpine: p.attentionLean * 0.45,
    upperSpine: p.attentionLean * 0.4,
    chest: p.attentionLean * 0.35,
    upperArm: 1,
    elbow: -10,
    counterArm: -7,
    gaze: -1,
  };
  const tracking = { ...attentive, weightX: p.restShift + 16, gaze: -2.2 };
  const background = { layer: 'base' as const, priority: 0, fade: 0.32 };
  pose(
    'observePrepare',
    0.7,
    [
      [0, neutral],
      [1, attentive],
    ],
    background,
  );
  pose(
    'observeFlight',
    0.65,
    [
      [0, attentive],
      [0.55, tracking],
      [1, tracking],
    ],
    background,
  );
  pose(
    'observeAcknowledge',
    0.85,
    [
      [0, tracking],
      [
        0.28,
        {
          ...attentive,
          gaze: 3 + p.reactionIntensity * 2,
          chest: p.attentionLean * 0.5,
        },
      ],
      [0.6, { ...attentive, gaze: -0.4 }],
      [1, neutral],
    ],
    background,
  );
  // Notice flows straight into the take's opening pose (no dwell).
  pose('look', 0.28 + (1 - p.confidence) * 0.18, [
    [0, { ...neutral, elbow: -6 }],
    [0.55, { ...ready, compression: (neutral.compression + ready.compression) / 2 }],
    [1, ready],
  ]);
  // Standalone settle action (the throw carries its own settle beat).
  pose('settle', 0.34, [
    [0, neutral],
    [1, ready],
  ]);
  const markerAt = (name: string) =>
    Math.round((take.markers[name] ?? 0) * endFrames) / 60;
  emit('underhand', take, {
    markers: [
      { name: 'anticipate', at: markerAt('anticipate') },
      { name: 'windup', at: markerAt('windup') },
      { name: 'windupPeak', at: markerAt('windupPeak') },
      { name: 'equipmentRelease', at: markerAt('equipmentRelease') },
      { name: 'finish', at: markerAt('finish') },
      { name: 'holdEnd', at: markerAt('holdEnd') },
    ],
    technique: 'underhand',
  });
  // The take already holds the finish through the flight and relaxes; watch
  // keeps tracking the board with breath until the result arrives.
  const watch = wrist(
    {
      ...finish,
      weightX: finish.weightX * 0.94,
      upperArm: finish.upperArm * 0.9,
      elbow: -10,
      gaze: -1.5,
    },
    58,
  );
  pose(
    'watch',
    1.6,
    [
      [0, finish],
      [0.4, wrist({ ...watch, chest: finish.chest + 0.6, gaze: -1.9 }, 60)],
      [1, watch],
    ],
    { fade: 0.18 },
  );
  const response = wrist(
    {
      ...watch,
      hips: 1.2,
      lowerSpine: 1.4,
      upperSpine: 1.5,
      chest: 1.6,
      upperArm: watch.upperArm * 0.7,
      elbow: -16,
      gaze: -1,
    },
    60,
  );
  pose('positive', p.celebration === 'chestTap' ? 0.25 : 0.3, [
    [0, watch],
    [
      0.55,
      wrist(
        { ...response, chest: 0.4, shoulder: -2, gaze: -3.5, compression: response.compression + 3 },
        62,
      ),
    ],
    [1, response],
  ]);
  const negativeEnd = wrist({ ...response, elbow: -12, gaze: 3 }, 60);
  pose('negative', 0.46, [
    [0, watch],
    [
      0.35,
      wrist(
        {
          ...watch,
          chest: 4.5,
          upperSpine: 3,
          compression: watch.compression + 5,
          gaze: 6 * p.reactionIntensity,
        },
        64,
      ),
    ],
    [1, negativeEnd],
  ]);
  const rest = {
    ...neutral,
    weightX: finish.weightX * 0.48,
    compression: 9,
    hips: 0.8,
    chest: 0.6,
    upperArm: -4,
    elbow: -9,
    palm: 48,
  };
  const recovery = (id: string, entry: Pose) =>
    pose(
      id,
      p.recoveryDuration,
      [
        [0, entry],
        // The native entry blend releases the arm first. The pelvis follows;
        // compression converges to rest without rising past it and bouncing back.
        [
          0.24,
          {
            ...rest,
            upperArm: 2,
            elbow: -6,
            palm: 56,
            weightX: rest.weightX * 0.92,
          },
        ],
        [
          0.58,
          {
            ...neutral,
            weightX: neutral.weightX + (rest.weightX - neutral.weightX) * 0.28,
            compression: p.restCompression + 1.4,
          },
        ],
        [1, neutral],
      ],
      { fade: 0.18 },
    );
  recovery('recoverWatch', watch);
  recovery('recoverPositive', response);
  recovery('recoverNegative', negativeEnd);
  recovery('recoverRest', rest);
  // Compatibility for callers that request a standalone return-to-idle action.
  recovery('recover', rest);
  pose('nod', 0.9, [
    [0, response],
    [0.14, { ...response, gaze: -2, chest: 0.6 }],
    [
      0.34,
      {
        ...response,
        gaze: 8 + 5 * p.reactionIntensity,
        chest: 3.2,
        compression: 18,
        upperArm: -2,
        elbow: -10,
      },
    ],
    [0.6, { ...response, gaze: -1.2, chest: 1, upperArm: -1, elbow: -8 }],
    [1, rest],
  ]);
  // Two brief chest-relative contacts with a visible withdrawal between them.
  const tap = {
    ...response,
    upperArm: 40,
    elbow: -112,
    shoulder: -3,
    palm: -78,
    gaze: 0,
    chest: 0.8,
  };
  const rebound = {
    ...response,
    upperArm: 20,
    elbow: -73,
    shoulder: -1,
    palm: -30,
    gaze: 2,
    chest: 2.4,
  };
  pose(
    'chestTap',
    1.08,
    [
      [0, response],
      [0.12, { ...response, upperArm: 1, elbow: -48, palm: 2 }],
      [0.25, { ...tap, upperArm: 28, elbow: -92, palm: -57 }],
      [0.36 / 1.08, { ...tap, chest: 0.4, compression: 12 }],
      [0.44, rebound],
      [0.54, { ...tap, upperArm: 30, elbow: -95, palm: -60 }],
      [0.67 / 1.08, { ...tap, chest: 0.2, compression: 11 }],
      [0.74, rebound],
      [0.87, { ...rest, upperArm: 4, elbow: -30, palm: 20 }],
      [1, rest],
    ],
    {
      fade: 0.14,
      markers: [
        { name: 'chestTapContact', at: Math.round(0.36 * 60) / 60 },
        { name: 'chestTapContact2', at: Math.round(0.67 * 60) / 60 },
        { name: 'chestTapRelease', at: 0.82 },
      ],
    },
  );
  return {
    profileId: p.id,
    compilerRevision: PERFORMANCE_REVISION,
    assetRevision: PERFORMANCE_ASSET_REVISION,
    native,
    clips,
  };
}
