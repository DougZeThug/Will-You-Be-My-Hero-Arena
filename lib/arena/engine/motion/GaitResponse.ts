import { clamp, type MotionEvent } from './MotionTypes';
import type { CharacterMotor } from '../movement/CharacterMotor';
/** Contact-driven start/stop response around the measured gait, without changing motor velocity. */
export class GaitResponse {
  phase:
    | 'idle'
    | 'load'
    | 'firstStep'
    | 'secondStep'
    | 'cruise'
    | 'braking'
    | 'finalPlant'
    | 'settle' = 'idle';
  steps = 0;
  lean = 0;
  chest = 0;
  liftScale = 1;
  private age = 0;
  private wasMoving = false;
  update(motor: CharacterMotor, events: MotionEvent[], dt: number) {
    const speed = Math.hypot(motor.velocity.x, motor.velocity.y),
      intent = Math.hypot(motor.desired.x, motor.desired.y) > 0.08;
    const moving = speed > 3 || intent;
    if (moving && !this.wasMoving) {
      this.age = 0;
      this.steps = 0;
    }
    this.age += dt;
    if (moving)
      this.steps += events.filter((e) => e.name === 'footPlant').length;
    this.phase = !moving
      ? this.wasMoving
        ? 'finalPlant'
        : Math.abs(this.lean) > 0.002
          ? 'settle'
          : 'idle'
      : !intent
        ? 'braking'
        : this.age < 0.1
          ? 'load'
          : this.steps < 2
            ? 'firstStep'
            : this.steps < 3
              ? 'secondStep'
              : 'cruise';
    const desired =
      clamp(motor.acceleration.x / 430, -1, 1) * 0.025 +
      (speed / 225) * 0.008 * Math.sign(motor.velocity.x);
    this.lean += (desired - this.lean) * (1 - Math.exp(-dt / 0.09));
    this.chest += (this.lean * 0.45 - this.chest) * (1 - Math.exp(-dt / 0.065));
    this.liftScale =
      this.phase === 'braking'
        ? clamp(speed / 110, 0.35, 1)
        : clamp(0.55 + this.age * 0.8, 0.55, 1);
    this.wasMoving = moving;
  }
  snapshot() {
    return {
      phase: this.phase,
      steps: this.steps,
      lean: this.lean,
      chest: this.chest,
      liftScale: this.liftScale,
    };
  }
}
