import type { MotionClip } from './MotionTypes';
export type Technique = NonNullable<MotionClip['technique']>;
/** Shared response configuration. Authored poses still supply the primary performance. */
export const techniqueResponse: Record<
  Technique,
  {
    energy: number;
    delay: number;
    load: number;
    arm: number;
    compression: number;
  }
> = {
  underhand: { energy: 1, delay: 1, load: -0.72, arm: -1, compression: 8 },
  overhead: {
    energy: 0.65,
    delay: 0.6,
    load: -0.45,
    arm: -0.5,
    compression: 8,
  },
  stride: { energy: 0.65, delay: 0.4, load: -0.4, arm: -1, compression: 3 },
  jump: { energy: 0.75, delay: 0.65, load: -0.5, arm: -0.6, compression: 8 },
  strike: { energy: 0.9, delay: 0.45, load: -0.5, arm: -0.8, compression: 6 },
  evade: { energy: -0.55, delay: 0.5, load: 0.2, arm: 0.3, compression: 6 },
  impact: { energy: -0.8, delay: 0.7, load: 0, arm: 0.4, compression: 5 },
};
export const responseChain = [
  ['pelvis', 0, 0.7],
  ['spine_lower', 0.018, 0.65],
  ['spine_mid', 0.038, 0.6],
  ['chest', 0.058, 1.1],
  ['clavicle_L', 0.08, 1.2],
  ['upper_arm_L', 0.105, 3.2],
  ['forearm_L', 0.133, 3.6],
  ['hand_L', 0.158, 3.8],
] as const;
export const kineticRecipes = {
  cornhole: [
    'supportFoot',
    'pelvis',
    'spine',
    'chest',
    'clavicle',
    'shoulder',
    'elbow',
    'wrist',
    'bag',
  ],
  basketball: [
    'feet',
    'ankles',
    'knees',
    'hips',
    'pelvis',
    'spine',
    'chest',
    'shoulder',
    'elbow',
    'wrist',
    'ball',
  ],
  running: [
    'contact',
    'load',
    'stance',
    'pushOff',
    'toeOff',
    'swing',
    'nextContact',
  ],
  football: [
    'rearFoot',
    'hips',
    'pelvis',
    'spine',
    'chest',
    'shoulder',
    'elbow',
    'wrist',
    'football',
  ],
  fighting: [
    'supportFoot',
    'leg',
    'hip',
    'pelvis',
    'spine',
    'chest',
    'shoulder',
    'fist',
    'recovery',
  ],
} as const;
