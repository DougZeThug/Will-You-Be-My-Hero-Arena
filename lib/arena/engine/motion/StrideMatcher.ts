import { clamp, type MotionClip } from './MotionTypes';
export interface StrideFit {
  clip: string;
  speed: number;
  rate: number;
  reachScale: number;
  nominalSpeed: number;
  matchedSpeed: number;
  error: number;
}
/** Fit authored cycle travel to the motor, then use a bounded stride adjustment, never bone scaling. */
export function matchStride(
  speed: number,
  clips: MotionClip[],
  scale = 1,
  previous?: string,
): StrideFit | undefined {
  const options = clips
    .filter((c) => c.stride && c.gait)
    .map((c) => {
      const nominalSpeed = (c.stride! * scale) / c.duration;
      const ratio = speed / nominalSpeed;
      const rate = clamp(ratio, c.id === 'walk' ? 0.5 : 0.86, 1.18);
      const reachScale = clamp(ratio / rate, 0.35, 1.18);
      return {
        clip: c.id,
        speed,
        rate,
        reachScale,
        nominalSpeed,
        matchedSpeed: nominalSpeed * rate * reachScale,
        error: Math.abs(nominalSpeed * rate * reachScale - speed),
        cost:
          Math.abs(Math.log(Math.max(0.01, ratio))) +
          (6 * Math.abs(nominalSpeed * rate * reachScale - speed)) /
            Math.max(1, speed) -
          (c.id === previous ? 0.12 : 0),
      };
    });
  return options.sort((a, b) => a.cost - b.cost)[0];
}
export function gaitSupport(phase: number, stance: number) {
  return (['right', 'left'] as const).filter(
    (side) => (((phase + (side === 'left' ? 0.5 : 0)) % 1) + 1) % 1 < stance,
  );
}
