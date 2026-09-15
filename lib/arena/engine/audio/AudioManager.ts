import type { ArenaCue } from '../core/LiveTypes';
const tones: Record<string, [number, number]> = {
  release: [380, 0.055],
  hole: [740, 0.15],
  boardImpact: [110, 0.08],
  punch: [85, 0.07],
  block: [180, 0.06],
  runningCollision: [95, 0.1],
  footstep: [125, 0.025],
  victory: [880, 0.22],
};
/** Replace the cue bank with authored sounds without changing event modules. */
export class AudioManager {
  private context?: AudioContext;
  enabled = false;
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.context ??= new AudioContext();
      void this.context.resume();
    }
  }
  cue(cue: ArenaCue) {
    if (!this.enabled || cue.kind !== 'audio' || !this.context) return;
    const ctx = this.context,
      [frequency, duration] = tones[cue.name] ?? [240, 0.06],
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = cue.name === 'punch' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      frequency * 0.65,
      ctx.currentTime + duration,
    );
    gain.gain.setValueAtTime(0.055, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  destroy() {
    void this.context?.close();
  }
}
