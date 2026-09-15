import reference from '../../../motion-reference/running/reference-gait.json';
import { motionSignatures } from '../../../lib/arena/engine/motion/CharacterMotionSignature';
import {
  sampleScalar,
  type Knot,
} from '../../loongbones/cornhole-motion/curves';
import { anatomy } from '../../loongbones/side-rig/anatomy';
import { handSurfaces } from '../../loongbones/side-rig/hand-surfaces';
import {
  rotation,
  translate,
  type BoneTrack,
  type LibraryBuilder,
} from './builder';

/** Observed angular gait → character-length FK → bounded effector curves → native foot IK.
 * Travel metadata and foot sweep use the same source units. Authored walking is separate.
 */
export function addGaits(library: LibraryBuilder, id: 'dan' | 'doug') {
  const rig = anatomy(id),
    signature = motionSignatures[id];
  const scale = 371 / (id === 'dan' ? 1215 : 1191);
  const channel = (name: keyof typeof reference.channels, u: number) =>
    sampleScalar(
      reference.channels[name].map(([t, v]) => [t, v] as Knot),
      u,
    );
  for (const [name, seconds, stride, lift, stance] of [
    ['walk', 1.05, 76, 24, 0.6],
    ['jog', 0.84, 112, 100, 0.46],
    ['run', 0.73, 143, 148, 0.43],
    ['sprint', 0.66, 170, 180, 0.39],
  ] as const) {
    const d = Math.round(seconds * 60 * (1 + (signature.rhythm - 1) * 0.6));
    const tracks: BoneTrack[] = [];
    for (const side of ['L', 'R']) {
      const hip = rig.joints.find((j) => j.name === 'thigh_' + side)!;
      const knee = rig.joints.find((j) => j.name === 'shin_' + side)!;
      const ankle = rig.joints.find((j) => j.name === 'foot_' + side)!;
      const thigh = Math.hypot(
        knee.point.x - hip.point.x,
        knee.point.y - hip.point.y,
      );
      const shin = Math.hypot(
        ankle.point.x - knee.point.x,
        ankle.point.y - knee.point.y,
      );
      const travel = (stride * stance) / scale;
      const start = travel * 0.4,
        finish = -travel * 0.6;
      const fk = (u: number) => {
        const a = (channel('hip', u) * Math.PI) / 180,
          b = a - (channel('knee', u) * Math.PI) / 180;
        return {
          x: thigh * Math.sin(a) + shin * Math.sin(b),
          y: thigh * Math.cos(a) + shin * Math.cos(b),
        };
      };
      const toe = fk(reference.stanceFraction),
        next = fk(1);
      const points: [number, number, number][] = [];
      const arms: Knot[] = [],
        elbows: Knot[] = [],
        feet: Knot[] = [];
      for (let f = 0; f <= d; f++) {
        const u = (f / d + (side === 'R' ? 0.5 : 0)) % 1;
        const inStance = u < stance,
          swing = (u - stance) / (1 - stance);
        const observed = inStance
          ? (u / stance) * reference.stanceFraction
          : reference.stanceFraction + swing * (1 - reference.stanceFraction);
        const p = fk(observed);
        // Heel recovery has a backward component before the leg returns forward.
        const x = inStance
          ? start - (travel * u) / stance
          : finish + ((start - finish) * (p.x - toe.x)) / (next.x - toe.x);
        const clearance = inStance
          ? 0
          : Math.max(0, ((thigh + shin - p.y) / (thigh + shin)) * 3.1);
        const y = inStance
          ? 0
          : -Math.min(lift, clearance * lift) *
            Math.min(1, swing / 0.1, (1 - swing) / 0.12);
        points.push([f, hip.point.x - ankle.point.x + x, y]);
        const arm = channel('arm', observed);
        // Source channel is an absolute shoulder angle. Remove its forward
        // bias before retargeting; both hands previously remained ahead of
        // the torso despite opposite phases. The complete far-arm surface
        // now supports the backward swing.
        // Right foot contact pairs with a trailing right upper arm. Poses are
        // authored contact/push/passing breakdowns, not a larger sinusoid.
        const shoulder =
          name === 'walk'
            ? -(arm + 20) * 0.65
            : sampleScalar(
                id === 'doug'
                  ? [
                      [0, 28],
                      [0.14, 22],
                      [stance, -30],
                      [0.64, -58],
                      [0.8, -28],
                      [1, 28],
                    ]
                  : [
                      [0, 23],
                      [0.12, 16],
                      [stance, -34],
                      [0.6, -48],
                      [0.78, -24],
                      [1, 23],
                    ],
                u,
              );
        arms.push([f, shoulder]);
        elbows.push([
          f,
          name === 'walk'
            ? -24
            : sampleScalar(
                [
                  [0, -52],
                  [0.18, -72],
                  [stance, -96],
                  [0.64, -88],
                  [0.84, -62],
                  [1, -52],
                ],
                u,
              ),
        ]);
        // Native support pivots preserve the heel/forefoot during this keyed roll.
        feet.push([
          f,
          inStance
            ? sampleScalar(
                [
                  [0, -4],
                  [0.18, 0],
                  [0.56, 0],
                  [0.84, 10],
                  [1, 20],
                ],
                u / stance,
              )
            : sampleScalar(
                [
                  [0, 20],
                  [0.16, 24],
                  [0.5, -8],
                  [0.85, -7],
                  [1, -4],
                ],
                swing,
              ),
        ]);
      }
      tracks.push(
        translate('foot_target_' + side, points, d),
        rotation('upper_arm_' + side, arms, d),
        rotation('forearm_' + side, elbows, d),
        rotation('foot_' + side, feet, d),
      );
    }
    const pelvis: [number, number, number][] = [],
      pelvicTilt: Knot[] = [],
      headHeight: [number, number, number][] = [],
      chest: Knot[] = [],
      spine: Knot[] = [],
      head: Knot[] = [];
    for (let f = 0; f <= d; f++) {
      const u = f / d,
        step = (u * 2) % 1;
      const load = sampleScalar(
        [
          [0, 3],
          [0.16, 13],
          [Math.min(0.85, stance * 2), 0],
          [1, 3],
        ],
        step,
      );
      pelvis.push([
        f,
        (name === 'walk' ? 3 : 9) + 3 * Math.sin(u * Math.PI * 2),
        23 + load * 1.3,
      ]);
      pelvicTilt.push([
        f,
        (name === 'walk' ? 0 : 1.8) + 1.5 * Math.sin(u * Math.PI * 2),
      ]);
      headHeight.push([f, 0, -load * 0.32]);
      spine.push([
        f,
        (name === 'walk' ? 0 : 2) + 1.8 * Math.sin((u - 0.05) * Math.PI * 2),
      ]);
      chest.push([
        f,
        signature.bodyLean * (name === 'walk' ? 1.2 : 4.5) -
          2.8 * Math.sin((u - 0.09) * Math.PI * 2),
      ]);
      head.push([
        f,
        -signature.bodyLean * (name === 'walk' ? 1.2 : 7.5) +
          0.5 * Math.sin(u * Math.PI * 2),
      ]);
    }
    tracks.push(
      translate('pelvis', pelvis, d),
      rotation('pelvis', pelvicTilt, d),
      translate('head', headHeight, d),
      rotation('spine_mid', spine, d),
      rotation('chest', chest, d),
      rotation('head', head, d),
      rotation(
        'hand_L',
        [
          [0, 58],
          [d, 58],
        ],
        d,
      ),
    );
    library.add(
      name,
      {
        name: 'v2_' + name,
        duration: d,
        playTimes: 0,
        bone: tracks,
        slot: handSurfaces(d),
      },
      [
        ['contact', 0],
        ['load', (d / 60) * 0.08],
        ['acceleration', (d / 60) * 0.26],
        ['airborne', (d / 60) * Math.min(0.49, stance)],
        ['contact', d / 120],
        ['load', (d / 60) * 0.58],
        ['recovery', (d / 60) * 0.83],
      ],
      [
        { name: 'footPlant', foot: 'right', at: 0 },
        {
          name: 'footRelease',
          foot: 'left',
          at: (d / 60) * Math.max(0, stance - 0.5),
        },
        { name: 'footRelease', foot: 'right', at: (d / 60) * stance },
        { name: 'footPlant', foot: 'left', at: d / 120 },
        ...(stance < 0.5
          ? [
              {
                name: 'footRelease',
                foot: 'left' as const,
                at: (d / 60) * (stance + 0.5),
              },
            ]
          : []),
      ],
      {
        layer: 'base',
        priority: 0,
        stride,
        gait: { stance, referenceScale: scale, lift },
        moveControl: 1,
        fade: 0.18,
        technique: 'stride',
        performanceGain: 0.2,
        footContactRoll: true,
      },
    );
  }
}
