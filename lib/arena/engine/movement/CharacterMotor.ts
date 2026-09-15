import {
  approach,
  clamp,
  type Vec2,
  type MotionProfile,
} from '../motion/MotionTypes';
export interface MotorSweep {
  position: Vec2;
  blockedX?: boolean;
  blockedY?: boolean;
}
export type MovementCollision = (from: Vec2, desired: Vec2) => MotorSweep;
/** Sole authority for world translation. Animation submits displacement, never writes position. */
export class CharacterMotor {
  position: Vec2;
  velocity = { x: 0, y: 0 };
  acceleration = { x: 0, y: 0 };
  desired = { x: 0, y: 0 };
  facing = 1;
  facingTarget = 1;
  steerFacing = true;
  turning = false;
  height = 0;
  verticalVelocity = 0;
  grounded = true;
  sprint = false;
  distance = 0;
  rejectedRoot = 0;
  lastDisplacement = { x: 0, y: 0 };
  verticalScale = 1;
  constructor(
    readonly profile: MotionProfile,
    position: Vec2,
    private collide: MovementCollision = (_from, to) => ({ position: to }),
  ) {
    this.position = { ...position };
  }
  move(v: Vec2) {
    const m = Math.max(1, Math.hypot(v.x, v.y));
    this.desired = { x: v.x / m, y: v.y / m };
    if (this.steerFacing && Math.abs(v.x) > 0.08)
      this.facingTarget = Math.sign(v.x);
  }
  jump(speed = 310) {
    if (!this.grounded) return false;
    this.grounded = false;
    this.verticalVelocity = speed * this.verticalScale;
    return true;
  }
  impulse(v: Vec2) {
    this.velocity.x += v.x;
    this.velocity.y += v.y;
  }
  stopIntent() {
    this.move({ x: 0, y: 0 });
    this.sprint = false;
  }
  update(dt: number, authored: Vec2 = { x: 0, y: 0 }, control = 1) {
    if (!(dt > 0 && dt <= 0.1)) throw Error('Motor requires bounded seconds');
    const old = { ...this.velocity },
      speed = this.profile.topSpeed * (this.sprint ? 1 : 0.55);
    for (const axis of ['x', 'y'] as const) {
      const target = this.desired[axis] * speed * control;
      const reversing = target * this.velocity[axis] < 0;
      const accel = reversing
        ? this.profile.turnAcceleration
        : Math.abs(target) < Math.abs(this.velocity[axis])
          ? this.profile.deceleration
          : this.profile.acceleration;
      this.velocity[axis] = approach(this.velocity[axis], target, accel * dt);
      this.acceleration[axis] = (this.velocity[axis] - old[axis]) / dt;
    }
    this.turning = this.facingTarget !== this.facing;
    // Facing changes at a low-speed plant, not on the first reversed input frame.
    if (this.turning && Math.abs(this.velocity.x) < 28)
      this.facing = this.facingTarget;
    const requested = {
      x: this.velocity.x * dt + clamp(authored.x, -40, 40),
      y: this.velocity.y * dt + clamp(authored.y, -40, 40),
    };
    const next = this.collide(this.position, {
      x: this.position.x + requested.x,
      y: this.position.y + requested.y,
    });
    this.lastDisplacement = {
      x: next.position.x - this.position.x,
      y: next.position.y - this.position.y,
    };
    this.rejectedRoot += Math.hypot(
      requested.x - this.lastDisplacement.x,
      requested.y - this.lastDisplacement.y,
    );
    this.distance += Math.hypot(
      this.lastDisplacement.x,
      this.lastDisplacement.y,
    );
    this.position = { ...next.position };
    if (next.blockedX) this.velocity.x = 0;
    if (next.blockedY) this.velocity.y = 0;
    let landed = false,
      impactSpeed = 0;
    if (!this.grounded) {
      this.height +=
        this.verticalVelocity * dt - 450 * this.verticalScale * dt * dt;
      this.verticalVelocity -= 900 * this.verticalScale * dt;
      if (this.height <= 0 && this.verticalVelocity < 0) {
        impactSpeed = -this.verticalVelocity;
        this.height = 0;
        this.verticalVelocity = 0;
        this.grounded = true;
        landed = true;
      }
    }
    return { landed, impactSpeed, displacement: { ...this.lastDisplacement } };
  }
  snapshot() {
    return structuredClone({
      position: this.position,
      velocity: this.velocity,
      acceleration: this.acceleration,
      desired: this.desired,
      facing: this.facing,
      facingTarget: this.facingTarget,
      turning: this.turning,
      height: this.height,
      verticalVelocity: this.verticalVelocity,
      grounded: this.grounded,
      distance: this.distance,
      rejectedRoot: this.rejectedRoot,
    });
  }
}
