import type { Vec2 } from '../motion/MotionTypes';
export interface BallFlight {
  position: Vec2;
  velocity: Vec2;
  gravity: Vec2;
  age: number;
}
/** Free flight, constant vertical gravity. Collision tests use swept rim crossings, never homing. */
export function advanceBasketball(
  ball: BallFlight,
  dt: number,
  rim: Vec2,
  radius = 17,
) {
  const before = { ...ball.position };
  ball.position.x += ball.velocity.x * dt;
  ball.position.y += ball.velocity.y * dt + 0.5 * ball.gravity.y * dt * dt;
  ball.velocity.y += ball.gravity.y * dt;
  if (before.y < rim.y && ball.position.y >= rim.y && ball.velocity.y > 0) {
    const t = (rim.y - before.y) / Math.max(1e-8, ball.position.y - before.y);
    const x = before.x + (ball.position.x - before.x) * t;
    if (Math.abs(x - rim.x) < radius) return 'score' as const;
    if (Math.abs(x - rim.x) < radius + 12) {
      ball.position.y = rim.y - 1;
      ball.velocity.y *= -0.42;
      ball.velocity.x *= 0.72;
      return 'rim' as const;
    }
  }
  return ball.position.y > 700 ||
    ball.position.x > 1320 ||
    ball.position.x < -40 ||
    ball.age > 3
    ? ('miss' as const)
    : ('flight' as const);
}
