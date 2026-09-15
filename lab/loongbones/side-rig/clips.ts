import {
  scalarTrack,
  sampleScalar,
  type Knot,
} from '../cornhole-motion/curves';
import { throwStyles, type CornholeStyle } from '../cornhole-motion/throws';
import type { Person } from './anatomy';
import { handSurfaces } from './hand-surfaces';
import { ambientClips } from './ambient-clips';
import { throwPerformance } from './throw-performance';
const rotate = (name: string, points: Knot[], duration: number) => ({
  name,
  rotateFrame: scalarTrack(points, duration, 'rotate'),
});

/** Authoring-only constraint bake. Runtime evaluates ordinary DragonBones
 * timelines; there is no procedural pose clock competing with the match. */
export function sideThrow(id: Person, style: CornholeStyle) {
  const {
    duration: end,
    release,
    landmarks,
    tracks,
  } = throwPerformance(id, style);
  const parentKeys = ['pelvis', 'spine_lower', 'spine_mid', 'chest'] as const;
  const at = (key: keyof typeof tracks, frame: number) =>
    sampleScalar(tracks[key], frame);
  const torso = (frame: number) =>
    parentKeys.reduce((sum, key) => sum + at(key, frame), 0);
  const bake = (fn: (frame: number) => number): Knot[] =>
    Array.from({ length: end + 1 }, (_, frame) => [frame, fn(frame)]);
  // Palm orientation is relative to the FULL evaluated ancestor rotation,
  // including chest and clavicle. Never independently pin it to screen axes
  // throughout the backswing. The grip drawing rotates with the supporting arm.
  // The source forearm axis is about 68 degrees: 38–88 degrees of hand track
  // keeps wrist extension/flexion modest. Palms-up is in the drawing; forcing
  // that drawing horizontal must not fold the anatomical wrist by 60 degrees.
  const wrist = bake((frame) =>
    Math.max(
      38,
      Math.min(
        88,
        at('palm', frame) -
          torso(frame) -
          at('clavicle_L', frame) -
          at('upper_arm_L', frame) -
          at('forearm_L', frame),
      ),
    ),
  );
  const neck = bake((frame) => -0.72 * torso(frame));
  const head = bake((frame) => at('gaze', frame) - 0.28 * torso(frame));
  // DragonBones 5.5 shares one curve for x/y on a translate timeline. Bake
  // these two independently authored smooth curves rather than deriving knee
  // compression from horizontal travel. This is not an increased render FPS.
  const transfer = Array.from({ length: end + 1 }, (_, frame) => ({
    duration: frame === end ? 0 : 1,
    tweenEasing: 0,
    x: at('pelvisX', frame),
    y: at('pelvisY', frame),
  }));
  const bone: object[] = [
    { ...rotate('pelvis', tracks.pelvis, end), translateFrame: transfer },
    ...(
      [
        'spine_lower',
        'spine_mid',
        'chest',
        'clavicle_L',
        'upper_arm_L',
        'forearm_L',
        'upper_arm_R',
        'forearm_R',
      ] as const
    ).map((name) => rotate(name, tracks[name], end)),
    rotate('neck', neck, end),
    rotate('head', head, end),
    rotate('hand_L', wrist, end),
  ];
  return {
    name: `cornhole_throw_${style}_R_${id}`,
    duration: end,
    playTimes: 1,
    bone,
    slot: handSurfaces(end, release),
    frame: landmarks.map((entry, i) => ({
      duration: (landmarks[i + 1]?.frame ?? end) - entry.frame,
      events: [
        {
          name: entry.name,
          ...(entry.name === 'bagRelease' ? { bone: 'throwing_hand' } : {}),
        },
        ...(entry.name === 'bagRelease'
          ? [{ name: 'release', bone: 'throwing_hand' }]
          : []),
        ...(entry.name === 'maximumBackswing' ? [{ name: 'load' }] : []),
        ...(entry.name === 'earlyBackswing' ? [{ name: 'backswing' }] : []),
        ...(entry.name === 'forwardDrive' ? [{ name: 'forwardSwing' }] : []),
        ...(entry.name === 'ready' ? [{ name: 'grab' }] : []),
      ],
    })),
  };
}
export function sideClips(id: Person) {
  return [
    ...ambientClips(id),
    ...throwStyles.map((style) => sideThrow(id, style)),
  ];
}
