import { clamp } from './MotionTypes';
/** Short contact beats with independent approach/rebound, never a half-second lock. */
export function chestContactWeight(seconds: number, contacts = [0.5, 49 / 60]) {
  const pulse = (center: number) => {
    const d = seconds - center;
    const t = d < 0 ? 1 + d / 0.105 : 1 - d / 0.085;
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  };
  return Math.max(0, ...contacts.map(pulse));
}
