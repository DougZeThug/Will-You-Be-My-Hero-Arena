// Records every Frame and the command log so the lab can scrub to any past
// step, step frame by frame, replay slowly, and re-simulate deterministically
// from the command log. Scrubbing shows exactly what happened (the recorded
// frames), including interruptions; nothing is re-posed for display.
import type { Command } from './types';
import { createSim } from './sim';
import type { Sim, SimFrame, SimOptions } from './sim';

export interface LoggedCommand {
  step: number; // the command was applied before this step was simulated
  cmd: Command;
}

export class Timeline {
  readonly options: SimOptions;
  frames: SimFrame[] = [];
  commands: LoggedCommand[] = [];
  private sim: Sim;

  constructor(options: SimOptions) {
    this.options = options;
    this.sim = createSim(options);
  }

  /** Number of simulated steps so far. */
  get length(): number {
    return this.frames.length;
  }

  get last(): SimFrame {
    return this.frames.length
      ? this.frames[this.frames.length - 1]
      : this.sim.frame;
  }

  /** Applies a command at the live head (never in the past). */
  command(cmd: Command): void {
    this.commands.push({
      step: this.frames.length,
      cmd: JSON.parse(JSON.stringify(cmd)) as Command,
    });
    this.sim.command(cmd);
  }

  /** Simulates one step at the live head and records it. */
  step(): SimFrame {
    const f = this.sim.step();
    this.frames.push(f);
    return f;
  }

  /** The recorded frame for a past step (clamped). */
  at(step: number): SimFrame {
    if (!this.frames.length) return this.sim.frame;
    const i = Math.max(0, Math.min(this.frames.length - 1, Math.round(step)));
    return this.frames[i];
  }

  /** Rebuilds a fresh simulation from the command log up to `steps` and returns its frames. */
  resimulate(steps = this.frames.length): SimFrame[] {
    const sim = createSim(this.options);
    const out: SimFrame[] = [];
    let c = 0;
    for (let i = 0; i < steps; i++) {
      while (c < this.commands.length && this.commands[c].step <= i)
        sim.command(this.commands[c++].cmd);
      out.push(sim.step());
    }
    return out;
  }

  /** Drops everything after `step` and continues live from there (re-simulated from the log). */
  truncate(step: number): void {
    const keep = Math.max(0, Math.min(this.frames.length, Math.round(step)));
    this.commands = this.commands.filter(
      (c) => c.step < keep || (c.step === keep && false),
    );
    this.sim = createSim(this.options);
    const frames: SimFrame[] = [];
    let c = 0;
    for (let i = 0; i < keep; i++) {
      while (c < this.commands.length && this.commands[c].step <= i)
        this.sim.command(this.commands[c++].cmd);
      frames.push(this.sim.step());
    }
    this.frames = frames;
  }

  /** Stable text form of a frame list, for byte-exact determinism comparison. */
  static serialize(frames: SimFrame[]): string {
    return JSON.stringify(frames);
  }
}
