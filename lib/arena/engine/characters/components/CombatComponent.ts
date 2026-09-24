import type { ArenaCharacter, CharacterComponent } from '../ArenaCharacter';
import type { ClipMarker } from '../../animation/AnimationEvents';
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
export class CombatComponent implements CharacterComponent {
  attack = '';
  active = false;
  blocking = false;
  dodgeUntil = 0;
  counterUntil = 0;
  hit = new Set<string>();
  constructor(
    readonly c: ArenaCharacter,
    private time: () => number,
    private playing: () => boolean,
  ) {}
  can(action: string) {
    if (!this.playing() || this.c.health <= 0) return false;
    if (action === 'stopBlock') return true;
    if (
      ![...Object.keys(ATTACKS), 'block', 'dodge', 'ability'].includes(action)
    )
      return false;
    if (this.c.substate === 'hitstun') return false;
    return (
      !this.c.animation.timeline.active ||
      this.c.canCancel() ||
      this.c.substate === 'blocking'
    );
  }
  perform(action: string) {
    const c = this.c,
      time = this.time();
    if (action === 'stopBlock') {
      this.blocking = false;
      if (c.substate === 'blocking') {
        c.cancelAction();
        c.substate = 'neutral';
      }
      return true;
    }
    if (action === 'block') {
      if (c.stamina < 4) return false;
      if (!this.blocking) c.startAction('combat.block');
      this.blocking = true;
      c.substate = 'blocking';
      return true;
    }
    if (action === 'ability') {
      if (c.stamina < 12) return false;
      c.stamina -= 12;
      this.counterUntil = time + 0.7;
      return true;
    }
    if (action === 'dodge') {
      if (c.stamina < 15) return false;
      c.stamina -= 15;
      c.startAction('combat.dodge');
      this.dodgeUntil = time + 0.42;
      c.substate = 'dodging';
      c.applyImpulse(
        (Math.abs(c.moveIntent.x) > 0.2
          ? Math.sign(c.moveIntent.x)
          : -c.body.facing) * 220,
      );
      this.blocking = false;
      this.active = false;
      return true;
    }
    const def = ATTACKS[action];
    // A grapple is set up by holding the counter-stance key. Pressing it for
    // the grapple is not a counter stance, so a stance still running is
    // cancelled and refunded.
    if (action === 'grapple' && time < this.counterUntil) {
      c.stamina += 12;
      this.counterUntil = 0;
    }
    if (!def || c.stamina < def.cost) return false;
    if (action === 'special' || action === 'chargedSpecial') {
      const ability = c.abilities.activate('powerStrike', time, c.stamina);
      if (!ability) return false;
    }
    c.stamina -= def.cost;
    this.blocking = false;
    this.attack = action;
    this.hit.clear();
    this.active = false;
    c.startAction(def.clip);
    c.substate = 'attacking';
    return true;
  }
  marker(m: ClipMarker) {
    if (m.name === 'hitboxOn' && this.c.substate === 'attacking')
      this.active = true;
    if (m.name === 'hitboxOff') this.active = false;
    if (m.name === 'animationComplete' && this.c.health > 0) {
      this.active = false;
      if (!this.blocking) this.c.substate = 'neutral';
    }
  }
  interrupt() {
    this.active = false;
    this.blocking = false;
    this.attack = '';
  }
}
