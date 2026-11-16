import type { ArenaCharacter } from '../../characters/ArenaCharacter';
import {
  LANE_CHANGE_COOLDOWN,
  LANE_CHANGE_THRESHOLD,
  LANE_COUNT,
  LANE_HALF_PITCH,
  LANE_PITCH,
  LANE_Y0,
  FREE_STEER_Y_MIN,
  FREE_STEER_Y_MAX,
  FREE_STEER_SPEED,
  RUN_GRAVITY,
  laneY,
  type RunnerMotion,
  type RunningMovement,
} from './RunningConstants';
import { clamp } from '../../../math';
export interface Obstacle {
  id: string;
  x: number;
  y: number;
  kind: 'hurdle' | 'bar';
  width: number;
  height: number;
}
export const RUNNING_LENGTH = 2400;
/** Lane depth: runners nearer the camera (larger y) are drawn larger. */
export function laneScale(y: number) {
  return 0.65 + ((y - LANE_Y0) / LANE_PITCH) * 0.035;
}
/** How long a stumble lasts: the card's running recovery rating shortens it. */
export function stumbleTime(c: ArenaCharacter) {
  return 0.9 - c.stats.event('running', 'recovery', 0.5) * 0.4;
}
/** Gravity and landing. Returns true on the step the runner touches down. */
export function settleAirborne(c: ArenaCharacter, dt: number, time: number) {
  const b = c.body;
  if (!(b.z > 0 || b.vz > 0)) return false;
  b.vz -= RUN_GRAVITY * dt;
  b.z = Math.max(0, b.z + b.vz * dt);
  if (b.z) return false;
  b.vz = 0;
  c.beat('land', time);
  return true;
}
/** Advances one runner. Returns true on the step the runner touches down. */
export function runPhysics(
  c: ArenaCharacter,
  m: RunnerMotion,
  dt: number,
  time: number,
  mode: RunningMovement,
) {
  const b = c.body;
  // A finished runner stops moving forward but still comes down from a jump
  // taken over the line.
  if (m.finished) return settleAirborne(c, dt, time);
  m.slide = Math.max(0, m.slide - dt);
  m.stumble = Math.max(0, m.stumble - dt);
  m.laneClock = Math.max(0, m.laneClock - dt);
  if (mode === 'lanes') {
    if (
      Math.abs(c.moveIntent.y) > LANE_CHANGE_THRESHOLD &&
      m.laneClock === 0
    ) {
      m.lane = clamp(m.lane + Math.sign(c.moveIntent.y), 0, LANE_COUNT - 1);
      m.laneClock = LANE_CHANGE_COOLDOWN;
    }
    b.y += (laneY(m.lane) - b.y) * Math.min(1, dt * 12);
  } else
    b.y = clamp(
      b.y + c.moveIntent.y * FREE_STEER_SPEED * dt,
      FREE_STEER_Y_MIN,
      FREE_STEER_Y_MAX,
    );
  // Depth follows the runner's position on the track, lane changes included.
  b.scale = laneScale(b.y);
  // Braking stops a sprint, and a sprint stops while a jump is still
  // affordable (a jump costs 8).
  const sprint = m.sprint > 0.2 && c.stamina > 8 && !m.brake,
    boost = c.abilities.enabled('burstSprint', time),
    max =
      140 +
      c.stats.event('running', 'topSpeed', 0.7) * 40 +
      (sprint ? 65 * m.sprint : 0) +
      (boost ? 75 : 0);
  // In free steering nothing moves the runner forward without a push, not
  // even a brake or a stumble.
  const push = mode === 'free' ? Math.max(0, c.moveIntent.x) : 1,
    target = m.stumble || m.brake ? 45 * push : max * push;
  b.vx +=
    (target - b.vx) *
    Math.min(1, dt * (2 + c.stats.event('running', 'acceleration', 0.6) * 4));
  b.x += b.vx * dt;
  c.stamina = clamp(
    c.stamina +
      (sprint ? -(c.abilities.has('ironStamina') ? 12 : 18) : 13) * dt,
    0,
    100,
  );
  const landed = settleAirborne(c, dt, time);
  const start = m.startX ?? 170;
  c.score = Math.round(
    clamp(((b.x - start) / (RUNNING_LENGTH - start)) * 100, 0, 100),
  );
  c.substate = m.stumble
    ? 'stumbling'
    : b.z > 0
      ? 'airborne'
      : m.slide
        ? 'sliding'
        : sprint
          ? 'sprinting'
          : 'running';
  // Hysteresis: a runner hovering at a threshold must not flicker between
  // gait clips (each switch cross-fades the legs).
  const gait = c.animation.locomotion,
    sprintAt = gait === 'locomotion.sprint' ? 175 : 195,
    runAt =
      gait === 'locomotion.run' || gait === 'locomotion.sprint' ? 85 : 105;
  c.animation.locomotion =
    m.stumble || m.slide
      ? ''
      : b.z > 0
        ? 'athletic.airborne'
        : b.vx > sprintAt
          ? 'locomotion.sprint'
          : b.vx > runAt
            ? 'locomotion.run'
            : 'locomotion.walk';
  if (!c.animation.timeline.active) c.state = 'moving';
  return landed;
}
/**
 * Obstacle hits span LANE_HALF_PITCH either side of the obstacle: adjacent
 * lanes' hit bands tile with no seam (the strict `<` leaves only the exact
 * midline unhit).
 */
export function obstacleCollision(
  c: ArenaCharacter,
  o: Obstacle,
  m: RunnerMotion,
) {
  return (
    !m.hits.has(o.id) &&
    Math.abs(c.body.x - o.x) < o.width / 2 + 15 &&
    Math.abs(c.body.y - o.y) < LANE_HALF_PITCH &&
    (o.kind === 'bar' ? m.slide <= 0 : c.body.z < o.height)
  );
}
