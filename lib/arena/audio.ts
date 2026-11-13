import { playTone } from './engine/audio/ToneSynth';
export class ArenaAudio {
  private ctx: AudioContext | null = null;
  muted = true;
  private nodes: AudioScheduledSourceNode[] = [];
  event(cue: { name: string; value?: string }) {
    const names: Record<
      string,
      'summon' | 'release' | 'score' | 'miss' | 'victory' | 'boardImpact'
    > = {
      card: 'summon',
      release: 'release',
      victory: 'victory',
      footstep: 'miss',
      catch: 'miss',
      boardImpact: 'boardImpact',
    };
    if (cue.name === 'score')
      this.cue(Number(cue.value) > 0 ? 'score' : 'miss');
    else if (names[cue.name]) this.cue(names[cue.name]);
  }
  async toggle() {
    if (!this.ctx) this.ctx = new AudioContext();
    this.muted = !this.muted;
    if (this.muted) {
      this.stop();
      await this.ctx.suspend();
    } else await this.ctx.resume();
    return !this.muted;
  }
  cue(
    kind: 'summon' | 'release' | 'score' | 'miss' | 'victory' | 'boardImpact',
  ) {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx,
      now = ctx.currentTime;
    const tones =
      kind === 'victory'
        ? [261.63, 329.63, 392, 523.25]
        : kind === 'score'
          ? [523.25, 783.99]
          : kind === 'summon'
            ? [130.81, 196]
            : kind === 'release'
              ? [170]
              : kind === 'boardImpact'
                ? [112, 76]
                : [83];
    tones.forEach((freq, i) => {
      const osc = playTone(
        ctx,
        now,
        {
          type: kind === 'miss' || kind === 'boardImpact' ? 'triangle' : 'sine',
          frequency: freq,
          glide: kind === 'release' ? { to: 55, after: 0.17 } : undefined,
          gain: 0,
          attack: {
            to: kind === 'miss' || kind === 'boardImpact' ? 0.035 : 0.055,
            after: 0.025 + i * 0.035,
          },
          decayAfter: (kind === 'victory' ? 1 : 0.38) + i * 0.05,
          stopAfter: 1.3,
        },
        now,
        () => {
          this.nodes = this.nodes.filter((n) => n !== osc);
        },
      );
      this.nodes.push(osc);
    });
  }
  stop() {
    for (const n of this.nodes)
      try {
        n.stop();
      } catch {
        // An oscillator that already ended throws when stopped again.
      }
    this.nodes = [];
  }
  destroy() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
