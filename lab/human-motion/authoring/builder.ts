import {
  scalarTrack,
  sampleScalar,
  type Knot,
} from '../../loongbones/cornhole-motion/curves';
import { handSurfaces } from '../../loongbones/side-rig/hand-surfaces';
import type {
  MotionClip,
  MotionMarker,
  MotionPhase,
} from '../../../lib/arena/engine/motion/MotionTypes';
export type BoneTrack = {
  name: string;
  rotateFrame?: object[];
  translateFrame?: object[];
};
export type NativeClip = {
  name: string;
  duration: number;
  playTimes?: number;
  bone?: BoneTrack[];
  slot?: object[];
  frame?: { duration: number; events?: { name: string; bone?: string }[] }[];
};
export const rotation = (
  name: string,
  keys: Knot[],
  end: number,
): BoneTrack => ({
  name,
  rotateFrame: scalarTrack(
    keys.map(([f, v]) => [Math.round(f), v]),
    end,
    'rotate',
  ),
});
export const translate = (
  name: string,
  points: [number, number, number][],
  end: number,
): BoneTrack => ({
  name,
  translateFrame: points.map(([frame, x, y], i) => ({
    duration: Math.round(points[i + 1]?.[0] ?? end) - Math.round(frame),
    x,
    y,
    tweenEasing: 0,
  })),
});
export const pulse = (n: number, end: number): Knot[] => [
  [0, 0],
  [end * 0.25, n * -0.18],
  [end * 0.52, n],
  [end * 0.72, n * 0.65],
  [end, 0],
];
/** Bake independent monotone X/Y tangents into a portable translation track.
 * LoongBones translate frames share one easing curve; separate axis timing needs sampling.
 */
export const smoothTranslate = (
  name: string,
  points: [number, number, number][],
  end: number,
) =>
  translate(
    name,
    Array.from({ length: end + 1 }, (_, f) => [
      f,
      sampleScalar(
        points.map(([t, x]) => [t, x]),
        f,
      ),
      sampleScalar(
        points.map(([t, , y]) => [t, y]),
        f,
      ),
    ]),
    end,
  );
/** Align an authored force peak to a semantic contact, with independent segment lead/lag. */
export const contactPulse = (
  amount: number,
  end: number,
  contact: number,
  offset = 0,
): Knot[] => {
  const peak = Math.max(5, Math.round((contact + offset) * 60));
  return [
    [0, 0],
    [Math.max(2, Math.round(peak * 0.35)), -amount * 0.12],
    [peak, amount],
    [Math.min(end - 2, peak + 6), amount * 0.86],
    [end, 0],
  ];
};
export function createLibrary(original: NativeClip[]) {
  const native = structuredClone(original),
    metadata: MotionClip[] = [];
  const add = (
    id: string,
    clip: NativeClip,
    phases: [MotionPhase, number][],
    markers: MotionMarker[] = [],
    options: Partial<MotionClip> = {},
  ) => {
    if (clip.name.startsWith('v2_')) {
      const times = [
        ...new Set([
          0,
          ...markers.map((m) => Math.round(m.at * 60)),
          clip.duration,
        ]),
      ].sort((a, b) => a - b);
      clip.frame = times.map((f, i) => ({
        duration: (times[i + 1] ?? clip.duration) - f,
        events: markers
          .filter((m) => Math.round(m.at * 60) === f)
          .map((m) => ({
            name: m.name,
            ...(m.name === 'equipmentRelease' ? { bone: 'throwing_hand' } : {}),
          })),
      }));
    }
    if (!native.some((c) => c.name === clip.name)) native.push(clip);
    metadata.push({
      id,
      native: clip.name,
      duration: clip.duration / 60,
      loop: clip.playTimes === 0,
      layer: 'action',
      priority: 2,
      fade: 0.14,
      phases: phases.map(([phase, at]) => ({ phase, at })),
      markers,
      cancel: [[(clip.duration / 60) * 0.78, clip.duration / 60]],
      moveControl: 0.1,
      ...options,
    });
  };
  const athletic = (
    name: string,
    end: number,
    channels: Record<string, Knot[]>,
    phases: [MotionPhase, number][],
    markers: MotionMarker[],
    options: Partial<MotionClip> = {},
    translation: BoneTrack[] = [],
  ) => {
    add(
      name,
      {
        name: 'v2_' + name,
        duration: end,
        playTimes: options.loop ? 0 : 1,
        bone: [
          ...Object.entries(channels).map(([bone, keys]) =>
            rotation(bone, keys, end),
          ),
          ...translation,
        ],
        slot: handSurfaces(end),
      },
      phases,
      markers,
      options,
    );
  };
  return { native, metadata, add, athletic };
}
export type LibraryBuilder = ReturnType<typeof createLibrary>;
