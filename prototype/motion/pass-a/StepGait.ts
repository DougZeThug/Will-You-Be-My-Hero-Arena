/**
 * Pass A footwork (prototype; pure, no Phaser or browser globals).
 *
 * The shipped side rig has no step clip and one body mesh, but its ankles
 * follow two IK targets. This planner is the honest best that allows: the
 * root travels smoothly, each foot is either planted at a fixed WORLD x or
 * swinging to its next plant, and the scene writes the difference back to the
 * existing `foot_target_L/R` bones. No clip, cut or bone is added. Everything
 * is stage px along screen x; `lift` is px above the ground.
 */
export const GAIT = {
  /** Root speed while a move is held (px/s). */
  speed: 160,
  /** Root acceleration (px/s^2). */
  accel: 800,
  /** Root braking when the move is released (px/s^2). */
  brake: 1400,
  /** Extra distance (px) the root may glide past its braking distance to stop
   * with a planted foot already in its stance. */
  glide: 26,
  /** Step length: a foot lands half of this ahead of the body centre. */
  step: 64,
  /** Fixed steps a walking swing takes; with `support` it makes the cadence
   * (step / speed = 0.4 s per step). */
  swingSteps: 21,
  /** Fixed steps both feet stay down between swings. */
  support: 3,
  /** Fixed steps of a closing step back to the stance. */
  closeSteps: 14,
  /** Peak ankle lift of a full swing (px). */
  lift: 9,
  /** A planted foot further than this from its stance takes a closing step. */
  tolerance: 1.5,
} as const;

export type Side = 'L' | 'R';
export interface Foot {
  /** World x of the ankle target. */
  x: number;
  lift: number;
  swing?: {
    from: number;
    target: number;
    t: number;
    steps: number;
    /** Lift as a fraction of a full swing's. */
    height: number;
  };
}
const SIDES: readonly Side[] = ['L', 'R'];
const ease = (u: number) => u * u * (3 - 2 * u);

export class StepGait {
  v = 0;
  mode: 'idle' | 'walk' | 'stopping' = 'idle';
  readonly feet: Record<Side, Foot>;
  private dir = 1;
  private stopX?: number;
  private support = 0;
  constructor(
    public x: number,
    /** Stance offsets of each ankle target from the root (px). */
    readonly home: Record<Side, number>,
    readonly config: typeof GAIT = GAIT,
  ) {
    this.feet = {
      L: { x: x + home.L, lift: 0 },
      R: { x: x + home.R, lift: 0 },
    };
  }
  get centre() {
    return (this.home.L + this.home.R) / 2;
  }
  get settled() {
    return this.mode === 'idle' && !this.feet.L.swing && !this.feet.R.swing;
  }
  private get walking() {
    return this.mode === 'walk';
  }
  /** Where a foot wants to land right now. */
  private landing(side: Side, stepsLeft: number) {
    if (this.walking)
      return (
        this.x +
        (this.v * stepsLeft) / 60 +
        this.centre +
        (this.dir * this.config.step) / 2
      );
    return (this.stopX ?? this.x) + this.home[side];
  }
  /** Brake at once. If a planted foot is already (nearly) where its stance
   * would be, stop exactly there so it never has to move again; the other
   * foot lands in, or takes one closing step to, its stance. */
  private resolveStop() {
    const c = this.config,
      braking = (this.v * this.v) / (2 * c.brake);
    let stop = this.x + this.dir * braking,
      nearest = Infinity;
    for (const side of SIDES) {
      if (this.feet[side].swing) continue;
      const at = this.feet[side].x - this.home[side],
        ahead = this.dir * (at - this.x);
      if (ahead < braking - 0.5 || ahead > braking + c.glide) continue;
      if (ahead < nearest) {
        nearest = ahead;
        stop = at;
      }
    }
    this.stopX = stop;
  }
  /** One fixed 1/60 s step. `move` is the intent in [-1, 1] along screen x. */
  step(move: number) {
    const c = this.config,
      dt = 1 / 60,
      intent = Math.abs(move) > 0.2 ? Math.sign(move) : 0;
    if (intent) {
      this.dir = intent;
      this.mode = 'walk';
      this.stopX = undefined;
    } else if (this.mode === 'walk') this.mode = 'stopping';
    if (this.mode === 'stopping' && this.stopX === undefined)
      this.resolveStop();
    // Root.
    if (this.walking) {
      const wanted = this.dir * c.speed,
        dv = Math.max(-c.accel * dt, Math.min(c.accel * dt, wanted - this.v));
      this.v += dv;
      this.x += this.v * dt;
    } else if (this.mode === 'stopping') {
      const left = this.dir * (this.stopX! - this.x),
        speed = Math.min(
          Math.abs(this.v) + c.accel * dt,
          c.speed,
          Math.sqrt(2 * c.brake * Math.max(0, left)),
        );
      if (left <= Math.max(0.05, speed * dt)) {
        this.x = this.stopX!;
        this.v = 0;
      } else {
        this.v = this.dir * speed;
        this.x += this.v * dt;
      }
    } else this.v = 0;
    // Swinging feet.
    for (const side of SIDES) {
      const foot = this.feet[side],
        s = foot.swing;
      if (!s) continue;
      s.t++;
      const u = Math.min(1, s.t / s.steps);
      // The landing follows the body (and a stop) until late in the swing,
      // then commits. Re-basing `from` keeps the foot where it is when the
      // landing moves, so a retarget never jumps the foot.
      const done = ease(Math.min(1, (s.t - 1) / s.steps));
      if (u < 0.9) {
        const target = this.landing(side, s.steps - s.t);
        s.from = (foot.x - target * done) / (1 - done);
        s.target = target;
      }
      foot.x = s.from + (s.target - s.from) * ease(u);
      foot.lift = c.lift * s.height * Math.sin(Math.PI * u);
      if (u >= 1) {
        foot.x = s.target;
        foot.lift = 0;
        foot.swing = undefined;
        this.support = c.support;
      }
    }
    // Next swing.
    if (!this.feet.L.swing && !this.feet.R.swing) {
      if (this.support > 0) this.support--;
      else {
        let pick: Side | undefined,
          most = this.walking ? 0 : c.tolerance;
        for (const side of SIDES) {
          const error = this.walking
            ? this.dir * (this.landing(side, 0) - this.feet[side].x)
            : Math.abs(this.landing(side, 0) - this.feet[side].x);
          if (error > most) {
            most = error;
            pick = side;
          }
        }
        if (pick) {
          const steps = this.walking ? c.swingSteps : c.closeSteps,
            from = this.feet[pick].x,
            target = this.landing(pick, steps);
          this.feet[pick].swing = {
            from,
            target,
            t: 0,
            steps,
            height: this.walking
              ? 1
              : Math.max(0.35, Math.min(1, Math.abs(target - from) / c.step)),
          };
        } else if (
          this.mode === 'stopping' &&
          this.stopX !== undefined &&
          this.v === 0
        ) {
          this.mode = 'idle';
          this.stopX = undefined;
        }
      }
    }
  }
}
