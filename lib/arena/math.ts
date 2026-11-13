/** Shared scalar helpers. Expression forms are pinned: recordings are hashed. */

/** Clamp to [min, max] (min wins on NaN-free inverted bounds, as Math.max). */
export const clamp = (n: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, n));

export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Cubic smoothstep of an already-normalised t (no clamping). */
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Cubic smoothstep with the input clamped to 0..1. */
export const smooth = (n: number) => smoothstep(clamp01(n));

/** Clamped smoothstep of value between start and end. */
export const smoothRange = (start: number, end: number, value: number) =>
  smooth((value - start) / (end - start));
