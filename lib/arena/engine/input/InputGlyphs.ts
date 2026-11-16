import type { DeviceFamily, Intent } from './InputActions';
import {
  KEYBOARD_AIM_KEYS,
  KEYBOARD_MOVE_KEYS,
  layoutOf,
  type Bindings,
} from './InputBindings';
const xbox = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu'];
const ps = [
  'Cross',
  'Circle',
  'Square',
  'Triangle',
  'L1',
  'R1',
  'L2',
  'R2',
  'Share',
  'Options',
];
/** The keyboard layout's movement keys as a label, in W A S D order (up, left, down, right). */
const moveKeysGlyph = (layout: 0 | 1) => {
  const [up, down, left, right] = KEYBOARD_MOVE_KEYS[layout];
  return [up, left, down, right].map((k) => k.replace('Key', '')).join(' ');
};
/** The keyboard layout's aim keys as a label: arrows by name, a numpad as its digits (left, right, up, down). */
const aimKeysGlyph = (layout: 0 | 1) => {
  const [up, down, left, right] = KEYBOARD_AIM_KEYS[layout];
  return [up, down, left, right].every((k) => k.startsWith('Arrow'))
    ? 'Arrow keys'
    : 'Numpad ' +
        [left, right, up, down].map((k) => k.replace('Numpad', '')).join('/');
};
export function inputGlyph(
  intent: Intent,
  family: DeviceFamily,
  b: Bindings,
  player = 0,
) {
  if (family === 'touch')
    return intent === 'move'
      ? 'Move pad'
      : intent === 'aim'
        ? 'Aim pad'
        : 'Tap';
  if (family === 'ai') return 'AI';
  if (intent === 'move')
    return family === 'keyboard'
      ? moveKeysGlyph(layoutOf(player))
      : 'Left stick';
  if (intent === 'aim')
    return family === 'keyboard'
      ? aimKeysGlyph(layoutOf(player))
      : 'Right stick';
  if (family === 'keyboard')
    return (b.keys[intent] ?? 'Unbound')
      .replace('Key', '')
      .replace('Digit', '')
      .replace('Numpad', 'Num ')
      .replace('Left', ' L')
      .replace('Right', ' R');
  const index = b.buttons[intent];
  return index === undefined
    ? 'Unbound'
    : family === 'xbox'
      ? (xbox[index] ?? 'Button ' + index)
      : family === 'playstation'
        ? (ps[index] ?? 'Button ' + index)
        : 'Button ' + index;
}
