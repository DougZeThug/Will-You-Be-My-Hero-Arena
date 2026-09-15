import {
  smoothTranslate as translate,
  rotation,
  pulse,
  contactPulse,
  type LibraryBuilder,
} from './builder';
import type { MotionMarker } from '../../../lib/arena/engine/motion/MotionTypes';
import { motionSignatures } from '../../../lib/arena/engine/motion/CharacterMotionSignature';
export function addCombat(
  library: LibraryBuilder,
  id: 'dan' | 'doug',
  plants: MotionMarker[],
) {
  const { athletic } = library;
  const signature = motionSignatures[id];
  // The complete far-arm material now supports a two-hand guard.
  athletic(
    'combatNeutral',
    90,
    {
      upper_arm_L: [
        [0, -50],
        [45, -51],
        [90, -50],
      ],
      forearm_L: [
        [0, -110],
        [45, -112],
        [90, -110],
      ],
      upper_arm_R: [
        [0, -32],
        [45, -33],
        [90, -32],
      ],
      forearm_R: [
        [0, -92],
        [45, -94],
        [90, -92],
      ],
      hand_L: [
        [0, 58],
        [90, 58],
      ],
      chest: [
        [0, 2 * signature.bodyLean],
        [45, 2.4 * signature.bodyLean],
        [90, 2 * signature.bodyLean],
      ],
      head: [
        [0, -1.5],
        [90, -1.5],
      ],
    },
    [['plant', 0]],
    plants,
    {
      layer: 'base',
      priority: 0,
      loop: true,
      moveControl: 1,
      performanceGain: 0,
    },
    [
      translate(
        'pelvis',
        [
          [0, 0, 16],
          [45, 0, 18],
          [90, 0, 16],
        ],
        90,
      ),
    ],
  );
  for (const [name, end, amount, reach] of [
    ['jab', 38, -75, 17],
    ['heavy', 58, -90, 35],
  ] as const) {
    const active = name === 'jab' ? 0.19 : 0.36,
      off = active + 0.075;
    athletic(
      name,
      end,
      {
        pelvis: [
          [0, 0],
          [active * 60 * 0.35, -1.5],
          [active * 60 - 4, 3.5],
          [active * 60 + 3, 3],
          [end * 0.7, -0.6],
          [end, 0],
        ],
        spine_lower: [
          [0, 0],
          [active * 60 - 5, -0.8],
          [active * 60, 2],
          [active * 60 + 5, 2.4],
          [end * 0.82, 0],
          [end, 0],
        ],
        spine_mid: [
          [0, 0],
          [active * 60 - 4, -1],
          [active * 60 + 1, 2.8],
          [active * 60 + 6, 2],
          [end, 0],
        ],
        chest: [
          [0, 2],
          [active * 60 - 5, 0],
          [active * 60 + 1, name === 'heavy' ? 7 : 5],
          [active * 60 + 7, 4],
          [end * 0.78, 1],
          [end, 2],
        ],
        neck: [
          [0, -1.5],
          [active * 60, -4],
          [active * 60 + 5, -6],
          [end, -1.5],
        ],
        upper_arm_L: [
          [0, -50],
          [active * 60 - 6, id === 'doug' ? -38 : -44],
          [active * 60, amount - 10],
          [active * 60 + 4, amount - 13],
          [end * 0.7, -64],
          [end, -50],
        ],
        forearm_L: [
          [0, -110],
          [active * 60 - 5, -116],
          [active * 60, -13],
          [(off + 0.05) * 60, -25],
          [end * 0.75, -106],
          [end, -110],
        ],
        hand_L: [
          [0, 58],
          [end, 58],
        ],
        upper_arm_R: contactPulse(2, end, active, 0.05).map(([t, v]) => [
          t,
          v - 32,
        ]),
        forearm_R: contactPulse(-2, end, active, 0.075).map(([t, v]) => [
          t,
          v - 92,
        ]),
      },
      [
        ['startup', 0],
        ['active', active],
        ['recovery', off],
      ],
      [
        { name: 'footRelease', foot: 'left', at: 0 },
        { name: 'footRelease', foot: 'right', at: 0 },
        { name: 'footPlant', foot: 'left', at: active },
        { name: 'footPlant', foot: 'right', at: active },
        { name: 'hitboxOn', at: active },
        { name: 'hitboxOff', at: off },
        { name: 'cancelWindow', at: (end / 60) * 0.69 },
      ],
      {
        technique: 'strike',
        rootInterpolation: 'continuous',
        root: [
          { at: 0, x: 0, y: 0 },
          { at: active, x: reach, y: 0 },
          { at: off + 0.05, x: reach + 2, y: 0 },
          { at: end / 60, x: reach * 0.15, y: 0 },
        ],
        cancel: [[(end / 60) * 0.69, end / 60]],
        moveControl: 0,
      },
      [
        translate(
          'pelvis',
          [
            [0, 0, 16],
            [active * 60 - 5, -4, 25],
            [active * 60, 12, 12],
            [active * 60 + 7, 14, 15],
            [end, 0, 16],
          ],
          end,
        ),
      ],
    );
  }
  athletic(
    'dodge',
    48,
    {
      chest: pulse(9, 48),
      neck: pulse(-6, 48),
      upper_arm_L: pulse(-12, 48).map(([t, v]) => [t, v - 50]),
      forearm_L: pulse(-8, 48).map(([t, v]) => [t, v - 110]),
      upper_arm_R: [
        [0, -32],
        [14, -42],
        [48, -32],
      ],
      forearm_R: [
        [0, -92],
        [17, -104],
        [48, -92],
      ],
      hand_L: [
        [0, 58],
        [48, 58],
      ],
    },
    [
      ['anticipation', 0],
      ['acceleration', 0.12],
      ['recovery', 0.5],
    ],
    [
      { name: 'footRelease', foot: 'right', at: 0 },
      { name: 'footRelease', foot: 'left', at: 0 },
      { name: 'dodgeOn', at: 0.1 },
      { name: 'dodgeOff', at: 0.48 },
      { name: 'footPlant', foot: 'right', at: 0.6 },
      { name: 'footPlant', foot: 'left', at: 0.6 },
    ],
    {
      technique: 'evade',
      root: [
        { at: 0, x: 0, y: 0 },
        { at: 0.12, x: -3, y: 0 },
        { at: 0.48, x: -80, y: 0 },
        { at: 0.8, x: -86, y: 0 },
      ],
      moveControl: 0,
    },
    [
      translate(
        'pelvis',
        [
          [0, 0, 0],
          [12, 0, 25],
          [29, 0, 22],
          [48, 0, 0],
        ],
        48,
      ),
    ],
  );
  athletic(
    'hit',
    42,
    {
      pelvis: [
        [0, 0],
        [3, -2],
        [8, -3],
        [17, -1],
        [42, 0],
      ],
      chest: [
        [0, 0],
        [3, -8],
        [7, -11],
        [16, -4],
        [29, 1],
        [42, 0],
      ],
      head: [
        [0, 0],
        [5, -5],
        [9, -8],
        [18, -3],
        [30, 1],
        [42, 0],
      ],
      upper_arm_L: pulse(10, 42).map(([t, v]) => [t, v - 50]),
      forearm_L: pulse(-18, 42).map(([t, v]) => [t, v - 110]),
      upper_arm_R: [
        [0, -32],
        [7, -18],
        [20, -25],
        [42, -32],
      ],
      forearm_R: [
        [0, -92],
        [9, -78],
        [22, -103],
        [42, -92],
      ],
      hand_L: [
        [0, 58],
        [42, 58],
      ],
    },
    [
      ['impact', 0],
      ['recovery', 0.27],
    ],
    [
      { name: 'footRelease', foot: 'left', at: 0 },
      { name: 'footRelease', foot: 'right', at: 0 },
      { name: 'footPlant', foot: 'left', at: 0.5 },
      { name: 'footPlant', foot: 'right', at: 0.5 },
    ],
    {
      layer: 'reaction',
      priority: 10,
      fade: 0.08,
      moveControl: 0.25,
      technique: 'impact',
    },
  );
  athletic(
    'block',
    36,
    {
      upper_arm_L: [
        [0, -64],
        [36, -64],
      ],
      forearm_L: [
        [0, -106],
        [36, -106],
      ],
      upper_arm_R: [
        [0, -55],
        [36, -55],
      ],
      forearm_R: [
        [0, -104],
        [36, -104],
      ],
      hand_L: [
        [0, 58],
        [36, 58],
      ],
      chest: [
        [0, 2],
        [36, 2],
      ],
    },
    [['plant', 0]],
    plants,
    { loop: true, priority: 4, moveControl: 0.25, cancel: [[0, 1000]] },
  );
  // Same duration/priority/control interruption as hit; only guard absorption differs.
  athletic(
    'blockImpact',
    42,
    {
      pelvis: [
        [0, 0],
        [7, -1.5],
        [17, -0.6],
        [42, 0],
      ],
      spine_lower: [
        [0, 0],
        [5, -1],
        [14, -1.5],
        [42, 0],
      ],
      chest: [
        [0, 2],
        [3, -3],
        [9, -4],
        [22, 1],
        [42, 2],
      ],
      head: [
        [0, -1.5],
        [7, 1],
        [19, -2],
        [42, -1.5],
      ],
      upper_arm_L: [
        [0, -64],
        [5, -71],
        [16, -67],
        [42, -50],
      ],
      forearm_L: [
        [0, -106],
        [6, -118],
        [19, -113],
        [42, -110],
      ],
      upper_arm_R: [
        [0, -55],
        [7, -60],
        [20, -49],
        [42, -32],
      ],
      forearm_R: [
        [0, -104],
        [6, -112],
        [23, -102],
        [42, -92],
      ],
      hand_L: [
        [0, 58],
        [42, 58],
      ],
    },
    [
      ['impact', 0],
      ['recovery', 0.27],
    ],
    [
      { name: 'footRelease', foot: 'left', at: 0 },
      { name: 'footRelease', foot: 'right', at: 0 },
      { name: 'footPlant', foot: 'left', at: 0.5 },
      { name: 'footPlant', foot: 'right', at: 0.5 },
    ],
    {
      layer: 'reaction',
      priority: 10,
      fade: 0.08,
      moveControl: 0.25,
      technique: 'impact',
    },
    [
      translate(
        'pelvis',
        [
          [0, 0, 16],
          [8, -8, 28],
          [22, -3, 23],
          [42, 0, 16],
        ],
        42,
      ),
    ],
  );
  // Combat uses the existing curled fingers rather than the dangling idle palm.
  // Preserve each gait's contacts/travel while authoring a guard upper body.
  for (const id of ['walk', 'jog', 'run', 'sprint']) {
    const meta = library.metadata.find((c) => c.id === id)!;
    const native = structuredClone(
      library.native.find((c) => c.name === meta.native)!,
    );
    const name = 'combat.' + id;
    native.name = 'v2_combat_' + id;
    const guard: Record<string, number> = {
      upper_arm_L: -50,
      forearm_L: -110,
      upper_arm_R: -32,
      forearm_R: -92,
      hand_L: 58,
    };
    native.bone = [
      ...native.bone!.filter((b) => !(b.name in guard)),
      ...Object.entries(guard).map(([bone, value]) =>
        rotation(
          bone,
          [
            [0, value],
            [native.duration, value],
          ],
          native.duration,
        ),
      ),
    ];
    library.add(
      name,
      native,
      meta.phases.map((p) => [p.phase, p.at]),
      meta.markers,
      { ...meta, id: name, native: native.name },
    );
  }
  // Slot exposure is authored on the same native clock; no runtime texture flicker.
  for (const clip of library.native.filter((c) =>
    [
      'combatNeutral',
      'jab',
      'heavy',
      'dodge',
      'hit',
      'block',
      'blockImpact',
    ].some((name) => c.name === 'v2_' + name),
  ))
    clip.slot = ['grip', 'open', 'relaxed'].map((name) => ({
      name,
      colorFrame: [
        { duration: clip.duration, value: { aM: name === 'grip' ? 100 : 0 } },
      ],
    }));
}
