/**
 * Pass A live throw clock (prototype; pure, no Phaser or browser globals).
 *
 * It only decides WHEN the shipped underhand take plays: which clip time to
 * enter at and how far to advance the clip on each fixed step. The clip, the
 * rig and the performance runtime are the shipped ones.
 *
 * - press:   enter at the take's `windup` marker (skip settle/anticipate), so
 *            the arm is already travelling on the first step.
 * - charge:  front-loaded backswing that reaches `windupPeak` on an exact
 *            step (BACKSWING_STEPS), then a slow creep through the authored
 *            hang (never rate 0; the take's moving hold stays alive).
 * - release: the drive lands `equipmentRelease` on an exact counted step
 *            after key-up. The rate ramps continuously from whatever it was
 *            at key-up, is continuous through the release step, and eases
 *            back to 1 across the follow-through.
 * - early release: with a `swing` sampler the clock re-enters the same clip
 *            on the drive side at the arm angle the backswing had reached
 *            (after a minimum depth), so a short charge is a short throw
 *            rather than the whole backswing and drive crammed into a few
 *            frames. Without the sampler it plays through the top instead and
 *            pays with a longer delay (capped).
 */
export const FIXED_DT = 1 / 60;

export interface ThrowMarkers {
  /** Clip seconds. */
  windup: number;
  windupPeak: number;
  equipmentRelease: number;
  finish: number;
  holdEnd: number;
  duration: number;
}

export const LIVE_THROW = {
  /** Fixed steps from press to `windupPeak` (0.40 s). */
  backswingSteps: 24,
  /** Front-loading: the backswing rate falls as 1 - u^2 from its first step. */
  backswingShape: 2,
  /** Clip seconds past `windupPeak` where the authored arm stops rising. */
  hangSpan: 5 / 60,
  /** Fixed steps of charge after which the throw releases by itself (1.5 s);
   * the creep is sized to arrive at the end of the hang on that step. */
  maxChargeSteps: 90,
  /** Key-up to bag release for a normal (hung) charge: 12-13 steps. */
  releaseStepsMin: 12,
  releaseStepsMax: 13,
  /** Mean drive rate the step count is chosen for. */
  driveRate: 1.5,
  /** Steps over which the rate ramps from its key-up value to the drive. */
  rampSteps: 4,
  /** Early release, mirror re-entry: minimum backswing (clip seconds past
   * `windup`) reached before the arm turns round. Deep enough that the
   * drive left after the turn outlasts the runtime's 0.16 s crossfade. */
  minBackswing: 0.36,
  /** Early release, mirror re-entry: rate the drive after the turn is sized
   * for (the remaining backswing is sized at `playThroughRate`). */
  earlyRate: 1,
  /** Early release without re-entry: mean rate limit and step cap (0.30 s). */
  playThroughRate: 1.9,
  earlyStepsMax: 18,
} as const;

export type ThrowPhase =
  | 'idle'
  | 'backswing'
  | 'hang'
  | 'drive'
  | 'follow'
  | 'settle'
  | 'done';

/** One fixed step of clip playback, applied in order. `advance` is clip
 * seconds on the forward-only clock; `enter` re-requests the clip at a clip
 * time (the runtime's own crossfade joins the two). */
export type ClockOp = { advance: number } | { enter: number };

export interface ClockStep {
  phase: ThrowPhase;
  /** Mean clip rate over this step. */
  rate: number;
  ops: ClockOp[];
  /** This step lands exactly on `equipmentRelease`. */
  release: boolean;
}

const smoothstep = (u: number) => {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
};

/** Drive-side clip time whose arm swing equals the backswing's at `t`. */
export function mirrorTime(
  swing: (clipTime: number) => number,
  t: number,
  m: ThrowMarkers,
) {
  const wanted = swing(t);
  // The drive falls monotonically from the top of the hang to the release.
  let lo = m.windupPeak + LIVE_THROW.hangSpan,
    hi = m.equipmentRelease;
  if (swing(lo) <= wanted) return lo;
  if (swing(hi) >= wanted) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (swing(mid) > wanted) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export class LiveThrowClock {
  phase: ThrowPhase = 'idle';
  /** Clip time of the model (the runtime's clip follows it exactly). */
  clip = 0;
  rate = 1;
  /** Fixed steps the charge was held. */
  chargeSteps = 0;
  /** Fixed steps from key-up to the release (set when planned). */
  releaseSteps: number | null = null;
  /** Steps since key-up. */
  sinceKeyUp = 0;
  released = false;
  /** True when the release re-entered the clip on the drive side. */
  mirrored = false;
  private readonly backswing: number[];
  private readonly creep: number;
  private plan?: {
    rates: number[];
    index: number;
    jumpAt?: number;
    jumpTo?: number;
  };
  private releaseRate = 1;

  constructor(
    readonly markers: ThrowMarkers,
    /** World arm swing of the take at a clip time (degrees, + = back).
     * Omit to disable mirror re-entry. */
    private swing?: (clipTime: number) => number,
    readonly config: typeof LIVE_THROW = LIVE_THROW,
  ) {
    const c = config,
      m = markers,
      hang = c.maxChargeSteps - c.backswingSteps;
    this.creep = c.hangSpan / (hang * FIXED_DT);
    // rate_i = creep + k * w_i with sum(rate_i) * dt = windupPeak - windup.
    const weights = Array.from(
        { length: c.backswingSteps },
        (_, i) => 1 - ((i + 0.5) / c.backswingSteps) ** c.backswingShape,
      ),
      total = weights.reduce((a, b) => a + b, 0),
      k =
        ((m.windupPeak - m.windup) / FIXED_DT -
          c.backswingSteps * this.creep) /
        total;
    this.backswing = weights.map((w) => this.creep + k * w);
  }

  get active() {
    return this.phase !== 'idle' && this.phase !== 'done';
  }
  /** The follow-through has peaked; movement may take over. */
  get interruptible() {
    return (
      this.phase === 'settle' ||
      this.phase === 'done' ||
      (this.phase === 'follow' && this.clip >= this.markers.finish)
    );
  }
  /** Clip time to enter at on the press step. */
  press() {
    this.phase = 'backswing';
    this.clip = this.markers.windup;
    this.rate = this.backswing[0];
    this.chargeSteps = 0;
    this.releaseSteps = null;
    this.sinceKeyUp = 0;
    this.released = false;
    this.mirrored = false;
    this.plan = undefined;
    return this.clip;
  }
  reset() {
    this.phase = 'idle';
    this.plan = undefined;
    this.rate = 1;
  }

  /** Key-up to release in fixed steps for a charge of `chargeSteps`: the one
   * function both the rig and the bag follow. */
  private planRelease() {
    const c = this.config,
      m = this.markers,
      r0 = this.rate;
    let distance = m.equipmentRelease - this.clip,
      steps: number,
      jumpAt: number | undefined,
      jumpTo: number | undefined;
    if (this.clip >= m.windupPeak - 1e-9) {
      steps = Math.round(distance / FIXED_DT / c.driveRate);
      steps = Math.max(c.releaseStepsMin, Math.min(c.releaseStepsMax, steps));
    } else if (this.swing) {
      jumpAt = Math.min(
        Math.max(this.clip, m.windup + c.minBackswing),
        m.windupPeak,
      );
      jumpTo = mirrorTime(this.swing, jumpAt, m);
      const turn = m.equipmentRelease - jumpTo;
      distance = jumpAt - this.clip + turn;
      // The rest of the backswing may hurry; the drive after the turn plays
      // near authored speed because the crossfade is still joining it.
      steps = Math.ceil(
        (jumpAt - this.clip) / FIXED_DT / c.playThroughRate +
          turn / FIXED_DT / c.earlyRate,
      );
      steps = Math.max(c.releaseStepsMin, Math.min(c.earlyStepsMax, steps));
    } else {
      steps = Math.ceil(distance / FIXED_DT / c.playThroughRate);
      steps = Math.max(c.releaseStepsMin, Math.min(c.earlyStepsMax, steps));
    }
    const weights = Array.from({ length: steps }, (_, i) =>
        smoothstep((i + 1) / c.rampSteps),
      ),
      total = weights.reduce((a, b) => a + b, 0),
      peak = r0 + (distance / FIXED_DT - steps * r0) / total;
    this.plan = {
      rates: weights.map((w) => r0 + (peak - r0) * w),
      index: 0,
      jumpAt,
      jumpTo,
    };
    this.releaseSteps = steps;
    this.releaseRate = peak;
    this.mirrored = jumpTo !== undefined;
    this.phase = 'drive';
  }

  /** Advance one fixed step. `held` is the charge input on this step. */
  step(held: boolean): ClockStep {
    const m = this.markers,
      c = this.config,
      ops: ClockOp[] = [];
    let release = false;
    const advance = (seconds: number) => {
      if (seconds > 0) ops.push({ advance: seconds });
      this.clip += seconds;
    };
    if (this.phase === 'idle' || this.phase === 'done')
      return { phase: this.phase, rate: 1, ops, release };
    if (this.phase === 'backswing' || this.phase === 'hang') {
      if (!held || this.chargeSteps >= c.maxChargeSteps) this.planRelease();
      else {
        this.rate =
          this.chargeSteps < c.backswingSteps
            ? this.backswing[this.chargeSteps]
            : this.creep;
        this.chargeSteps++;
        if (this.chargeSteps === c.backswingSteps) {
          // Land the top of the backswing exactly.
          advance(m.windupPeak - this.clip);
          this.phase = 'hang';
        } else advance(this.rate * FIXED_DT);
        return { phase: this.phase, rate: this.rate, ops, release };
      }
    }
    if (this.phase === 'drive') {
      const plan = this.plan!;
      this.sinceKeyUp++;
      const last = plan.index === plan.rates.length - 1;
      let left = plan.rates[plan.index++] * FIXED_DT,
        spent = 0;
      if (plan.jumpAt !== undefined && plan.jumpTo !== undefined) {
        const before = plan.jumpAt - this.clip;
        if (before <= left + 1e-12 || last) {
          advance(Math.max(0, before));
          left -= Math.max(0, before);
          spent = Math.max(0, before);
          ops.push({ enter: plan.jumpTo });
          this.clip = plan.jumpTo;
          plan.jumpAt = plan.jumpTo = undefined;
        }
      }
      if (last) {
        // Exact landing; the epsilon only guarantees the marker is crossed.
        left = m.equipmentRelease - this.clip + 1e-7;
        release = true;
        this.released = true;
        this.phase = 'follow';
      }
      this.rate = (spent + left) / FIXED_DT;
      advance(left);
      return { phase: 'drive', rate: this.rate, ops, release };
    }
    // Follow-through: ease the release rate back to authored speed by the
    // finish marker, then play the take's own hold and relaxation.
    this.sinceKeyUp++;
    const u =
      (this.clip - m.equipmentRelease) / (m.finish - m.equipmentRelease);
    this.rate = 1 + (this.releaseRate - 1) * (1 - smoothstep(u));
    advance(Math.min(this.rate * FIXED_DT, m.duration - this.clip));
    if (this.clip >= m.duration - 1e-9) this.phase = 'done';
    else if (this.clip >= m.holdEnd) this.phase = 'settle';
    const phase = this.phase;
    return { phase, rate: this.rate, ops, release };
  }
}
