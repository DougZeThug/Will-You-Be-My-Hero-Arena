/** Local rotation limits (degrees, relative to bind) for the side-view-v3
 * performance rig. The compiler rejects any shipped frame outside them, so the
 * adapter's runtime clamp is a safety net that should never fire (a clamp
 * would flatten the curve into a visible velocity plateau).
 *
 * `upper_arm_L` covers a full cartoon underhand swing: ~70° behind the body at
 * the top of the backswing and a finish above horizontal toward the board. */
export const NATIVE_LIMITS: Readonly<Record<string, readonly [number, number]>> =
  {
    upper_arm_L: [-120, 70],
    forearm_L: [-145, 15],
    hand_L: [-35, 95],
    clavicle_L: [-14, 14],
    pelvis: [-8, 8],
    spine_lower: [-10, 10],
    spine_mid: [-10, 10],
    chest: [-12, 12],
    head: [-15, 15],
    neck: [-15, 15],
  };
