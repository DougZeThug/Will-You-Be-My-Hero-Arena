import type { ArenaCharacter } from '../../characters/ArenaCharacter';
import { clamp } from '../../input/InputActions';
export interface RunnerMotion {
  sprint: number;
  brake: boolean;
  slide: number;
  stumble: number;
  finished: number;
  lane: number;
  laneClock: number;
  hits: Set<string>;
}
export interface Obstacle {
  id: string;
  x: number;
  y: number;
  kind: 'hurdle' | 'bar';
  width: number;
  height: number;
}
export const RUNNING_LENGTH = 2400;
export const RUN_GRAVITY = 590;
export function runPhysics(
  c: ArenaCharacter,
  m: RunnerMotion,
  dt: number,
  time: number,
  mode: string,
) {
  const b = c.body;
  if (m.finished) return;
  m.slide = Math.max(0, m.slide - dt);
  m.stumble = Math.max(0, m.stumble - dt);
  m.laneClock = Math.max(0, m.laneClock - dt);
  if (mode === 'lanes') {
    if (Math.abs(c.moveIntent.y) > 0.5 && m.laneClock === 0) {
      m.lane = clamp(m.lane + Math.sign(c.moveIntent.y), 0, 2);
      m.laneClock = 0.24;
    }
    b.y += (520 + m.lane * 62 - b.y) * Math.min(1, dt * 12);
  } else b.y = clamp(b.y + c.moveIntent.y * 160 * dt, 515, 650);
  const sprint = m.sprint > 0.2 && c.stamina > 5,
    boost = c.abilities.enabled('burstSprint', time),
    max =
      140 +
      c.stats.event('running', 'topSpeed', 0.7) * 40 +
      (sprint ? 65 * m.sprint : 0) +
      (boost ? 75 : 0);
  const target = m.stumble
    ? 45
    : m.brake
      ? 45
      : max * (mode === 'free' ? Math.max(0, c.moveIntent.x) : 1);
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
  if (b.z > 0 || b.vz > 0) {
    b.vz -= RUN_GRAVITY * dt;
    b.z = Math.max(0, b.z + b.vz * dt);
    if (!b.z) b.vz = 0;
  }
  c.score = Math.round(
    Math.min(100, ((b.x - 170) / (RUNNING_LENGTH - 170)) * 100),
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
}
export function obstacleCollision(
  c: ArenaCharacter,
  o: Obstacle,
  m: RunnerMotion,
) {
  return (
    !m.hits.has(o.id) &&
    Math.abs(c.body.x - o.x) < o.width / 2 + 15 &&
    Math.abs(c.body.y - o.y) < 30 &&
    (o.kind === 'bar' ? m.slide <= 0 : c.body.z < o.height + 10)
  );
}
