import { clamp } from '../../math';
export type Vector = { x: number; y: number };
export type Intent =
  | 'move'
  | 'aim'
  | 'look'
  | 'primaryAction'
  | 'secondaryAction'
  | 'tertiaryAction'
  | 'specialAction'
  | 'modifierLeft'
  | 'modifierRight'
  | 'charge'
  | 'release'
  | 'jump'
  | 'dodge'
  | 'block'
  | 'interact'
  | 'sprint'
  | 'brake'
  | 'accelerate'
  | 'celebrate'
  | 'taunt'
  | 'pause'
  | 'up'
  | 'down'
  | 'left'
  | 'right';
export type InputPhase =
  | 'pressed'
  | 'held'
  | 'released'
  | 'doubleTapped'
  | 'repeated'
  | 'analog';
export type DeviceFamily =
  | 'keyboard'
  | 'xbox'
  | 'playstation'
  | 'generic'
  | 'touch'
  | 'ai';
export type IntentValues = Partial<Record<Intent, number | Vector>>;
export interface InputFrame {
  values: IntentValues;
  family: DeviceFamily;
  connected: boolean;
}
export interface InputSignal {
  intent: Intent;
  phase: InputPhase;
  value: number | Vector;
  at: number;
  held: number;
  magnitude?: number;
  angle?: number;
}
/** Every analog and timing threshold the input path applies, in one place. */
export const INPUT_THRESHOLDS = {
  /** A stick past this on an axis also presses the matching up/down/left/right intent. */
  stickDirection: 0.55,
  /** An intent value must pass `pressOn` to press and fall to `releaseOff` to release (hysteresis). */
  pressOn: 0.2,
  releaseOff: 0.1,
  /** The controller's `held` set (what combos and actions are gated on) includes values above this. */
  heldSet: 0.2,
  /** Radial deadzone applied to gamepad sticks. */
  stickDeadzone: 0.18,
  /** A second press within this many seconds is a double tap. */
  doubleTapSeconds: 0.26,
  /** A held intent repeats after `repeatDelaySeconds`, then every `repeatIntervalSeconds`. */
  repeatDelaySeconds: 0.36,
  repeatIntervalSeconds: 0.1,
  /** A combo's presses must all fall inside this many seconds. */
  comboHistorySeconds: 1.2,
} as const;
export function radialDeadzone(
  v: Vector,
  zone: number = INPUT_THRESHOLDS.stickDeadzone,
): Vector {
  const m = Math.hypot(v.x, v.y);
  if (!Number.isFinite(m) || m <= zone) return { x: 0, y: 0 };
  const r = clamp((m - zone) / (1 - zone));
  return { x: (v.x / m) * r, y: (v.y / m) * r };
}
