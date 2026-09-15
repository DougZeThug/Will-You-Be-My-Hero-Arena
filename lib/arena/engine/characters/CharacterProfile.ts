import '../animation/LiveClips';
import type { AnimationCategory, ShotStyle } from '../animation/AnimationTypes';
import type { Choreography } from '../../puppet-motion';
import { animations, SHOT_STYLES } from '../animation/AnimationRegistry';
export interface SpineRigDefinition {
  format: 'spine';
  version: string;
  skeleton: string;
  atlas: string;
  scale: number;
  animations: Record<string, string>;
  events: Record<string, Record<string, number>>;
  bones: {
    throwingHand: string;
    offHand: string;
    head: string;
    chest: string;
    waist: string;
    footL: string;
    footR: string;
  };
}
export interface CharacterProfile {
  id: string;
  version: 1;
  name: string;
  personality: {
    confidence: number;
    showmanship: number;
    intensity: number;
    calmness: number;
    humor: number;
    patience: number;
    resilience: number;
    sociability: number;
  };
  throwingStyle: {
    speed: number;
    flatness: number;
    accuracy: number;
    tendencies: Partial<Record<ShotStyle, number>>;
  };
  pools: Partial<Record<AnimationCategory, string[]>>;
  signatures: {
    id: string;
    chance: number;
    cooldown: number;
    tags: string[];
  }[];
  overrides?: Record<string, Choreography>;
  rig?: SpineRigDefinition;
  gameplay?: import('./components/CharacterStats').GameplayProfile;
}
export function validateProfile(input: unknown) {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return ['performance must be a character profile object.'];
  const p = input as CharacterProfile,
    ids = new Set(animations().map((c) => c.id));
  if (!p.id || p.version !== 1)
    errors.push('A version 1 character id is required.');
  for (const name of [
    'confidence',
    'showmanship',
    'intensity',
    'calmness',
    'humor',
    'patience',
    'resilience',
    'sociability',
  ] as const) {
    const value = p.personality?.[name];
    if (!Number.isFinite(value) || value < 0 || value > 1)
      errors.push(`${name} must be between 0 and 1.`);
  }
  for (const name of ['speed', 'flatness', 'accuracy'] as const) {
    const value = p.throwingStyle?.[name];
    if (!Number.isFinite(value) || value < 0 || value > 1)
      errors.push(`throwingStyle.${name} must be between 0 and 1.`);
  }
  const tendencies = p.throwingStyle?.tendencies ?? {};
  if (!Object.values(tendencies).some((w) => w !== undefined && w > 0))
    errors.push('At least one positive shot tendency is required.');
  if (
    Object.entries(tendencies).some(
      ([id, w]) =>
        !SHOT_STYLES.includes(id as ShotStyle) ||
        !Number.isFinite(w) ||
        w! < 0 ||
        w! > 100,
    )
  )
    errors.push('Unknown or invalid shot tendency.');
  for (const [category, pool] of Object.entries(p.pools ?? {}))
    if (
      ![
        'idle',
        'locomotion',
        'entrance',
        'ritual',
        'throw',
        'celebration',
        'reaction',
        'interaction',
      ].includes(category) ||
      !Array.isArray(pool) ||
      !pool.length ||
      pool.some((id) => typeof id !== 'string' || !ids.has(id))
    )
      errors.push('Invalid animation pool: ' + category);
  if (!Array.isArray(p.signatures)) errors.push('signatures must be an array.');
  else
    for (const s of p.signatures)
      if (
        !s ||
        !ids.has(s.id) ||
        !Number.isFinite(s.chance) ||
        s.chance < 0 ||
        s.chance > 1 ||
        !Number.isInteger(s.cooldown) ||
        s.cooldown < 1 ||
        s.cooldown > 99 ||
        !Array.isArray(s.tags)
      )
        errors.push('Invalid signature animation.');
  const bounds: Record<string, [number, number]> = {
    hipX: [-40, 40],
    hipY: [-215, -135],
    body: [-25, 25],
    head: [-25, 25],
    shrug: [-12, 12],
    handLX: [-160, 160],
    handLY: [-400, -70],
    handRX: [-160, 160],
    handRY: [-400, -70],
    footLX: [-80, 20],
    footLY: [-70, -22],
    footRX: [-20, 80],
    footRY: [-70, -22],
    footL: [-25, 25],
    footR: [-25, 25],
    turn: [0.65, 1.1],
  };
  for (const [id, clip] of Object.entries(p.overrides ?? {}))
    if (
      !ids.has(id) ||
      !clip ||
      !Array.isArray(clip.keys) ||
      clip.keys.length < 2 ||
      clip.keys.length > 24 ||
      clip.keys[0].at !== 0 ||
      clip.keys.at(-1)?.at !== 1 ||
      clip.keys.some(
        (k, i) =>
          !Number.isFinite(k.at) ||
          k.at < 0 ||
          k.at > 1 ||
          (i > 0 && k.at <= clip.keys[i - 1].at) ||
          !k.pose ||
          Object.entries(k.pose).some(
            ([key, v]) =>
              !bounds[key] ||
              !Number.isFinite(v) ||
              v! < bounds[key][0] ||
              v! > bounds[key][1],
          ),
      )
    )
      errors.push('Invalid authored animation override: ' + id);
  if (p.gameplay) {
    const g = p.gameplay;
    if (typeof g !== 'object' || Array.isArray(g)) {
      errors.push('Gameplay must be an object.');
      return errors;
    }
    if (g.events && (typeof g.events !== 'object' || Array.isArray(g.events)))
      errors.push('Gameplay events must be named objects.');
    for (const values of [g.core ?? {}, ...Object.values(g.events ?? {})])
      if (
        !values ||
        typeof values !== 'object' ||
        Array.isArray(values) ||
        Object.entries(values).some(
          ([key, v]) => !key || !Number.isFinite(v) || v < 0 || v > 1,
        )
      )
        errors.push('Gameplay traits must be named numbers between 0 and 1.');
    if (
      g.abilities &&
      (!Array.isArray(g.abilities) ||
        g.abilities.some((v) => typeof v !== 'string'))
    )
      errors.push('Gameplay abilities must be named IDs.');
    if (
      g.animations &&
      Object.values(g.animations).some((v) => typeof v !== 'string')
    )
      errors.push('Gameplay animation overrides must be named clips.');
  }
  return errors;
}
