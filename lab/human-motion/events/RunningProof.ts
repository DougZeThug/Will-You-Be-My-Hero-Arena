import type { MotionEventModule } from './contracts';
import { sharedActions } from './contracts';
import type { MotionActor } from '../MotionActor';
import type { ActionPayload } from '../../../lib/arena/engine/controllers/ControllableEntity';
import type { MotionEvent } from '../../../lib/arena/engine/motion/MotionTypes';
import type { EventActionMap } from '../../../lib/arena/engine/controllers/EventActionMap';
export class RunningProof implements MotionEventModule {
  id = 'running';
  actors: MotionActor[] = [];
  collisions = 0;
  finish = 1150;
  private hits = new Set<string>();
  obstacles = [
    { id: 1, x: 550, y: 600, height: 36 },
    { id: 2, x: 850, y: 520, height: 36 },
  ];
  controls: EventActionMap = {
    id: 'human-v2-running',
    bufferSeconds: 0.22,
    actions: [
      ...sharedActions,
      { intent: 'charge', phase: 'held', command: 'sprint', label: 'Sprint' },
      {
        intent: 'charge',
        phase: 'released',
        command: 'cruise',
        label: 'Cruise',
      },
      {
        intent: 'primaryAction',
        phase: 'pressed',
        command: 'jump',
        label: 'Jump',
      },
      {
        intent: 'secondaryAction',
        phase: 'pressed',
        command: 'dodge',
        label: 'Slide / dodge',
      },
    ],
  };
  initialize(a: MotionActor[]) {
    this.actors = a;
  }
  can(action: string, a: MotionActor) {
    return (
      ['sprint', 'cruise'].includes(action) ||
      (['jump', 'dodge'].includes(action) && a.canCancel() && a.motor.grounded)
    );
  }
  perform(action: string, _p: ActionPayload, a: MotionActor) {
    if (action === 'sprint' || action === 'cruise') {
      a.motor.sprint = action === 'sprint' && a.stamina > 5;
      return true;
    }
    return a.start(action);
  }
  marker(_a: MotionActor, _e: MotionEvent) {}
  update(dt: number, _time: number) {
    for (const a of this.actors) {
      a.stamina = Math.max(
        0,
        Math.min(100, a.stamina + (a.motor.sprint ? -8 : 5) * dt),
      );
      if (!a.stamina) a.motor.sprint = false;
      for (const o of this.obstacles) {
        const key = a.id + o.id;
        if (
          !this.hits.has(key) &&
          Math.abs(a.motor.position.x - o.x) < 20 &&
          Math.abs(a.motor.position.y - o.y) < 45 &&
          a.motor.height < o.height &&
          !a.dodging
        ) {
          this.hits.add(key);
          this.collisions++;
          a.motor.impulse({ x: -160, y: 0 });
          a.planner.request('hit', true);
        }
      }
      if (a.motor.position.x >= this.finish && !a.score) {
        a.score = 1;
        a.motor.stopIntent();
        a.planner.request('success', true);
      }
    }
  }
  ai(a: MotionActor, _time: number) {
    if (a.score) return {};
    const obstacle = this.obstacles.find(
      (o) =>
        o.x - a.motor.position.x > 20 &&
        o.x - a.motor.position.x < 130 &&
        Math.abs(o.y - a.motor.position.y) < 45,
    );
    return {
      move: { x: 1, y: 0 },
      charge: a.stamina > 8 ? 1 : 0,
      ...(obstacle ? { primaryAction: 1 } : {}),
    };
  }
  pause() {
    this.actors.forEach((a) => a.motor.stopIntent());
  }
  snapshot() {
    return {
      id: this.id,
      phase: 'running',
      obstacles: this.obstacles,
      collisions: this.collisions,
      finish: this.finish,
    };
  }
}
