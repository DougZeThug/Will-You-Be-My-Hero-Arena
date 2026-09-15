import type { Vec2 } from './MotionTypes';
export interface SupportedLeg {
  hip: Vec2;
  knee: Vec2;
  ankle: Vec2;
  target: Vec2;
}
/** Minimum downward hip correction inside the actual fixed-length support chain. */
export function supportCompression(legs: SupportedLeg[], maximum: number) {
  let correction = 0;
  for (const { hip, knee, ankle, target } of legs) {
    const length =
      Math.hypot(knee.x - hip.x, knee.y - hip.y) +
      Math.hypot(ankle.x - knee.x, ankle.y - knee.y);
    const vertical = Math.sqrt(
      Math.max(0, (length * 0.985) ** 2 - (target.x - hip.x) ** 2),
    );
    correction = Math.max(correction, target.y - vertical - hip.y);
  }
  return Math.min(maximum, Math.max(0, correction));
}
