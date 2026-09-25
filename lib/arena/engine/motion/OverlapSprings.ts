/** Offline overlap / follow-through for authored or captured motion.
 *
 * Cartoon drag and overshoot come from a child that follows its parent through
 * an underdamped spring: it trails while the parent accelerates and swings past
 * when the parent stops. Baking the response from the sampled parent signal
 * keeps playback deterministic and seek-safe (no runtime state), exports into
 * native clips, and works for any future mocap take.
 */
export interface SpringSettings {
  /** Natural frequency in Hz. Lower = heavier, lazier follow. */
  frequency: number;
  /** Damping ratio. <1 overshoots; ~0.35–0.5 reads as cartoon settle. */
  damping: number;
  /** Fraction of the parent's lag applied to the child. */
  gain: number;
  /** Largest absolute offset (same units as the signal). */
  limit?: number;
}

/**
 * Returns per-sample offsets `gain * (follower - signal)` where `follower` is a
 * spring chasing `signal`. `signal` is sampled at `rate` Hz. A looping signal
 * is simulated twice and the second (periodic) pass is returned, so the loop
 * seam carries the steady-state response instead of a restart.
 */
export function bakeOverlap(
  signal: readonly number[],
  rate: number,
  settings: SpringSettings,
  loop = false,
) {
  if (signal.length < 2) return signal.map(() => 0);
  const omega = 2 * Math.PI * settings.frequency,
    zeta = settings.damping,
    substeps = 4,
    h = 1 / rate / substeps;
  let x = signal[0],
    v = 0;
  const passes = loop ? 2 : 1,
    out = new Array<number>(signal.length).fill(0);
  if (loop) {
    // The caller sends a sentinel-duplicated table (signal[N] === signal[0]),
    // so the period is the N unique samples 0..N-1 and the wrap is N-1 -> 0.
    // Integrating the sentinel as a separate interval would hold the spring on
    // signal[N] for a full sample every pass, deforming the periodic orbit and
    // biasing out[0] away from the steady state out[N-1] carries — a wrap-seam
    // discontinuity. Integrate the N unique samples with true wraparound, then
    // mirror out[0] into the sentinel slot so the interp table is continuous.
    const N = signal.length - 1;
    for (let pass = 0; pass < passes; pass++)
      for (let i = 0; i < N; i++) {
        const a = signal[i],
          b = signal[(i + 1) % N];
        for (let s = 0; s < substeps; s++) {
          const target = a + (b - a) * (s / substeps);
          // Semi-implicit Euler: stable for these stiffness/step ratios.
          v += (omega * omega * (target - x) - 2 * zeta * omega * v) * h;
          x += v * h;
        }
        if (pass === passes - 1) {
          const offset = settings.gain * (x - signal[i]);
          out[i] =
            settings.limit === undefined
              ? offset
              : Math.max(-settings.limit, Math.min(settings.limit, offset));
        }
      }
    out[N] = out[0];
    return out;
  }
  for (let pass = 0; pass < passes; pass++)
    for (let i = 0; i < signal.length; i++) {
      const a = signal[i],
        b = signal[Math.min(signal.length - 1, i + 1)];
      for (let s = 0; s < substeps; s++) {
        const target = a + (b - a) * (s / substeps);
        // Semi-implicit Euler: stable for these stiffness/step ratios.
        v += (omega * omega * (target - x) - 2 * zeta * omega * v) * h;
        x += v * h;
      }
      if (pass === passes - 1) {
        const offset = settings.gain * (x - signal[i]);
        out[i] =
          settings.limit === undefined
            ? offset
            : Math.max(-settings.limit, Math.min(settings.limit, offset));
      }
    }
  // Ease the offset in over the first samples: a clip entered from a matching
  // pose has no history, so the child starts on its parent.
  const ramp = Math.min(signal.length, Math.round(rate * 0.06));
  for (let i = 0; i < ramp; i++) out[i] *= i / ramp;
  return out;
}

/** Angular velocity (units/s) of a sampled signal, central differences. */
export function derivative(signal: readonly number[], rate: number) {
  return signal.map((_, i) => {
    const a = signal[Math.max(0, i - 1)],
      b = signal[Math.min(signal.length - 1, i + 1)],
      span = Math.min(signal.length - 1, i + 1) - Math.max(0, i - 1);
    return span ? ((b - a) * rate) / span : 0;
  });
}
