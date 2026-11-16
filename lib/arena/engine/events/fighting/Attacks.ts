/** Attack data shared by the fighter's combat component and the fighting rules. */
export const ATTACKS: Record<
  string,
  {
    clip: string;
    damage: number;
    range: number;
    cost: number;
    knockback: number;
  }
> = {
  light: { clip: 'combat.jab', damage: 8, range: 120, cost: 6, knockback: 85 },
  heavy: {
    clip: 'combat.heavy',
    damage: 15,
    range: 134,
    cost: 14,
    knockback: 185,
  },
  finisher: {
    clip: 'combat.finisher',
    damage: 22,
    range: 148,
    cost: 20,
    knockback: 250,
  },
  special: {
    clip: 'combat.special',
    damage: 25,
    range: 155,
    cost: 22,
    knockback: 290,
  },
  // Down, forward, special: the power strike with a run-up, 20% stronger.
  chargedSpecial: {
    clip: 'combat.special',
    damage: 30,
    range: 155,
    cost: 22,
    knockback: 320,
  },
  grapple: {
    clip: 'combat.grapple',
    damage: 17,
    range: 92,
    cost: 16,
    knockback: 220,
  },
};
