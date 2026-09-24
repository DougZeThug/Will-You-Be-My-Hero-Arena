import { VirtualDevice } from './InputDevice';
import {
  KEYBOARD_AIM_KEYS,
  KEYBOARD_MOVE_KEYS,
  type Bindings,
} from './InputBindings';
import type { Intent } from './InputActions';
export class KeyboardDevice extends VirtualDevice {
  private down = new Set<string>();
  private cleanup: () => void;
  constructor(
    id: string,
    private bindings: Bindings,
    player: number,
    scope: HTMLElement,
  ) {
    super(id, 'keyboard');
    const move = KEYBOARD_MOVE_KEYS[player === 1 ? 1 : 0],
      aim = KEYBOARD_AIM_KEYS[player === 1 ? 1 : 0];
    const allowed = new Set([...move, ...aim, ...Object.values(bindings.keys)]);
    const key = (e: KeyboardEvent, pressed: boolean) => {
      if (
        pressed &&
        (!scope.contains(document.activeElement) ||
          /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement)?.tagName))
      )
        return;
      if (!allowed.has(e.code)) return;
      // Only a release of a key this device took is kept from the page, so a
      // focused page button still receives the Space or Enter it was pressed
      // with.
      if (!pressed && !this.down.has(e.code)) return;
      e.preventDefault();
      if (pressed) this.down.add(e.code);
      else this.down.delete(e.code);
      for (const [intent, code] of Object.entries(bindings.keys))
        if (code === e.code) this.set(intent as Intent, pressed ? 1 : 0);
      for (const [intent, keys] of [
        ['move', move],
        ['aim', aim],
      ] as const)
        this.set(intent, {
          x: Number(this.down.has(keys[3])) - Number(this.down.has(keys[2])),
          y: Number(this.down.has(keys[1])) - Number(this.down.has(keys[0])),
        });
    };
    const down = (e: KeyboardEvent) => {
        if (!e.repeat) key(e, true);
      },
      up = (e: KeyboardEvent) => key(e, false),
      blur = () => this.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    this.cleanup = () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }
  clear() {
    super.clear();
    this.down?.clear();
  }
  destroy() {
    this.cleanup();
    super.destroy();
  }
}
