import { clamp } from './MotionTypes';

/** Analytic damped convergence, in seconds. No variable-frame Euler springs. */
export class DampedMotion {
  value = 0;
  velocity = 0;
  update(target: number, dt: number, seconds: number, damping = 1) {
    if (!Number.isFinite(target) || !Number.isFinite(dt) || dt < 0 || dt > 0.1)
      throw Error('Invalid bounded motion step');
    if (!dt) return this.value;
    const w = 4 / Math.max(0.04, seconds),
      z = clamp(damping, 0.6, 1);
    const x = this.value - target,
      v = this.velocity;
    if (z >= 0.999) {
      const e = Math.exp(-w * dt),
        j = v + w * x;
      this.value = target + (x + j * dt) * e;
      this.velocity = (v - w * j * dt) * e;
    } else {
      const a = z * w,
        b = w * Math.sqrt(1 - z * z);
      const e = Math.exp(-a * dt),
        c = Math.cos(b * dt),
        s = Math.sin(b * dt);
      const j = (v + a * x) / b;
      this.value = target + e * (x * c + j * s);
      this.velocity = e * (v * c - (a * j + b * x) * s);
    }
    return this.value;
  }
  impulse(velocity: number) {
    this.velocity += velocity;
  }
}

/** C1 transition residual over the incoming native blend. It is not a new pose clock. */
export class InertialChannel {
  private previous?: number;
  private rawPrevious?: number;
  private velocity = 0;
  private residual = new DampedMotion();
  apply(
    raw: number,
    changed: boolean,
    dt: number,
    seconds: number,
    limit: number,
  ) {
    if (this.previous === undefined || dt <= 0) {
      this.previous = this.rawPrevious = raw;
      return raw;
    }
    const rawVelocity = clamp(
      (raw - this.rawPrevious!) / dt,
      -limit * 50,
      limit * 50,
    );
    if (changed) {
      this.residual.value = clamp(this.previous - raw, -limit, limit);
      this.residual.velocity = clamp(
        this.velocity - rawVelocity,
        -limit * 10,
        limit * 10,
      );
    }
    this.residual.update(0, dt, seconds);
    const value = raw + clamp(this.residual.value, -limit, limit);
    this.velocity = (value - this.previous) / dt;
    this.previous = value;
    this.rawPrevious = raw;
    return value;
  }
}
