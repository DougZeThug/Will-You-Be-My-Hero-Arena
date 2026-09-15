import {clip} from '../authoring/clips';
export const danClips = [
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
        frame: 78,
        pose: {
          chest: { r: -0.35, x: 2.1 },
          neck: { r: 0.25 },
          head: { r: 0.3 },
          upper_arm_R: { r: 0.6 },
          forearm_R: { r: -0.6 },
        },
      },
      { frame: 180, pose: {} },
    ],
    true,
  ),
  clip('look_target', 120, [
    { frame: 0, pose: {} },
    {
      frame: 28,
      pose: { head: { r: -3.5 }, neck: { r: 0.6 }, chest: { r: -0.4 } },
    },
    {
      frame: 75,
      pose: { head: { r: -3.5 }, neck: { r: 0.6 }, chest: { r: -0.4 } },
    },
    { frame: 120, pose: {} },
  ]),
  clip('arm_check', 150, [
    { frame: 0, pose: {} },
    {
      frame: 40,
      pose: {
        upper_arm_R: { r: -18 },
        forearm_R: { r: -32 },
        hand_R: { r: 8 },
        clavicle_R: { r: -0.8 },
      },
    },
    {
      frame: 74,
      pose: {
        upper_arm_R: { r: -18 },
        forearm_R: { r: -32 },
        hand_R: { r: 8 },
        clavicle_R: { r: -0.8 },
      },
    },
    { frame: 150, pose: {} },
  ]),
  clip('throw_low', 150, [
    { frame: 0, pose: {}, event: 'grab' },
    {
      frame: 26,
      pose: {
        upper_arm_R: { r: 8 },
        forearm_R: { r: 9 },
        hand_R: { r: -6 },
        chest: { r: 0.6 },
      },
    },
    {
      frame: 43,
      pose: {
        upper_arm_R: { r: -27 },
        forearm_R: { r: -26 },
        hand_R: { r: 4 },
        chest: { r: -0.8 },
      },
      event: 'release',
    },
    {
      frame: 63,
      pose: {
        upper_arm_R: { r: -34 },
        forearm_R: { r: -18 },
        hand_R: { r: 9 },
        chest: { r: -1.1 },
      },
    },
    {
      frame: 100,
      pose: {
        upper_arm_R: { r: -7 },
        forearm_R: { r: -8 },
        chest: { r: -0.35 },
      },
      event: 'recovery',
    },
    { frame: 150, pose: {}, event: 'animationComplete' },
  ]),
  clip('quiet_nod', 90, [
    { frame: 0, pose: {} },
    { frame: 20, pose: { head: { r: 4.5 }, neck: { r: 0.5 } } },
    { frame: 42, pose: { head: { r: -1.2 } } },
    { frame: 90, pose: {}, event: 'animationComplete' },
  ]),
  clip('weight_shift', 180, [
    { frame: 0, pose: {} },
    {
      frame: 65,
      pose: {
        pelvis: { x: -4, y: 5, r: 0.45 },
        spine_lower: { r: -0.7 },
        chest: { r: 0.25 },
      },
    },
    {
      frame: 100,
      pose: {
        pelvis: { x: -4, y: 5, r: 0.45 },
        spine_lower: { r: -0.7 },
        chest: { r: 0.25 },
      },
    },
    { frame: 180, pose: {} },
  ]),
];
