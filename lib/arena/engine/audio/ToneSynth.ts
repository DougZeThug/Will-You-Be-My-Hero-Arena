/** One oscillator voice: pitch, optional glide, and a gain envelope. Times are seconds from the start. */
export interface ToneSpec {
  type: OscillatorType;
  frequency: number;
  /** Exponential pitch glide to `to` Hz, reaching it `after` seconds in. */
  glide?: { to: number; after: number };
  /** Gain at the start of the tone. */
  gain: number;
  /** Linear gain rise to `to`, reached `after` seconds in. */
  attack?: { to: number; after: number };
  /** The gain falls exponentially to near silence `after` seconds in. */
  decayAfter: number;
  /** The oscillator is stopped `after` seconds in. */
  stopAfter: number;
}

/**
 * Schedules one oscillator and gain node on `ctx` and returns the oscillator.
 * Both the Watch cues (`ArenaAudio`) and the Play cues (`AudioManager`) play
 * through here; each keeps its own cue table. `startAt` is passed straight to
 * `osc.start`, so leaving it out starts the tone immediately.
 */
export function playTone(
  ctx: AudioContext,
  now: number,
  spec: ToneSpec,
  startAt?: number,
  onEnded?: () => void,
) {
  const osc = ctx.createOscillator(),
    gain = ctx.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.frequency, now);
  if (spec.glide)
    osc.frequency.exponentialRampToValueAtTime(
      spec.glide.to,
      now + spec.glide.after,
    );
  gain.gain.setValueAtTime(spec.gain, now);
  if (spec.attack)
    gain.gain.linearRampToValueAtTime(spec.attack.to, now + spec.attack.after);
  gain.gain.exponentialRampToValueAtTime(0.001, now + spec.decayAfter);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(now + spec.stopAfter);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    onEnded?.();
  };
  return osc;
}
