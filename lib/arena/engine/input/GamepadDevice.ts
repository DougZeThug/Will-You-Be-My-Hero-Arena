import type { Bindings } from './InputBindings';
import {
  radialDeadzone,
  type DeviceFamily,
  type IntentValues,
  type Intent,
} from './InputActions';
import type { InputDevice, HapticCue } from './InputDevice';
export interface PadSnapshot {
  connected: boolean;
  id: string;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { value: number; pressed: boolean }[];
}
/** Standard-mapping button indices of the d-pad, which adds to the left stick. */
const DPAD = { up: 12, down: 13, left: 14, right: 15 } as const;
/** The pad at `index`, or null when absent or the browser refuses (a restricted context throws). */
function padAt(index: number): Gamepad | null {
  try {
    return navigator.getGamepads?.()[index] ?? null;
  } catch {
    return null;
  }
}
type PadWithRumble = Gamepad & {
  vibrationActuator?: {
    playEffect: (kind: string, data: unknown) => Promise<unknown>;
  };
};
export function mapGamepad(p: PadSnapshot | null, b: Bindings) {
  const family: DeviceFamily =
      p && /sony|dualshock|dualsense|playstation|054c/i.test(p.id)
        ? 'playstation'
        : p && /xbox|xinput|045e/i.test(p.id)
          ? 'xbox'
          : 'generic',
    values: IntentValues = {};
  if (!p?.connected) return { values, family, connected: false };
  for (const [action, index] of Object.entries(b.buttons))
    values[action as Intent] = Math.max(
      0,
      Math.min(1, p.buttons[index!]?.value ?? 0),
    );
  for (const [action, axes] of [
    ['move', b.moveAxes],
    ['aim', b.aimAxes],
  ] as const)
    values[action] = radialDeadzone({
      x: p.axes[axes[0]] ?? 0,
      y: p.axes[axes[1]] ?? 0,
    });
  if (!values.move || typeof values.move === 'number')
    return { values, family, connected: true };
  const v = values.move;
  v.x = Math.max(
    -1,
    Math.min(
      1,
      v.x +
        (p.buttons[DPAD.right]?.value ?? 0) -
        (p.buttons[DPAD.left]?.value ?? 0),
    ),
  );
  v.y = Math.max(
    -1,
    Math.min(
      1,
      v.y +
        (p.buttons[DPAD.down]?.value ?? 0) -
        (p.buttons[DPAD.up]?.value ?? 0),
    ),
  );
  return { values, family, connected: true };
}
export class GamepadDevice implements InputDevice {
  family: DeviceFamily = 'generic';
  readonly id: string;
  constructor(
    readonly index: number,
    private bindings: Bindings,
  ) {
    this.id = 'gamepad:' + index;
  }
  poll() {
    const frame = mapGamepad(padAt(this.index), this.bindings);
    this.family = frame.family;
    return frame;
  }
  connected() {
    return !!padAt(this.index)?.connected;
  }
  haptic(cue: HapticCue) {
    try {
      const p = padAt(this.index) as PadWithRumble | null;
      const strong = ['heavyImpact', 'runningCrash', 'victory'].includes(cue);
      void p?.vibrationActuator
        ?.playEffect('dual-rumble', {
          duration: strong ? 140 : 65,
          strongMagnitude: strong ? 0.4 : 0.12,
          weakMagnitude: 0.22,
          startDelay: 0,
        })
        .catch(() => {});
    } catch {}
  }
}
