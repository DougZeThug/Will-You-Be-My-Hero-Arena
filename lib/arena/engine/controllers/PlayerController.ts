import { IntentTracker } from '../input/IntentTracker';
import type { InputFrame, Intent, InputSignal } from '../input/InputActions';
import type { ControllableEntity, ActionPayload } from './ControllableEntity';
import {
  resolveAction,
  ComboRecognizer,
  type EventActionMap,
} from './EventActionMap';
export class PlayerController {
  private tracker = new IntentTracker();
  private combo = new ComboRecognizer();
  private buffer: {
    command: string;
    payload: ActionPayload;
    expires: number;
  }[] = [];
  commands = 0;
  buffered = 0;
  lastCommand = '';
  constructor(
    readonly id: string,
    private entity: ControllableEntity,
    readonly map: EventActionMap,
    private onPause: () => void,
  ) {}
  update(frame: InputFrame, time: number) {
    const held = new Set(
      Object.entries(frame.values)
        .filter(([, v]) => typeof v === 'number' && v > 0.2)
        .map(([k]) => k as Intent),
    );
    const signals = this.tracker.sample(frame, time);
    for (const signal of signals) {
      if (signal.intent === 'pause' && signal.phase === 'pressed') {
        this.onPause();
        continue;
      }
      const context = {
        state: this.entity.controlState(),
        canCancel: this.entity.canCancel(),
        held,
        facing: this.entity.getFacing(),
      };
      const relative =
        context.facing < 0 && ['left', 'right'].includes(signal.intent)
          ? {
              ...signal,
              intent: (signal.intent === 'left' ? 'right' : 'left') as Intent,
            }
          : signal;
      const combo = this.combo.push(relative, this.map.combos),
        definition = resolveAction(this.map, signal, context);
      if (!definition && !combo) continue;
      const command = combo ?? definition!.command,
        payload = { value: signal.value, held: signal.held, at: signal.at };
      if (
        !this.execute(command, payload) &&
        ['pressed', 'doubleTapped'].includes(signal.phase)
      ) {
        this.buffer = this.buffer.filter((b) => b.command !== command);
        this.buffer.push({
          command,
          payload,
          expires: time + (definition?.buffer ?? this.map.bufferSeconds),
        });
        this.buffer = this.buffer.slice(-4);
        this.buffered++;
      }
    }
    this.buffer = this.buffer.filter((b) => b.expires >= time);
    const next = this.buffer[0];
    if (next && this.execute(next.command, next.payload)) this.buffer.shift();
  }
  private execute(command: string, payload: ActionPayload) {
    if (
      !this.entity.canPerform(command) ||
      !this.entity.performAction(command, payload)
    )
      return false;
    this.commands++;
    this.lastCommand = command;
    return true;
  }
  reset() {
    this.tracker.reset();
    this.combo.clear();
    this.buffer = [];
  }
  get pending() {
    return this.buffer.map((b) => b.command);
  }
}
