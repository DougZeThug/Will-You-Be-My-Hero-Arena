export interface AbilityDefinition {
  id: string;
  kind: 'active' | 'passive';
  duration: number;
  cooldown: number;
  cost: number;
  tags: string[];
  /** Granted to a character whose profile lists no abilities. */
  byDefault?: boolean;
  /** Scales the length of the owner's throw clips (below 1 = quicker). */
  throwDurationScale?: number;
}
const definitions = new Map<string, AbilityDefinition>();
for (const a of [
  {
    id: 'precisionMode',
    kind: 'active' as const,
    duration: 3,
    cooldown: 10,
    cost: 15,
    tags: ['accuracy'],
    byDefault: true,
  },
  {
    id: 'burstSprint',
    kind: 'active' as const,
    duration: 1.4,
    cooldown: 7,
    cost: 18,
    tags: ['speed'],
    byDefault: true,
  },
  {
    id: 'powerStrike',
    kind: 'active' as const,
    duration: 1.1,
    cooldown: 6,
    cost: 15,
    tags: ['attack'],
    byDefault: true,
  },
  ...['clutchPerformer', 'quickRelease', 'ironStamina', 'comebackKid'].map(
    (id): AbilityDefinition => ({
      id,
      kind: 'passive' as const,
      duration: 0,
      cooldown: 0,
      cost: 0,
      tags: [id],
      ...(id === 'quickRelease' ? { throwDurationScale: 0.9 } : {}),
    }),
  ),
] satisfies AbilityDefinition[])
  definitions.set(a.id, a);
/** The abilities of a character whose profile lists none. */
export function defaultAbilities() {
  return [...definitions.values()].filter((a) => a.byDefault).map((a) => a.id);
}
/** Combined throw-clip length scale of a set of owned abilities. */
export function throwDurationScale(owned: readonly string[] = []) {
  let scale = 1;
  for (const id of new Set(owned))
    scale *= definitions.get(id)?.throwDurationScale ?? 1;
  return scale;
}
export class AbilityComponent {
  private ready = new Map<string, number>();
  private active = new Map<string, number>();
  constructor(readonly owned: string[]) {}
  has(id: string) {
    return this.owned.includes(id);
  }
  activate(id: string, time: number, energy: number) {
    const a = definitions.get(id);
    if (
      !a ||
      !this.has(id) ||
      time < (this.ready.get(id) ?? 0) ||
      energy < a.cost
    )
      return null;
    this.ready.set(id, time + a.cooldown);
    this.active.set(id, time + a.duration);
    return a;
  }
  enabled(id: string, time: number) {
    return time < (this.active.get(id) ?? 0);
  }
  remaining(id: string, time: number) {
    return Math.max(0, (this.ready.get(id) ?? 0) - time);
  }
}
