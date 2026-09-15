export function timingGrade(value: number, target: number, window: number) {
  const offset = value - target;
  return {
    grade:
      Math.abs(offset) <= window
        ? ('perfect' as const)
        : offset < 0
          ? ('early' as const)
          : ('late' as const),
    offset,
    accuracy: Math.max(0, 1 - Math.abs(offset) / Math.max(0.001, window * 4)),
  };
}
export function rhythmTiming(
  time: number,
  beatDuration: number,
  window: number,
) {
  const beat = Math.round(time / beatDuration) * beatDuration;
  return timingGrade(time, beat, window);
}
