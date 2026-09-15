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
export const clamp = (n: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, n));
export function radialDeadzone(v: Vector, zone = 0.18): Vector {
  const m = Math.hypot(v.x, v.y);
  if (!Number.isFinite(m) || m <= zone) return { x: 0, y: 0 };
  const r = clamp((m - zone) / (1 - zone));
  return { x: (v.x / m) * r, y: (v.y / m) * r };
}
export function numberValue(v: number | Vector | undefined) {
  return typeof v === 'number' ? v : 0;
}
