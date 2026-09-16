import type { PerformanceProfile } from './PerformanceTypes';
export type BodyChannel =
  | 'weightX'
  | 'compression'
  | 'hips'
  | 'lowerSpine'
  | 'upperSpine'
  | 'chest'
  | 'shoulder'
  | 'upperArm'
  | 'elbow'
  | 'palm'
  | 'counterArm'
  | 'counterElbow'
  | 'gaze';
export interface BodyTake {
  seconds: number;
  times: number[];
  release: number;
  channels: Record<BodyChannel, number[]>;
}

/** A shared kinetic chain in rig-space pixels/degrees, compiled once at loading.
 * Timing overlaps: pelvis commits before chest, shoulder leads elbow, the elbow
 * folds after release, and hips recover after the arm has decelerated. */
export function underhandMechanics(p: PerformanceProfile): BodyTake {
  const times = [
    0, 0.08, 0.16, 0.23, 0.29, 0.34, 0.37, 0.4, 0.44, 0.48, 0.53, 0.61, 0.71,
    0.82, 0.93, 1,
  ];
  const scale = (values: number[], magnitude: number) =>
    values.map((v) => v * magnitude);
  return {
    seconds: 2.25 / p.movementTempo,
    times,
    release: 0.48,
    channels: {
      weightX: scale(
        [
          -0.15, -0.24, -0.48, -0.78, -0.86, -0.72, -0.4, 0.05, 0.48, 0.8, 1,
          1.02, 0.94, 0.84, 0.74, 0.7,
        ],
        p.weightTransfer,
      ),
      compression: [
        12, 17, 26, 35, 38, 35, 29, 23, 18, 14, 16, 20, 19, 17, 15, 14,
      ],
      hips: [
        -0.2, -0.5, -1, -1.2, -1, -0.3, 0.7, 1.4, 2, 2.4, 2.5, 2.3, 2, 1.7, 1.5,
        1.4,
      ],
      lowerSpine: [
        0.3, 0.4, 0.8, 1, 1.4, 1.8, 2.6, 3.2, 3.4, 3.1, 2.8, 2.4, 2, 1.8, 1.6,
        1.5,
      ],
      upperSpine: [
        0.4, 0.6, 0.9, 1.1, 1.3, 1.6, 2.2, 2.6, 2.8, 2.8, 2.7, 2.5, 2.2, 2, 1.7,
        1.6,
      ],
      chest: [
        0.5, 0.6, 0.7, 0.7, 0.9, 1.4, 1.9, 2.4, 2.8, 3.1, 3.2, 2.9, 2.5, 2.2,
        1.9, 1.8,
      ].map((v) => v * (0.8 + p.posture * 0.3)),
      shoulder: [
        0, 0.2, 0.7, 1.5, 2.8, 3.5, 2.2, 0.5, -1.5, -3, -4.2, -5, -4.3, -3.4,
        -2.5, -2,
      ],
      upperArm: [
        -7,
        -10,
        -9,
        p.backswing * 0.3,
        p.backswing * 0.8,
        p.backswing,
        p.backswing * 0.94,
        p.backswing * 0.68,
        -10,
        -24 - p.releaseLift,
        -41 - p.releaseLift,
        -p.followThrough,
        -p.followThrough * 0.9,
        -p.followThrough * (p.finishRetention + 0.15),
        -p.followThrough * (p.finishRetention + 0.05),
        -p.followThrough * p.finishRetention,
      ],
      elbow: [
        -16, -18, -18, -12, -5, -3, -2, -3, -4, -6, -8, -12, -13, -12, -11, -10,
      ],
      palm: [48, 45, 40, 64, 91, 105, 100, 76, 46, 22, 4, -7, 0, 12, 24, 32],
      counterArm: [
        -5, -6, -8, -10, -11, -10, -7, -4, 0, 3, 5, 4, 2, -1, -3, -4,
      ],
      counterElbow: [
        -9, -10, -13, -16, -17, -17, -16, -14, -12, -10, -9, -9, -10, -11, -11,
        -10,
      ],
      gaze: [
        0, -0.1, -0.3, -0.4, -0.4, -0.3, -0.1, 0, 0.1, 0.3, 0.7, 1.2, 0.9, 0.3,
        0, 0,
      ],
    },
  };
}
