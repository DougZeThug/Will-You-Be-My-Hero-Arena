import { registerAnimation, animation } from './AnimationRegistry';
import type {
  AnimationClip,
  AnimationCategory,
  AnimationMarker,
} from './AnimationTypes';
import { REST, type PuppetPose } from '../../puppet-motion';
import { sportThrowMotion, THROW_RELEASE } from './SportMechanics';
type Pose = Partial<PuppetPose>;
const guard: Pose = {
  body: -3,
  handLX: -30,
  handLY: -248,
  handRX: 59,
  handRY: -250,
  footLX: -46,
  footRX: 48,
  hipY: -167,
};
function clip(
  id: string,
  category: AnimationCategory,
  duration: number,
  poses: [number, Pose][],
  markers: AnimationMarker[] = [],
  loop = false,
) {
  registerAnimation({
    id,
    category,
    duration,
    tags: id.split('.'),
    weight: 1,
    intensity: 0.5,
    markers,
    loop,
    motion: {
      label: id,
      keys: poses.map(([at, pose]) => ({ at, pose: { ...REST, ...pose } })),
    },
  });
}
const attack = (id: string, duration: number, anticipate: Pose, strike: Pose) =>
  clip(
    id,
    'interaction',
    duration,
    [
      [0, guard],
      [0.22, { ...guard, ...anticipate }],
      [0.38, { ...guard, ...strike }],
      [0.54, { ...guard, ...strike }],
      [0.83, guard],
      [1, guard],
    ],
    [
      { name: 'hitboxOn', at: 0.32 },
      { name: 'hitboxOff', at: 0.54 },
      { name: 'cancelWindow', at: 0.72 },
    ],
  );
clip(
  'combat.stance',
  'idle',
  2.2,
  [
    [0, guard],
    [0.5, { ...guard, hipY: -164, body: -1, handRY: -246 }],
    [1, guard],
  ],
  [],
  true,
);
attack(
  'combat.jab',
  0.48,
  { handRX: 35, handRY: -247, body: -5 },
  { handRX: 136, handRY: -249, hipX: 5, body: 5 },
);
attack(
  'combat.cross',
  0.72,
  { handRX: 15, handRY: -246, body: -9 },
  { handRX: 146, handRY: -244, hipX: 9, body: 8 },
);
attack(
  'combat.uppercut',
  0.8,
  { handRX: 54, handRY: -201, hipY: -161, body: 3 },
  { handRX: 92, handRY: -319, hipY: -176, body: -7 },
);
attack(
  'combat.finisher',
  0.94,
  { handRX: 5, handRY: -226, body: -12 },
  { handRX: 150, handRY: -249, hipX: 14, body: 11, footRX: 55 },
);
attack(
  'combat.special',
  0.98,
  { handLX: -28, handLY: -248, handRX: 18, handRY: -209, body: -10 },
  { handRX: 149, handRY: -251, handLX: 27, handLY: -244, hipX: 13, body: 12 },
);
attack(
  'combat.grapple',
  0.84,
  { handRX: 58, handRY: -227 },
  { handRX: 124, handRY: -247, handLX: 87, handLY: -250, body: 7 },
);
clip('combat.block', 'interaction', 0.35, [
  [0, guard],
  [
    0.35,
    { ...guard, handRX: 28, handRY: -280, handLX: 1, handLY: -270, body: -7 },
  ],
  [
    1,
    { ...guard, handRX: 28, handRY: -280, handLX: 1, handLY: -270, body: -7 },
  ],
]);
clip(
  'combat.dodge',
  'locomotion',
  0.55,
  [
    [0, guard],
    [0.35, { ...guard, hipY: -143, body: -14, handRY: -225, handLY: -220 }],
    [0.65, { ...guard, hipY: -145, body: -11 }],
    [1, guard],
  ],
  [{ name: 'cancelWindow', at: 0.85 }],
);
clip('combat.hit', 'reaction', 0.38, [
  [0, guard],
  [0.25, { ...guard, body: -13, head: -15, hipX: -8, handRX: 38 }],
  [1, guard],
]);
clip('combat.heavyHit', 'reaction', 0.72, [
  [0, guard],
  [
    0.24,
    {
      ...guard,
      body: -19,
      head: -17,
      hipY: -151,
      hipX: -16,
      handRX: 37,
      handRY: -202,
    },
  ],
  [0.7, { ...guard, body: -10, hipY: -154 }],
  [1, guard],
]);
clip('combat.defeat', 'reaction', 1.2, [
  [0, guard],
  [
    0.45,
    {
      hipY: -139,
      body: 20,
      head: 17,
      handLX: -35,
      handLY: -110,
      handRX: 44,
      handRY: -116,
    },
  ],
  [
    1,
    {
      hipY: -140,
      body: 18,
      head: 18,
      handLX: -35,
      handLY: -110,
      handRX: 44,
      handRY: -116,
    },
  ],
]);
clip(
  'athletic.jump',
  'locomotion',
  0.8,
  [
    [0, { hipY: -156, handLY: -157, handRY: -157 }],
    [
      0.24,
      {
        hipY: -177,
        handLX: -35,
        handLY: -217,
        handRX: 56,
        handRY: -228,
        footLY: -45,
        footRY: -41,
      },
    ],
    [0.7, { hipY: -174, footLY: -34, footRY: -34 }],
    [1, {}],
  ],
  [
    { name: 'jump', at: 0.12 },
    { name: 'land', at: 0.95 },
  ],
);
clip('running.stumble', 'reaction', 0.75, [
  [0, {}],
  [
    0.2,
    {
      body: 17,
      hipY: -153,
      handLX: -67,
      handLY: -209,
      handRX: 102,
      handRY: -212,
      footRX: 57,
    },
  ],
  [0.55, { body: 9, hipY: -160 }],
  [
    1,
    {
      body: 0,
      hipY: -172,
      handLX: -53,
      handLY: -142,
      handRX: 55,
      handRY: -142,
      footRX: 41,
    },
  ],
]);
clip('running.slide', 'locomotion', 0.62, [
  [0, {}],
  [
    0.26,
    {
      hipY: -140,
      body: -15,
      footRX: 72,
      footLX: -49,
      handLY: -157,
      handRY: -177,
    },
  ],
  [0.65, { hipY: -140, body: -12, footRX: 66 }],
  [
    1,
    {
      hipY: -172,
      body: 0,
      footRX: 41,
      footLX: -40,
      handLY: -142,
      handRY: -142,
    },
  ],
]);
for (const [id, shot] of [
  ['throw.precision', 'flat'],
  ['throw.airmail.live', 'airmail'],
  ['throw.roll.live', 'roll'],
] as const) {
  const motion = sportThrowMotion('cornhole', shot);
  clip(
    id,
    'throw',
    0.78,
    motion.keys.map(k => [k.at <= THROW_RELEASE ? k.at / THROW_RELEASE * .44 : .44 + (k.at - THROW_RELEASE) / (1 - THROW_RELEASE) * .56, k.pose]),
    [
      { name: 'release', at: 0.44 },
      { name: 'cancelWindow', at: 0.92 },
    ],
  );
}
export function semanticClip(id: string): AnimationClip {
  const aliases: Record<string, string> = {
    'locomotion.walk': 'walk',
    'locomotion.run': 'run',
    'locomotion.sprint': 'sprint',
    'locomotion.idle': 'idle_breathe',
    'combat.heavy': 'combat.cross',
    'reaction.success': 'fist_pump',
    'reaction.failure': 'head_shake',
    'celebration.chestTap': 'chest_tap',
  };
  return animation(aliases[id] ?? id);
}
