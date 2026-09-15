import { rotation, type BoneTrack, type LibraryBuilder } from './builder';
import {
  sampleScalar,
  type Knot,
} from '../../loongbones/cornhole-motion/curves';
import { handSurfaces } from '../../loongbones/side-rig/hand-surfaces';
import { motionSignatures } from '../../../lib/arena/engine/motion/CharacterMotionSignature';
import reference from '../../../motion-reference/cornhole/reference-throw.json';
import type {
  MotionMarker,
  MotionPhase,
} from '../../../lib/arena/engine/motion/MotionTypes';

import {
  THROW_LANDMARKS,
  tracks,
  pelvisX,
  pelvisY,
  shoulderX,
  shoulderY,
  styleTraits,
} from './cornhole-curves';
export function addCornhole(
  library: LibraryBuilder,
  id: 'dan' | 'doug',
  plants: MotionMarker[],
) {
  for (const [style, technique] of Object.entries(styleTraits)) {
    const signature = motionSignatures[id],
      loose = signature.looseness > 0.5,
      tempo = technique.tempo * signature.rhythm;
    const frame = (f: number) => Math.round(f * tempo),
      end = frame(reference.endFrame),
      release = frame(reference.releaseFrame);
    const channels = Object.fromEntries(
      Object.entries(tracks).map(([name, keys]) => [
        name,
        keys.map(([f, v]) => {
          const action = Math.sin(
            Math.PI * Math.min(1, Math.max(0, (f - 34) / 85)),
          );
          if (name === 'upper_arm_L')
            v =
              v * technique.sweep * signature.backswingSize +
              technique.lift * action;
          if (name === 'forearm_L' && loose) v *= 1.12;
          if (name === 'hand_L') v += technique.wrist * action;
          if (['spine_mid', 'chest', 'upper_arm_R'].includes(name) && loose)
            v *= signature.bodyLean;
          return [frame((f * reference.endFrame) / 146), v] as Knot;
        }),
      ]),
    );
    const at = (name: string, f: number) => sampleScalar(channels[name], f);
    const body = (f: number) =>
      ['pelvis', 'spine_lower', 'spine_mid', 'chest'].reduce(
        (n, b) => n + at(b, f),
        0,
      );
    const measured = (
      name: keyof typeof reference.channels,
      f: number,
      lag = 0,
    ) =>
      sampleScalar(
        reference.channels[name].map(([t, v]) => [t, v] as Knot),
        Math.max(0, f / tempo - lag),
      );
    const sampled = (get: (f: number) => number): Knot[] =>
      Array.from({ length: end + 1 }, (_, f) => [f, get(f)]);
    // Measured sagittal pitch is useful reference, but cannot describe independent
    // pelvis/rib-cage decisions. Preserve it as a guide around authored breakdowns.
    for (const [name, share, delay] of [
      ['pelvis', 0.18, 0],
      ['spine_lower', 0.23, 1],
      ['spine_mid', 0.25, 2],
      ['chest', 0.34, 3],
    ] as const)
      channels[name] = sampled(
        (f) =>
          measured('torsoPitch', f, delay) * share * signature.bodyLean * 0.35 +
          sampleScalar(tracks[name], ((f / tempo) * 146) / reference.endFrame) *
            (loose ? 0.96 : 0.8),
      );
    channels.upper_arm_L = sampled((f) => {
      const progress = Math.max(0, Math.min(1, (f / tempo - 34) / 72));
      return (
        measured('upperRight', f) * technique.sweep * signature.backswingSize -
        body(f) -
        at('clavicle_L', f) +
        technique.lift * Math.sin(Math.PI * progress)
      );
    });
    channels.forearm_L = sampled(
      (f) => measured('elbowRight', f) * (loose ? 1.08 : 1),
    );
    // The far arm is hidden in the source. Bounded authored counterbalance follows
    // the observed trunk load; it is explicitly not labeled extracted motion.
    channels.upper_arm_R = sampled((f) =>
      sampleScalar(
        loose
          ? [
              [0, 0],
              [18, -4],
              [36, -17],
              [50, -10],
              [67, 7],
              [90, 4],
              [111, -2],
              [134, 0],
            ]
          : [
              [0, 0],
              [23, -2],
              [35, -10],
              [47, -8],
              [63, 4],
              [85, 2],
              [112, 0],
              [134, 0],
            ],
        f / tempo,
      ),
    );
    channels.forearm_R = sampled((f) =>
      sampleScalar(
        [
          [0, 0],
          [25, -8],
          [40, -17],
          [55, -12],
          [77, -4],
          [104, -7],
          [134, 0],
        ],
        f / tempo,
      ),
    );
    // Compensate the actual authored ancestors, not a guessed one-piece torso.
    channels.neck = Array.from(
      { length: end + 1 },
      (_, f) => [f, -body(f) * 0.72] as Knot,
    );
    channels.head = Array.from(
      { length: end + 1 },
      (_, f) =>
        [f, -body(f) * 0.28 + 0.6 * Math.sin((Math.PI * f) / end)] as Knot,
    );
    const shift = (keys: Knot[], f: number) =>
      sampleScalar(keys, ((f / tempo) * 146) / reference.endFrame);
    const translated = (
      name: string,
      get: (f: number) => { x: number; y: number },
    ): BoneTrack => ({
      name,
      translateFrame: Array.from({ length: end + 1 }, (_, f) => ({
        duration: f === end ? 0 : 1,
        ...get(f),
        tweenEasing: 0,
      })),
    });
    const native = {
      name: `v2_reference_${style}_${id}`,
      duration: end,
      playTimes: 1,
      bone: [
        ...Object.entries(channels).map(([name, keys]) =>
          rotation(name, keys, end),
        ),
        translated('pelvis', (f) => ({
          x:
            shift(pelvisX, f) * (loose ? 1 : 0.85) +
            measured('pelvisForward', f) * (loose ? 75 : 65),
          y:
            shift(pelvisY, f) * 1.05 +
            measured('pelvisLoad', f) * (loose ? 92 : 82),
        })),
        translated('clavicle_L', (f) => {
          // Chest bind axis (520,390)->(493,244). Translate through its local frame.
          const angle = Math.atan2(-146, -27) + (body(f) * Math.PI) / 180;
          const x = shift(shoulderX, f),
            y = shift(shoulderY, f);
          return {
            x: Math.cos(angle) * x + Math.sin(angle) * y,
            y: -Math.sin(angle) * x + Math.cos(angle) * y,
          };
        }),
      ],
      slot: handSurfaces(end, release),
    };
    const phases: [MotionPhase, number][] = [
      ['settle', 0],
      ['anticipation', frame(12) / 60],
      ['load', frame(30) / 60],
      ['acceleration', frame(41) / 60],
      ['release', release / 60],
      ['followThrough', frame(57) / 60],
      ['recovery', frame(73) / 60],
    ];
    library.add(
      'throw.' + style,
      native,
      phases,
      [...plants, { name: 'equipmentRelease', at: release / 60 }],
      {
        moveControl: 0,
        priority: 3,
        technique: 'underhand',
        performanceGain: 0.22,
        landmarks: THROW_LANDMARKS.map(([name], i) => ({
          name,
          at:
            frame(
              [
                0, 6, 10, 12, 21, 27, 34, 39, 43, 47, 50, 51, 56, 64, 75, 96,
                116, 134,
              ][i],
            ) / 60,
        })),
        rootInterpolation: 'continuous',
        root: [
          [0, 0],
          [27, -2.5],
          [33, -3],
          [40, -0.8],
          [51, 4],
          [65, 7],
          [81, 7.5],
          [95, 2],
          [114, 0],
          [127, 0],
          [146, 0],
        ].map(([f, x]) => ({
          at: frame((f * reference.endFrame) / 146) / 60,
          x: x * (loose ? 1.12 : 1),
          y: 0,
        })),
        // Preserve the independently authored return until support weight has recovered.
        cancel: [[frame(104) / 60, end / 60]],
      },
    );
  }
}
