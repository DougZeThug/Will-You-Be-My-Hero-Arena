import type { InputSignal, Intent, InputPhase } from '../input/InputActions';
export interface ControlContext {
  state: string;
  canCancel: boolean;
  held: Set<Intent>;
  facing: number;
}
export interface ActionDefinition {
  intent: Intent;
  phase: InputPhase;
  command: string;
  label: string;
  states?: string[];
  modifiers?: Intent[];
  buffer?: number;
  hidden?: boolean;
}
export interface ComboDefinition {
  id: string;
  sequence: Intent[];
  window: number;
  command: string;
}
export interface EventActionMap {
  id: string;
  bufferSeconds: number;
  actions: ActionDefinition[];
  combos?: ComboDefinition[];
}
export function resolveAction(
  map: EventActionMap,
  signal: InputSignal,
  context: ControlContext,
) {
  return map.actions.find(
    (a) =>
      a.intent === signal.intent &&
      a.phase === signal.phase &&
      (!a.states || a.states.includes(context.state)) &&
      (!a.modifiers || a.modifiers.every((m) => context.held.has(m))),
  );
}
export class ComboRecognizer {
  private history: { intent: Intent; time: number }[] = [];
  push(signal: InputSignal, combos: ComboDefinition[] = []) {
    if (signal.phase !== 'pressed') return;
    this.history = this.history.filter((p) => signal.at - p.time < 1.2);
    this.history.push({ intent: signal.intent, time: signal.at });
    for (const combo of combos) {
      const h = this.history.slice(-combo.sequence.length);
      if (
        h.length === combo.sequence.length &&
        h.every((p, i) => p.intent === combo.sequence[i]) &&
        signal.at - h[0].time <= combo.window
      ) {
        this.history = [];
        return combo.command;
      }
    }
  }
  clear() {
    this.history = [];
  }
}
