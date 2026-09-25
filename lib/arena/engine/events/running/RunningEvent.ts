import type {
  PlayableArenaEvent,
  EventContext,
  LiveView,
} from '../../core/LiveTypes';
import type { ArenaCharacter } from '../../characters/ArenaCharacter';
import type { InputFrame } from '../../input/InputActions';
import { RunningActionMap } from './RunningActionMap';
import { RunningComponent } from '../../characters/components/RunningComponent';
import {
  runPhysics,
  obstacleCollision,
  laneScale,
  stumbleTime,
  RUNNING_LENGTH,
  type RunnerMotion,
  type Obstacle,
} from './RunningPhysics';
export class RunningEvent implements PlayableArenaEvent {
  id = 'running';
  private ctx!: EventContext;
  private state = 'ready';
  private started = 0;
  private firstFinish = 0;
  private motions = new Map<string, RunnerMotion>();
  private obstacles: Obstacle[] = [];
  private message = 'Take your mark';
  /** Runners whose celebration the caption has already announced. */
  private cheering = new Set<string>();
  initialize(ctx: EventContext) {
    this.ctx = ctx;
  }
  registerControls() {
    return RunningActionMap;
  }
  createParticipants() {
    this.ctx.characters.forEach((c, i) => {
      c.body.x = 170 - Math.floor(i / 3) * 95;
      c.body.y = 520 + (i % 3) * 62;
      c.body.scale = laneScale(c.body.y);
      c.substate = 'ready';
      const m: RunnerMotion = {
        sprint: 0,
        brake: false,
        slide: 0,
        stumble: 0,
        finished: 0,
        lane: i % 3,
        laneClock: 0,
        hits: new Set(),
        startX: c.body.x,
      };
      this.motions.set(c.id, m);
      c.attach(
        new RunningComponent(
          c,
          m,
          this.ctx.time,
          () => this.state === 'running',
        ),
      );
    });
    for (let row = 0; row < 7; row++)
      for (let lane = 0; lane < 3; lane++)
        if ((row + lane) % 3 !== 2)
          this.obstacles.push({
            id: `obstacle-${row}-${lane}`,
            x: 490 + row * 245 + (lane % 2) * 50,
            y: 520 + lane * 62,
            kind: (row + lane) % 4 === 0 ? 'bar' : 'hurdle',
            width: 36,
            height: 42,
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
      this.state = 'running';
      this.message = 'Go — jump hurdles, slide under bars';
    }
    if (this.state !== 'running') return;
    for (const c of this.ctx.characters) {
      const m = this.motions.get(c.id)!;
      if (runPhysics(c, m, dt, time, String(this.ctx.options.movement ?? 'lanes')))
        this.ctx.emit({
          kind: 'effect',
          name: 'dust',
          x: c.body.x,
          y: c.body.y,
          intensity: 0.3,
        });
      for (const o of this.obstacles)
        if (obstacleCollision(c, o, m)) {
          m.hits.add(o.id);
          m.stumble = stumbleTime(c);
          c.body.vx *= 0.28;
          c.stamina = Math.max(0, c.stamina - 10);
          c.react('running.stumble');
          this.ctx.emit({
            kind: 'effect',
            name: 'dust',
            x: c.body.x,
            y: c.body.y,
            intensity: 0.45,
          });
          this.ctx.emit({
            kind: 'audio',
            name: 'runningCollision',
            player: c.id,
          });
          this.ctx.emit({ kind: 'haptic', name: 'runningCrash', player: c.id });
          this.ctx.emit({ kind: 'camera', name: 'stumble', intensity: 0.35 });
        }
      const celebrating = c.state === 'celebrating' && !m.finished;
      if (celebrating && !this.cheering.has(c.id))
        this.message = c.profile.name + ' celebrates';
      if (celebrating) this.cheering.add(c.id);
      else this.cheering.delete(c.id);
      if (c.body.x >= RUNNING_LENGTH && !m.finished) {
        m.finished = time - this.started;
        c.body.vx = 0;
        c.substate = 'finished';
        c.animation.locomotion = '';
        c.celebrate(1);
        this.firstFinish ||= time;
        this.message = c.profile.name + ' crosses the line';
        this.ctx.emit({ kind: 'audio', name: 'victory', player: c.id });
      }
    }
    if (
      [...this.motions.values()].every((m) => m.finished) ||
      (this.firstFinish && time - this.firstFinish > 6) ||
      time - this.started > 40
    ) {
      this.state = 'finished';
      this.finish();
    }
  }
  ai(c: ArenaCharacter, time: number): InputFrame {
    const m = this.motions.get(c.id)!,
      // React in time rather than at a fixed distance: a hurdle needs the
      // runner airborne before it and still clear of it on landing, a bar
      // needs the slide to last until it is passed.
      obstacle = this.obstacles.find(
        (o) =>
          o.x > c.body.x &&
          o.x - c.body.x <
            Math.max(36, c.body.vx * (o.kind === 'bar' ? 0.3 : 0.5)) &&
          Math.abs(o.y - c.body.y) < 35,
      ),
      values: InputFrame['values'] = {
        move: { x: 1, y: 0 },
        charge: c.stamina > 18 ? 1 : 0,
      };
    if (obstacle) {
      if (obstacle.kind === 'bar') values.secondaryAction = 1;
      else values.primaryAction = 1;
    }
    if (Math.floor(time) % 8 === 4) values.specialAction = 1;
    return { values, family: 'ai', connected: true };
  }
  onPause() {
    this.motions.forEach((m) => {
      m.sprint = 0;
      m.brake = false;
    });
  }
  resolveOutcome() {
    const first = Math.min(
      ...[...this.motions.values()].map((m) => m.finished || Infinity),
    );
    return {
      finished: this.state === 'finished',
      // A dead heat is shared: every runner on the first finishing step wins.
      winners:
        this.state === 'finished' && Number.isFinite(first)
          ? [...this.motions]
              .filter(([, m]) => m.finished === first)
              .map(([id]) => id)
          : [],
    };
  }
  finish() {
    this.ctx.characters.forEach((c) => {
      c.body.vx = 0;
      c.animation.locomotion = '';
      c.substate = 'finished';
    });
    const winners = this.resolveOutcome().winners.length;
    this.message = !winners
      ? 'Time limit'
      : winners > 1
        ? 'Dead heat — race complete'
        : 'Finish — race complete';
  }
  cleanup() {
    this.motions.clear();
    this.obstacles = [];
  }
  view(): LiveView {
    return {
      title: 'Clubhouse Dash',
      stage: { lanes: [493, 555, 617, 679] },
      phase: this.state,
      message: this.message,
      time: this.ctx.time(),
      ...this.resolveOutcome(),
      scores: Object.fromEntries(
        this.ctx.characters.map((c) => [c.id, c.score]),
      ),
      camera: 'running',
      worldWidth: RUNNING_LENGTH + 700,
      objects: [
        ...this.obstacles.map((o) => ({
          ...o,
          kind: 'obstacle' as const,
          color: o.kind === 'bar' ? 0x18a1ad : 0xffcf25,
          height: o.kind === 'bar' ? 90 : o.height,
        })),
        {
          id: 'finish',
          kind: 'finish',
          x: RUNNING_LENGTH,
          y: 585,
          width: 24,
          height: 210,
        },
      ],
    };
  }
}
