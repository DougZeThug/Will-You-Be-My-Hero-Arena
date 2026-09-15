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
export function validateBindings(b: Bindings) {
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
