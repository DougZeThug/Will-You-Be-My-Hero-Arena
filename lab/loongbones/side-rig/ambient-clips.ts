import { scalarTrack, type Knot } from '../cornhole-motion/curves';
import { handSurfaces, gestureHand } from './hand-surfaces';
import type { Person } from './anatomy';

const rotate = (name: string, points: Knot[], end: number) => ({
  name,
  rotateFrame: scalarTrack(points, end, 'rotate'),
});
const pulse = (amount: number, end: number, lag = 0): Knot[] => [
  [0, 0],
  [Math.round(end * 0.32) + lag, amount],
  [Math.round(end * 0.64) + lag, amount * 0.35],
  [end, 0],
];
const wrist = (end: number) =>
  rotate(
    'hand_L',
    [
      [0, 58],
      [end, 58],
    ],
    end,
  );

/** Small authored performances, not a common shake with different amplitudes.
 * Dan watches the result and settles his chest. Doug answers with the palm,
 * then lowers the arm before settling his head. All end at the same bind rest. */
export function ambientClips(id: Person) {
  const dan = id === 'dan';
  const idle = (
    name: string,
    amount: number,
    duration: number,
    shift = 0,
    glance = 0,
  ) => ({
    name,
    duration,
    playTimes: 0,
    slot: handSurfaces(duration),
    bone: [
      rotate(
        'chest',
        [
          [0, 0],
          [Math.round(duration * 0.45), amount],
          [duration, 0],
        ],
        duration,
      ),
      rotate(
        'neck',
        [
          [0, 0],
          [Math.round(duration * 0.45), -amount],
          [duration, 0],
        ],
        duration,
      ),
      rotate(
        'head',
        [
          [0, 0],
          [Math.round(duration * 0.55), glance],
          [Math.round(duration * 0.7), glance],
          [duration, 0],
        ],
        duration,
      ),
      {
        name: 'pelvis',
        translateFrame: scalarTrack(
          [
            [0, 0],
            [duration * 0.5, shift],
            [duration, 0],
          ],
          duration,
          'x',
        ).map((f) => ({ ...f, y: Number(f.x) * 0.24 })),
      },
      wrist(duration),
    ],
  });
  const reaction = (name: string, head: number, arm = 0, elbow = 0) => {
    const duration = 76,
      gesture = arm !== 0;
    return {
      name,
      duration,
      playTimes: 1,
      slot: gesture ? gestureHand(duration, 11, 57) : handSurfaces(duration),
      bone: [
        rotate('head', pulse(head, duration, dan ? 0 : 4), duration),
        rotate('neck', pulse(-head * 0.2, duration, 2), duration),
        rotate('chest', pulse(dan ? 0.65 : -0.45, duration, -3), duration),
        rotate('spine_mid', pulse(dan ? -0.3 : 0.2, duration, -4), duration),
        rotate('upper_arm_L', pulse(arm, duration, -3), duration),
        rotate('forearm_L', pulse(elbow, duration, 1), duration),
        wrist(duration),
      ],
      frame: [
        { duration, events: [{ name: 'reaction' }] },
        { duration: 0, events: [{ name: 'animationComplete' }] },
      ],
    };
  };
  return [
    idle('neutral', 0, 180),
    idle('idle_breathe', dan ? 0.3 : 0.45, dan ? 210 : 180),
    idle('weight_shift', dan ? 0.45 : 0.6, 210, dan ? 3 : 6),
    idle('idle_scan', 0.25, 180, 0, dan ? 1.5 : 3),
    reaction('quiet_nod', dan ? 3 : 2),
    reaction('reset_nod', dan ? -2.5 : -3.5),
    reaction(
      'celebrate_open_hand',
      dan ? -2 : -4,
      dan ? 0 : -16,
      dan ? 0 : -20,
    ),
    reaction('inspect_hand', dan ? 4 : 7, dan ? -11 : -15, dan ? -30 : -36),
    reaction('bag_squeeze', 1, -5, -12),
    reaction('look_target', -1.5),
    reaction('enter_lockin', dan ? -2 : -3),
  ];
}
