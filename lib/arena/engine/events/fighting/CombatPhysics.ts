import type { ArenaCharacter } from '../../characters/ArenaCharacter';
import {
  ATTACKS,
  CombatComponent,
} from '../../characters/components/CombatComponent';
import { clamp } from '../../input/InputActions';
export interface CombatHit {
  attacker: ArenaCharacter;
  target: ArenaCharacter;
  damage: number;
  impulse: number;
  blocked: boolean;
  /** The target's counter stance reduced the damage. */
  countered: boolean;
}
export function moveFighter(
  c: ArenaCharacter,
  combat: CombatComponent,
  dt: number,
) {
  if (c.health <= 0) return;
  const locked = ['attacking', 'hitstun', 'dodging'].includes(c.substate),
    speed = 110 + c.stats.event('fighting', 'mobility', 0.6) * 100;
  c.body.x = clamp(
    c.body.x +
      (locked
        ? 0
        : c.moveIntent.x * speed * (combat.blocking ? 0.38 : 1) * dt) +
      c.body.vx * dt,
    105,
    1175,
  );
  c.body.vx *= Math.exp(-7 * dt);
  c.stamina = clamp(c.stamina + dt * (combat.blocking ? 3 : 11), 0, 100);
  // Moving away from the opponent steps backward instead of moonwalking.
  c.animation.locomotion =
    !locked && Math.abs(c.moveIntent.x) > 0.15
      ? c.moveIntent.x * c.body.facing < 0
        ? 'back_step'
        : 'locomotion.walk'
      : '';
}
/** Detect all active hitboxes before applying any hit. Trades do not depend on
 * participant iteration order. Hitboxes belong to rules, never sprite bounds. */
export function combatHits(
  characters: ArenaCharacter[],
  components: Map<string, CombatComponent>,
  time: number,
): CombatHit[] {
  const hits: CombatHit[] = [];
  for (const a of characters) {
    const ca = components.get(a.id)!,
      def = ATTACKS[ca.attack];
    if (!ca.active || !def || a.health <= 0 || a.substate !== 'attacking')
      continue;
    for (const b of characters) {
      if (a === b || b.health <= 0 || ca.hit.has(b.id)) continue;
      const cb = components.get(b.id)!,
        dx = b.body.x - a.body.x;
      if (
        dx * a.body.facing < 0 ||
        Math.abs(dx) > def.range ||
        Math.abs(a.body.y - b.body.y) > 65 ||
        time < cb.dodgeUntil
      )
        continue;
      ca.hit.add(b.id);
      const blocked =
          cb.blocking &&
          Math.sign(-dx) === b.body.facing &&
          ca.attack !== 'grapple',
        factor = 0.8 + a.stats.event('fighting', 'attack', 0.6) * 0.4,
        // The target's defence rating takes up to 10% off, or adds up to 10%,
        // around a middling card. Blocked chip damage is fixed.
        defence = 1.1 - b.stats.event('fighting', 'defense', 0.5) * 0.2,
        countered = !blocked && time < cb.counterUntil,
        damage = blocked
          ? 2
          : Math.round(def.damage * factor * defence * (countered ? 0.65 : 1));
      hits.push({
        attacker: a,
        target: b,
        damage,
        impulse: a.body.facing * def.knockback * (blocked ? 0.18 : 1),
        blocked,
        countered,
      });
    }
  }
  return hits;
}
