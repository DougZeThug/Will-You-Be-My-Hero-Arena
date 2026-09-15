import type { DeviceFamily, Intent } from './InputActions';
import type { Bindings } from './InputBindings';
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
      ? player === 1
        ? 'T F G H'
        : 'W A S D'
      : 'Left stick';
  if (intent === 'aim')
    return family === 'keyboard'
      ? player === 1
        ? 'Numpad 4/6/8/5'
        : 'Arrow keys'
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
