import { type LibraryBuilder, type BoneTrack } from './builder';
import { motionSignatures } from '../../../lib/arena/engine/motion/CharacterMotionSignature';
import { gestureHand } from '../../loongbones/side-rig/hand-surfaces';
import type { Knot } from '../../loongbones/cornhole-motion/curves';
import type { MotionMarker } from '../../../lib/arena/engine/motion/MotionTypes';
/** Semantic, equipment-independent gestures. Athletic clips never contain celebration logic. */
export function addGestures(
  library: LibraryBuilder,
  id: 'dan' | 'doug',
  plants: MotionMarker[],
) {
  const energy = motionSignatures[id].gestureEnergy;
  const add = (
    name: string,
    end: number,
    channels: Record<string, Knot[]>,
    markers: MotionMarker[] = [],
    translation: BoneTrack[] = [],
  ) => {
    library.athletic(
      'gesture.' + name,
      end,
      channels,
      [
        ['anticipation', 0],
        ['active', 0.2],
        ['recovery', (end / 60) * 0.72],
      ],
      [...plants, ...markers],
      {
        layer: 'reaction',
        priority: 5,
        moveControl: 0,
        performanceGain: 0,
        fade: 0.16,
        cancel: [[end / 60, end / 60]],
      },
      translation,
    );
  };
  add(
    'chestTap',
    92,
    {
      upper_arm_L: [
        [0, 0],
        [12, 6],
        [24, 36],
        [30, 45],
        [33, 42],
        [39, 25],
        [49, 45],
        [52, 42],
        [57, 25],
        [66, 7],
        [82, 0],
        [92, 0],
      ],
      forearm_L: [
        [0, 0],
        [12, -30],
        [24, -104],
        [30, -115],
        [33, -109],
        [39, -83],
        [49, -115],
        [52, -109],
        [57, -83],
        [66, -50],
        [82, -5],
        [92, 0],
      ],
      hand_L: [
        [0, 58],
        [12, 40],
        [24, 0],
        [30, -10],
        [36, -10],
        [41, -6],
        [49, -10],
        [54, -10],
        [60, 8],
        [82, 58],
        [92, 58],
      ],
      clavicle_L: [
        [0, 0],
        [24, -2],
        [30, -3],
        [35, -1],
        [49, -3],
        [54, -1],
        [76, 0],
        [92, 0],
      ],
      spine_lower: [
        [0, 0],
        [24, -0.8],
        [30, -1.2],
        [35, -0.5],
        [49, -1.2],
        [54, -0.5],
        [80, 0],
        [92, 0],
      ],
      chest: [
        [0, 0],
        [24, -1],
        [30, -1],
        [33, 2.5],
        [40, -0.8],
        [49, -1],
        [52, 2.5],
        [61, -0.6],
        [76, 0],
        [92, 0],
      ],
      neck: [
        [0, 0],
        [26, 1],
        [37, 1.7],
        [57, 1],
        [78, 0],
        [92, 0],
      ],
      head: [
        [0, 0],
        [24, -1.5],
        [35, 2 * energy],
        [46, -1],
        [56, 1.2 * energy],
        [82, 0],
        [92, 0],
      ],
      upper_arm_R: [
        [0, 0],
        [22, -3],
        [38, -5],
        [60, -2],
        [82, 0],
        [92, 0],
      ],
    },
    [
      { name: 'chestTapContact', at: 30 / 60 },
      { name: 'chestTapContact2', at: 49 / 60 },
      { name: 'chestTapRelease', at: 55 / 60 },
    ],
  );
  library.native.find((c) => c.name === 'v2_gesture.chestTap')!.slot =
    gestureHand(92, 17, 62);
  add(
    'bagFlip',
    62,
    {
      upper_arm_L: [
        [0, 0],
        [12, -6],
        [18, -8],
        [24, -8],
        [42, -8],
        [46, -2],
        [51, -5],
        [62, 0],
      ],
      forearm_L: [
        [0, 0],
        [12, -17],
        [18, -27],
        [24, -27],
        [42, -27],
        [46, -16],
        [51, -22],
        [62, 0],
      ],
      hand_L: [
        [0, 58],
        [12, 48],
        [18, 48],
        [42, 48],
        [49, 54],
        [62, 58],
      ],
      chest: [
        [0, 0],
        [15, 1.2],
        [24, 1.2],
        [42, 1.2],
        [56, 0],
        [62, 0],
      ],
      head: [
        [0, 0],
        [14, 1.4],
        [23, -1],
        [32, -2],
        [43, 1],
        [58, 0],
        [62, 0],
      ],
      upper_arm_R: [
        [0, 0],
        [18, -3],
        [35, -5],
        [51, -1],
        [62, 0],
      ],
    },
    [
      { name: 'propToss', at: 24 / 60 },
      { name: 'propCatch', at: 42 / 60 },
    ],
  );
  // Grip before/after catch; opening during the actual toss, all opaque.
  library.native.find((c) => c.name === 'v2_gesture.bagFlip')!.slot = [
    'grip',
    'open',
    'relaxed',
  ].map((name) => ({
    name,
    colorFrame: [
      [0, 'grip'],
      [24, 'open'],
      [42, 'grip'],
      [62, 'grip'],
    ].map(([f, exposure], i, all) => ({
      duration: Number(all[i + 1]?.[0] ?? 62) - Number(f),
      value: { aM: name === exposure ? 100 : 0 },
    })),
  }));
  add('fistPump', 74, {
    upper_arm_L: [
      [0, 0],
      [14, -14],
      [27, -55 * energy],
      [33, -59 * energy],
      [42, -22],
      [48, -30],
      [63, -5],
      [74, 0],
    ],
    forearm_L: [
      [0, 0],
      [14, -40],
      [27, -90],
      [33, -98],
      [42, -60],
      [48, -68],
      [63, -20],
      [74, 0],
    ],
    chest: [
      [0, 0],
      [22, -2 * energy],
      [34, -1.2],
      [60, 0],
      [74, 0],
    ],
    head: [
      [0, 0],
      [22, -2],
      [37, 1],
      [60, 0],
      [74, 0],
    ],
    hand_L: [
      [0, 58],
      [74, 58],
    ],
  });
  add('subtleNod', 50, {
    head: [
      [0, 0],
      [14, 2.7 * energy],
      [23, -1.2],
      [38, 0.3],
      [50, 0],
    ],
    neck: [
      [0, 0],
      [19, 0.8],
      [35, 0],
      [50, 0],
    ],
    chest: [
      [0, 0],
      [19, 0.7],
      [40, 0],
      [50, 0],
    ],
  });
  add('headShake', 64, {
    head: [
      [0, 0],
      [15, -3],
      [26, 2.5],
      [37, -2],
      [48, 1],
      [64, 0],
    ],
    neck: [
      [0, 0],
      [25, 1.1],
      [44, 0.5],
      [64, 0],
    ],
    chest: [
      [0, 0],
      [20, 1.3],
      [42, 0.6],
      [64, 0],
    ],
  });
  add('shrug', 72, {
    clavicle_L: [
      [0, 0],
      [22, -4],
      [34, -3],
      [52, 0],
      [72, 0],
    ],
    clavicle_R: [
      [0, 0],
      [26, 4],
      [38, 3],
      [57, 0],
      [72, 0],
    ],
    upper_arm_L: [
      [0, 0],
      [23, -14],
      [35, -12],
      [55, -3],
      [72, 0],
    ],
    forearm_L: [
      [0, 0],
      [25, -42],
      [36, -35],
      [55, -12],
      [72, 0],
    ],
    hand_L: [
      [0, 58],
      [30, 66],
      [60, 58],
      [72, 58],
    ],
    upper_arm_R: [
      [0, 0],
      [27, -10],
      [40, -8],
      [60, 0],
      [72, 0],
    ],
    head: [
      [0, 0],
      [27, 3],
      [45, 2],
      [72, 0],
    ],
  });
  add('breathReset', 42, {
    chest: [
      [0, 0],
      [17, -1.2],
      [32, 0.4],
      [42, 0],
    ],
    neck: [
      [0, 0],
      [21, 1],
      [35, 0.3],
      [42, 0],
    ],
    head: [
      [0, 0],
      [18, 1.4],
      [35, 0],
      [42, 0],
    ],
  });
  add('shoulderRoll', 46, {
    clavicle_L: [
      [0, 0],
      [11, -3],
      [22, 1.5],
      [34, 1],
      [46, 0],
    ],
    clavicle_R: [
      [0, 0],
      [16, 2],
      [27, -1],
      [38, -0.6],
      [46, 0],
    ],
    chest: [
      [0, 0],
      [15, -1],
      [29, 0.8],
      [46, 0],
    ],
    upper_arm_L: [
      [0, 0],
      [18, -3],
      [31, 2],
      [46, 0],
    ],
  });
}
