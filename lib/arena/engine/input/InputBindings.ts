import type { Intent } from './InputActions';
export interface Bindings {
  keys: Partial<Record<Intent, string>>;
  buttons: Partial<Record<Intent, number>>;
  moveAxes: [number, number];
  aimAxes: [number, number];
}
export const DEFAULT_BINDINGS: Bindings = {
  keys: {
    primaryAction: 'KeyJ',
    secondaryAction: 'KeyK',
    tertiaryAction: 'KeyL',
    specialAction: 'KeyE',
    charge: 'Space',
    modifierLeft: 'ShiftLeft',
    modifierRight: 'ControlLeft',
    celebrate: 'KeyC',
    pause: 'Escape',
  },
  buttons: {
    primaryAction: 0,
    secondaryAction: 2,
    tertiaryAction: 1,
    specialAction: 3,
    modifierLeft: 4,
    modifierRight: 5,
    charge: 7,
    pause: 9,
    celebrate: 8,
  },
  moveAxes: [0, 1],
  aimAxes: [2, 3],
};
export const SECOND_KEYS: Bindings['keys'] = {
  primaryAction: 'Numpad1',
  secondaryAction: 'Numpad2',
  tertiaryAction: 'Numpad3',
  specialAction: 'Numpad0',
  charge: 'Enter',
  modifierLeft: 'ShiftRight',
  modifierRight: 'ControlRight',
  celebrate: 'NumpadDecimal',
  pause: 'Backspace',
};
export function bindingsFor(
  player: number,
  saved?: Partial<Bindings>,
): Bindings {
  return {
    ...DEFAULT_BINDINGS,
    ...saved,
    keys: {
      ...(player === 1 ? SECOND_KEYS : DEFAULT_BINDINGS.keys),
      ...saved?.keys,
    },
    buttons: { ...DEFAULT_BINDINGS.buttons, ...saved?.buttons },
  };
}
/** Fixed movement and aim keys for keyboard 1 (index 0) and keyboard 2 (index 1): up, down, left, right. */
export const KEYBOARD_MOVE_KEYS = [
  ['KeyW', 'KeyS', 'KeyA', 'KeyD'],
  ['KeyT', 'KeyG', 'KeyF', 'KeyH'],
] as const;
export const KEYBOARD_AIM_KEYS = [
  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
  ['Numpad8', 'Numpad5', 'Numpad4', 'Numpad6'],
] as const;
/**
 * What already uses a key among the keyboard players, or undefined. Both
 * keyboard layouts read the same physical keyboard, so a key used by the other
 * layout conflicts too. `own` is the index of the player being remapped.
 */
export function keyConflict(
  code: string,
  intent: Intent,
  players: { layout: number; keys: Bindings['keys'] }[],
  own: number,
): { player: number; use: Intent | 'move' | 'aim' } | undefined {
  for (const [player, p] of players.entries()) {
    if (
      (KEYBOARD_MOVE_KEYS[p.layout] as readonly string[]).includes(code)
    )
      return { player, use: 'move' };
    if ((KEYBOARD_AIM_KEYS[p.layout] as readonly string[]).includes(code))
      return { player, use: 'aim' };
    for (const [use, bound] of Object.entries(p.keys))
      if (bound === code && !(player === own && use === intent))
        return { player, use: use as Intent };
  }
  return undefined;
}
/** The first binding that is not a usable key, button or axis, or undefined when all are. */
export function invalidBinding(
  b: Bindings,
): Intent | 'moveAxes' | 'aimAxes' | undefined {
  for (const [intent, v] of Object.entries(b.keys))
    if (typeof v !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,25}$/.test(v))
      return intent as Intent;
  for (const [intent, v] of Object.entries(b.buttons))
    if (!Number.isInteger(v) || v! < 0 || v! > 31) return intent as Intent;
  for (const axis of ['moveAxes', 'aimAxes'] as const)
    if (b[axis].some((v) => !Number.isInteger(v) || v < 0 || v > 15))
      return axis;
  return undefined;
}
export function validateBindings(b: Bindings) {
  if (
    !b ||
    typeof b !== 'object' ||
    !b.keys ||
    typeof b.keys !== 'object' ||
    !b.buttons ||
    typeof b.buttons !== 'object' ||
    !Array.isArray(b.moveAxes) ||
    b.moveAxes.length !== 2 ||
    !Array.isArray(b.aimAxes) ||
    b.aimAxes.length !== 2
  )
    return false;
  return (
    Object.values(b.keys).every(
      (v) => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9]{0,25}$/.test(v),
    ) &&
    Object.values(b.buttons).every(
      (v) => Number.isInteger(v) && v! >= 0 && v! <= 31,
    ) &&
    [...b.moveAxes, ...b.aimAxes].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 15,
    )
  );
}
