import type { Vec2 } from '../../motion/MotionTypes';
import { artPoint, placement, quadPoint } from '../../../equipment-layout';
import { EQUIPMENT_ART } from '../../../equipment-art';

export interface BagContact {
  phase: 'flight' | 'board' | 'hole' | 'ground' | 'settled';
  board: {
    left: number;
    right: number;
    slope: number;
    hole: Vec2;
    floor: number;
    scale: number;
  };
  age: number;
  impacts: number;
  tangentSpeed: number;
  bounce: number;
  bounceSpeed: number;
  compression: number;
  result: 'pending' | 'hole' | 'board' | 'miss';
  spin: number;
  style: string;
  trail: Vec2[];
}
export interface MovingBag {
  position: Vec2;
  velocity: Vec2;
  gravity: Vec2;
  angle: number;
  landed: boolean;
  scored: boolean;
  contact: BagContact;
}
export function bagContact(actor: number, style: string): BagContact {
  const art = EQUIPMENT_ART.board,
    p = placement('cornhole', actor);
  const a = artPoint('cornhole', actor, quadPoint(art.plane, 0, 0.5));
  const b = artPoint('cornhole', actor, quadPoint(art.plane, 1, 0.5));
  return {
    phase: 'flight',
    board: {
      left: a.x,
      right: b.x,
      slope: (b.y - a.y) / (b.x - a.x),
      hole: { ...p.anchor },
      floor: 622 - actor * 133,
      scale: actor === 1 ? 0.7 : 1,
    },
    age: 0,
    impacts: 0,
    tangentSpeed: 0,
    bounce: 0,
    bounceSpeed: 0,
    compression: 0,
    result: 'pending',
    spin: style === 'roll' ? 8 : 0.45,
    style,
    trail: [],
  };
}
const surface = (b: BagContact['board'], x: number) =>
  b.hole.y + b.slope * (x - b.hole.x);
function finish(p: MovingBag, result: BagContact['result']) {
  p.contact.result = result;
  p.contact.phase = 'settled';
  p.landed = true;
  p.scored = result === 'hole';
  p.velocity = { x: 0, y: 0 };
}
/** Fixed downward gravity; the measured hand velocity is the initial condition.
 * Equipment contact is an explicit inelastic/friction phase, never target homing. */
export function advanceBag(p: MovingBag, dt: number) {
  if (p.landed) return;
  const c = p.contact,
    b = c.board,
    r = 4 * b.scale;
  c.age += dt;
  c.compression *= Math.exp(-dt * 19);
  if (c.phase === 'flight') {
    const g = p.gravity.y,
      v = p.velocity;
    const d = p.position.y - surface(b, p.position.x) + r;
    const slopeV = v.y - b.slope * v.x,
      disc = slopeV * slopeV - 2 * g * d;
    const hit = disc >= 0 ? (-slopeV + Math.sqrt(disc)) / g : Infinity;
    const x = p.position.x + v.x * hit;
    const valid = hit >= -1e-8 && hit <= dt && x >= b.left && x <= b.right;
    const travel = valid ? Math.max(0, hit) : dt;
    p.position.x += v.x * travel;
    p.position.y += v.y * travel + 0.5 * g * travel * travel;
    v.y += g * travel;
    p.angle += c.spin * travel;
    if (valid) {
      c.impacts++;
      const norm = Math.hypot(1, b.slope);
      c.tangentSpeed =
        ((v.x + v.y * b.slope) / norm) *
        (c.style === 'roll' ? 0.65 : c.style === 'slide' ? 0.59 : 0.48);
      c.bounceSpeed = Math.min(
        22 * b.scale,
        Math.abs(v.y - b.slope * v.x) * 0.035,
      );
      c.compression = 0.22;
      c.age = 0;
      c.phase = 'board';
      p.position.y = surface(b, p.position.x) - r;
      if (Math.abs(p.position.x - b.hole.x) < 12 * b.scale) {
        c.phase = 'hole';
        c.age = 0;
      }
      if (dt > travel) advanceBag(p, dt - travel);
    } else if (p.position.y >= b.floor - r && v.y > 0) {
      c.impacts++;
      // Ground catch is outside the board and cannot award a board score.
      p.position.y = b.floor - r;
      c.phase = 'ground';
      c.age = 0;
      c.compression = 0.25;
      p.velocity.x *= 0.18;
      p.velocity.y = 0;
    }
  } else if (c.phase === 'board') {
    const norm = Math.hypot(1, b.slope),
      old = c.tangentSpeed;
    const friction =
      (c.style === 'slide' ? 400 : c.style === 'roll' ? 310 : 540) * b.scale;
    c.tangentSpeed =
      Math.sign(old) * Math.max(0, Math.abs(old) - friction * dt);
    p.position.x += ((old + c.tangentSpeed) * 0.5 * dt) / norm;
    c.bounce = Math.max(
      0,
      c.bounce + c.bounceSpeed * dt - 0.5 * 1100 * b.scale * dt * dt,
    );
    c.bounceSpeed -= 1100 * b.scale * dt;
    if (!c.bounce && c.bounceSpeed < 0) c.bounceSpeed = 0;
    p.position.y = surface(b, p.position.x) - r - c.bounce;
    p.velocity = {
      x: c.tangentSpeed / norm,
      y: (c.tangentSpeed * b.slope) / norm - c.bounceSpeed,
    };
    p.angle +=
      c.style === 'roll'
        ? c.spin * dt * Math.min(1, Math.abs(c.tangentSpeed) / 180)
        : (Math.atan(b.slope) - p.angle) * (1 - Math.exp(-dt * 12));
    if (Math.abs(p.position.x - b.hole.x) < 12 * b.scale && c.bounce < 2) {
      c.phase = 'hole';
      c.age = 0;
    } else if (p.position.x < b.left || p.position.x > b.right) {
      c.phase = 'flight';
      p.velocity.y = Math.max(20, p.velocity.y);
    } else if (Math.abs(c.tangentSpeed) < 1 && c.age > 0.15) finish(p, 'board');
  } else if (c.phase === 'hole') {
    p.position.y += 48 * b.scale * dt;
    p.position.x += p.velocity.x * 0.04 * dt;
    if (c.age > 0.18) finish(p, 'hole');
  } else if (c.phase === 'ground') {
    const old = p.velocity.x;
    p.velocity.x *= Math.exp(-dt * 18);
    p.position.x += (old + p.velocity.x) * dt * 0.5;
    p.angle += (Math.atan(b.slope) - p.angle) * (1 - Math.exp(-dt * 12));
    if (c.age > 0.22) finish(p, 'miss');
  }
  c.trail.push({ ...p.position });
  c.trail = c.trail.slice(-72);
}
