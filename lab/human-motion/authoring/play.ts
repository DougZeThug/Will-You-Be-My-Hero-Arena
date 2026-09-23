import { smoothTranslate, type LibraryBuilder } from './builder';

/** Clips the Play running event needs beyond the Human Motion proofs.
 *
 * `slide`: duck under a bar at speed. The base gait keeps the legs cycling
 * underneath; the lowered pelvis bends the knees through the planted foot IK,
 * the torso pitches over the hips, the head counters to keep the eyes on the
 * lane and the arms reach forward for balance. Authored Arena motion, not a
 * capture; its length matches the simulation's 0.6 s slide.
 */
export function addPlayRunning(library: LibraryBuilder) {
  const end = 36;
  library.athletic(
    'slide',
    end,
    {
      spine_lower: [
        [0, 0],
        [8, 10],
        [26, 12],
        [end, 0],
      ],
      spine_mid: [
        [0, 0],
        [8, 12],
        [26, 13],
        [end, 0],
      ],
      chest: [
        [0, 3],
        [8, 15],
        [26, 16],
        [end, 3],
      ],
      neck: [
        [0, 0],
        [8, -10],
        [26, -10],
        [end, 0],
      ],
      head: [
        [0, 0],
        [8, -18],
        [26, -18],
        [end, 0],
      ],
      upper_arm_L: [
        [0, 0],
        [8, -55],
        [26, -50],
        [end, 0],
      ],
      forearm_L: [
        [0, -60],
        [8, -40],
        [26, -45],
        [end, -60],
      ],
      upper_arm_R: [
        [0, 0],
        [8, -45],
        [26, -40],
        [end, 0],
      ],
      forearm_R: [
        [0, -58],
        [8, -40],
        [26, -42],
        [end, -58],
      ],
      hand_L: [
        [0, 58],
        [end, 58],
      ],
    },
    [
      ['load', 0],
      ['recovery', 0.45],
    ],
    [],
    { moveControl: 1 },
    [
      smoothTranslate(
        'pelvis',
        [
          [0, 0, 0],
          [8, 0, 150],
          [26, 0, 160],
          [end, 0, 0],
        ],
        end,
      ),
    ],
  );
}
