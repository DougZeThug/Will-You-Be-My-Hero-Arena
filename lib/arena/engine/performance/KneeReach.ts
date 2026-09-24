/** Soft leg reach for two-bone planted legs.
 *
 * A two-bone IK chain near full extension is singular: the knee angle grows
 * with the square root of the missing length, so the first pixel of pelvis
 * drop turns an almost-straight knee by ~8°. Authored or captured motion that
 * passes through that region pops. Remapping the requested hip-to-ankle ratio
 * through a C1 soft limit keeps every leg a little bent (a relaxed athletic
 * stance) and turns the pop into a smooth, bounded knee response. Feet stay
 * planted: only the pelvis is lowered.
 */
export const SOFT_REACH_START = 0.965;
export const SOFT_REACH_MAX = 0.988;

/** Identity below `start`; above it, eases asymptotically toward `max`. */
export function softReach(
  ratio: number,
  start = SOFT_REACH_START,
  max = SOFT_REACH_MAX,
) {
  if (!(ratio > start)) return ratio;
  const span = max - start;
  return start + span * Math.tanh((ratio - start) / span);
}

export interface LegReach {
  /** Hip joint position in armature space (y down). */
  hip: { x: number; y: number };
  /** Planted ankle target in armature space. */
  ankle: { x: number; y: number };
  /** Thigh + shin length. */
  length: number;
}

/** Pelvis drop (armature units, positive = down) that brings every leg inside
 * its soft reach while keeping the ankle targets fixed. */
export function softReachDrop(legs: readonly LegReach[]) {
  let drop = 0;
  for (const leg of legs) {
    const dx = leg.ankle.x - leg.hip.x,
      dy = leg.ankle.y - leg.hip.y;
    if (!(dy > 0) || !(leg.length > 0)) continue;
    const ratio = Math.hypot(dx, dy) / leg.length,
      soft = softReach(ratio);
    if (soft >= ratio) continue;
    const wanted = soft * leg.length;
    if (wanted <= Math.abs(dx)) continue;
    drop = Math.max(drop, dy - Math.sqrt(wanted * wanted - dx * dx));
  }
  return drop;
}
