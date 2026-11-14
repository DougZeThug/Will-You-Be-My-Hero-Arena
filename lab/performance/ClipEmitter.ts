import type {
  BodyChannel,
  BodyTake,
} from '../../lib/arena/engine/performance/BodyMechanics';
import type { PerformanceProfile } from '../../lib/arena/engine/performance/PerformanceTypes';
import type { MotionClip } from '../../lib/arena/engine/motion/MotionTypes';
import { NATIVE_LIMITS } from '../../lib/arena/engine/performance/NativeLimits';
import { bakeOverlap } from '../../lib/arena/engine/motion/OverlapSprings';
import {
  scalarTrack,
  sampleScalar,
  type Knot,
} from '../loongbones/cornhole-motion/curves';
import type { NativeClip } from '../rig-shared/NativeClip';

export type Pose = Record<BodyChannel, number>;
export const TORSO = ['hips', 'lowerSpine', 'upperSpine', 'chest'] as const;
/** Cartoon follow-through: children trail and overshoot their parents. Baked
 * per frame from the authored/captured signal, so playback stays exact under
 * seek and the result exports to the editor like any other curve. */
const OVERLAP = {
  head: { frequency: 2.3, damping: 0.38, gain: 0.55, limit: 7 },
  chest: { frequency: 2.8, damping: 0.42, gain: 0.35, limit: 3 },
  counterArm: { frequency: 1.7, damping: 0.34, gain: 0.8, limit: 14 },
  wrist: { frequency: 3.4, damping: 0.45, gain: 0.14, limit: 9 },
};

/** The generic clip emitter behind every shipped performance: it samples a
 * take per native frame, bakes the cartoon overlap layers, enforces the native
 * joint limits and appends the native clip and its metadata. */
export function createClipEmitter(
  p: PerformanceProfile,
  native: NativeClip[],
  clips: Map<string, MotionClip>,
) {
  const emit = (
    id: string,
    take: BodyTake,
    options: Partial<MotionClip> = {},
  ) => {
    const end = Math.round(take.seconds * 60),
      loop = options.loop === true;
    // Sample each channel at every native frame. Knots stay at fractional
    // frames (tempo changes never snap them to uneven whole frames); a loop
    // borrows its neighbours across the seam so the cycle never stalls there.
    const series = Object.fromEntries(
      Object.entries(take.channels).map(([key, values]) => {
        let knots: Knot[] = values.map((v, i) => [take.times[i] * end, v]);
        if (loop && knots.length > 2)
          knots = [
            [knots.at(-2)![0] - end, knots.at(-2)![1]],
            ...knots,
            [knots[1][0] + end, knots[1][1]],
          ];
        return [
          key,
          Array.from({ length: end + 1 }, (_, f) => sampleScalar(knots, f)),
        ];
      }),
    ) as Record<BodyChannel, number[]>;
    const at = (key: BodyChannel, f: number) => series[key][f];
    const torsoAt = (f: number) => TORSO.reduce((n, k) => n + at(k, f), 0);
    const torso = series.hips.map((_, f) => torsoAt(f));
    // Overlap layers (degrees), from the pre-overlap parent signals.
    const lower = series.hips.map((h, f) => h + series.lowerSpine[f]);
    const swing = series.hips.map(
      (_, f) => torso[f] + at('shoulder', f) + at('upperArm', f),
    );
    const headLag = bakeOverlap(torso, 60, OVERLAP.head, loop),
      chestLag = bakeOverlap(lower, 60, OVERLAP.chest, loop),
      counterLag = bakeOverlap(torso, 60, OVERLAP.counterArm, loop),
      wristLag = bakeOverlap(swing, 60, OVERLAP.wrist, loop);
    const chest = series.chest.map((v, f) => v + chestLag[f]);
    const fullTorso = (f: number) => torso[f] - series.chest[f] + chest[f];
    const local: Record<string, number[]> = {
      pelvis: series.hips,
      spine_lower: series.lowerSpine,
      spine_mid: series.upperSpine,
      chest,
      clavicle_L: series.shoulder,
      upper_arm_L: series.upperArm,
      forearm_L: series.elbow,
      upper_arm_R: series.counterArm.map((v, f) => v + counterLag[f]),
      forearm_R: series.counterElbow,
      // The world hand target is authored; its local rotation is what remains
      // after every parent, then trails the swing slightly (wrist lag/snap).
      hand_L: series.palm.map(
        (palm, f) =>
          palm -
          fullTorso(f) -
          at('shoulder', f) -
          at('upperArm', f) -
          at('elbow', f) +
          wristLag[f],
      ),
      // Head leads/drags: it keeps only part of the counter-rotation that used
      // to pin it level, and overshoots when the torso stops.
      neck: torso.map((t) => -0.5 * t),
      head: torso.map((t, f) => at('gaze', f) - 0.3 * t + headLag[f]),
    };
    for (const [bone, values] of Object.entries(local)) {
      const limit = NATIVE_LIMITS[bone];
      if (!limit) continue;
      const outside = values.find((v) => v < limit[0] || v > limit[1]);
      if (outside !== undefined)
        throw Error(
          `${p.id} ${id} authors ${bone} outside native limits: ${outside.toFixed(2)}`,
        );
    }
    const bake = (values: number[]) =>
      scalarTrack(
        values.map((v, f): Knot => [f, v]),
        end,
        'rotate',
      );
    const bones: NonNullable<NativeClip['bone']> = Object.entries(local).map(
      ([name, values]) => ({ name, rotateFrame: bake(values) }),
    );
    bones.find((b) => b.name === 'pelvis')!.translateFrame = Array.from(
      { length: end + 1 },
      (_, f) => ({
        duration: f === end ? 0 : 1,
        tweenEasing: 0,
        x: at('weightX', f),
        y: at('compression', f),
      }),
    );
    // Footwork: the front (R) and back (L) IK targets follow the take. The
    // side rig faces +x with the front foot on foot_target_R.
    for (const [bone, x, y] of [
      ['foot_target_R', 'frontFootX', 'frontFootY'],
      ['foot_target_L', 'backFootX', 'backFootY'],
    ] as const)
      if (series[x].some((v) => v !== 0) || series[y].some((v) => v !== 0))
        bones.push({
          name: bone,
          translateFrame: Array.from({ length: end + 1 }, (_, f) => ({
            duration: f === end ? 0 : 1,
            tweenEasing: 0,
            x: series[x][f],
            y: series[y][f],
          })),
        });
    native.push({
      name: 'performance_' + id,
      duration: end,
      playTimes: loop ? 0 : 1,
      bone: bones,
    });
    const metadata: MotionClip = {
      id,
      native: 'performance_' + id,
      duration: end / 60,
      layer: 'action',
      priority: 10,
      fade: 0.16,
      phases: [],
      markers: [],
      ...options,
    };
    clips.set(id, metadata);
    return metadata;
  };
  return emit;
}
export type ClipEmitter = ReturnType<typeof createClipEmitter>;
