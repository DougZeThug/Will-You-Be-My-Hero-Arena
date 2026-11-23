// Small deterministic math kit for the Character Lab animator. No Math.random.
import type { Basis, Vec3 } from './types';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});
export const sub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
export const mul = (a: Vec3, k: number): Vec3 => ({
  x: a.x * k,
  y: a.y * k,
  z: a.z * k,
});
export const madd = (a: Vec3, b: Vec3, k: number): Vec3 => ({
  x: a.x + b.x * k,
  y: a.y + b.y * k,
  z: a.z + b.z * k,
});
export const dot = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const dist = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x > hi ? hi : x;
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (t: number): number => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};
/** Minimum-jerk ease 0..1 (zero velocity and acceleration at both ends). */
export const minJerk = (t: number): number => {
  const u = clamp01(t);
  return u * u * u * (10 - 15 * u + 6 * u * u);
};
export function norm(a: Vec3, fallback: Vec3 = { x: 0, y: 1, z: 0 }): Vec3 {
  const l = len(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { ...fallback };
}
/** Wraps to (-pi, pi]. */
export function wrap(a: number): number {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r <= -Math.PI) r += TAU;
  return r;
}
// INTERFACE.md: right-hand rule about +Y. Yaw 0 faces +X, +90 deg faces -Z, -90 deg faces +Z.
export const fwd = (yaw: number): Vec3 => ({
  x: Math.cos(yaw),
  y: 0,
  z: -Math.sin(yaw),
});
/** The character's anatomical right for a facing yaw (facing +X -> right is +Z). */
export const rgt = (yaw: number): Vec3 => ({
  x: Math.sin(yaw),
  y: 0,
  z: Math.cos(yaw),
});
/** Yaw whose facing is the ground direction (x, z). */
export const yawOf = (x: number, z: number): number => Math.atan2(-z, x);

/** Orthonormal basis with x along `x` and z as close to `zHint` as possible; y = z cross x. */
export function mkBasis(
  x: Vec3,
  zHint: Vec3,
  fallback: Vec3 = { x: 0, y: 1, z: 0 },
): Basis {
  const bx = norm(x, { x: 1, y: 0, z: 0 });
  let z = sub(zHint, mul(bx, dot(zHint, bx)));
  if (len(z) < 1e-6) z = sub(fallback, mul(bx, dot(fallback, bx)));
  if (len(z) < 1e-6) z = cross(bx, { x: 0, y: 0, z: 1 });
  const bz = norm(z);
  return { x: bx, y: cross(bz, bx), z: bz };
}
/** Expresses basis `b` in the frame of basis `a` (rows = a's axes). */
export function relBasis(a: Basis, b: Basis): Basis {
  const row = (v: Vec3): Vec3 => ({
    x: dot(a.x, v),
    y: dot(a.y, v),
    z: dot(a.z, v),
  });
  return { x: row(b.x), y: row(b.y), z: row(b.z) };
}
/** Inverse of relBasis: the world basis of something held at `rel` inside `a`. */
export function applyBasis(a: Basis, rel: Basis): Basis {
  const out = (v: Vec3): Vec3 =>
    add(add(mul(a.x, v.x), mul(a.y, v.y)), mul(a.z, v.z));
  return { x: out(rel.x), y: out(rel.y), z: out(rel.z) };
}
/** Rotates every axis of a basis about unit axis k by angle a. */
export function rotateBasis(b: Basis, k: Vec3, a: number): Basis {
  return { x: rotate(b.x, k, a), y: rotate(b.y, k, a), z: rotate(b.z, k, a) };
}
/** Angle (rad) of the rotation taking basis a to basis b. */
export function basisAngle(a: Basis, b: Basis): number {
  const tr = dot(a.x, b.x) + dot(a.y, b.y) + dot(a.z, b.z);
  return Math.acos(clamp((tr - 1) / 2, -1, 1));
}
export const UP: Vec3 = { x: 0, y: 1, z: 0 };

/** Rotate v about unit axis k by angle a (Rodrigues). */
export function rotate(v: Vec3, k: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  return {
    x: v.x * c + kv.x * s + k.x * kd,
    y: v.y * c + kv.y * s + k.y * kd,
    z: v.z * c + kv.z * s + k.z * kd,
  };
}

/** Smooth minimum; always <= min(a, b), equal to it when they differ by more than k. */
export function smin(a: number, b: number, k: number): number {
  const h = clamp01(0.5 + (0.5 * (b - a)) / k);
  return lerp(b, a, h) - k * h * (1 - h);
}

/** Second-order spring (semi-implicit), unconditionally well behaved at 60 Hz for w <= ~40. */
export class Spring {
  x: number;
  v = 0;
  constructor(x = 0) {
    this.x = x;
  }
  step(target: number, w: number, zeta: number, dt: number): number {
    // Implicit Euler: stiffness and damping are both taken at the end of the step.
    this.v =
      (this.v + w * w * (target - this.x) * dt) /
      (1 + 2 * zeta * w * dt + w * w * dt * dt);
    this.x += this.v * dt;
    return this.x;
  }
  kick(dv: number): void {
    this.v += dv;
  }
}

/**
 * A scalar that travels to a target on a quintic with zero end velocity and
 * acceleration, starting from its CURRENT value and velocity. Retargeting at
 * any moment is therefore C1-continuous, and arrival is exact (no asymptote).
 */
export class Mover {
  x: number;
  v = 0;
  target: number;
  private c: number[] = [0, 0, 0, 0, 0, 0];
  private t = 0;
  private T = 0;
  constructor(x = 0) {
    this.x = x;
    this.target = x;
  }
  get moving(): boolean {
    return this.t < this.T;
  }
  get arrived(): boolean {
    return this.t >= this.T;
  }
  /** Seconds left until arrival. */
  get remaining(): number {
    return Math.max(0, this.T - this.t);
  }
  to(target: number, duration: number): void {
    const T = Math.max(duration, 1e-4);
    const x0 = this.x;
    const v0 = this.v;
    const d = target - x0;
    // quintic with x(0)=x0, v(0)=v0, a(0)=0, x(T)=target, v(T)=0, a(T)=0
    this.c = [
      x0,
      v0,
      0,
      (10 * d - 6 * v0 * T) / (T * T * T),
      (-15 * d + 8 * v0 * T) / (T * T * T * T),
      (6 * d - 3 * v0 * T) / (T * T * T * T * T),
    ];
    this.t = 0;
    this.T = T;
    this.target = target;
  }
  step(dt: number): number {
    if (this.t >= this.T) {
      this.x = this.target;
      this.v = 0;
      return this.x;
    }
    this.t += dt;
    if (this.t >= this.T - 1e-9) {
      this.t = this.T;
      this.x = this.target;
      this.v = 0;
      return this.x;
    }
    const t = this.t;
    const c = this.c;
    this.x =
      c[0] + t * (c[1] + t * (c[2] + t * (c[3] + t * (c[4] + t * c[5]))));
    this.v =
      c[1] + t * (2 * c[2] + t * (3 * c[3] + t * (4 * c[4] + t * 5 * c[5])));
    return this.x;
  }
}

/** Cubic Hermite point (p0, m0) -> (p1, m1) with tangents as velocities over duration T, at u in 0..1. */
export function hermite(
  p0: Vec3,
  m0: Vec3,
  p1: Vec3,
  m1: Vec3,
  T: number,
  u: number,
): Vec3 {
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = (u3 - 2 * u2 + u) * T;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = (u3 - u2) * T;
  return {
    x: h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
    y: h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
    z: h00 * p0.z + h10 * m0.z + h01 * p1.z + h11 * m1.z,
  };
}

/** Deterministic PRNG (mulberry32) seeded from a string or number. */
export function makeRng(seed: string | number): () => number {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let a = h || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TwoBone {
  mid: Vec3;
  /** distance actually solved for (after clamping) divided by total length */
  reach: number;
  /** requested distance divided by total length, before clamping */
  asked: number;
  /** the end point actually solved for (the target, pulled in if it was out of reach) */
  end: Vec3;
}

/**
 * Analytic two-bone IK. The middle joint lies in the plane of (root->target, pole)
 * on the pole's side, so its bend direction can never flip while the pole stays
 * off the root->target axis. Targets beyond `maxReach` (fraction of a + b) are
 * pulled in along the root->target line; the caller is told via `asked`.
 */
export function solveTwoBone(
  root: Vec3,
  target: Vec3,
  a: number,
  b: number,
  pole: Vec3,
  maxReach = 0.995,
): TwoBone {
  const total = a + b;
  let d = sub(target, root);
  let l = len(d);
  const asked = l / total;
  const lo = Math.abs(a - b) + 1e-4;
  const hi = total * maxReach;
  const dir = norm(d, { x: 0, y: -1, z: 0 });
  if (l > hi) l = hi;
  if (l < lo) l = lo;
  d = mul(dir, l);
  // perpendicular toward the pole
  let perp = sub(pole, mul(dir, dot(pole, dir)));
  if (len(perp) < 1e-6) perp = sub(UP, mul(dir, dot(UP, dir)));
  if (len(perp) < 1e-6) perp = { x: 1, y: 0, z: 0 };
  perp = norm(perp);
  const along = (a * a - b * b + l * l) / (2 * l);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  return {
    mid: add(root, add(mul(dir, along), mul(perp, h))),
    reach: l / total,
    asked,
    end: add(root, d),
  };
}
