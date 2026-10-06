import type { Attempt, V3 } from '../../../model';
import type { ShotStyle } from '../../animation/AnimationTypes';
import type { ReleaseFrame, ProjectileFrame } from '../ArenaEvent';
import {
  surfacePoint,
  boardDepthScale,
  BAG_FLIGHT_FLATTEN,
  placement,
} from '../../../equipment-layout';
import { clamp01, smooth } from '../../../match-timeline';
import {
  firstImpactTime,
  surfaceTravelSeconds,
} from './CornholePresentationTiming';
import type { BagInteraction } from './CornholeBoard';
import {
  squashOffset,
  squashScale,
  velocityStretch,
} from '../../motion/SquashStretch';
export {
  firstImpactTime,
  surfaceTravelSeconds,
} from './CornholePresentationTiming';

/** Court projection: vertical render pixels per metre (see equipment-layout). */
const COURT_PX_PER_METRE_Y = 78;
const quintic = (u: number) => u * u * u * (10 - 15 * u + 6 * u * u);
/** Longest presented board slide, in screen px. */
const MAX_SLIDE_PX = 90;
/** Hole drop: share of the 0.28 s fall spent easing over the drawn hole. */
const HOLE_SETTLE = 0.3;

/** Hand→cruise velocity blend window shared by flight and touch solving. */
export const blendSeconds = (air: number) => Math.min(0.22, 0.35 * air);

/** Board-surface point (the same slope form the board solver records). */
const onBoard = (x: number, z: number): V3 => ({
  x,
  y: 0.16 + ((x - 8) / 1.9) * 0.34,
  z,
});

/** Drawn resting bag half-size in screen px at depth scale 1: the 60 px
 * sprite's opaque art (about 96% of it) at the 0.52 resting flatten. */
const BAG_HALF = { x: 29, y: 14 };
/** Drawn hole opening half-extents in screen px at depth scale 1: the dark
 * interior of board-finish-v2 (240 × 104 source px) at the board's scale. */
const HOLE_HALF = { x: 20, y: 8.3 };

type XYPoint = { x: number; y: number };
/** Screen obstacle a sliding bag must not cross: a resting bag (its body;
 * box of both bags' half-sizes) or the drawn hole opening (its centre path;
 * the body may pass over the rim). */
type Obstacle = { kind: 'bag' | 'hole'; center: XYPoint; half: XYPoint };

/** Does the slide chord a→b (both bag centres) enter the obstacle? */
function chordHits(a: XYPoint, b: XYPoint, o: Obstacle) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    px = a.x - o.center.x,
    py = a.y - o.center.y;
  if (o.kind === 'hole') {
    // Minimum of the ellipse form along the chord.
    const qa = (dx / o.half.x) ** 2 + (dy / o.half.y) ** 2,
      qb = 2 * ((px * dx) / o.half.x ** 2 + (py * dy) / o.half.y ** 2),
      u = qa > 0 ? Math.max(0, Math.min(1, -qb / (2 * qa))) : 0;
    return (
      ((px + u * dx) / o.half.x) ** 2 + ((py + u * dy) / o.half.y) ** 2 <
      1 - 1e-9
    );
  }
  let lo = 0,
    hi = 1;
  for (const [p, d, h] of [
    [px, dx, o.half.x],
    [py, dy, o.half.y],
  ]) {
    if (Math.abs(d) < 1e-12) {
      if (Math.abs(p) >= h - 1e-9) return false;
      continue;
    }
    const u1 = (-h - p) / d,
      u2 = (h - p) / d;
    lo = Math.max(lo, Math.min(u1, u2));
    hi = Math.min(hi, Math.max(u1, u2));
  }
  return hi - lo > 1e-9;
}

/** First chord fraction (0..1) at which a bag sliding a→b touches a resting
 * bag centred at c, or undefined when it never reaches it. */
function chordEntry(a: XYPoint, b: XYPoint, c: XYPoint, half: XYPoint) {
  let lo = 0,
    hi = 1;
  for (const [p, d, h] of [
    [a.x - c.x, b.x - a.x, half.x],
    [a.y - c.y, b.y - a.y, half.y],
  ]) {
    if (Math.abs(d) < 1e-12) {
      if (Math.abs(p) >= h) return undefined;
      continue;
    }
    const u1 = (-h - p) / d,
      u2 = (h - p) / d;
    lo = Math.max(lo, Math.min(u1, u2));
    hi = Math.min(hi, Math.max(u1, u2));
  }
  return hi > lo ? lo : undefined;
}

/** Bags drawn on this board before the throw that it does not move
 * (the previous board state, which `CornholeEvent` draws until contact). */
export function restingBags(a: Attempt): V3[] {
  const r = a.boardResolution;
  if (!r) return [];
  const moved = new Set(r.interactions.map((hit) => hit.id));
  return r.bags
    .filter((b) => b.id !== a.id && !moved.has(b.id) && b.score === 1)
    .map((b) => b.position);
}

export type SlideClamp =
  | 'none'
  | 'max'
  | 'min'
  | 'front'
  | 'disc'
  | 'target'
  | 'bag'
  | 'hole';

/**
 * The single owner of a bag's first-impact touch point (simulation space),
 * with the limit that shaped it.
 *
 * A recorded touch (misses) is returned as is. A performance (ballistic)
 * release that travels on the board touches down short of the immutable target
 * by the velocity-matched slide distance: the bag lands at the horizontal speed
 * the flight arrives with and decelerates to rest exactly on the target at
 * `contactAt`. The slide never starts off the front of the board, never runs
 * backwards, never passes through a resting bag it does not push, and a board
 * bag's centre never slides across the hole (the scoring disc or the drawn
 * opening; its body may pass over the rim). When the target itself is on a
 * resting bag or over the opening it lands on the target without sliding. Presentation only:
 * target, timing and scoring are unchanged.
 */
export function presentationSlide(
  a: Attempt,
  shot: ShotStyle,
  release: ReleaseFrame,
): { touch: V3; clamp: SlideClamp; ideal?: number } {
  if (a.boardResolution?.touch)
    return { touch: a.boardResolution.touch, clamp: 'none' };
  const slide = surfaceTravelSeconds(a, shot);
  if (release.flatten === undefined || !release.velocity || !slide)
    return { touch: a.target, clamp: 'none' };
  // Velocity match: ballistic arrival speed (dx - v0·τ/2)/span equals the
  // slide's initial speed 2d/slide, with dx = D - d.
  const target = surfacePoint('cornhole', a.actor, a.target),
    air = Math.max(0.3, a.duration - slide),
    tau = blendSeconds(air),
    span = air - tau / 2,
    ideal =
      (slide * (target.x - release.x - (release.velocity.x * tau) / 2)) /
      (2 * span + slide),
    distance = Math.max(0, Math.min(MAX_SLIDE_PX, ideal));
  let clamp: SlideClamp =
    ideal > MAX_SLIDE_PX ? 'max' : ideal < 0 ? 'min' : 'none';
  // At fixed depth the registered board maps x piecewise linearly (knee at
  // the hole), so three samples invert it exactly.
  const screen = (x: number) =>
      surfacePoint('cornhole', a.actor, onBoard(x, a.target.z)),
    front = screen(8).x,
    hole = screen(9.2).x,
    back = screen(9.9).x,
    want = target.x - distance;
  let x =
    want <= hole
      ? 8 + ((want - front) / (hole - front)) * 1.2
      : 9.2 + ((want - hole) / (back - hole)) * 0.7;
  const edge = Math.min(8.12, 8 + (a.target.x - 8) / 2);
  if (x < edge) {
    x = edge;
    clamp = 'front';
  }
  const dz = a.target.z - a.actor * 3.5;
  if (a.contact === 'board' && a.target.x > 9.2 && Math.abs(dz) < 0.19) {
    const disc = 9.2 + Math.sqrt(0.19 ** 2 - dz ** 2);
    if (x < disc) {
      x = disc;
      clamp = 'disc';
    }
  }
  if (x > a.target.x) {
    x = a.target.x;
    clamp = 'target';
  }
  // Drawn obstacles along the screen slide chord.
  const s = boardDepthScale(a.actor),
    obstacles: Obstacle[] = restingBags(a).map((p) => ({
      kind: 'bag',
      center: surfacePoint('cornhole', a.actor, p),
      half: { x: 2 * BAG_HALF.x * s, y: 2 * BAG_HALF.y * s },
    }));
  if (a.contact === 'board')
    obstacles.push({
      kind: 'hole',
      center: placement('cornhole', a.actor).anchor,
      half: { x: HOLE_HALF.x * s, y: HOLE_HALF.y * s },
    });
  const blocking = (from: number) =>
    obstacles.find((o) => chordHits(screen(from), target, o));
  const blocked = blocking(x);
  if (blocked) {
    // Land past the obstacle: the nearest clear chord toward the target
    // (bisection), or the target itself when even it is covered.
    let lo = x,
      hi = a.target.x;
    if (blocking(hi)) lo = hi;
    else
      for (let i = 0; i < 60 && hi - lo > 1e-10; i++) {
        const mid = (lo + hi) / 2;
        if (blocking(mid)) lo = mid;
        else hi = mid;
      }
    x = hi;
    clamp = blocked.kind;
  }
  return { touch: onBoard(x, a.target.z), clamp, ideal };
}

/** The presentation touch point alone (see `presentationSlide`). */
export function presentationTouch(
  a: Attempt,
  shot: ShotStyle,
  release: ReleaseFrame,
): V3 {
  return presentationSlide(a, shot, release).touch;
}

/**
 * When a presented thrown bag reaches a bag it pushes: the slide time at
 * which its drawn body first touches the pushed bag's starting footprint
 * (never before first impact). Undefined when the bag is not presented or
 * never reaches it; the board presentation then keeps its recorded timing.
 */
export function presentationPushStart(
  a: Attempt,
  shot: ShotStyle,
  release: ReleaseFrame,
  hit: BagInteraction,
): number | undefined {
  const slide = surfaceTravelSeconds(a, shot);
  if (
    release.flatten === undefined ||
    a.boardResolution?.touch ||
    !slide ||
    !a.boardResolution?.interactions.some((h) => h.id === hit.id)
  )
    return undefined;
  const s = boardDepthScale(a.actor),
    entry = chordEntry(
      surfacePoint('cornhole', a.actor, presentationTouch(a, shot, release)),
      surfacePoint('cornhole', a.actor, a.target),
      surfacePoint('cornhole', a.actor, hit.from),
      { x: 2 * BAG_HALF.x * s, y: 2 * BAG_HALF.y * s },
    );
  if (entry === undefined) return undefined;
  // Slide travel 1 - (1 - u)² reaches the entry fraction at u = 1 - √(1 - e).
  return firstImpactTime(a, shot) + (1 - Math.sqrt(1 - entry)) * slide;
}

/**
 * Ballistic flight that leaves the hand at the hand's own evaluated velocity.
 *
 * The velocity blends from the release velocity to a cruise velocity over a
 * short window τ (quintic, never reversing), after which the bag travels with
 * constant horizontal speed under a bounded constant gravity. Cruise velocity
 * and gravity are solved so the bag reaches the immutable touch point exactly
 * at `air`: position and velocity are continuous at release and the recorded
 * contact, target, score and timing are unchanged. The previous model solved a
 * free horizontal acceleration, so a slow hand produced a bag that visibly
 * sped up after leaving it.
 */
export function ballisticFlight(
  release: { x: number; y: number; scale?: number },
  velocity: { x: number; y: number },
  touch: { x: number; y: number },
  air: number,
) {
  const tau = blendSeconds(air),
    dx = touch.x - release.x,
    dy = touch.y - release.y,
    reference = 9.8 * COURT_PX_PER_METRE_Y * (release.scale ?? 1),
    implied = (2 * (dy - velocity.y * air)) / (air * air),
    gravity = Math.max(0.7 * reference, Math.min(1.5 * reference, implied)),
    span = air - tau / 2,
    cruise = {
      x: (dx - (velocity.x * tau) / 2) / span,
      y: (dy - 0.5 * gravity * air * air - (velocity.y * tau) / 2) / span,
    };
  return {
    tau,
    gravity,
    implied,
    cruise,
    at(t: number) {
      const u = Math.max(0, Math.min(1, t / tau)),
        // w: remaining share of the release-velocity difference; W = ∫w dt.
        w = 1 - quintic(u),
        W = tau * (u - 2.5 * u ** 4 + 3 * u ** 5 - u ** 6);
      return {
        x: release.x + cruise.x * t + (velocity.x - cruise.x) * W,
        y:
          release.y +
          cruise.y * t +
          0.5 * gravity * t * t +
          (velocity.y - cruise.y) * W,
        vx: cruise.x + (velocity.x - cruise.x) * w,
        vy: cruise.y + gravity * t + (velocity.y - cruise.y) * w,
      };
    },
  };
}

/** Integrate from the evaluated release velocity. Solve acceleration against
 * the immutable board contact. Horizontal acceleration accommodates the
 * compressed court projection: visual physics, never a new scoring rule.
 * Performance releases (which carry `flatten`) use `ballisticFlight`. */
export function releasedBag(
  a: Attempt,
  shot: ShotStyle,
  release: ReleaseFrame,
  time: number,
): ProjectileFrame {
  const velocity = release.velocity!;
  const target = surfacePoint('cornhole', a.actor, a.target);
  const direct = [
    'airmail',
    'highArc',
    'collect',
    'drag',
    'desperation',
  ].includes(shot);
  const touch = surfacePoint(
    'cornhole',
    a.actor,
    presentationTouch(a, shot, release),
  );
  const slide = surfaceTravelSeconds(a, shot);
  const air = Math.max(0.3, a.duration - slide),
    elapsed = Math.max(0, time - a.releaseAt),
    t = Math.min(air, elapsed);
  const performance = release.flatten !== undefined;
  // The presentation solver (not a recording) chose this touch point.
  const presented = performance && !a.boardResolution?.touch && slide > 0;
  const ballistic = performance
    ? ballisticFlight(release, velocity, touch, air)
    : null;
  const ax = ballistic
      ? 0
      : (2 * (touch.x - release.x - velocity.x * air)) / (air * air),
    gravity = ballistic
      ? ballistic.gravity
      : (2 * (touch.y - release.y - velocity.y * air)) / (air * air);
  const flight = ballistic?.at(t);
  let x = flight ? flight.x : release.x + velocity.x * t + 0.5 * ax * t * t,
    y = flight ? flight.y : release.y + velocity.y * t + 0.5 * gravity * t * t;
  const rolls = ['roll', 'cut', 'flop', 'trick'].includes(shot),
    omega = rolls ? 2.5 : direct ? 0.16 : 0.08;
  let angle = (release.angle ?? 0) + omega * t,
    flatten =
      (release.flatten ?? BAG_FLIGHT_FLATTEN) +
      (rolls ? 0.09 * Math.sin(t * 5) : 0),
    alpha = 1;
  let vx = flight ? flight.vx : velocity.x + ax * t,
    vy = flight ? flight.vy : velocity.y + gravity * t;
  // Only the new performance supplies an edge-on release exposure. Ease that
  // same object toward the board plane before contact; preserve historical paths.
  if (release.flatten !== undefined) {
    const approach = smooth(clamp01((t / air - 0.55) / 0.45));
    angle += (-0.1 - angle) * approach;
    flatten += (0.52 - flatten) * approach;
  }
  if (elapsed >= air && slide) {
    const u = clamp01((elapsed - air) / slide),
      travel = 1 - (1 - u) ** 2;
    x = touch.x + (target.x - touch.x) * travel;
    y = touch.y + (target.y - touch.y) * travel;
    vx = ((target.x - touch.x) * 2 * (1 - u)) / slide;
    vy = ((target.y - touch.y) * 2 * (1 - u)) / slide;
    angle += (rolls ? 0.65 : 0) * u;
    angle += (-0.1 - angle) * smooth(u);
    flatten =
      flatten +
      (0.52 - flatten) * travel -
      0.07 * Math.sin(Math.PI * clamp01(u / 0.35));
  }
  // Shadow: on the court under the flight, toward the touch point for a
  // presented slide; on the board surface under the bag after it lands.
  let ground =
    presented && elapsed >= air
      ? y
      : 610 -
        a.actor * 133 +
        ((presented ? touch.y : target.y) - (610 - a.actor * 133)) *
          clamp01(t / air);
  const after = Math.max(0, elapsed - a.duration),
    fall = clamp01(after / 0.28),
    anchor = placement('cornhole', a.actor).anchor,
    // Ballistic hole bags first ease from the target over the drawn hole,
    // then drop through it; the historical path drops at the target.
    lateral = ballistic ? smooth(clamp01(fall / HOLE_SETTLE)) : 0,
    sink = ballistic
      ? smooth(clamp01((fall - HOLE_SETTLE) / (1 - HOLE_SETTLE)))
      : fall;
  if (elapsed >= a.duration) {
    x = target.x;
    y = target.y;
    vx = 0;
    vy = 0;
    if (a.contact === 'hole' && ballistic) {
      x += (anchor.x - target.x) * lateral;
      y += (anchor.y - target.y) * lateral;
      ground = y;
      y += 42 * sink * boardDepthScale(a.actor);
      alpha = fall >= 1 ? 0 : 1;
      flatten *= 1 - 0.15 * sink;
    } else if (a.contact === 'hole') {
      y += 42 * smooth(fall) * boardDepthScale(a.actor);
      alpha = fall >= 1 ? 0 : 1;
      flatten *= 1 - 0.15 * fall;
    } else if (a.contact === 'board') {
      angle += (-0.1 - angle) * smooth(fall);
      flatten += (0.52 - flatten) * smooth(fall);
    } else {
      x += 20 * fall;
      y += 7 * fall - 5 * Math.sin(fall * Math.PI);
      angle += 0.25 * fall;
      alpha = 1 - clamp01((after - 0.4) / 0.3);
    }
  }
  const startScale = release.scale ?? 1;
  const depth =
    startScale + (boardDepthScale(a.actor) - startScale) * clamp01(t / air);
  // Cartoon deformation (performance releases only): the bag stretches along
  // its velocity in flight and squashes flat on touchdown, then settles.
  let stretch = 1;
  if (ballistic) {
    if (elapsed < air) {
      const speed = Math.hypot(vx, vy),
        along = velocityStretch(speed, 1100, 0.2),
        d = Math.atan2(vy, vx) - angle,
        c = Math.cos(d) ** 2,
        // Grow in after release (the held bag is unstretched: no pop at the
        // hand) and relax before touchdown.
        ease =
          smooth(clamp01(t / 0.1)) *
          (1 - smooth(clamp01((t / air - 0.8) / 0.2)));
      const sx = along.across + (along.along - along.across) * c,
        sy = along.across + (along.along - along.across) * (1 - c);
      stretch = 1 + (sx - 1) * ease;
      flatten *= 1 + (sy / sx - 1) * ease;
    }
    const impact = squashOffset(
      [{ at: air, amount: -0.28, settle: 0.34, frequency: 4.5 }],
      elapsed,
    );
    if (impact) {
      const q = squashScale(impact);
      stretch *= q.x;
      flatten *= q.y / q.x;
    }
  }
  return {
    x,
    y,
    angle,
    flatten,
    alpha,
    scale: depth * stretch * (a.contact === 'hole' ? 1 - 0.2 * sink : 1),
    // Mask the hole's front lip only once the bag is over the drawn hole, so
    // no bag is clipped on the board in front of it.
    ...(a.contact === 'hole' &&
    elapsed >= a.duration &&
    (!ballistic || fall >= HOLE_SETTLE)
      ? {
          occlusion: {
            ...anchor,
            y: anchor.y + 5 * depth,
            slope: -0.1,
          },
        }
      : {}),
    ground: { x, y: ground },
    kinematics: {
      model: ballistic
        ? 'release-ballistic-blend-v1'
        : 'release-constant-acceleration',
      velocity: { x: vx, y: vy },
      initialVelocity: velocity,
      acceleration: { x: ax, y: gravity },
      ...(ballistic
        ? {
            cruiseVelocity: ballistic.cruise,
            impliedGravity: ballistic.implied,
            blendSeconds: ballistic.tau,
          }
        : {}),
      airTime: air,
      ...(presented ? { touch: { x: touch.x, y: touch.y } } : {}),
      phase:
        elapsed < air
          ? 'flight'
          : elapsed < a.duration
            ? 'board-slide'
            : a.contact === 'hole'
              ? 'hole-drop'
              : 'settle',
    },
  };
}
