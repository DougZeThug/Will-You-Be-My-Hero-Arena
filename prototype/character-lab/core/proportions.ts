// Bone lengths. The animator reads nothing else about a character's body.
import type { Proportions } from './types';

/** A 1.73 m (5'8") adult with average build. Used until rigs/<id>/proportions.json exists. */
export function defaultProportions(): Proportions {
  return {
    height: 1.73,
    pelvisHeight: 0.96,
    spine: 0.2,
    chestLen: 0.26,
    neck: 0.11,
    headLen: 0.2,
    shoulderWidth: 0.4,
    hipWidth: 0.19,
    upperArm: 0.29,
    forearm: 0.26,
    hand: 0.18,
    thigh: 0.44,
    shin: 0.42,
    footLen: 0.25,
    ankleHeight: 0.08,
  };
}

/**
 * A deliberately different second body at the same 1.73 m: longer legs, shorter
 * torso, narrower shoulders, longer forearms, bigger head. Proves that goals
 * (not poses) transfer: nothing in the animator is tuned to either set.
 */
export function lankyProportions(): Proportions {
  return {
    height: 1.73,
    pelvisHeight: 1.03,
    spine: 0.16,
    chestLen: 0.22,
    neck: 0.1,
    headLen: 0.22,
    shoulderWidth: 0.34,
    hipWidth: 0.17,
    upperArm: 0.3,
    forearm: 0.29,
    hand: 0.19,
    thigh: 0.48,
    shin: 0.45,
    footLen: 0.24,
    ankleHeight: 0.08,
  };
}

const KEYS: (keyof Proportions)[] = [
  'height',
  'pelvisHeight',
  'spine',
  'chestLen',
  'neck',
  'headLen',
  'shoulderWidth',
  'hipWidth',
  'upperArm',
  'forearm',
  'hand',
  'thigh',
  'shin',
  'footLen',
  'ankleHeight',
];

/** Accepts a parsed rigs/<id>/proportions.json; missing or invalid fields fall back to the default. */
export function sanitizeProportions(raw: unknown, base: Proportions = defaultProportions()): Proportions {
  const out = { ...base };
  if (raw && typeof raw === 'object') {
    for (const k of KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
    }
  }
  // The legs must be able to reach the floor from the pelvis.
  const leg = out.thigh + out.shin + out.ankleHeight;
  if (out.pelvisHeight < leg) out.pelvisHeight = leg;
  return out;
}
