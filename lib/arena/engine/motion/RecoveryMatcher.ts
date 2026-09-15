import { clamp } from './MotionTypes';
export interface RecoveryPose {
  handHeight: number;
  chestPitch: number;
  speed: number;
  footPhase: number;
}
const candidates = [
  {
    id: 'lowered-arm-settle',
    handHeight: -0.1,
    chestPitch: 0,
    speed: 0,
    footPhase: 0,
    seconds: 0.24,
  },
  {
    id: 'elevated-arm-settle',
    handHeight: 0.95,
    chestPitch: -0.06,
    speed: 0,
    footPhase: 0,
    seconds: 0.38,
  },
  {
    id: 'moving-recovery',
    handHeight: 0.3,
    chestPitch: 0.08,
    speed: 170,
    footPhase: 0.5,
    seconds: 0.18,
  },
];
/** Chooses a convergence policy from outgoing pose, not an event name or fake new animation. */
export function matchRecovery(pose: RecoveryPose, recoverySpeed = 1) {
  const scored = candidates
    .map((c) => ({
      ...c,
      cost:
        (pose.handHeight - c.handHeight) ** 2 +
        (pose.chestPitch - c.chestPitch) ** 2 * 8 +
        ((pose.speed - c.speed) / 140) ** 2 +
        Math.min(
          Math.abs(pose.footPhase - c.footPhase),
          1 - Math.abs(pose.footPhase - c.footPhase),
        ) **
          2 *
          0.1,
    }))
    .sort((a, b) => a.cost - b.cost);
  return {
    ...scored[0],
    seconds: clamp(scored[0].seconds / recoverySpeed, 0.14, 0.48),
  };
}
