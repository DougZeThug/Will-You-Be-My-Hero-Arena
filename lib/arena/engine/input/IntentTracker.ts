import {
  numberValue,
  type InputFrame,
  type InputSignal,
  type Intent,
  type IntentValues,
} from './InputActions';
export class IntentTracker {
  private old: IntentValues = {};
  private active = new Set<Intent>();
  private starts = new Map<Intent, number>();
  private lastPress = new Map<Intent, number>();
  private repeat = new Map<Intent, number>();
  reset() {
    this.old = {};
    this.active.clear();
    this.starts.clear();
    this.lastPress.clear();
    this.repeat.clear();
  }
  sample(frame: InputFrame, time: number): InputSignal[] {
    const values = { ...frame.values },
      move = values.move;
    if (move && typeof move !== 'number') {
      values.up = move.y < -0.55 ? 1 : 0;
      values.down = move.y > 0.55 ? 1 : 0;
      values.left = move.x < -0.55 ? 1 : 0;
      values.right = move.x > 0.55 ? 1 : 0;
    }
    const signals: InputSignal[] = [];
    for (const intent of new Set([
      ...Object.keys(this.old),
      ...Object.keys(values),
    ]) as Set<Intent>) {
      const value = values[intent] ?? 0,
        old = this.old[intent];
      if (typeof value !== 'number') {
        signals.push({
          intent,
          phase: 'analog',
          value,
          at: time,
          held: 0,
          magnitude: Math.hypot(value.x, value.y),
          angle: Math.atan2(value.y, value.x),
        });
        continue;
      }
      const was = this.active.has(intent),
        on = value > (was ? 0.1 : 0.2),
        held = time - (this.starts.get(intent) ?? time);
      if (on) this.active.add(intent);
      else this.active.delete(intent);
      if (on && !was) {
        this.starts.set(intent, time);
        signals.push({ intent, phase: 'pressed', value, at: time, held: 0 });
        if (time - (this.lastPress.get(intent) ?? -99) < 0.26)
          signals.push({
            intent,
            phase: 'doubleTapped',
            value,
            at: time,
            held: 0,
          });
        this.lastPress.set(intent, time);
        this.repeat.set(intent, time + 0.36);
      }
      if (on) {
        signals.push({ intent, phase: 'held', value, at: time, held });
        if (time >= (this.repeat.get(intent) ?? Infinity)) {
          signals.push({ intent, phase: 'repeated', value, at: time, held });
          this.repeat.set(intent, time + 0.1);
        }
      }
      if (was && !on) {
        signals.push({ intent, phase: 'released', value: 0, at: time, held });
        this.starts.delete(intent);
      }
    }
    this.old = values;
    return signals;
  }
}
