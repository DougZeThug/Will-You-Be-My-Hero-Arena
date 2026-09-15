export interface AbilityDefinition {
  id: string;
  kind: 'active' | 'passive';
  duration: number;
  cooldown: number;
  cost: number;
  tags: string[];
}
const definitions = new Map<string, AbilityDefinition>();
export function registerAbility(a: AbilityDefinition) {
  definitions.set(a.id, a);
}
for (const a of [
  {
    id: 'precisionMode',
    kind: 'active' as const,
    duration: 3,
    cooldown: 10,
    cost: 15,
    tags: ['accuracy'],
  },
  {
    id: 'burstSprint',
    kind: 'active' as const,
    duration: 1.4,
    cooldown: 7,
    cost: 18,
    tags: ['speed'],
  },
  {
    id: 'powerStrike',
    kind: 'active' as const,
    duration: 1.1,
    cooldown: 6,
    cost: 15,
    tags: ['attack'],
  },
  ...['clutchPerformer', 'quickRelease', 'ironStamina', 'comebackKid'].map(
    (id) => ({
      id,
      kind: 'passive' as const,
      duration: 0,
      cooldown: 0,
      cost: 0,
      tags: [id],
    }),
  ),
])
  registerAbility(a);
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
