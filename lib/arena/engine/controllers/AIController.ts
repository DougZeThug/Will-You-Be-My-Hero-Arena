import type { InputDevice } from '../input/InputDevice';
import type { InputFrame } from '../input/InputActions';
/** AI produces intents, never invokes event mechanics or hit detection. */
export class AIController implements InputDevice {
  readonly family = 'ai' as const;
  constructor(
    readonly id: string,
    private decide: (time: number) => InputFrame,
  ) {}
  poll(time: number) {
    return this.decide(time);
  }
  clear() {}
  destroy() {}
}
