import {
  INPUT_THRESHOLDS,
  type InputSignal,
  type Intent,
  type InputPhase,
} from '../input/InputActions';
export interface ControlContext {
  state: string;
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
// First non-hidden action for an intent; hidden entries never name an intent.
export function visibleAction(actions: ActionDefinition[], intent: string) {
  return actions.find((a) => a.intent === intent && !a.hidden);
}
// One button per intent for the touch pad and the setup screen: the first
// non-hidden action of each intent, without the continuous move/aim sticks.
export function visibleActions(map: EventActionMap) {
  return map.actions.filter(
    (a, i, all) =>
      !a.hidden &&
      a.intent !== 'move' &&
      a.intent !== 'aim' &&
      all.findIndex((b) => b.intent === a.intent && !b.hidden) === i,
  );
}
export class ComboRecognizer {
  private history: { intent: Intent; time: number }[] = [];
  push(signal: InputSignal, combos: ComboDefinition[] = []) {
    if (signal.phase !== 'pressed') return;
    this.history = this.history.filter((p) => signal.at - p.time < INPUT_THRESHOLDS.comboHistorySeconds);
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
