import { InputManager } from '../../lib/arena/engine/input/InputManager';
import {
  VirtualDevice,
  type InputDevice,
} from '../../lib/arena/engine/input/InputDevice';
import { PlayerController } from '../../lib/arena/engine/controllers/PlayerController';
import { AIController } from '../../lib/arena/engine/controllers/AIController';
import type {
  Intent,
  InputFrame,
} from '../../lib/arena/engine/input/InputActions';
import { MotionActor } from './MotionActor';
import { CharacterProximity } from '../../lib/arena/engine/movement/CharacterProximity';
import type { NativeAnimator } from './NativeAnimator';
import type { MotionEventModule } from './events/contracts';
import { PrecisionProof } from './events/PrecisionProof';
import { RunningProof } from './events/RunningProof';
import { CombatProof } from './events/CombatProof';
import { kineticRecipes } from '../../lib/arena/engine/motion/KineticChains';
import { placement, boardDepthScale } from '../../lib/arena/equipment-layout';
export const proofEvents = {
  cornhole: () => new PrecisionProof('cornhole'),
  basketball: () => new PrecisionProof('basketball'),
  running: () => new RunningProof(),
  fighting: () => new CombatProof(),
};
export type ProofEvent = keyof typeof proofEvents;
export class MotionSession {
  readonly actors: MotionActor[];
  readonly event: MotionEventModule;
  readonly controllers: PlayerController[];
  readonly input = new InputManager();
  private virtual = new Map<string, VirtualDevice>();
  private frames = new Map<string, InputFrame>();
  private awaitingNeutral = new Set<string>();
  time = 0;
  steps = 0;
  paused = true;
  recent: { player: string; name: string; time: number; clip: string }[] = [];
  private accumulator = 0;
  private manualRemainder = 0;
  readonly proximity = new CharacterProximity();
  bodies() {
    return (this.actors ?? []).map((a) => ({
      id: a.id,
      position: { ...a.motor.position },
      radius: 49,
      depthRadius: 29,
      height: 290,
    }));
  }
  constructor(
    readonly scenario: ProofEvent,
    animators: NativeAnimator[],
  ) {
    this.event = proofEvents[scenario]();
    const placements =
      scenario === 'fighting'
        ? [
            { x: 470, y: 610 },
            { x: 720, y: 610 },
          ]
        : scenario === 'running'
          ? [
              { x: 210, y: 610 },
              { x: 280, y: 520 },
            ]
          : [
              { x: 250, y: 610 },
              // Match the projected throwing distance to the same depth scale
              // as the rig, board and sampled hand velocity. The old far lane
              // required invisible horizontal acceleration to reach its board.
              {
                x:
                  placement(
                    scenario === 'cornhole' ? 'cornhole' : 'basketball',
                    1,
                  ).anchor.x -
                  (placement(
                    scenario === 'cornhole' ? 'cornhole' : 'basketball',
                    0,
                  ).anchor.x -
                    250) *
                    boardDepthScale(1),
                y: 478,
              },
            ];
    this.actors = animators.map(
      (animator, i) =>
        new MotionActor(
          animator.definition.id as 'dan' | 'doug',
          animator,
          placements[i],
          this.event,
          (from, desired) => {
            const x = Math.max(100, Math.min(1190, desired.x));
            if (scenario === 'fighting') {
              const bounded = { x, y: Math.max(470, Math.min(640, desired.y)) };
              const swept = this.proximity.sweep(
                animator.definition.id,
                from,
                bounded,
                this.bodies(),
              );
              return {
                ...swept,
                blockedX: swept.blockedX || x !== desired.x,
                blockedY: swept.blockedY || bounded.y !== desired.y,
              };
            }
            return {
              position: { x, y: Math.max(470, Math.min(640, desired.y)) },
              blockedX: x !== desired.x,
              blockedY: desired.y < 470 || desired.y > 640,
            };
          },
        ),
    );
    this.event.initialize(this.actors);
    this.controllers = this.actors.map(
      (a) =>
        new PlayerController(a.id, a, this.event.controls, () =>
          this.pause(!this.paused),
        ),
    );
    this.actors.forEach((a) => {
      this.virtual.set(a.id, new VirtualDevice('motion-touch:' + a.id));
      this.ai(a.id);
    });
  }
  ai(id: string) {
    const a = this.actors.find((a) => a.id === id)!;
    this.input.assign(
      id,
      new AIController('motion-ai:' + id, (t) => ({
        values: this.event.ai(a, t),
        family: 'ai',
        connected: true,
      })),
    );
  }
  assign(id: string, device: InputDevice) {
    if (!this.actors.some((a) => a.id === id)) throw Error('Unknown player');
    this.controllers.find((c) => c.id === id)!.reset();
    this.input.assign(id, device);
  }
  inject(id: string, intent: Intent, value: number | { x: number; y: number }) {
    const device = this.virtual.get(id);
    if (!device) throw Error('Unknown player');
    if (this.input.device(id) !== device) this.assign(id, device);
    device.set(intent, value);
  }
  pause(value = true, cleanup = true) {
    this.paused = value;
    this.accumulator = 0;
    if (value && cleanup) {
      this.input.clear();
      this.controllers.forEach((c) => c.reset());
      this.event.pause();
      this.actors.forEach((a) => {
        a.motor.stopIntent();
        this.awaitingNeutral.add(a.id);
      });
    }
  }
  advance(dt: number) {
    if (this.paused) return;
    this.accumulator += Math.max(0, Math.min(0.1, dt));
    while (this.accumulator + 1e-10 >= 1 / 120 && !this.paused) {
      this.accumulator -= 1 / 120;
      this.tick();
    }
  }
  step(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 30)
      throw Error('Step accepts 0–30 seconds');
    this.manualRemainder += seconds;
    while (this.manualRemainder + 1e-10 >= 1 / 120) {
      this.manualRemainder -= 1 / 120;
      this.tick();
    }
  }
  private tick() {
    this.time += 1 / 120;
    this.steps++;
    for (const c of this.controllers) {
      const frame = this.input.poll(c.id, this.time);
      if (this.awaitingNeutral.has(c.id)) {
        const held = Object.values(frame.values).some((v) =>
          typeof v === 'number' ? v > 0.1 : !!v && Math.hypot(v.x, v.y) > 0.15,
        );
        if (held) frame.values = {};
        else this.awaitingNeutral.delete(c.id);
      }
      this.frames.set(c.id, structuredClone(frame));
      if (!frame.connected) {
        this.pause(true);
        return;
      }
      c.update(frame, this.time);
    }
    let remaining = 1 / 120;
    while (remaining > 1e-9) {
      const dt = this.actors.reduce(
        (n, a) => Math.min(n, a.planner.graph.untilNextMarker(n)),
        remaining,
      );
      const time = this.time - remaining + dt;
      for (const a of this.actors) {
        const events = a.update(dt, time);
        for (const event of events) {
          this.event.marker(a, event);
          this.recent.push({
            player: a.id,
            name: event.name,
            time: event.time,
            clip: event.clip,
          });
        }
      }
      this.event.update(dt, time);
      remaining -= dt;
    }
    this.recent = this.recent.slice(-100);
  }
  snapshot() {
    return structuredClone({
      version: 2,
      boundary: 'human-motion-lab-only',
      scenario: this.scenario,
      kineticChain: kineticRecipes[this.scenario],
      time: this.time,
      steps: this.steps,
      paused: this.paused,
      actors: this.actors.map((a) => a.snapshot()),
      event: this.event.snapshot(),
      proximity: this.proximity.snapshot(
        this.scenario === 'fighting' ? this.bodies() : [],
      ),
      markers: this.recent,
      controllers: this.controllers.map((c) => ({
        id: c.id,
        commands: c.commands,
        buffered: c.buffered,
        pending: c.pending,
        lastCommand: c.lastCommand,
      })),
      input: this.actors.map((a) => ({
        id: a.id,
        frame: this.frames.get(a.id),
      })),
    });
  }
  destroy() {
    this.controllers.forEach((c) => c.reset());
    this.input.destroy();
    this.actors.forEach((a) => a.animator.destroy());
  }
}
