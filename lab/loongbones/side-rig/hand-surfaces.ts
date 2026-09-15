import type { Knot } from '../cornhole-motion/curves';

const opacity = (name: string, points: Knot[], duration: number) => ({
  name,
  // Exposure changes, not a dissolve: semi-transparent overlapping fingers
  // read as a malformed hand. Body/wrist motion still uses continuous curves.
  colorFrame: points.map(([time, alpha], i) => ({
    duration: (points[i + 1]?.[0] ?? duration) - time,
    value: { aM: alpha },
  })),
});

/** Registered drawings share a wrist. Keep the extended release fingers until
 * the arm is descending; changing to dangling fingers at the apex reads as a
 * broken wrist. Each exposure is a single opaque drawing. */
export function handSurfaces(end: number, release?: number) {
  if (release === undefined)
    return ['grip', 'open', 'relaxed'].map((name) =>
      opacity(
        name,
        [
          [0, name === 'relaxed' ? 100 : 0],
          [end, name === 'relaxed' ? 100 : 0],
        ],
        end,
      ),
    );
  const relax = end - 27;
  return [
    opacity(
      'grip',
      [
        [0, 0],
        [4, 100],
        [release, 0],
        [end, 0],
      ],
      end,
    ),
    opacity(
      'open',
      [
        [0, 0],
        [release, 100],
        [relax, 0],
        [end, 0],
      ],
      end,
    ),
    opacity(
      'relaxed',
      [
        [0, 100],
        [4, 0],
        [relax, 100],
        [end, 100],
      ],
      end,
    ),
  ];
}

/** Bounded palm gesture; authored hand surface changes use the same pose clock. */
export function gestureHand(end: number, begin: number, finish: number) {
  return [
    opacity(
      'grip',
      [
        [0, 0],
        [end, 0],
      ],
      end,
    ),
    opacity(
      'open',
      [
        [0, 0],
        [begin, 0],
        [begin + 2, 100],
        [finish, 100],
        [finish + 2, 0],
        [end, 0],
      ],
      end,
    ),
    opacity(
      'relaxed',
      [
        [0, 100],
        [begin, 100],
        [begin + 2, 0],
        [finish, 0],
        [finish + 2, 100],
        [end, 100],
      ],
      end,
    ),
  ];
}
