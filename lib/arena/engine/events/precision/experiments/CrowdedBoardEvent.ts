/**
 * GAMEPLAY EXPERIMENT (prototype; Lab only, never offered on Play setup).
 *
 * A copy of PrecisionEvent's turn flow with two switchable rule changes from
 * CrowdedBoardRules: the crowded board (bags block and shove) and backyard
 * innings scoring. It is selected only when a LiveConfig carries the
 * `cornholeBoard` / `cornholeScoring` options, which the player app never
 * sets. With `cornholeBoard: 'classic'`, `cornholeScoring: 'total'` and
 * `cornholeAI: 'stock'` it reproduces the shipped event throw for throw (a test
 * asserts this), so every difference measured is the rule change itself.
 */
import type {
  PlayableArenaEvent,
  EventContext,
  LiveView,
} from '../../../core/LiveTypes';
import type {
  ArenaCharacter,
  ThrowContact,
} from '../../../characters/ArenaCharacter';
import type { ActionPayload } from '../../../controllers/ControllableEntity';
import type { ClipMarker } from '../../../animation/AnimationEvents';
import {
  clamp,
  type InputFrame,
  type Vector,
} from '../../../input/InputActions';
import { placement } from '../../../../equipment-layout';
import { timingGrade } from '../../../input/TimingWindow';
import { PrecisionActionMap } from '../PrecisionActionMap';
import {
  precisionTarget,
  flightPosition,
  type PrecisionBag,
  type PrecisionFlight,
} from '../PrecisionPhysics';
import {
  bagTotals,
  inningAward,
  releaseWindow,
  resolveThrow,
  restPoint,
  rulesFromOptions,
  type ExperimentRules,
  type Motion,
  type Shot,
} from './CrowdedBoardRules';
import { plan, type ThrowerModel, type Option } from './TacticalPlanner';

const SHOTS: Record<string, string> = Object.fromEntries(
  PrecisionActionMap.actions
    .filter((a) => a.command.startsWith('select.'))
    .map((a) => [a.command.slice(7), a.label]),
);
const SKILL: Record<string, string> = { flat: 'slide' };
const SHOT_INTENT: Record<Shot, string> = {
  flat: 'primaryAction',
  slide: 'secondaryAction',
  roll: 'tertiaryAction',
  airmail: 'specialAction',
};
const START_X = [215, 345, 280, 190];
const AI_SCALE = 0.04,
  AI_EARLY = 4,
  AI_LATE = 1.6,
  /** The stock AI's error, uniform on [-0.16, 0.064]: its mean and std. dev. */
  AI_MEAN = ((AI_LATE - AI_EARLY) / 2) * AI_SCALE,
  AI_SIGMA = ((AI_EARLY + AI_LATE) * AI_SCALE) / Math.sqrt(12),
  THROW_TIMEOUT = 1.0,
  /** How long shoved and sliding bags take to come to rest on screen. */
  SETTLE = 0.45,
  BAGS = 4;

interface Settle {
  motions: Motion[];
  age: number;
  landed: PrecisionBag;
  tags: string[];
}

export class CrowdedBoardEvent implements PlayableArenaEvent {
  id = 'cornhole';
  readonly rules: ExperimentRules;
  private ctx!: EventContext;
  private aiMode: 'stock' | 'tactical' = 'tactical';
  private order: number[] = [];
  private turnIndex = 0;
  private throws = 0;
  private roundThrows = 0;
  private round = 0;
  private state = 'entrance';
  private phaseAt = 0;
  private chargeAt = 0;
  private throwAt = 0;
  private shot: Shot = 'flat';
  private aim = { x: 0, y: 0 };
  private flight?: PrecisionFlight;
  private flightShot: Shot = 'flat';
  private settle?: Settle;
  private bags: PrecisionBag[] = [];
  private match: Record<string, number> = {};
  private message = 'Cards to court';
  /** A round notice shown in front of the aiming caption for the turn. */
  private notice = '';
  private complete = false;
  private perfect = false;
  private releasePower = 0;
  private releaseWindow = 0;
  private aiError?: { throw: number; value: number };
  private aiPlan?: { throw: number; option: Option; values: number[] };
  private serial = 0;
  /** Analysis log of every resolved throw (read by tests and the Lab). */
  readonly log: {
    round: number;
    player: string;
    shot: Shot;
    aim: Vector;
    grade: string;
    points: number;
    tags: string[];
    scores: Record<string, number>;
  }[] = [];
  constructor(options: Record<string, string | number | boolean> = {}) {
    this.rules = rulesFromOptions(options);
    this.aiMode = options.cornholeAI === 'stock' ? 'stock' : 'tactical';
  }
  initialize(context: EventContext) {
    this.ctx = context;
  }
  registerControls() {
    return PrecisionActionMap;
  }
  createParticipants() {
    this.ctx.characters.forEach((c, i) => {
      c.body.x = START_X[i] ?? 215;
      c.body.y = 650 - i * 72;
      c.body.scale = i === 0 ? 0.84 : 0.74;
      c.substate = 'waiting';
      this.match[c.id] = 0;
      c.attach({
        can: (a) => this.can(c, a),
        perform: (a, p) => this.action(c, a, p),
      });
    });
    this.order = this.ctx.characters.map((_, i) => i);
  }
  start() {
    this.phaseAt = this.ctx.time();
    this.ctx.characters.forEach((c) =>
      c.startAction(c.personality.choose('entrance')),
    );
  }
  private active() {
    return this.ctx.characters[this.order[this.turnIndex]];
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
      this.shot = a.slice(7) as Shot;
      this.message =
        this.state === 'charging' ? this.chargeMessage() : this.aimMessage();
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
      this.message = this.chargeMessage();
      return true;
    }
    if (a === 'release') {
      this.releasePower = this.power();
      this.releaseWindow = this.window();
      this.perfect =
        timingGrade(this.releasePower, this.ideal(), this.releaseWindow)
          .grade === 'perfect';
      this.state = c.substate = 'throwing';
      this.throwAt = this.ctx.time();
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
  private shotName(shot: string = this.shot) {
    return SHOTS[shot] ?? shot;
  }
  private name(id: string) {
    return this.ctx.characters.find((c) => c.id === id)?.profile.name ?? id;
  }
  /** What a Perfect release of the selected shot at the reticle would do to the board now. */
  private blockerNote() {
    if (
      this.rules.board !== 'crowded' ||
      !this.bags.some((b) => b.points === 1)
    )
      return '';
    const t = precisionTarget(),
      me = this.active().id,
      r = resolveThrow(
        this.rules,
        'preview',
        me,
        this.shot,
        { x: t.x + this.aim.x * 115, y: t.y + this.aim.y * 48 },
        this.bags.map((b) => ({ ...b })),
      ),
      other = r.motions.find((m) => m.id !== 'preview');
    const whose = other
      ? other.owner === me
        ? 'your own bag'
        : `${this.name(other.owner)}'s bag`
      : 'a bag';
    if (r.tags.includes('hop')) return ` · rolls over ${whose}`;
    if (r.tags.includes('gift'))
      return ` · ${whose} in the way: this knocks it in for them`;
    if (r.tags.includes('own-push-in')) return ` · knocks ${whose} in`;
    if (r.tags.includes('blocked')) return ` · ${whose} in the way`;
    if (r.tags.includes('hot')) return ' · too hot: skates over the hole';
    if (r.tags.includes('skid')) return ' · lands on a bag';
    return '';
  }
  private aimMessage() {
    return `${this.notice ? this.notice + ' · ' : ''}${this.active().profile.name}: aim, hold charge, then release · Shot: ${this.shotName()}${this.blockerNote()}`;
  }
  /** Keep the aiming caption's board preview current as the reticle moves. */
  private previewKey = '';
  private refreshAimMessage() {
    const key = `${this.shot}:${this.aim.x.toFixed(2)}:${this.aim.y.toFixed(2)}`;
    if (key === this.previewKey) return;
    this.previewKey = key;
    this.message = this.aimMessage();
  }
  private chargeMessage() {
    return `Release in the green window · Shot: ${this.shotName()}`;
  }
  private ideal() {
    return 0.7 + (215 - this.active().body.x) / 1400;
  }
  private bagsEach() {
    return this.ctx.characters.length * BAGS;
  }
  private clutchNow() {
    return this.rules.scoring === 'innings'
      ? this.roundThrows >= this.ctx.characters.length * 3
      : this.throws >= this.ctx.characters.length * 3;
  }
  private window() {
    const c = this.active();
    return releaseWindow(
      c.stats.event('cornhole', SKILL[this.shot] ?? this.shot, 0.6),
      c.abilities.enabled('precisionMode', this.ctx.time()),
      this.clutchNow() && c.abilities.has('clutchPerformer'),
    );
  }
  private power() {
    return clamp((this.ctx.time() - this.chargeAt) / 1.5, 0, 1.2);
  }
  private releaseBag(c: ArenaCharacter) {
    const accuracy = c.stats.event(
        'cornhole',
        'accuracy',
        c.profile.throwingStyle.accuracy,
      ),
      rx = this.ctx.random(),
      ry = this.ctx.random(),
      rest = restPoint(
        {
          error: this.releasePower - this.ideal(),
          window: this.releaseWindow,
          accuracy,
          precision: c.abilities.enabled('precisionMode', this.ctx.time()),
          shot: this.shot,
          aim: this.aim,
          board: this.rules.board,
        },
        rx,
        ry,
      );
    this.flightShot = this.shot;
    // Classic: the bag flies to its rest point. Crowded: it flies to where it
    // touches down, then slides (see CrowdedBoardRules.LEAD).
    const preview = resolveThrow(
      this.rules,
      'preview',
      c.id,
      this.shot,
      rest,
      this.bags.map((b) => ({ ...b })),
    );
    this.flight = {
      id: 'live-bag-' + this.serial++,
      owner: c.id,
      origin: c.hand(this.ctx.time()),
      target: this.rules.board === 'crowded' ? preview.motions[0].from : rest,
      age: 0,
      duration: this.shot === 'airmail' ? 1.25 : 0.88,
      arc: this.shot === 'airmail' ? 240 : this.shot === 'flat' ? 66 : 105,
      spin: this.shot === 'roll' ? Math.PI * 4 : 0.6,
    };
    (this.flight as PrecisionFlight & { rest: Vector }).rest = rest;
    this.state = c.substate = 'flight';
    this.ctx.emit({ kind: 'audio', name: 'release', player: c.id });
  }
  onCharacterEvent(c: ArenaCharacter, m: ClipMarker) {
    if (
      m.name !== 'release' ||
      c !== this.active() ||
      this.state !== 'throwing'
    )
      return;
    this.releaseBag(c);
  }
  update(dt: number) {
    const c = this.active(),
      time = this.ctx.time();
    if (this.state === 'entrance' && time - this.phaseAt > 1.45)
      this.nextPlayer();
    if (this.state === 'throwing' && time - this.throwAt > THROW_TIMEOUT)
      this.releaseBag(c);
    if (['aiming', 'charging'].includes(this.state)) {
      c.body.x = clamp(c.body.x + c.moveIntent.x * dt * 35, 165, 350);
      this.aim.x = clamp(this.aim.x + c.aimIntent.x * dt * 0.65, -1, 1);
      this.aim.y = clamp(this.aim.y + c.aimIntent.y * dt * 0.65, -1, 1);
      if (this.state === 'charging' && time - this.chargeAt > 2.2)
        this.action(c, 'release', {});
      if (this.state === 'aiming' && this.rules.board === 'crowded')
        this.refreshAimMessage();
    }
    if (this.flight) {
      this.flight.age += dt;
      if (this.flight.age >= this.flight.duration) {
        const rest = (this.flight as PrecisionFlight & { rest: Vector }).rest,
          r = resolveThrow(
            this.rules,
            this.flight.id,
            this.flight.owner,
            this.flightShot,
            rest,
            this.bags,
          );
        this.flight = undefined;
        this.settle = {
          motions: r.motions,
          age: 0,
          landed: r.landed,
          tags: r.tags,
        };
        // Classic resolution has no slide to show; resolve on the same step.
        const moving =
          this.rules.board === 'crowded' &&
          r.motions.some(
            (m) => Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) > 1,
          );
        if (!moving) this.settle.age = SETTLE;
      }
    }
    if (this.settle) {
      this.settle.age += this.settle.age >= SETTLE ? 0 : dt;
      if (this.settle.age >= SETTLE) this.resolveTurn(c, time);
    }
    if (this.state === 'result' && time - this.phaseAt > 1.2)
      this.advanceTurn();
  }
  private resolveTurn(c: ArenaCharacter, time: number) {
    const { landed: bag, tags } = this.settle!;
    this.settle = undefined;
    const ids = this.ctx.characters.map((p) => p.id),
      round = bagTotals(ids, this.bags);
    for (const p of this.ctx.characters)
      p.score =
        this.rules.scoring === 'innings' ? this.match[p.id] : round[p.id];
    const contact: ThrowContact =
      bag.points === 3 ? 'hole' : bag.points === 1 ? 'board' : 'miss';
    c.lastThrow = { contact };
    this.state = c.substate = 'result';
    this.phaseAt = time;
    this.throws++;
    this.roundThrows++;
    const notes: string[] = [];
    if (tags.includes('hop')) notes.push('rolled over a blocker');
    else if (tags.includes('blocked') && bag.points === 1)
      notes.push('stopped by a blocker');
    if (tags.includes('skid')) notes.push('skidded off a bag');
    if (tags.includes('rim')) notes.push('rimmed out');
    for (const b of this.bags)
      if (
        b.id !== bag.id &&
        tags.includes('gift') &&
        b.points === 3 &&
        b.owner !== c.id
      )
        notes.push(`pushed ${this.name(b.owner)}'s bag in`);
    if (tags.includes('own-push-in')) notes.push('knocked their own bag in');
    if (tags.includes('knock-off')) notes.push('knocked a bag off');
    // The classic board keeps the shipped wording exactly.
    const unique = this.rules.board === 'crowded' ? [...new Set(notes)] : [];
    // Innings: the nameplates show match points, so the caption carries the round's bag count.
    const tally =
      this.rules.scoring === 'innings'
        ? ` · Round ${this.round + 1}: ${this.ctx.characters.map((p) => `${p.profile.name} ${round[p.id]}`).join(', ')}`
        : '';
    this.message = `${c.profile.name}: ${bag.points === 3 ? 'in the hole — three points' : bag.points === 1 ? 'on the board — one point' : 'off the board'}${unique.length ? ' · ' + unique.join(', ') : ''}${tally}`;
    this.log.push({
      round: this.round,
      player: c.id,
      shot: this.flightShot,
      aim: { ...this.aim },
      grade: this.perfect
        ? 'perfect'
        : this.releasePower < this.ideal()
          ? 'early'
          : 'late',
      points: bag.points,
      tags,
      scores: { ...round },
    });
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
  private advanceTurn() {
    const n = this.ctx.characters.length;
    if (this.rules.scoring === 'total') {
      if (this.throws >= this.bagsEach()) return this.end();
      this.turnIndex = (this.turnIndex + 1) % n;
      return this.nextPlayer();
    }
    if (this.roundThrows < this.bagsEach()) {
      this.turnIndex = (this.turnIndex + 1) % n;
      return this.nextPlayer();
    }
    // End of a round: cancel, award, clear the board.
    const ids = this.ctx.characters.map((p) => p.id),
      totals = bagTotals(ids, this.bags),
      award = inningAward(totals);
    for (const id of ids) this.match[id] += award[id];
    for (const p of this.ctx.characters) p.score = this.match[p.id];
    const scorer = ids.find((id) => award[id] > 0);
    this.round++;
    this.roundThrows = 0;
    this.bags = [];
    const best = Math.max(...ids.map((id) => this.match[id]));
    if (best >= this.rules.target || this.round >= this.rules.maxRounds) {
      this.message = scorer
        ? `${this.name(scorer)} takes the round +${award[scorer]}`
        : 'Round cancels out';
      return this.end();
    }
    // The scorer throws first next round; everyone else keeps their order.
    if (scorer) {
      const s = ids.indexOf(scorer);
      this.order = ids.map((_, i) => (s + i) % ids.length);
    }
    this.turnIndex = 0;
    this.nextPlayer(
      scorer
        ? `Round ${this.round + 1} · ${this.name(scorer)} took the last round +${award[scorer]} and throws first`
        : `Round ${this.round + 1} · last round cancelled out`,
    );
  }
  private end() {
    this.complete = true;
    this.state = 'finished';
    this.finish();
  }
  private nextPlayer(prefix?: string) {
    this.state = 'aiming';
    this.phaseAt = this.ctx.time();
    this.aim = { x: 0, y: 0 };
    this.ctx.characters.forEach((c) => {
      c.substate = c === this.active() ? 'aiming' : 'waiting';
      c.animation.idle = c.personality.choose('idle');
    });
    this.shot = (Object.entries(this.active().profile.throwingStyle.tendencies)
      .filter(([shot]) => shot in SHOTS)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'flat') as Shot;
    this.notice = prefix ?? '';
    this.previewKey = '';
    this.message = this.aimMessage();
  }
  /** The planner's model of a character (timing as the stock AI's spread). */
  model(c: ArenaCharacter): ThrowerModel {
    const skill = (s: string) => c.stats.event('cornhole', SKILL[s] ?? s, 0.6);
    return {
      id: c.id,
      accuracy: c.stats.event(
        'cornhole',
        'accuracy',
        c.profile.throwingStyle.accuracy,
      ),
      skill: {
        flat: skill('flat'),
        slide: skill('slide'),
        roll: skill('roll'),
        airmail: skill('airmail'),
      },
      clutch: c.abilities.has('clutchPerformer'),
      sigma: AI_SIGMA,
      bias: AI_MEAN,
    };
  }
  /** Who throws after the active player this round, in order. */
  private upcoming() {
    const n = this.ctx.characters.length,
      left =
        (this.rules.scoring === 'innings'
          ? this.bagsEach() - this.roundThrows
          : this.bagsEach() - this.throws) - 1;
    return Array.from(
      { length: Math.min(left, n) },
      (_, k) => this.ctx.characters[this.order[(this.turnIndex + 1 + k) % n]],
    );
  }
  planFor(c: ArenaCharacter) {
    const next = this.upcoming().filter((p) => p !== c);
    return plan({
      board: this.rules.board,
      bags: this.bags,
      me: this.model(c),
      next: next.map((p) => this.model(p)),
      rivals: this.ctx.characters.filter((p) => p !== c).map((p) => p.id),
      clutchNow: this.clutchNow(),
    });
  }
  ai(c: ArenaCharacter, time: number): InputFrame {
    const values: InputFrame['values'] = {
      move: { x: 0, y: 0 },
      aim: { x: 0, y: 0 },
    };
    if (c === this.active()) {
      let ready = true;
      if (this.aiMode === 'tactical' && this.state === 'aiming') {
        if (this.aiPlan?.throw !== this.throws) {
          const evaluations = this.planFor(c);
          this.aiPlan = {
            throw: this.throws,
            option: evaluations[0].option,
            values: evaluations.map((e) => e.value),
          };
        }
        const want = this.aiPlan.option;
        if (this.shot !== want.shot) {
          // One press per frame of difference; the edge needs a 0 between.
          if (Math.round(time * 60) % 2 === 0)
            (values as Record<string, unknown>)[SHOT_INTENT[want.shot]] = 1;
          ready = false;
        }
        const dx = want.aim.x - this.aim.x,
          dy = want.aim.y - this.aim.y;
        if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) {
          values.aim = {
            x: Math.abs(dx) > 0.02 ? Math.sign(dx) : 0,
            y: Math.abs(dy) > 0.02 ? Math.sign(dy) : 0,
          };
          ready = false;
        }
      }
      if (this.state === 'aiming' && ready && time - this.phaseAt > 0.4)
        values.charge = 1;
      if (this.state === 'charging') {
        if (this.aiError?.throw !== this.throws)
          this.aiError = {
            throw: this.throws,
            value: this.ctx.random() * (AI_EARLY + AI_LATE) - AI_EARLY,
          };
        values.charge =
          this.power() < this.ideal() + this.aiError.value * AI_SCALE ? 1 : 0;
      }
    }
    return { values, family: 'ai', connected: true };
  }
  onPause() {
    if (this.state === 'charging') {
      this.state = this.active().substate = 'aiming';
      this.active().cancelAction();
      this.message = this.aimMessage();
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
    const winners = this.resolveOutcome().winners;
    this.message =
      (this.rules.scoring === 'innings' ? this.message + ' · ' : '') +
      'Final score';
    this.ctx.characters.forEach((c) => {
      c.substate = 'finished';
      if (winners.includes(c.id)) c.celebrate(1);
    });
  }
  cleanup() {
    this.flight = undefined;
    this.settle = undefined;
    this.bags = [];
  }
  /** Board bags drawn where they are mid-slide while a throw settles. */
  private boardObjects() {
    const s = this.settle,
      t = s ? Math.min(1, s.age / SETTLE) : 1,
      ease = 1 - (1 - t) ** 3,
      moving = new Map<string, Motion>();
    // A bag can be shoved more than once in a chain; draw its first start and final rest.
    s?.motions.forEach((m) => {
      const prev = moving.get(m.id);
      moving.set(m.id, prev ? { ...m, from: prev.from } : m);
    });
    return this.bags
      .filter((b) => b.points === 1 || (moving.has(b.id) && t < 1))
      .map((b) => {
        const m = moving.get(b.id);
        const at = m
          ? {
              x: m.from.x + (m.to.x - m.from.x) * ease,
              y: m.from.y + (m.to.y - m.from.y) * ease,
            }
          : { x: b.x, y: b.y };
        return { ...b, ...at, flatten: 0.52, kind: 'bag' as const };
      });
  }
  view(): LiveView {
    const c = this.active(),
      target = precisionTarget(),
      n = this.ctx.characters.length,
      thrown =
        this.rules.scoring === 'innings' ? this.roundThrows : this.throws;
    return {
      title:
        'Cornhole · ' +
        (this.rules.board === 'crowded' ? 'Crowded board' : 'Classic board') +
        (this.rules.scoring === 'innings'
          ? ` · Round ${Math.min(this.round + 1, this.rules.maxRounds)} · to ${this.rules.target}`
          : ''),
      stage: { equipment: [placement('cornhole', 0)] },
      phase: this.settle ? 'settling' : this.state,
      message: this.message,
      time: this.ctx.time(),
      ...this.resolveOutcome(),
      scores: Object.fromEntries(
        this.ctx.characters.map((c) => [c.id, c.score]),
      ),
      attempts: Object.fromEntries(
        this.ctx.characters.map((player) => {
          const seat = this.order.indexOf(this.ctx.characters.indexOf(player));
          return [
            player.id,
            {
              total: BAGS,
              remaining: Math.max(
                0,
                BAGS - Math.floor(thrown / n) - (seat < thrown % n ? 1 : 0),
              ),
            },
          ];
        }),
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
        ...this.boardObjects(),
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
