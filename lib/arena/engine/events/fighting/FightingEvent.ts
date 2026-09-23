import type {
  PlayableArenaEvent,
  EventContext,
  LiveView,
} from '../../core/LiveTypes';
import type { ArenaCharacter } from '../../characters/ArenaCharacter';
import type { InputFrame } from '../../input/InputActions';
import { FightingActionMap } from './FightingActionMap';
import { CombatComponent } from '../../characters/components/CombatComponent';
import { moveFighter, combatHits } from './CombatPhysics';
export class FightingEvent implements PlayableArenaEvent {
  id = 'fighting';
  private ctx!: EventContext;
  private state = 'ready';
  private started = 0;
  private components = new Map<string, CombatComponent>();
  private message = 'Step into the ring';
  private think = new Map<
    string,
    { at: number; values: InputFrame['values'] }
  >();
  initialize(ctx: EventContext) {
    this.ctx = ctx;
  }
  registerControls() {
    return FightingActionMap;
  }
  createParticipants() {
    this.ctx.characters.forEach((c, i) => {
      c.body.x = 310 + (i * 620) / Math.max(1, this.ctx.characters.length - 1);
      c.body.y = 640;
      c.body.scale = 0.88;
      c.body.facing = i % 2 ? -1 : 1;
      c.substate = 'ready';
      c.animation.idle = 'combat.stance';
      const component = new CombatComponent(
        c,
        this.ctx.time,
        () => this.state === 'fighting',
      );
      c.attach(component);
      this.components.set(c.id, component);
    });
  }
  start() {
    this.started = this.ctx.time();
    this.ctx.characters.forEach((c) =>
      c.startAction(c.personality.choose('entrance')),
    );
  }
  update(dt: number) {
    const time = this.ctx.time();
    if (this.state === 'ready' && time - this.started > 1.5) {
      this.state = 'fighting';
      this.ctx.characters.forEach((c) => (c.substate = 'neutral'));
      this.message = 'Fight — light, light, heavy chains into a finisher';
    }
    if (this.state !== 'fighting') return;
    for (const c of this.ctx.characters) {
      const enemy = this.ctx.characters
        .filter((p) => p !== c && p.health > 0)
        .sort(
          (a, b) =>
            Math.abs(a.body.x - c.body.x) - Math.abs(b.body.x - c.body.x),
        )[0];
      if (enemy && !['attacking', 'dodging'].includes(c.substate))
        c.body.facing = enemy.body.x > c.body.x ? 1 : -1;
      moveFighter(c, this.components.get(c.id)!, dt);
    }
    for (let i = 0; i < this.ctx.characters.length; i++)
      for (let j = i + 1; j < this.ctx.characters.length; j++) {
        const a = this.ctx.characters[i],
          b = this.ctx.characters[j],
          dx = b.body.x - a.body.x;
        if (a.health > 0 && b.health > 0 && Math.abs(dx) < 70) {
          const push = (70 - Math.abs(dx)) / 2,
            sign = Math.sign(dx) || 1;
          a.body.x -= sign * push;
          b.body.x += sign * push;
        }
      }
    for (const hit of combatHits(this.ctx.characters, this.components, time)) {
      const component = this.components.get(hit.target.id)!;
      if (hit.blocked) {
        hit.target.health = Math.max(0, hit.target.health - hit.damage);
        hit.target.stamina = Math.max(0, hit.target.stamina - 8);
        hit.target.applyImpulse(hit.impulse);
        if (!hit.target.stamina || !hit.target.health) {
          component.interrupt();
          hit.target.takeHit(0, 0);
        }
      } else {
        component.interrupt();
        hit.target.takeHit(hit.damage, hit.impulse);
        hit.target.beat('hit', time);
        // Play-only hit-stop: the session holds the clock for a few steps so
        // a landed blow reads. Heavier hits hold longer.
        this.ctx.hitStop?.(hit.damage >= 15 ? 5 : 3);
      }
      hit.attacker.score += hit.damage;
      this.message = hit.blocked
        ? hit.target.profile.name + ' blocks'
        : hit.attacker.profile.name + ' hits ' + hit.target.profile.name;
      this.ctx.emit({
        kind: 'effect',
        name: hit.blocked ? 'block' : 'hit',
        x: hit.target.body.x,
        y: hit.target.body.y - 190,
        intensity: hit.damage / 30,
      });
      this.ctx.emit({
        kind: 'camera',
        name: hit.blocked ? 'block' : 'hit',
        intensity: hit.blocked ? 0.2 : Math.min(1, 0.3 + hit.damage / 25),
      });
      this.ctx.emit({
        kind: 'audio',
        name: hit.blocked ? 'block' : 'punch',
        player: hit.attacker.id,
      });
      this.ctx.emit({
        kind: 'haptic',
        name: hit.blocked ? 'lightImpact' : 'punchHit',
        player: hit.target.id,
      });
    }
    if (
      this.ctx.characters.filter((c) => c.health > 0).length <= 1 ||
      time - this.started >= 60
    ) {
      this.state = 'finished';
      this.finish();
    }
  }
  ai(c: ArenaCharacter, time: number): InputFrame {
    const enemy = this.ctx.characters
      .filter((p) => p !== c && p.health > 0)
      .sort(
        (a, b) => Math.abs(a.body.x - c.body.x) - Math.abs(b.body.x - c.body.x),
      )[0];
    if (!enemy) return { values: {}, family: 'ai', connected: true };
    const distance = Math.abs(enemy.body.x - c.body.x),
      values: InputFrame['values'] = {
        move: {
          x: distance > 112 ? Math.sign(enemy.body.x - c.body.x) : 0,
          y: 0,
        },
      },
      thought = this.think.get(c.id);
    if (!thought || time >= thought.at) {
      const roll = this.ctx.random(),
        aggressive =
          c.profile.personality.intensity +
          c.profile.personality.showmanship * 0.25;
      const intent =
        enemy.substate === 'attacking' && roll > aggressive * 0.4
          ? 'modifierLeft'
          : roll < 0.45
            ? 'primaryAction'
            : roll < 0.73
              ? 'secondaryAction'
              : roll < 0.85
                ? 'tertiaryAction'
                : 'specialAction';
      this.think.set(c.id, {
        at: time + 0.26 + this.ctx.random() * 0.28,
        values: distance < 160 ? { [intent]: 1 } : {},
      });
    }
    const now = this.think.get(c.id)!;
    if (now.at - time > 0.13) Object.assign(values, now.values);
    return { values, family: 'ai', connected: true };
  }
  onPause() {
    this.components.forEach((c) => {
      c.perform('stopBlock');
    });
  }
  resolveOutcome() {
    const high = Math.max(...this.ctx.characters.map((c) => c.health));
    return {
      finished: this.state === 'finished',
      winners:
        this.state === 'finished'
          ? this.ctx.characters
              .filter((c) => c.health === high && high > 0)
              .map((c) => c.id)
          : [],
    };
  }
  finish() {
    const win = this.resolveOutcome().winners;
    this.ctx.characters.forEach((c) => {
      this.components.get(c.id)!.interrupt();
      c.body.vx = 0;
      c.animation.locomotion = '';
      c.substate = 'finished';
      if (win.includes(c.id)) c.celebrate(1);
    });
    this.message =
      win.length === 1
        ? this.ctx.characters.find((c) => c.id === win[0])!.profile.name +
          ' wins'
        : 'Draw';
    this.ctx.emit({ kind: 'audio', name: 'victory' });
  }
  cleanup() {
    this.components.clear();
    this.think.clear();
  }
  view(): LiveView {
    return {
      title: 'Backyard Brawl',
      metric: 'health',
      phase: this.state,
      message: this.message,
      time: this.ctx.time(),
      ...this.resolveOutcome(),
      scores: Object.fromEntries(
        this.ctx.characters.map((c) => [c.id, c.score]),
      ),
      camera: 'dual',
      worldWidth: 1280,
      objects: [],
    };
  }
}
