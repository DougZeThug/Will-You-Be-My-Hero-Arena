import {
  underhandMechanics,
  type BodyChannel,
  type BodyTake,
} from '../../lib/arena/engine/performance/BodyMechanics';
import type { PerformanceProfile } from '../../lib/arena/engine/performance/PerformanceTypes';
import type { MotionClip } from '../../lib/arena/engine/motion/MotionTypes';
import {
  scalarTrack,
  sampleScalar,
  type Knot,
} from '../loongbones/cornhole-motion/curves';
import type { NativeClip } from './NativeClip';
import {
  PERFORMANCE_ASSET_REVISION,
  PERFORMANCE_REVISION,
} from './PerformanceAuthority';
export { PERFORMANCE_REVISION } from './PerformanceAuthority';
export const PERFORMANCE_HAND_LIMITS = [-35, 95] as const;

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
/** One full-body pose compiler. Action owns articulated support, spine and arms;
 * the adapter then applies bounded gaze, native contact IK and hand exposure. */
export interface CompiledPerformance {
  profileId: string;
  compilerRevision: string;
  assetRevision: string;
  native: NativeClip[];
  clips: Map<string, MotionClip>;
}

/**
 * Sole compiler for shipped cornhole motion. BodyMechanics supplies authored
 * curves, the validated profile supplies character timing/personality, and
 * this function owns native durations, loop counts and semantic markers.
 */
export function compilePerformance(p: PerformanceProfile): CompiledPerformance {
  const native: NativeClip[] = [],
    clips = new Map<string, MotionClip>();
  const emit = (
    id: string,
    take: BodyTake,
    options: Partial<MotionClip> = {},
  ) => {
    const end = Math.round(take.seconds * 60);
    const tracks = Object.fromEntries(
      Object.entries(take.channels).map(([key, values]) => [
        key,
        values.map((v, i): Knot => [Math.round(take.times[i] * end), v]),
      ]),
    );
    const at = (key: string, f: number) => sampleScalar(tracks[key], f);
    const torso = (f: number) =>
      ['hips', 'lowerSpine', 'upperSpine', 'chest'].reduce(
        (n, k) => n + at(k, f),
        0,
      );
    const bake = (fn: (f: number) => number) =>
      scalarTrack(
        Array.from({ length: end + 1 }, (_, f): Knot => [f, fn(f)]),
        end,
        'rotate',
      );
    const bones: NonNullable<NativeClip['bone']> = Object.entries(map).map(
      ([semantic, name]) => ({
        name,
        rotateFrame: scalarTrack(tracks[semantic], end, 'rotate'),
      }),
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
    const handRequests = Array.from(
      { length: end + 1 },
      (_, f) =>
        at('palm', f) -
        torso(f) -
        at('shoulder', f) -
        at('upperArm', f) -
        at('elbow', f),
    );
    const outside = handRequests.find(
      (rotation) =>
        rotation < PERFORMANCE_HAND_LIMITS[0] ||
        rotation > PERFORMANCE_HAND_LIMITS[1],
    );
    if (outside !== undefined)
      throw Error(
        `${p.id} ${id} authors hand_L outside native limits: ${outside.toFixed(2)}`,
      );
    bones.push(
      {
        name: 'hand_L',
        rotateFrame: bake((f) => handRequests[f]),
      },
      { name: 'neck', rotateFrame: bake((f) => -0.72 * torso(f)) },
      {
        name: 'head',
        rotateFrame: bake((f) => at('gaze', f) - 0.28 * torso(f)),
      },
    );
    native.push({
      name: 'performance_' + id,
      duration: end,
      playTimes: options.loop ? 0 : 1,
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
  const ready = Object.fromEntries(
    Object.entries(take.channels).map(([key, values]) => [key, values[0]]),
  ) as Pose;
  const finish = Object.fromEntries(
    Object.entries(take.channels).map(([key, values]) => [key, values.at(-1)!]),
  ) as Pose;
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
  pose(
    'idle',
    3.8,
    [
      [0, neutral],
      [
        0.38,
        { ...neutral, chest: 0.6 * p.idleEnergy, gaze: 0.2 * p.idleEnergy },
      ],
      [0.68, { ...neutral, chest: 0.2 * p.idleEnergy }],
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
  const prepared = {
    ...ready,
    compression: 5,
    weightX: -3,
    upperArm: -4,
    elbow: -12,
    gaze: -1,
  };
  pose('look', 0.28 + (1 - p.confidence) * 0.18, [
    [0, { ...neutral, elbow: -6 }],
    [0.7, prepared],
    [1, prepared],
  ]);
  pose('settle', 0.34, [
    [0, prepared],
    [0.75, ready],
    [1, ready],
  ]);
  const release = Math.round(take.release * Math.round(take.seconds * 60)) / 60;
  emit('underhand', take, {
    markers: [{ name: 'equipmentRelease', at: release }],
    technique: 'underhand',
  });
  const watch = {
    ...finish,
    weightX: finish.weightX * 0.94,
    upperArm: finish.upperArm * 0.84,
    elbow: -8,
    palm: 42,
    gaze: -1.5,
  };
  pose(
    'watch',
    1.1,
    [
      [0, finish],
      [
        0.55,
        { ...watch, upperArm: finish.upperArm * 0.94, elbow: -10, palm: 36 },
      ],
      [1, watch],
    ],
    { fade: 0.18 },
  );
  const response = {
    ...watch,
    hips: 1.2,
    lowerSpine: 1.2,
    upperSpine: 1.3,
    chest: 1.4,
    upperArm: watch.upperArm * 0.8,
    elbow: -16,
    palm: 44,
    gaze: -1,
  };
  pose('positive', p.celebration === 'chestTap' ? 0.25 : 0.3, [
    [0, watch],
    [0.55, { ...response, chest: 0.4, shoulder: -1.5, gaze: -2.5 }],
    [1, response],
  ]);
  const negativeEnd = { ...response, elbow: -12, gaze: 3 };
  pose('negative', 0.4, [
    [0, watch],
    [0.4, { ...watch, chest: 2.8, gaze: 4 * p.reactionIntensity }],
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
        gaze: 6 + 4 * p.reactionIntensity,
        chest: 2.3,
        compression: 16,
        upperArm: -2,
        elbow: -10,
      },
    ],
    [0.6, { ...response, gaze: -0.7, chest: 1, upperArm: -1, elbow: -8 }],
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
