import { clip } from '../authoring/clips';
/** Doug performs a straighter, faster pendulum than Dan, with a restrained
 * pre-shot squeeze and a visible wrist follow-through. All keys are authored
 * against his own source anatomy, in degrees/source pixels. */
export const dougClips = [
  clip(
    'neutral',
    60,
    [
      { frame: 0, pose: {} },
      { frame: 60, pose: {} },
    ],
    true,
  ),
  clip(
    'idle_breathe',
    180,
    [
      { frame: 0, pose: {} },
      {
        frame: 74,
        pose: {
          chest: { r: -0.3, y: -0.35 },
          neck: { r: 0.3 },
          upper_arm_L: { r: 0.5 },
          forearm_R: { r: -0.8 },
        },
      },
      { frame: 180, pose: {} },
    ],
    true,
  ),
  clip(
    'idle_scan',
    210,
    [
      { frame: 0, pose: {} },
      { frame: 55, pose: { head: { r: -2.8 }, neck: { r: 0.5 } } },
      { frame: 122, pose: { head: { r: 1.5 }, neck: { r: -0.2 } } },
      { frame: 210, pose: {} },
    ],
    true,
  ),
  clip(
    'weight_shift',
    168,
    [
      { frame: 0, pose: {} },
      {
        frame: 61,
        pose: {
          pelvis: { x: -0.5, y: 0.8, r: 0.25 },
          spine_lower: { r: -0.5 },
          chest: { r: 0.35 },
        },
      },
      {
        frame: 105,
        pose: {
          pelvis: { x: -0.5, y: 0.8, r: 0.25 },
          spine_lower: { r: -0.5 },
          chest: { r: 0.35 },
        },
      },
      { frame: 168, pose: {} },
    ],
    true,
  ),
  clip('enter_lockin', 96, [
    { frame: 0, pose: {} },
    {
      frame: 28,
      pose: {
        chest: { r: -0.8 },
        head: { r: -2.4 },
        forearm_R: { r: -21 },
        hand_R: { r: -6 },
      },
    },
    {
      frame: 51,
      pose: { head: { r: 1.6 }, forearm_R: { r: -12 }, hand_R: { r: 5 } },
    },
    { frame: 96, pose: {}, event: 'animationComplete' },
  ]),
  clip('bag_squeeze', 84, [
    { frame: 0, pose: {}, event: 'grab' },
    {
      frame: 25,
      pose: { forearm_R: { r: -13 }, hand_R: { r: -9 }, head: { r: 1.2 } },
    },
    { frame: 47, pose: { forearm_R: { r: -10 }, hand_R: { r: 4 } } },
    { frame: 84, pose: {}, event: 'animationComplete' },
  ]),
  clip('throw_flat', 126, [
    { frame: 0, pose: {}, event: 'grab' },
    {
      frame: 24,
      pose: {
        upper_arm_R: { r: 14 },
        forearm_R: { r: -6 },
        hand_R: { r: -8 },
        chest: { r: 0.6 },
        head: { r: -0.4 },
      },
    },
    {
      frame: 39,
      pose: {
        upper_arm_R: { r: -25 },
        forearm_R: { r: 5 },
        hand_R: { r: -55 },
        chest: { r: -1 },
        upper_arm_L: { r: 1.5 },
      },
      event: 'release',
    },
    {
      frame: 58,
      pose: {
        upper_arm_R: { r: -35 },
        forearm_R: { r: -3 },
        hand_R: { r: -55 },
        chest: { r: -1.2 },
        head: { r: -1.5 },
      },
    },
    {
      frame: 88,
      pose: {
        upper_arm_R: { r: -18 },
        forearm_R: { r: -9 },
        hand_R: { r: -10 },
        chest: { r: -0.35 },
      },
      event: 'recovery',
    },
    { frame: 126, pose: {}, event: 'animationComplete' },
  ]),
  clip('throw_arc', 156, [
    { frame: 0, pose: {}, event: 'grab' },
    {
      frame: 32,
      pose: {
        upper_arm_R: { r: 9 },
        forearm_R: { r: 1 },
        hand_R: { r: -7 },
        head: { r: -2 },
      },
    },
    {
      frame: 51,
      pose: {
        upper_arm_R: { r: -44 },
        forearm_R: { r: -10 },
        hand_R: { r: -40 },
        chest: { r: -0.9 },
      },
      event: 'release',
    },
    {
      frame: 79,
      pose: {
        upper_arm_R: { r: -49 },
        forearm_R: { r: -8 },
        hand_R: { r: -35 },
        chest: { r: -1.1 },
        head: { r: -2.5 },
      },
    },
    {
      frame: 118,
      pose: { upper_arm_R: { r: -14 }, forearm_R: { r: -6 } },
      event: 'recovery',
    },
    { frame: 156, pose: {}, event: 'animationComplete' },
  ]),
  clip('celebrate_open_hand', 126, [
    { frame: 0, pose: {} },
    {
      frame: 34,
      pose: {
        upper_arm_R: { r: -12 },
        forearm_R: { r: -60 },
        hand_R: { r: -26 },
        head: { r: -2.6 },
        upper_arm_L: { r: -2 },
      },
    },
    {
      frame: 63,
      pose: {
        upper_arm_R: { r: -12 },
        forearm_R: { r: -60 },
        hand_R: { r: -12 },
        head: { r: -1 },
      },
    },
    { frame: 126, pose: {}, event: 'animationComplete' },
  ]),
  clip('inspect_hand', 114, [
    { frame: 0, pose: {} },
    {
      frame: 32,
      pose: {
        upper_arm_R: { r: -10 },
        forearm_R: { r: -40 },
        hand_R: { r: -10 },
        head: { r: 3.5 },
      },
    },
    {
      frame: 59,
      pose: {
        upper_arm_R: { r: -10 },
        forearm_R: { r: -40 },
        hand_R: { r: 9 },
        head: { r: 1.2 },
      },
    },
    { frame: 114, pose: {}, event: 'animationComplete' },
  ]),
  clip('reset_nod', 90, [
    { frame: 0, pose: {} },
    { frame: 22, pose: { head: { r: 3.7 }, neck: { r: 0.5 } } },
    { frame: 44, pose: { head: { r: -1.8 } } },
    { frame: 90, pose: {}, event: 'animationComplete' },
  ]),
];
