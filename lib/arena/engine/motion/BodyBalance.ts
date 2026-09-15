import { clamp, type MotionPose } from './MotionTypes';
export interface BalanceState {
  supportSide: 'right' | 'left' | 'airborne';
  weightBias: number;
  rightWeight: number;
  forwardBias: number;
  balance: number;
  projection: number;
  supportMin: number;
  supportMax: number;
  measured: false;
}
/** Screen-space mass/support proxy, not inverse dynamics or a force-plate measurement. */
export function bodyBalance(
  pose: MotionPose,
  grounded: boolean,
  contacts: string[],
): BalanceState {
  const j = pose.joints,
    r = j.rightAnkle,
    l = j.leftAnkle;
  const projection = j.pelvis.x * 0.62 + j.chest.x * 0.3 + j.head.x * 0.08;
  const lo = Math.min(r.x, l.x) - 10,
    hi = Math.max(r.x, l.x) + 18;
  const geometric =
    Math.abs(r.x - l.x) > 4 ? (projection - l.x) / (r.x - l.x) : 0.5;
  let rightWeight = clamp(geometric, 0.15, 0.85);
  if (contacts.length === 1) rightWeight = contacts[0] === 'right' ? 1 : 0;
  if (!grounded) rightWeight = 0;
  return {
    supportSide: !grounded ? 'airborne' : rightWeight >= 0.5 ? 'right' : 'left',
    weightBias: !grounded ? 0 : Math.max(rightWeight, 1 - rightWeight),
    rightWeight,
    forwardBias: clamp(
      (projection - (lo + hi) / 2) / Math.max(12, (hi - lo) / 2),
      -1,
      1,
    ),
    balance: grounded
      ? clamp(1 - Math.max(lo - projection, projection - hi, 0) / 45, 0, 1)
      : 0,
    projection,
    supportMin: lo,
    supportMax: hi,
    measured: false,
  };
}
