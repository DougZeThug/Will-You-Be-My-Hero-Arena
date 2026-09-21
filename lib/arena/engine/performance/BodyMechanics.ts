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

type AuthoredTechnique = Pick<BodyTake, 'times' | 'channels'>;

/** Dan settles into the rear leg and lets the torso carry the arm through.
 * Doug stays taller, commits later, and catches the finish with his chest.
 * These are hand-authored Arena takes, not footage-derived motion. */
function authoredTechnique(p: PerformanceProfile): AuthoredTechnique {
  const dan = p.id === 'dan';
  const times = dan
    ? [
        0, 0.08, 0.16, 0.23, 0.29, 0.34, 0.38, 0.41, 0.45, 0.48, 0.53, 0.61,
        0.71, 0.82, 0.93, 1,
      ]
    : [
        0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.39, 0.42, 0.45, 0.48, 0.52, 0.59,
        0.69, 0.81, 0.93, 1,
      ];
  const scale = (values: number[], magnitude: number) =>
    values.map((v) => v * magnitude);
  return {
    times,
    channels: {
      weightX: scale(
        dan
          ? [
              -0.12, -0.22, -0.43, -0.7, -0.82, -0.76, -0.5, -0.12, 0.34, 0.72,
              0.94, 1, 0.93, 0.83, 0.74, 0.7,
            ]
          : [
              -0.1, -0.18, -0.35, -0.58, -0.8, -0.9, -0.73, -0.32, 0.28, 0.78,
              1.04, 1.08, 0.96, 0.83, 0.72, 0.66,
            ],
        p.weightTransfer,
      ),
      compression: dan
        ? [12, 16, 23, 31, 36, 37, 33, 27, 20, 15, 15, 18, 18, 16, 15, 14]
        : [12, 14, 19, 27, 34, 38, 37, 31, 23, 16, 14, 17, 19, 18, 16, 14],
      hips: dan
        ? [
            -0.2, -0.5, -0.9, -1.2, -1.1, -0.6, 0.1, 0.9, 1.7, 2.2, 2.5, 2.4,
            2.1, 1.8, 1.55, 1.4,
          ]
        : [
            -0.1, -0.2, -0.5, -0.9, -1.2, -1.1, -0.4, 0.5, 1.6, 2.5, 2.9, 2.6,
            2.1, 1.7, 1.45, 1.3,
          ],
      lowerSpine: dan
        ? [
            0.3, 0.4, 0.7, 1, 1.3, 1.7, 2.2, 2.8, 3.2, 3.2, 2.9, 2.5, 2.1, 1.8,
            1.6, 1.5,
          ]
        : [
            0.2, 0.3, 0.5, 0.8, 1.1, 1.4, 2, 2.8, 3.5, 3.7, 3.2, 2.7, 2.2, 1.8,
            1.55, 1.4,
          ],
      upperSpine: dan
        ? [
            0.4, 0.5, 0.8, 1.1, 1.3, 1.6, 2, 2.4, 2.7, 2.8, 2.7, 2.5, 2.2, 2,
            1.7, 1.6,
          ]
        : [
            0.3, 0.4, 0.6, 0.8, 1, 1.3, 1.8, 2.5, 3.1, 3.3, 3.1, 2.7, 2.3, 2,
            1.7, 1.5,
          ],
      chest: (dan
        ? [
            0.5, 0.6, 0.7, 0.8, 1, 1.4, 1.8, 2.2, 2.7, 3, 3.2, 3, 2.6, 2.25,
            1.95, 1.8,
          ]
        : [
            0.4, 0.45, 0.5, 0.6, 0.75, 1, 1.5, 2.2, 3, 3.6, 3.7, 3.3, 2.7, 2.25,
            1.9, 1.7,
          ]
      ).map((v) => v * (0.8 + p.posture * 0.3)),
      shoulder: dan
        ? [
            0, 0.2, 0.6, 1.3, 2.4, 3.1, 2.5, 1.2, -0.7, -2.4, -4, -5, -4.4,
            -3.5, -2.6, -2,
          ]
        : [
            0, 0.1, 0.4, 1, 2.1, 3.4, 3.2, 1.8, -0.5, -3, -5, -5.6, -4.5, -3.4,
            -2.4, -1.8,
          ],
      upperArm: dan
        ? [
            -7,
            -9,
            -9,
            p.backswing * 0.25,
            p.backswing * 0.68,
            p.backswing,
            p.backswing * 0.9,
            p.backswing * 0.55,
            -12,
            -24 - p.releaseLift,
            -41 - p.releaseLift,
            -p.followThrough,
            -p.followThrough * 0.9,
            -p.followThrough * (p.finishRetention + 0.15),
            -p.followThrough * (p.finishRetention + 0.05),
            -p.followThrough * p.finishRetention,
          ]
        : [
            -6,
            -7,
            -7,
            p.backswing * 0.18,
            p.backswing * 0.58,
            p.backswing,
            p.backswing * 0.96,
            p.backswing * 0.62,
            -8,
            -24 - p.releaseLift,
            -43 - p.releaseLift,
            -p.followThrough,
            -p.followThrough * 0.96,
            -p.followThrough * (p.finishRetention + 0.18),
            -p.followThrough * (p.finishRetention + 0.07),
            -p.followThrough * p.finishRetention,
          ],
      elbow: dan
        ? [
            -16, -18, -18, -13, -7, -4, -3, -3, -4, -6, -8, -12, -13, -12, -11,
            -10,
          ]
        : [
            -14, -15, -15, -11, -6, -3, -2, -2, -3, -5, -7, -11, -14, -13, -11,
            -10,
          ],
      palm: dan
        ? [48, 45, 40, 61, 78, 86, 82, 69, 43, 22, 4, -7, 0, 12, 24, 32]
        : [48, 46, 42, 58, 75, 88, 86, 72, 45, 24, 5, -5, -1, 10, 22, 31],
      counterArm: dan
        ? [-5, -6, -8, -10, -11, -10, -8, -5, -1, 2, 4, 4, 2, -1, -3, -4]
        : [-5, -6, -7, -9, -12, -13, -11, -7, -1, 4, 7, 6, 3, 0, -3, -4],
      counterElbow: dan
        ? [
            -9, -10, -13, -16, -17, -17, -16, -14, -12, -10, -9, -9, -10, -11,
            -11, -10,
          ]
        : [
            -9, -10, -12, -15, -18, -19, -18, -15, -11, -8, -7, -8, -10, -12,
            -11, -10,
          ],
      gaze: dan
        ? [
            0, -0.1, -0.3, -0.4, -0.4, -0.3, -0.1, 0, 0.1, 0.3, 0.7, 1.2, 0.9,
            0.3, 0, 0,
          ]
        : [
            0, -0.1, -0.2, -0.25, -0.2, -0.1, 0, 0.1, 0.2, 0.5, 1, 1.5, 1, 0.35,
            0, 0,
          ],
    },
  };
}

/** A shared kinetic chain in rig-space pixels/degrees, compiled once at loading.
 * Timing overlaps: pelvis commits before chest, shoulder leads elbow, the elbow
 * folds after release, and hips recover after the arm has decelerated. */
export function underhandMechanics(p: PerformanceProfile): BodyTake {
  const technique = authoredTechnique(p);
  return {
    seconds: 2.25 / p.movementTempo,
    times: technique.times,
    release: 0.48,
    channels: technique.channels,
  };
}
