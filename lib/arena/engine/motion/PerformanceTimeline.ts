import {
  GestureMemory,
  type PerformancePersonality,
  type Emotion,
  type Gesture,
} from '../characters/PerformancePersonality';
export type PerformancePhase =
  | 'IDLE'
  | 'PRE_ACTION'
  | 'ACTION'
  | 'WATCHING'
  | 'RESULT'
  | 'REACTION'
  | 'RECOVERY';
export interface PerformanceHost {
  play(semantic: string): boolean;
  complete(): boolean;
  canTransition(): boolean;
  has(semantic: string): boolean;
}
/** Character-owned performance orchestration. Receives facts; never creates scores or changes physics. */
export class PerformanceTimeline {
  phase: PerformancePhase = 'IDLE';
  gesture: Gesture = 'none';
  mode: 'normal' | 'athletic-only' | 'showcase' = 'normal';
  readonly memory: GestureMemory;
  history: { phase: PerformancePhase; time: number; gesture: Gesture }[] = [];
  private pending?: () => boolean;
  private result?: { emotion: Emotion; at: number };
  private phaseAt = 0;
  constructor(
    readonly profile: PerformancePersonality,
    private host: PerformanceHost,
    seed: number,
  ) {
    this.memory = new GestureMemory(seed);
  }
  private enter(
    phase: PerformancePhase,
    time: number,
    gesture: Gesture = 'none',
  ) {
    this.phase = phase;
    this.gesture = gesture;
    this.phaseAt = time;
    this.history = [...this.history, { phase, time, gesture }].slice(-40);
  }
  get busy() {
    return this.phase !== 'IDLE';
  }
  begin(start: () => boolean, equipment: string, time: number) {
    if (this.busy) return false;
    const available = (g: Gesture) =>
      (g !== 'bagFlip' || equipment === 'bag') &&
      (g === 'none' || this.host.has('gesture.' + g));
    const pre =
      this.mode === 'athletic-only'
        ? 'none'
        : this.mode === 'showcase' && equipment === 'bag'
          ? 'bagFlip'
          : this.memory.choose(this.profile.preAction, available);
    if (pre !== 'none' && this.host.play('gesture.' + pre)) {
      this.pending = start;
      this.enter('PRE_ACTION', time, pre);
      return true;
    }
    if (!start()) return false;
    this.enter('ACTION', time);
    return true;
  }
  release(time: number) {
    this.enter('WATCHING', time);
  }
  resolve(emotion: Emotion, time: number) {
    if (this.result) return;
    this.result = { emotion, at: time + this.profile.perception };
    this.enter('RESULT', time);
  }
  update(time: number) {
    if (this.phase === 'PRE_ACTION' && this.host.complete()) {
      const start = this.pending;
      this.pending = undefined;
      this.enter(start?.() ? 'ACTION' : 'IDLE', time);
    }
    if (this.result && time >= this.result.at && this.host.canTransition()) {
      const result = this.result;
      this.result = undefined;
      const gesture =
        this.mode === 'showcase' && result.emotion !== 'failure'
          ? 'chestTap'
          : this.memory.choose(
              this.profile.reactions[result.emotion],
              (g) => g === 'none' || this.host.has('gesture.' + g),
            );
      if (gesture !== 'none' && this.host.play('gesture.' + gesture)) {
        if (this.mode === 'showcase') this.memory.remember(gesture);
        this.enter('REACTION', time, gesture);
      } else this.enter('RECOVERY', time);
    }
    if (this.phase === 'REACTION' && this.host.complete())
      this.enter('RECOVERY', time);
    if (
      this.phase === 'RECOVERY' &&
      this.host.complete() &&
      time - this.phaseAt >= 0.12
    )
      this.enter('IDLE', time);
  }
  snapshot() {
    return structuredClone({
      phase: this.phase,
      gesture: this.gesture,
      mode: this.mode,
      result: this.result ?? null,
      recent: this.memory.recent,
      history: this.history,
    });
  }
}
