import type {
  InputFrame,
  Intent,
  IntentValues,
  DeviceFamily,
} from './InputActions';
export type HapticCue =
  | 'lightImpact'
  | 'heavyImpact'
  | 'perfectRelease'
  | 'collision'
  | 'punchHit'
  | 'runningCrash'
  | 'victory';
export interface InputDevice {
  id: string;
  family: DeviceFamily;
  poll(time: number): InputFrame;
  clear(): void;
  destroy(): void;
  haptic?(cue: HapticCue): void;
}
/** Virtual controls are also used by touch and AI. Retain taps shorter than one
 * game tick, so a quick click cannot disappear between two polls. */
export class VirtualDevice implements InputDevice {
  protected values: IntentValues = {};
  private taps = new Set<Intent>();
  private vectorTaps = new Map<Intent, { x: number; y: number }>();
  constructor(
    readonly id: string,
    readonly family: DeviceFamily = 'touch',
  ) {}
  set(intent: Intent, value: number | { x: number; y: number }) {
    if (typeof value === 'number' && value > 0 && !this.values[intent])
      this.taps.add(intent);
    if (typeof value !== 'number' && (value.x || value.y))
      this.vectorTaps.set(intent, value);
    this.values[intent] = value;
  }
  pulse(intent: Intent) {
    this.taps.add(intent);
  }
  poll(_time: number): InputFrame {
    const values = { ...this.values };
    for (const [intent, value] of this.vectorTaps) {
      const current = values[intent];
      if (!current || (typeof current !== 'number' && !current.x && !current.y))
        values[intent] = value;
    }
    this.vectorTaps.clear();
    for (const intent of this.taps)
      values[intent] = Math.max(
        1,
        typeof values[intent] === 'number' ? (values[intent] as number) : 0,
      );
    this.taps.clear();
    return { values, family: this.family, connected: true };
  }
  clear() {
    this.values = {};
    this.taps.clear();
    this.vectorTaps.clear();
  }
  destroy() {
    this.clear();
  }
}
