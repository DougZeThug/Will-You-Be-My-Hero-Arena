import {
  underhandMechanics,
  type BodyChannel,
} from '../../lib/arena/engine/performance/BodyMechanics';
import type { PerformanceProfile } from '../../lib/arena/engine/performance/PerformanceTypes';
import type { MotionClip } from '../../lib/arena/engine/motion/MotionTypes';
import { PERFORMANCE_CLIPS as CLIP } from '../../lib/arena/engine/performance/ClipNames';
import { sampleScalar, type Knot } from '../loongbones/cornhole-motion/curves';
import { TORSO, type ClipEmitter, type Pose } from './ClipEmitter';

/** The hand-authored cornhole pose table: the underhand take plus every
 * standalone idle, observation, reaction and recovery pose. Clips are emitted
 * in this order; the profile only scales timing and amplitude. */
export function authorPerformancePoses(
  p: PerformanceProfile,
  emit: ClipEmitter,
) {
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
    CLIP.idle,
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
    CLIP.observePrepare,
    0.7,
    [
      [0, neutral],
      [1, attentive],
    ],
    background,
  );
  pose(
    CLIP.observeFlight,
    0.65,
    [
      [0, attentive],
      [0.55, tracking],
      [1, tracking],
    ],
    background,
  );
  pose(
    CLIP.observeAcknowledge,
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
  pose(CLIP.look, 0.28 + (1 - p.confidence) * 0.18, [
    [0, { ...neutral, elbow: -6 }],
    [
      0.55,
      { ...ready, compression: (neutral.compression + ready.compression) / 2 },
    ],
    [1, ready],
  ]);
  // Standalone settle action (the throw carries its own settle beat).
  pose(CLIP.settle, 0.34, [
    [0, neutral],
    [1, ready],
  ]);
  const markerAt = (name: string) =>
    Math.round((take.markers[name] ?? 0) * endFrames) / 60;
  emit(CLIP.underhand, take, {
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
    CLIP.watch,
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
  pose(CLIP.positive, p.celebration === 'chestTap' ? 0.25 : 0.3, [
    [0, watch],
    [
      0.55,
      wrist(
        {
          ...response,
          chest: 0.4,
          shoulder: -2,
          gaze: -3.5,
          compression: response.compression + 3,
        },
        62,
      ),
    ],
    [1, response],
  ]);
  const negativeEnd = wrist({ ...response, elbow: -12, gaze: 3 }, 60);
  pose(CLIP.negative, 0.46, [
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
  recovery(CLIP.recoverWatch, watch);
  recovery(CLIP.recoverPositive, response);
  recovery(CLIP.recoverNegative, negativeEnd);
  recovery(CLIP.recoverRest, rest);
  // Compatibility for callers that request a standalone return-to-idle action.
  recovery(CLIP.recover, rest);
  pose(CLIP.nod, 0.9, [
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
    CLIP.chestTap,
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
}
