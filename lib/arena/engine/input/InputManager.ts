import type { InputDevice, HapticCue } from './InputDevice';
export class InputManager {
  private slots = new Map<string, InputDevice>();
  assign(player: string, device: InputDevice) {
    if (
      [...this.slots.entries()].some(
        ([id, d]) => id !== player && d.id === device.id,
      )
    )
      throw Error('Each player needs their own input device.');
    this.slots.get(player)?.destroy();
    this.slots.set(player, device);
  }
  device(player: string) {
    return this.slots.get(player);
  }
  poll(player: string, time: number) {
    return (
      this.slots.get(player)?.poll(time) ?? {
        values: {},
        family: 'ai' as const,
        connected: false,
      }
    );
  }
  haptic(player: string, cue: HapticCue) {
    this.slots.get(player)?.haptic?.(cue);
  }
  clear() {
    this.slots.forEach((d) => d.clear());
  }
  destroy() {
    this.slots.forEach((d) => d.destroy());
    this.slots.clear();
  }
}
