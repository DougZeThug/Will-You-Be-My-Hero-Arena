import type { Person } from './anatomy';
import type { CornholeStyle } from '../cornhole-motion/throws';
import type { Knot } from '../cornhole-motion/curves';

/** Motion-reference breakdown, not captured/mocap coordinates. Source notes and
 * timestamped observations live in docs/review/cornhole-biomechanics/README.md.
 * Values are source pixels / local degrees. Positive torso pitch leans TOWARD
 * the rightward target in this y-down rig; the previous negative pitch leaned
 * away from the transfer. Different extrema are intentional overlaps. */
const phases = [
  'ready',
  'settle',
  'anticipation',
  'earlyBackswing',
  'midBackswing',
  'maximumBackswing',
  'reversal',
  'forwardDrive',
  'acceleration',
  'preRelease',
  'bagRelease',
  'earlyFollow',
  'followThrough',
  'bodySettle',
  'armDrop',
  'recovery',
  'animationComplete',
] as const;
const danFrames = [
  0, 5, 10, 17, 24, 29, 32, 36, 41, 46, 49, 54, 64, 75, 92, 110, 130,
];
const dougFrames = [
  0, 4, 8, 13, 19, 24, 27, 30, 35, 40, 43, 48, 60, 70, 85, 103, 122,
];

// Dan: a quiet setup, rear load before reversal, forward pelvis commitment,
// then a soft elbow folding as the arm falls. Recovery is not a reversed swing.
const dan = {
  pelvisX: [0, -1, -3, -7, -11, -12, -10, -5, 3, 13, 20, 26, 29, 27, 18, 5, 0],
  pelvisY: [0, 1, 3, 6, 9, 10, 10, 9, 7, 6, 7, 10, 12, 9, 5, 1, 0],
  pelvis: [
    0, -0.1, -0.3, -0.5, -0.7, -0.6, -0.3, 0.1, 0.5, 0.8, 1, 1.2, 1, 0.8, 0.4,
    0.1, 0,
  ],
  spine_lower: [
    0, 0, 0.1, 0.3, 0.6, 0.9, 1.1, 1.4, 1.7, 1.8, 1.7, 1.5, 1.1, 0.7, 0.2, -0.1,
    0,
  ],
  spine_mid: [
    0, 0, 0.1, 0.2, 0.4, 0.6, 0.8, 1, 1.3, 1.6, 1.9, 2, 1.6, 0.9, 0.3, 0, 0,
  ],
  chest: [
    0, 0, -0.1, -0.3, -0.5, -0.6, -0.4, 0, 0.6, 1.2, 1.5, 1.8, 1.6, 0.8, -0.2,
    -0.15, 0,
  ],
  clavicle_L: [
    0, 0.2, 0.5, 1.2, 1.8, 2, 1.8, 1, -0.2, -1.4, -2.2, -3, -3.3, -2, -0.7, 0.2,
    0,
  ],
  upper_arm_L: [
    0, -4, -7, 0, 16, 27, 28, 23, 5, -14, -29, -51, -65, -54, -22, -1, 0,
  ],
  forearm_L: [0, -5, -9, -6, 0, 3, 4, 4, 3, 1, -1, -6, -16, -25, -18, -3, 0],
  palm: [58, 41, 32, 55, 82, 96, 100, 72, 18, 2, 0, -2, 1, 10, 36, 56, 58],
  upper_arm_R: [
    0, -0.2, -0.7, -1.4, -2, -1.6, -1, -0.2, 0.8, 1.8, 2.3, 2.5, 1.8, 0.7, -0.6,
    -0.3, 0,
  ],
  forearm_R: [
    0, -0.3, -0.8, -1.4, -2.6, -3, -2.8, -2, -0.8, 0.5, 1.1, 1.5, 0.6, -0.6,
    -1.4, -0.5, 0,
  ],
  gaze: [
    0, -0.1, -0.3, -0.4, -0.3, -0.2, -0.1, 0, 0, 0.1, 0.2, 0.5, 0.9, 0.7, 0.2,
    -0.1, 0,
  ],
};
// Doug uses a shorter setup, deeper swing, earlier chest drive, longer elbow
// absorption and a delayed hip recenter. Not Dan's curves with more amplitude.
const doug: typeof dan = {
  pelvisX: [0, -2, -5, -9, -12, -10, -6, 0, 7, 17, 23, 27, 29, 28, 23, 9, 0],
  pelvisY: [0, 1, 2, 5, 8, 9, 9, 8, 6, 7, 8, 11, 12, 11, 7, 2, 0],
  pelvis: [
    0, -0.2, -0.5, -0.7, -0.8, -0.5, 0, 0.4, 0.9, 1.2, 1.3, 1.1, 0.9, 0.6, 0.3,
    0, 0,
  ],
  spine_lower: [
    0, 0, 0.2, 0.5, 0.9, 1.2, 1.5, 1.9, 2.1, 1.9, 1.6, 1.3, 1, 0.6, 0.1, -0.15,
    0,
  ],
  spine_mid: [
    0, 0.1, 0.2, 0.4, 0.6, 0.9, 1.3, 1.8, 2.1, 2.2, 2, 1.7, 1.3, 0.8, 0.2, -0.1,
    0,
  ],
  chest: [
    0, 0, -0.2, -0.4, -0.7, -0.4, 0.1, 0.7, 1.3, 1.9, 2.2, 2.3, 1.8, 0.7, -0.3,
    -0.2, 0,
  ],
  clavicle_L: [
    0, 0.2, 0.6, 1.3, 1.9, 2, 1.6, 0.7, -0.6, -1.8, -2.6, -3.4, -3.7, -2.6,
    -0.9, 0.15, 0,
  ],
  upper_arm_L: [
    0, -2, -4, 5, 24, 37, 36, 29, 8, -13, -29, -52, -68, -58, -25, -2, 0,
  ],
  forearm_L: [0, -3, -6, -3, 1, 3, 4, 4, 2, 0, -2, -7, -18, -27, -22, -6, 0],
  palm: [58, 45, 38, 65, 89, 102, 101, 72, 19, 2, 0, -3, 0, 7, 32, 54, 58],
  upper_arm_R: [
    0, -0.4, -0.9, -1.6, -2.5, -2.2, -1.2, 0, 1.2, 2.2, 2.8, 3, 2.2, 0.5, -0.9,
    -0.4, 0,
  ],
  forearm_R: [
    0, -0.7, -1.5, -2, -2.6, -2.5, -1.8, -0.6, 0.4, 1, 1.6, 2, 1, -0.8, -2,
    -0.8, 0,
  ],
  gaze: [
    0, -0.1, -0.2, -0.3, -0.4, -0.3, -0.1, 0, 0.1, 0.2, 0.3, 0.7, 1.1, 0.9, 0.3,
    -0.1, 0,
  ],
};
export function throwPerformance(id: Person, style: CornholeStyle) {
  const source = id === 'dan' ? dan : doug;
  const frames = (id === 'dan' ? danFrames : dougFrames).map(
    (frame, i) =>
      frame +
      (i >= 7
        ? style === 'airmail'
          ? 7
          : style === 'blocker'
            ? 3
            : style === 'slide'
              ? 2
              : style === 'roll'
                ? 1
                : 0
        : 0),
  );
  const channels = Object.fromEntries(
    Object.entries(source).map(([key, values]) => [key, [...values]]),
  ) as typeof dan;
  // Shot choice changes the athlete's path, loading and hand presentation,
  // not just a different ballistic endpoint. Endpoints still join neutral.
  if (style === 'airmail') {
    for (let i = 8; i <= 14; i++) {
      const weight = [0.1, 0.6, 1, 1, 1, 0.8, 0.3][i - 8];
      channels.upper_arm_L[i] -= 11 * weight;
      channels.forearm_L[i] -= 2 * weight;
      channels.palm[i] -= 5 * weight;
      channels.pelvisX[i] -= 5 * weight;
      channels.pelvisY[i] += 2 * weight;
      channels.chest[i] -= 0.8 * weight;
    }
  } else if (style === 'slide' || style === 'blocker') {
    for (let i = 8; i <= 14; i++) {
      const weight = [0.2, 0.6, 1, 1, 0.8, 0.5, 0.2][i - 8];
      channels.upper_arm_L[i] += (style === 'blocker' ? 10 : 5) * weight;
      channels.pelvisX[i] -= 3 * weight;
      channels.pelvisY[i] += (style === 'slide' ? 2 : 1) * weight;
    }
  } else if (style === 'roll') {
    for (let i = 7; i <= 13; i++) {
      const weight = [0.3, 0.7, 1, 1, 0.6, 0.2, 0][i - 7];
      channels.palm[i] += 14 * weight;
      channels.forearm_L[i] -= 3 * weight;
      channels.chest[i] += 0.35 * weight;
    }
  }
  return {
    duration: frames.at(-1)!,
    release: frames[10],
    landmarks: phases.map((name, i) => ({ name, frame: frames[i] })),
    tracks: Object.fromEntries(
      Object.entries(channels).map(([key, values]) => [
        key,
        values.map((value, i): Knot => [frames[i], value]),
      ]),
    ) as Record<keyof typeof dan, Knot[]>,
  };
}
