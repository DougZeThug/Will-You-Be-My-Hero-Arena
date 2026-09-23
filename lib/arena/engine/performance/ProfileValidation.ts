import type { PerformanceProfile } from './PerformanceTypes';

export const profileLimits: Record<
  Exclude<keyof PerformanceProfile, 'id' | 'celebration'>,
  [number, number]
> = {
  movementTempo: [0.65, 1.5],
  stanceWidth: [0.92, 1.06],
  posture: [-1, 1],
  confidence: [0, 1],
  // World arm-swing peaks of the take (degrees behind / in front of the body).
  backswing: [20, 85],
  releaseLift: [-4, 12],
  followThrough: [50, 120],
  finishRetention: [0.35, 0.95],
  recoveryDuration: [0.48, 0.95],
  weightTransfer: [16, 100],
  reactionIntensity: [0, 1],
  idleEnergy: [0, 1],
  restShift: [-18, 12],
  restCompression: [2, 12],
  attentionLean: [0.5, 3.5],
  perception: [0.1, 0.7],
};

/** Shared by the normal match, Lab and local candidate promotion command. */
export function validatePerformanceProfile(input: unknown): PerformanceProfile {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw Error('A character profile must be a JSON object');
  const source = input as Record<string, unknown>;
  if (source.id !== 'doug' && source.id !== 'dan')
    throw Error('Choose a Doug or Dan profile');
  if (source.celebration !== 'chestTap' && source.celebration !== 'nod')
    throw Error('Unknown celebration');
  const result: Record<string, unknown> = {
    id: source.id,
    celebration: source.celebration,
  };
  for (const [key, [min, max]] of Object.entries(profileLimits)) {
    const value = source[key];
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max
    )
      throw Error(`Invalid performance profile ${key}: expected ${min}–${max}`);
    result[key] = value;
  }
  return result as unknown as PerformanceProfile;
}
