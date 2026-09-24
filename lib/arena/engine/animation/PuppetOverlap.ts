import { REST, type Choreography, type PuppetPose } from '../../puppet-motion';
import { bakeOverlap } from '../motion/OverlapSprings';

/** Cartoon follow-through for the paper puppet: the head drags behind body
 * lean and hip travel and overshoots when they stop; the free hand trails the
 * hips. Offsets are baked per clip from its own curve (seek-safe, stateless);
 * the throwing hand is never touched, so release geometry stays exact. */
export type OverlapOffsets = Pick<
  PuppetPose,
  'head' | 'handLX' | 'handLY' | 'body'
>;
type Table = { samples: OverlapOffsets[] };
const cache = new WeakMap<Choreography, Map<string, Table>>();

export function puppetOverlap(
  definition: Choreography,
  sample: (progress: number) => PuppetPose,
  progress: number,
  duration: number,
  loop: boolean,
): OverlapOffsets {
  let byDuration = cache.get(definition);
  if (!byDuration) cache.set(definition, (byDuration = new Map()));
  const key = duration.toFixed(3) + (loop ? 'L' : '');
  let table = byDuration.get(key);
  if (!table) {
    const count = Math.max(24, Math.min(480, Math.round(duration * 60) + 1)),
      rate = (count - 1) / Math.max(1e-3, duration),
      poses = Array.from({ length: count }, (_, i) => sample(i / (count - 1)));
    const body = poses.map((p) => p.body),
      hipX = poses.map((p) => p.hipX),
      hipY = poses.map((p) => p.hipY - REST.hipY);
    const head = bakeOverlap(
        body,
        rate,
        { frequency: 2.2, damping: 0.36, gain: 0.7, limit: 7 },
        loop,
      ),
      nod = bakeOverlap(
        hipY,
        rate,
        { frequency: 2.6, damping: 0.4, gain: 0.35, limit: 5 },
        loop,
      ),
      settle = bakeOverlap(
        body,
        rate,
        { frequency: 3.2, damping: 0.45, gain: 0.18, limit: 2.5 },
        loop,
      ),
      trailX = bakeOverlap(
        hipX,
        rate,
        { frequency: 1.9, damping: 0.34, gain: 0.8, limit: 10 },
        loop,
      ),
      trailY = bakeOverlap(
        hipY,
        rate,
        { frequency: 2.1, damping: 0.36, gain: 0.7, limit: 8 },
        loop,
      );
    table = {
      samples: poses.map((_, i) => ({
        head: head[i] + nod[i],
        body: settle[i],
        handLX: trailX[i],
        handLY: trailY[i],
      })),
    };
    byDuration.set(key, table);
  }
  const s = table.samples,
    x = Math.max(0, Math.min(1, progress)) * (s.length - 1),
    i = Math.min(s.length - 2, Math.floor(x)),
    u = x - i,
    a = s[i],
    b = s[i + 1];
  return {
    head: a.head + (b.head - a.head) * u,
    body: a.body + (b.body - a.body) * u,
    handLX: a.handLX + (b.handLX - a.handLX) * u,
    handLY: a.handLY + (b.handLY - a.handLY) * u,
  };
}
