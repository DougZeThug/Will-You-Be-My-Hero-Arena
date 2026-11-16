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
// A hold-and-release intent: pressed in one set of states and released with
// its own labelled action (cornhole's charge). Touch controls show it as a
// toggle that reads `releaseLabel` while held, and it can only be held in the
// union of the states of the two actions. Held-phase intents (sprint, block)
// are not charge pairs; they have no 'pressed' visible action to release.
export function chargeAction(map: EventActionMap) {
  for (const press of map.actions) {
    if (press.hidden || press.phase !== 'pressed') continue;
    const release = map.actions.find(
      (a) => a.intent === press.intent && a.phase === 'released',
    );
    if (!release) continue;
    return {
      intent: press.intent,
      releaseLabel: release.label,
      states:
        press.states && release.states
          ? [...press.states, ...release.states]
          : undefined,
    };
  }
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
