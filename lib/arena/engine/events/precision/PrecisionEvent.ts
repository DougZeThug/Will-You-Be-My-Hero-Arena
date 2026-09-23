import type {
  PlayableArenaEvent,
  EventContext,
  LiveView,
} from '../../core/LiveTypes';
import type { ArenaCharacter } from '../../characters/ArenaCharacter';
import type { ActionPayload } from '../../controllers/ControllableEntity';
import type { ClipMarker } from '../../animation/AnimationEvents';
import { clamp, type InputFrame } from '../../input/InputActions';
import { placement } from '../../../equipment-layout';
import { timingGrade } from '../../input/TimingWindow';
import { PrecisionActionMap } from './PrecisionActionMap';
import {
  precisionTarget,
  flightPosition,
  resolvePrecisionLanding,
  type PrecisionBag,
  type PrecisionFlight,
} from './PrecisionPhysics';
export class PrecisionEvent implements PlayableArenaEvent {
  id = 'cornhole';
  private ctx!: EventContext;
  private turn = 0;
  private throws = 0;
  private state = 'entrance';
  private phaseAt = 0;
  private chargeAt = 0;
  private shot = 'flat';
  private aim = { x: 0, y: 0 };
  private flight?: PrecisionFlight;
  private bags: PrecisionBag[] = [];
  private message = 'Cards to court';
  private complete = false;
  private perfect = false;
  private releasePower = 0;
  private serial = 0;
  initialize(context: EventContext) {
    this.ctx = context;
  }
  registerControls() {
    return PrecisionActionMap;
  }
  createParticipants() {
    this.ctx.characters.forEach((c, i) => {
      c.body.x = 215 + i * 130;
      c.body.y = 650 - i * 72;
      c.body.scale = i === 0 ? 0.84 : 0.74;
      c.substate = 'waiting';
      c.attach({
        can: (a) => this.can(c, a),
        perform: (a, p) => this.action(c, a, p),
      });
    });
  }
  start() {
    this.phaseAt = this.ctx.time();
    this.ctx.characters.forEach((c) =>
      c.startAction(c.personality.choose('entrance')),
    );
  }
  private active() {
    return this.ctx.characters[this.turn];
  }
  private can(c: ArenaCharacter, a: string) {
    if (c !== this.active() || this.complete) return false;
    if (a.startsWith('select.') || a === 'precision')
      return ['aiming', 'charging'].includes(this.state);
    if (a === 'charge') return this.state === 'aiming';
    if (a === 'release') return this.state === 'charging';
    return false;
  }
  private action(c: ArenaCharacter, a: string, _p: ActionPayload) {
    if (a.startsWith('select.')) {
      this.shot = a.slice(7);
      return true;
    }
    if (a === 'precision') {
      const ability = c.abilities.activate(
        'precisionMode',
        this.ctx.time(),
        c.stamina,
      );
      if (!ability) return false;
      c.stamina -= ability.cost;
      this.message = 'Precision mode';
      return true;
    }
    if (a === 'charge') {
      this.state = c.substate = 'charging';
      this.chargeAt = this.ctx.time();
      c.startAction(c.personality.choose('ritual'));
      this.message = 'Release in the green window';
      return true;
    }
    if (a === 'release') {
      this.releasePower = this.power();
      this.perfect =
        timingGrade(this.releasePower, this.ideal(), this.window()).grade ===
        'perfect';
      this.state = c.substate = 'throwing';
      c.startAction(
        this.shot === 'airmail'
          ? 'throw.airmail.live'
          : this.shot === 'roll'
            ? 'throw.roll.live'
            : 'throw.precision',
      );
      this.message = this.perfect
        ? 'Perfect release'
        : this.releasePower < this.ideal()
          ? 'Early release'
          : 'Late release';
      if (this.perfect)
        this.ctx.emit({ kind: 'haptic', name: 'perfectRelease', player: c.id });
      return true;
    }
    return false;
  }
  private ideal() {
    return 0.7 + (215 - this.active().body.x) / 1400;
  }
  private window() {
    const c = this.active();
    return (
      0.035 +
      c.stats.event('cornhole', this.shot, 0.6) * 0.045 +
      (c.abilities.enabled('precisionMode', this.ctx.time()) ? 0.035 : 0) +
      (this.throws >= this.ctx.characters.length * 3 &&
      c.abilities.has('clutchPerformer')
        ? 0.025
        : 0)
    );
  }
  private power() {
    return clamp((this.ctx.time() - this.chargeAt) / 1.5, 0, 1.2);
  }
  onCharacterEvent(c: ArenaCharacter, m: ClipMarker) {
    if (
      m.name !== 'release' ||
      c !== this.active() ||
      this.state !== 'throwing'
    )
      return;
    const target = precisionTarget(),
      error = this.releasePower - this.ideal(),
      accuracy = c.stats.event(
        'cornhole',
        'accuracy',
        c.profile.throwingStyle.accuracy,
      ),
      spread =
        (1 - accuracy) *
        22 *
        (c.abilities.enabled('precisionMode', this.ctx.time()) ? 0.4 : 1);
    this.flight = {
      id: 'live-bag-' + this.serial++,
      owner: c.id,
      origin: c.hand(this.ctx.time()),
      target: {
        x:
          target.x +
          this.aim.x * 115 +
          error * 490 +
          (this.ctx.random() - 0.5) * spread,
        y:
          target.y +
          this.aim.y * 48 +
          Math.abs(error) * 60 +
          (this.ctx.random() - 0.5) * spread,
      },
      age: 0,
      duration: this.shot === 'airmail' ? 1.25 : 0.88,
      arc: this.shot === 'airmail' ? 240 : this.shot === 'flat' ? 66 : 105,
      spin: this.shot === 'roll' ? Math.PI * 4 : 0.6,
    };
    this.state = c.substate = 'flight';
    this.ctx.emit({ kind: 'audio', name: 'release', player: c.id });
  }
  update(dt: number) {
    const c = this.active(),
      time = this.ctx.time();
    if (this.state === 'entrance' && time - this.phaseAt > 1.45)
      this.nextPlayer();
    if (['aiming', 'charging'].includes(this.state)) {
      c.body.x = clamp(c.body.x + c.moveIntent.x * dt * 35, 165, 350);
      this.aim.x = clamp(this.aim.x + c.aimIntent.x * dt * 0.65, -1, 1);
      this.aim.y = clamp(this.aim.y + c.aimIntent.y * dt * 0.65, -1, 1);
      if (this.state === 'charging' && time - this.chargeAt > 2.2)
        this.action(c, 'release', {});
    }
    if (this.flight) {
      this.flight.age += dt;
      if (this.flight.age >= this.flight.duration) {
        const bag = resolvePrecisionLanding(this.flight, this.bags, this.shot);
        for (const p of this.ctx.characters)
          p.score = this.bags
            .filter((b) => b.owner === p.id)
            .reduce((n, b) => n + b.points, 0);
        this.flight = undefined;
        this.state = c.substate = 'result';
        this.phaseAt = time;
        this.throws++;
        this.message = `${c.profile.name}: ${bag.points === 3 ? 'in the hole — three points' : bag.points === 1 ? 'on the board — one point' : 'off the board'}`;
        c.react(
          c.personality.choose(
            bag.points ? 'celebration' : 'reaction',
            this.perfect ? 0.8 : 0.2,
          ),
        );
        this.ctx.emit({
          kind: 'audio',
          name: bag.points === 3 ? 'hole' : 'boardImpact',
          player: c.id,
        });
        this.ctx.emit({
          kind: 'effect',
          name: bag.points === 3 ? 'hole' : bag.points ? 'impact' : 'miss',
          x: bag.x,
          y: bag.y,
          intensity: 0.3,
        });
        if (bag.points === 3)
          this.ctx.emit({ kind: 'camera', name: 'hole', intensity: 0.5 });
      }
    }
    if (this.state === 'result' && time - this.phaseAt > 1.2) {
      if (this.throws >= this.ctx.characters.length * 4) {
        this.complete = true;
        this.state = 'finished';
        this.finish();
      } else {
        this.turn = (this.turn + 1) % this.ctx.characters.length;
        this.nextPlayer();
      }
    }
  }
  private nextPlayer() {
    this.state = 'aiming';
    this.phaseAt = this.ctx.time();
    this.aim = { x: 0, y: 0 };
    this.ctx.characters.forEach((c) => {
      c.substate = c === this.active() ? 'aiming' : 'waiting';
      c.animation.idle = c.personality.choose('idle');
    });
    this.shot =
      Object.entries(this.active().profile.throwingStyle.tendencies).sort(
        (a, b) => (b[1] ?? 0) - (a[1] ?? 0),
      )[0]?.[0] ?? 'flat';
    this.message = `${this.active().profile.name}: aim, hold charge, then release`;
  }
  ai(c: ArenaCharacter, time: number): InputFrame {
    const values: InputFrame['values'] = {
      move: { x: 0, y: 0 },
      aim: { x: 0, y: 0 },
    };
    if (c === this.active()) {
      if (this.state === 'aiming' && time - this.phaseAt > 0.4)
        values.charge = 1;
      if (this.state === 'charging') {
        values.charge =
          this.power() < this.ideal() + Math.sin(this.throws * 4.7) * 0.03
            ? 1
            : 0;
      }
    }
    return { values, family: 'ai', connected: true };
  }
  onPause() {
    if (this.state === 'charging') {
      this.state = this.active().substate = 'aiming';
      this.active().cancelAction();
    }
  }
  resolveOutcome() {
    const high = Math.max(...this.ctx.characters.map((c) => c.score));
    return {
      finished: this.complete,
      winners: this.complete
        ? this.ctx.characters.filter((c) => c.score === high).map((c) => c.id)
        : [],
    };
  }
  finish() {
    this.message = 'Final score';
    const winners = this.resolveOutcome().winners;
    this.ctx.characters.forEach((c) => {
      c.substate = 'finished';
      if (winners.includes(c.id)) c.celebrate(1);
    });
  }
  cleanup() {
    this.flight = undefined;
    this.bags = [];
  }
  view(): LiveView {
    const c = this.active(),
      target = precisionTarget();
    return {
      title: 'Cornhole',
      stage: { equipment: [placement('cornhole', 0)] },
      phase: this.state,
      message: this.message,
      time: this.ctx.time(),
      ...this.resolveOutcome(),
      scores: Object.fromEntries(
        this.ctx.characters.map((c) => [c.id, c.score]),
      ),
      // Read-only presentation of resolved turns; charging/flight does not spend a displayed bag.
      attempts: Object.fromEntries(
        this.ctx.characters.map((player, index) => [
          player.id,
          {
            total: 4,
            remaining: Math.max(
              0,
              4 -
                Math.floor(this.throws / this.ctx.characters.length) -
                (index < this.throws % this.ctx.characters.length ? 1 : 0),
            ),
          },
        ]),
      ),
      camera: 'static',
      worldWidth: 1280,
      active: c.id,
      target: ['aiming', 'charging'].includes(this.state)
        ? { x: target.x + this.aim.x * 115, y: target.y + this.aim.y * 48 }
        : undefined,
      meters:
        this.state === 'charging'
          ? {
              label: 'Release timing',
              value: this.power() / 1.2,
              target: this.ideal() / 1.2,
              window: this.window() / 1.2,
            }
          : undefined,
      objects: [
        ...this.bags
          .filter((b) => b.points === 1)
          .map((b) => ({ ...b, flatten: 0.52, kind: 'bag' as const })),
        ...(this.flight
          ? [
              {
                id: this.flight.id,
                owner: this.flight.owner,
                kind: 'bag' as const,
                ...flightPosition(this.flight),
              },
            ]
          : ['aiming', 'charging', 'throwing'].includes(this.state)
            ? [
                {
                  id: 'held',
                  owner: c.id,
                  kind: 'bag' as const,
                  ...c.hand(this.ctx.time()),
                },
              ]
            : []),
      ],
    };
  }
}
