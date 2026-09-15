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
      v.x + (p.buttons[15]?.value ?? 0) - (p.buttons[14]?.value ?? 0),
    ),
  );
  v.y = Math.max(
    -1,
    Math.min(
      1,
      v.y + (p.buttons[13]?.value ?? 0) - (p.buttons[12]?.value ?? 0),
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
    let pad: Gamepad | null = null;
    try {
      pad = navigator.getGamepads?.()[this.index] ?? null;
    } catch {}
    const frame = mapGamepad(pad, this.bindings);
    this.family = frame.family;
    return frame;
  }
  clear() {}
  destroy() {}
  haptic(cue: HapticCue) {
    try {
      const p = navigator.getGamepads?.()[this.index] as Gamepad & {
        vibrationActuator?: {
          playEffect: (kind: string, data: unknown) => Promise<unknown>;
        };
      };
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
