/** Stateless cartoon squash & stretch for whole characters and props.
 *
 * A pulse is an event time plus a signed amplitude (positive stretches
 * vertically, negative squashes). Its response is a short damped oscillation,
 * evaluated purely from the current time, so recorded Watch playback can seek,
 * pause and replay without state. Volume is preserved as if depth scaled with
 * width (sx = 1 / sqrt(sy)), the usual cartoon rule: a squash widens the
 * silhouette without the ballooning of strict 2D area (sx = 1 / sy).
 */
export interface SquashPulse {
  at: number;
  amount: number;
  /** Seconds until the pulse has settled (default 0.32). */
  settle?: number;
  /** Oscillation frequency in Hz (default 5.5). */
  frequency?: number;
}

export const MAX_SQUASH = 0.2;

/** Rise time to the pulse's extreme (~2 frames: it reads as a hit, not a fade). */
const ATTACK = 0.035;

/** Vertical scale offset from a set of pulses at `time` (0 = rest). Each pulse
 * reaches its full `amount` after ATTACK, then rings down: a smaller counter
 * stretch, then rest by `settle`. */
export function squashOffset(pulses: readonly SquashPulse[], time: number) {
  let total = 0;
  for (const p of pulses) {
    const t = time - p.at,
      settle = Math.max(2 * ATTACK, p.settle ?? 0.32);
    if (t < 0 || t > settle) continue;
    if (t < ATTACK) {
      const u = t / ATTACK;
      total += p.amount * u * u * (3 - 2 * u);
      continue;
    }
    const s = t - ATTACK,
      span = settle - ATTACK,
      decay = Math.exp((-4.2 * s) / span),
      // Cosine carries the rebound: squash, then a smaller counter-stretch.
      wave = Math.cos(2 * Math.PI * (p.frequency ?? 5.5) * s),
      // Taper the last 20% to exactly zero so nothing pops at `settle`.
      tail = Math.min(1, (settle - t) / (0.2 * span));
    total += p.amount * decay * wave * tail;
  }
  return Math.max(-MAX_SQUASH, Math.min(MAX_SQUASH, total));
}

/** Volume-preserving scale pair for an offset returned by `squashOffset`. */
export function squashScale(offset: number) {
  const y = 1 + offset;
  return { x: 1 / Math.sqrt(y), y };
}

/** Stretch along a direction for a moving prop: returns scale along and across
 * the velocity, volume preserved. `speed` in px/s. */
export function velocityStretch(speed: number, reference = 900, max = 0.35) {
  const along = 1 + Math.min(max, (Math.max(0, speed) / reference) * max);
  return { along, across: 1 / Math.sqrt(along) };
}
