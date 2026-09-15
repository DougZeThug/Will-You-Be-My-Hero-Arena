import type { Vec2 } from '../motion/MotionTypes';
/** Brief decorative toss of the held object. Does not enter scoring/projectile rules. */
export class PropPerformance {
  flight: {
    origin: Vec2;
    position: Vec2;
    angle: number;
    initialAngle: number;
    elapsed: number;
    duration: number;
    gravity: number;
  } | null = null;
  catchError: number | null = null;
  tosses = 0;
  catches = 0;
  cancellations = 0;
  cancel() {
    if (this.flight) this.cancellations++;
    this.flight = null;
  }
  toss(hand: Vec2 & { angle: number }, duration: number, scale: number) {
    if (this.flight) return;
    this.flight = {
      origin: { ...hand },
      position: { ...hand },
      angle: hand.angle,
      initialAngle: hand.angle,
      elapsed: 0,
      duration,
      gravity: 2400 * scale,
    };
    this.tosses++;
  }
  update(dt: number) {
    const f = this.flight;
    if (!f) return;
    f.elapsed = Math.min(f.duration, f.elapsed + dt);
    const t = f.elapsed;
    f.position = {
      x: f.origin.x,
      y:
        f.origin.y - 0.5 * f.gravity * f.duration * t + 0.5 * f.gravity * t * t,
    };
    f.angle = f.initialAngle + (Math.PI * 2 * t) / f.duration;
  }
  catch(hand: Vec2) {
    if (!this.flight) return;
    this.catchError = Math.hypot(
      hand.x - this.flight.position.x,
      hand.y - this.flight.position.y,
    );
    this.flight = null;
    this.catches++;
  }
  snapshot() {
    return structuredClone({
      flight: this.flight,
      catchError: this.catchError,
      tosses: this.tosses,
      catches: this.catches,
      cancellations: this.cancellations,
    });
  }
}
