import { addGaits, type GaitTuning } from './gait';
import {
  rotation,
  translate,
  pulse,
  type BoneTrack,
  type LibraryBuilder,
} from './builder';
import { handSurfaces } from '../../loongbones/side-rig/hand-surfaces';
import type { MotionMarker } from '../../../lib/arena/engine/motion/MotionTypes';
import { motionProfiles } from '../../../lib/arena/engine/motion/MotionTypes';
export function addLocomotion(
  library: LibraryBuilder,
  id: 'dan' | 'doug',
  plants: MotionMarker[],
  gait: GaitTuning = {},
) {
  const { add, athletic } = library;
  addGaits(library, id, gait);
  athletic(
    'pivot',
    36,
    {
      pelvis: pulse(-2, 36),
      chest: pulse(3, 36),
      head: pulse(2, 36),
      hand_L: [
        [0, 58],
        [36, 58],
      ],
    },
    [
      ['plant', 0],
      ['recovery', 0.35],
    ],
    plants,
    { layer: 'base', priority: 0, loop: true, moveControl: 1 },
  );
  athletic(
    'airborne',
    48,
    {
      chest: [
        [0, 3],
        [48, 3],
      ],
      hand_L: [
        [0, 58],
        [48, 58],
      ],
    },
    [['airborne', 0]],
    [],
    { layer: 'base', priority: 0, loop: true, moveControl: 1 },
  );
  const jumpMarkers: MotionMarker[] = [
    { name: 'footRelease', foot: 'right', at: 0 },
    { name: 'footRelease', foot: 'left', at: 0 },
    { name: 'footPlant', foot: 'right', at: 0.18 },
    { name: 'takeoff', at: 0.28 },
    { name: 'footRelease', foot: 'right', at: 0.28 },
    { name: 'footRelease', foot: 'left', at: 0.28 },
  ];
  athletic(
    'jump',
    65,
    {
      chest: pulse(4, 65),
      neck: pulse(-3, 65),
      upper_arm_L: pulse(-26, 65),
      forearm_L: [
        [0, -60],
        [18, -72],
        [36, -42],
        [65, -60],
      ],
      upper_arm_R: pulse(-22, 65),
      forearm_R: [
        [0, -58],
        [18, -66],
        [36, -40],
        [65, -58],
      ],
      hand_L: [
        [0, 58],
        [65, 58],
      ],
    },
    [
      ['load', 0],
      ['plant', 0.18],
      ['airborne', 0.28],
      ['recovery', 0.95],
    ],
    jumpMarkers,
    { moveControl: 1, technique: 'jump' },
    [
      translate(
        'pelvis',
        [
          [0, 0, 0],
          [12, 0, 25],
          [18, 0, 0],
          [48, 0, 0],
          [57, 0, 17],
          [65, 0, 0],
        ],
        65,
      ),
    ],
  );
}
