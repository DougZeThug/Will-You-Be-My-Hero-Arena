export const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

/** Cubic interpolation shared by runtime material registration and authoring. */
export const smooth = (start: number, end: number, value: number) => {
  const t = clampUnit((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};
