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
      aim = KEYBOARD_AIM_KEYS[player === 1 ? 1 : 0],
      moveAim = new Set<string>([...move, ...aim]),
      allowed = new Set<string>([
        ...move,
        ...aim,
        ...Object.values(bindings.keys),
      ]);
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
      // Only recompute move/aim when one of their keys actually changed, so an
      // unrelated action key (e.g. dodge) cannot re-seed vectorTaps with a
      // still-held vector that a same-step release of the direction key would
      // leave behind as a one-frame ghost move/aim.
      if (moveAim.has(e.code)) {
        this.set('move', {
          x: Number(this.down.has(move[3])) - Number(this.down.has(move[2])),
          y: Number(this.down.has(move[1])) - Number(this.down.has(move[0])),
        });
        this.set('aim', {
          x: Number(this.down.has(aim[3])) - Number(this.down.has(aim[2])),
          y: Number(this.down.has(aim[1])) - Number(this.down.has(aim[0])),
        });
      }
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
