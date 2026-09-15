export type Emotion =
  | 'successSmall'
  | 'successMedium'
  | 'successBig'
  | 'failure';
export type Gesture =
  | 'none'
  | 'bagFlip'
  | 'breathReset'
  | 'shoulderRoll'
  | 'chestTap'
  | 'fistPump'
  | 'subtleNod'
  | 'headShake'
  | 'shrug';
export interface PerformancePersonality {
  preAction: Partial<Record<Gesture, number>>;
  reactions: Record<Emotion, Partial<Record<Gesture, number>>>;
  perception: number;
}
export const performancePersonalities: Record<
  'dan' | 'doug',
  PerformancePersonality
> = {
  dan: {
    preAction: { breathReset: 0.4, none: 0.6 },
    perception: 0.22,
    reactions: {
      successSmall: { subtleNod: 0.45, none: 0.55 },
      successMedium: { subtleNod: 0.75, fistPump: 0.25 },
      successBig: { fistPump: 0.55, subtleNod: 0.45 },
      failure: { breathReset: 0.55, headShake: 0.3, none: 0.15 },
    },
  },
  doug: {
    preAction: { bagFlip: 0.3, shoulderRoll: 0.15, none: 0.55 },
    perception: 0.14,
    reactions: {
      successSmall: { subtleNod: 0.45, none: 0.55 },
      successMedium: { chestTap: 0.45, fistPump: 0.3, subtleNod: 0.25 },
      successBig: { chestTap: 0.6, fistPump: 0.25, subtleNod: 0.15 },
      failure: { headShake: 0.5, shrug: 0.3, none: 0.2 },
    },
  },
};
/** Seeded selection with recent-use suppression; unavailable equipment gestures are removed. */
export class GestureMemory {
  recent: Gesture[] = [];
  constructor(private seed: number) {}
  choose(
    pool: Partial<Record<Gesture, number>>,
    available: (g: Gesture) => boolean,
  ): Gesture {
    const entries = Object.entries(pool)
      .filter(([g]) => available(g as Gesture))
      .map(
        ([g, weight]) =>
          [
            g as Gesture,
            (weight ?? 0) *
              (this.recent.at(-1) === g
                ? 0.12
                : this.recent.includes(g as Gesture)
                  ? 0.5
                  : 1),
          ] as const,
      );
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    let pick =
      (this.seed / 4294967296) * entries.reduce((s, [, w]) => s + w, 0);
    let result: Gesture = 'none';
    for (const [g, w] of entries) {
      pick -= w;
      if (pick <= 0) {
        result = g;
        break;
      }
    }
    this.remember(result);
    return result;
  }
  remember(g: Gesture) {
    if (g !== 'none') this.recent = [...this.recent, g].slice(-4);
  }
}
