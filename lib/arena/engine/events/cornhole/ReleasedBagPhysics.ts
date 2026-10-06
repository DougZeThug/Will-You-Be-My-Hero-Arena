import type { Attempt, Recording, V3 } from '../../../model';
import type { ShotStyle } from '../../animation/AnimationTypes';
import type { ReleaseFrame, ProjectileFrame } from '../ArenaEvent';
import {
  surfacePoint,
  boardDepthScale,
  BAG_FLIGHT_FLATTEN,
  placement,
} from '../../../equipment-layout';
import { clamp01, smooth } from '../../../match-timeline';
import { surfaceTravelSeconds } from './CornholePresentationTiming';
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
/** Hole drop: the 0.28 s fall (the bag sinks from the moment its centre is
 * over the drawn opening until the end of it), and the bounds of the glide
 * from the target onto the drawn hole. */
const HOLE_FALL = 0.28;
const HOLE_GLIDE = { min: 0.05, max: 0.25 };
/** Forward run-out of a hole bag past its target (screen px at depth scale
 * 1): up to `max` (half the room ahead) over the opening, at least `min`, so
 * it never stops at the target. */
const HOLE_RUNOUT_PX = { min: 2, max: 4 };
/** Share of the drawn opening's half-extents a hole bag's centre comes to
 * rest within, so it is clearly over the hole. */
const HOLE_REST_SCALE = 0.8;
/** Ride-over lift at depth scale 1, in screen px (owner choice), and the
 * envelope's ramp time (6 px in 10 frames: at most 0.6 px/frame). */
const RIDE_LIFT_PX = 6;
const RIDE_RAMP_SECONDS = 1 / 6;
/** Shove duration bounds for a pushed bag, in seconds. */
const PUSH_SECONDS = { min: 0.12, max: 0.34 };

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

/** Does the slide chord a→b (both bag centres) enter the drawn hole opening
 * (an ellipse; the bag's centre path, its body may pass over the rim)? */
function chordCrossesOpening(
  a: XYPoint,
  b: XYPoint,
  center: XYPoint,
  half: XYPoint,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    px = a.x - center.x,
    py = a.y - center.y;
  // Minimum of the ellipse form along the chord.
  const qa = (dx / half.x) ** 2 + (dy / half.y) ** 2,
    qb = 2 * ((px * dx) / half.x ** 2 + (py * dy) / half.y ** 2),
    u = qa > 0 ? Math.max(0, Math.min(1, -qb / (2 * qa))) : 0;
  return (
    ((px + u * dx) / half.x) ** 2 + ((py + u * dy) / half.y) ** 2 < 1 - 1e-9
  );
}

/** Is a bag centre over the drawn hole opening? */
function overOpening(p: XYPoint, actor: number) {
  const anchor = placement('cornhole', actor).anchor,
    s = boardDepthScale(actor);
  return (
    ((p.x - anchor.x) / (HOLE_HALF.x * s)) ** 2 +
      ((p.y - anchor.y) / (HOLE_HALF.y * s)) ** 2 <
    1
  );
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
  | 'hole';

/**
 * Where a hole bag's centre comes to rest over the drawn opening (screen px),
 * and its forward run-out `run` (x px past the target, always positive: a
 * hole bag never stops at its target or moves back). Closed form, on the rest
 * ellipse (the drawn opening shrunk to `HOLE_REST_SCALE`):
 * - a target inside it runs on along the board's slope by half the room
 *   ahead, between `HOLE_RUNOUT_PX.min` and `.max`;
 * - a target outside it heads for its radial projection toward the hole
 *   centre when that lies at least `min` ahead;
 * - otherwise (beside or past the centre) it runs `min` ahead and moves
 *   across into the rest ellipse at that x (the drawn opening when the rest
 *   ellipse ends before it).
 */
export function holeRest(a: Attempt): { rest: XYPoint; run: number } {
  const target = surfacePoint('cornhole', a.actor, a.target),
    anchor = placement('cornhole', a.actor).anchor,
    s = boardDepthScale(a.actor),
    dx = target.x - anchor.x,
    dy = target.y - anchor.y,
    hx = HOLE_HALF.x * s * HOLE_REST_SCALE,
    hy = HOLE_HALF.y * s * HOLE_REST_SCALE,
    least = HOLE_RUNOUT_PX.min * s,
    e = (dx / hx) ** 2 + (dy / hy) ** 2;
  if (e < 1) {
    // Over the opening: run on along the board, within half the room.
    const front = surfacePoint('cornhole', a.actor, onBoard(8, a.target.z)),
      knee = surfacePoint('cornhole', a.actor, onBoard(9.2, a.target.z)),
      m = (knee.y - front.y) / (knee.x - front.x),
      qa = 1 / hx ** 2 + (m / hy) ** 2,
      qb = 2 * (dx / hx ** 2 + (m * dy) / hy ** 2),
      room = (-qb + Math.sqrt(qb * qb - 4 * qa * (e - 1))) / (2 * qa),
      run = Math.max(least, Math.min(HOLE_RUNOUT_PX.max * s, room / 2));
    return { rest: { x: target.x + run, y: target.y + m * run }, run };
  }
  const radial = {
    x: anchor.x + dx / Math.sqrt(e),
    y: anchor.y + dy / Math.sqrt(e),
  };
  if (radial.x - target.x >= least)
    return { rest: radial, run: radial.x - target.x };
  // Beside or past the centre: `least` ahead, across into the opening.
  const x = target.x + least,
    across = (h: XYPoint) =>
      h.y * Math.sqrt(Math.max(0, 1 - ((x - anchor.x) / h.x) ** 2)),
    reach =
      Math.abs(x - anchor.x) < hx
        ? across({ x: hx, y: hy })
        : across({ x: HOLE_HALF.x * s, y: HOLE_HALF.y * s });
  return {
    rest: { x, y: anchor.y + Math.max(-reach, Math.min(reach, dy)) },
    run: least,
  };
}
/** Hole bag still moving at contactAt: its exit/landing speed ratio r when it
 * decelerates uniformly from touchdown, passes the target at contactAt and
 * would come to rest `runout` px further on. Slide d px. */
const holeExitRatio = (d: number, runout: number) =>
  runout > 0 ? Math.sqrt(runout / (d + runout)) : 0;

/**
 * The single owner of a bag's first-impact touch point (simulation space),
 * with the limit that shaped it.
 *
 * A recorded touch (misses) is returned as is. A performance (ballistic)
 * release that travels on the board touches down short of the immutable target
 * by the velocity-matched slide distance: the bag lands at the horizontal speed
 * the flight arrives with and decelerates uniformly, a board bag to rest on the
 * target, a hole bag through the target at contactAt (still moving) toward the
 * drawn hole. The slide never starts off the front of the board, never runs
 * backwards, and a board bag's centre never slides across the hole (the
 * scoring disc or the drawn opening; its body may pass over the rim). When a
 * board bag's target is itself over the opening it lands on the target without
 * sliding. Resting bags do not block it: it rides over them (`releasedBag`).
 * Presentation only: target, timing and scoring are unchanged.
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
  // Velocity match: the ballistic arrival speed (D - d - v0·τ/2)/span equals
  // the slide's initial speed: 2d/slide for a board bag (rest at the target),
  // 2d/((1 + r)·slide) for a hole bag leaving the target at r times it.
  const target = surfacePoint('cornhole', a.actor, a.target),
    air = Math.max(0.3, a.duration - slide),
    tau = blendSeconds(air),
    span = air - tau / 2,
    reach = target.x - release.x - (release.velocity.x * tau) / 2,
    runout = a.contact === 'hole' ? holeRest(a).run : 0;
  let ideal = (slide * reach) / (2 * span + slide);
  if (a.contact === 'hole') {
    // Arrival speed falls and slide speed rises with d: bisect the crossing.
    let lo = 0,
      hi = Math.max(0, reach);
    for (let i = 0; i < 80; i++) {
      const d = (lo + hi) / 2;
      if (
        (reach - d) / span >
        (2 * d) / ((1 + holeExitRatio(d, runout)) * slide)
      )
        lo = d;
      else hi = d;
    }
    ideal = (lo + hi) / 2;
  }
  const distance = Math.max(0, Math.min(MAX_SLIDE_PX, ideal));
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
  // A board bag's centre stays off the drawn opening along the slide chord.
  if (a.contact === 'board') {
    const s = boardDepthScale(a.actor),
      center = placement('cornhole', a.actor).anchor,
      half = { x: HOLE_HALF.x * s, y: HOLE_HALF.y * s },
      blocked = (from: number) =>
        chordCrossesOpening(screen(from), target, center, half);
    if (blocked(x)) {
      // Land past the opening: the nearest clear chord toward the target
      // (bisection), or the target itself when even it is over the opening.
      let lo = x,
        hi = a.target.x;
      if (blocked(hi)) lo = hi;
      else
        for (let i = 0; i < 60 && hi - lo > 1e-10; i++) {
          const mid = (lo + hi) / 2;
          if (blocked(mid)) lo = mid;
          else hi = mid;
        }
      x = hi;
      clamp = 'hole';
    }
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
 * A presented bag's motion on the board (screen px, seconds): it lands at
 * `touch` at first impact (`start`) with x speed `v0`, decelerates uniformly
 * along the straight chord to `target` over `moving` seconds and leaves it at
 * x speed `v1`. A board bag stops (`v1` 0) after `moving = min(slide, 2d/vIn)`
 * and holds on the target until contactAt, so a shortened slide never creeps;
 * a hole bag passes the target exactly at contactAt still moving toward the
 * drawn hole. Undefined when the touch point is not the presentation's.
 */
export function slideMotion(
  a: Attempt,
  shot: ShotStyle,
  release: ReleaseFrame,
) {
  const slide = surfaceTravelSeconds(a, shot);
  if (
    release.flatten === undefined ||
    !release.velocity ||
    a.boardResolution?.touch ||
    !slide
  )
    return undefined;
  const touch = surfacePoint(
      'cornhole',
      a.actor,
      presentationTouch(a, shot, release),
    ),
    target = surfacePoint('cornhole', a.actor, a.target),
    air = Math.max(0.3, a.duration - slide),
    d = Math.max(0, target.x - touch.x),
    arrival = ballisticFlight(release, release.velocity, touch, air).cruise.x;
  let moving = slide,
    v0 = 0,
    v1 = 0;
  if (d > 1e-9) {
    if (a.contact === 'hole') {
      const r = holeExitRatio(d, holeRest(a).run);
      v0 = (2 * d) / ((1 + r) * slide);
      v1 = r * v0;
    } else {
      moving = arrival > 0 ? Math.min(slide, (2 * d) / arrival) : slide;
      v0 = (2 * d) / moving;
    }
  }
  return {
    touch,
    target,
    start: a.releaseAt + air,
    slide,
    moving,
    v0,
    v1,
    arrival,
  };
}
type SlideMotion = NonNullable<ReturnType<typeof slideMotion>>;

/** Share of the chord covered `t` s after first impact, and the x speed. */
function slideAt(m: SlideMotion, t: number) {
  const d = m.target.x - m.touch.x;
  if (d <= 1e-9) return { along: 1, vx: 0 };
  const u = Math.max(0, Math.min(m.moving, t)),
    k = (m.v0 - m.v1) / m.moving;
  return {
    along: Math.min(1, (m.v0 * u - 0.5 * k * u * u) / d),
    vx: t < m.moving ? m.v0 - k * u : m.v1,
  };
}

/** Seconds after first impact at which the slide covers `along` of its chord. */
function slideTime(m: SlideMotion, along: number) {
  const d = m.target.x - m.touch.x;
  if (d <= 1e-9) return 0;
  const k = (m.v0 - m.v1) / m.moving,
    s = along * d;
  return k > 1e-9
    ? (m.v0 - Math.sqrt(Math.max(0, m.v0 * m.v0 - 2 * k * s))) / k
    : s / m.v0;
}

/** When and how long a presented push lasts (see `presentationPush`). */
export type PushTiming = { start: number; duration: number };

/**
 * A pushed bag's shove: it starts when the presented thrown bag's drawn body
 * first touches its starting footprint (never before first impact) and leaves
 * at the thrown bag's speed, decelerating uniformly (ease-out) to its recorded
 * end over `duration = clamp(2·|to − from| / speed, 0.12, 0.34)` s. Undefined
 * when the bag is not presented or never reaches it; the board presentation
 * then keeps its recorded timing.
 */
export function presentationPush(
  a: Attempt,
  shot: ShotStyle,
  release: ReleaseFrame,
  hit: BagInteraction,
): PushTiming | undefined {
  const m = slideMotion(a, shot, release);
  if (!m || !a.boardResolution?.interactions.some((h) => h.id === hit.id))
    return undefined;
  const s = boardDepthScale(a.actor),
    from = surfacePoint('cornhole', a.actor, hit.from),
    to = surfacePoint('cornhole', a.actor, hit.to),
    entry = chordEntry(m.touch, m.target, from, {
      x: 2 * BAG_HALF.x * s,
      y: 2 * BAG_HALF.y * s,
    });
  if (entry === undefined) return undefined;
  const at = slideTime(m, entry),
    d = m.target.x - m.touch.x,
    // Screen speed along the straight chord from its x speed.
    speed =
      d > 1e-9
        ? (slideAt(m, at).vx * Math.hypot(d, m.target.y - m.touch.y)) / d
        : 0,
    shove = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    start: m.start + at,
    duration:
      speed > 1e-9
        ? Math.max(
            PUSH_SECONDS.min,
            Math.min(PUSH_SECONDS.max, (2 * shove) / speed),
          )
        : PUSH_SECONDS.max,
  };
}

/**
 * Travel (0..1, from `hit.from` to `hit.to`) of a bag the active attempt
 * pushes, or undefined while the board state draws it. A presented push
 * (`timing`) rests until its start, shoves out (ease-out `1 − (1 − u)²`) and
 * holds its end until the board state takes over at contactAt; otherwise the
 * recorded window (smoothstep over contactAt −0.18..+0.16 s).
 */
export function pushTravel(a: Attempt, time: number, timing?: PushTiming) {
  if (!timing) {
    if (time < a.contactAt - 0.18 || time > a.contactAt + 0.16)
      return undefined;
    const u = clamp01((time - a.contactAt + 0.18) / 0.34);
    return u * u * (3 - 2 * u);
  }
  if (
    time < a.releaseAt ||
    time > Math.max(a.contactAt, timing.start + timing.duration)
  )
    return undefined;
  const u = clamp01((time - timing.start) / timing.duration);
  return 1 - (1 - u) ** 2;
}

/**
 * Where a bag the active attempt pushes is drawn at `time` (screen px) and
 * its opacity, or undefined while the board state draws it. A bag pushed off
 * the board or into the hole fades as it moves (`CornholeEvent` draws this).
 */
export function pushedBag(
  a: Attempt,
  hit: BagInteraction,
  time: number,
  timing?: PushTiming,
) {
  const v = pushTravel(a, time, timing);
  if (v === undefined) return undefined;
  const from = surfacePoint('cornhole', a.actor, hit.from),
    to = surfacePoint('cornhole', a.actor, hit.to);
  return {
    x: from.x + (to.x - from.x) * v,
    y: from.y + (to.y - from.y) * v,
    alpha: hit.after === 1 ? 1 : 1 - v,
  };
}

/** How far (0..1) a presented sliding bag at `p` lies over a drawn bag,
 * weighted by that bag's opacity: full once their footprints overlap by half
 * a bag in both directions. */
export function rideCover(
  a: Attempt,
  shot: ShotStyle,
  release: ReleaseFrame,
  p: XYPoint,
  time: number,
) {
  const s = boardDepthScale(a.actor),
    half = { x: BAG_HALF.x * s, y: BAG_HALF.y * s },
    under = restingBags(a).map((b) => ({
      ...surfacePoint('cornhole', a.actor, b),
      alpha: 1,
    }));
  for (const hit of a.boardResolution?.interactions ?? []) {
    // Outside its push the board state draws it: at its start (opaque)
    // before contact, at its end after (gone unless it stays on the board).
    const drawn =
      pushedBag(a, hit, time, presentationPush(a, shot, release, hit)) ??
      (time < a.contactAt
        ? { ...surfacePoint('cornhole', a.actor, hit.from), alpha: 1 }
        : {
            ...surfacePoint('cornhole', a.actor, hit.to),
            alpha: hit.after === 1 ? 1 : 0,
          });
    under.push(drawn);
  }
  let cover = 0;
  for (const c of under)
    cover = Math.max(
      cover,
      c.alpha *
        Math.min(1, Math.max(0, 2 * half.x - Math.abs(p.x - c.x)) / half.x) *
        Math.min(1, Math.max(0, 2 * half.y - Math.abs(p.y - c.y)) / half.y),
    );
  return cover;
}

/** Watch cornhole draw depth of a board bag: board bags stack in throw
 * order, so a cold seek draws them as playback did. */
export const boardBagDepth = (rec: Recording, id: string) =>
  60 +
  0.001 *
    Math.max(
      0,
      rec.attempts.findIndex((a) => a.id === id),
    );

/** Watch cornhole draw depth of a released bag: above every board bag from
 * release until contactAt; below them while it sinks into the hole (its lip
 * mask is on), so a bag resting over the rim stays in front; otherwise with
 * the board bags in throw order. */
export function releasedBagDepth(
  rec: Recording,
  a: Attempt,
  time: number,
  frame: ProjectileFrame,
) {
  return time < a.contactAt
    ? 60.5
    : frame.occlusion
      ? 59.9
      : boardBagDepth(rec, a.id);
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
  // The presentation solver (not a recording) chose this touch point.
  const motion = slideMotion(a, shot, release),
    presented = !!motion;
  const touch =
    motion?.touch ??
    surfacePoint('cornhole', a.actor, presentationTouch(a, shot, release));
  const slide = surfaceTravelSeconds(a, shot);
  const air = Math.max(0.3, a.duration - slide),
    elapsed = Math.max(0, time - a.releaseAt),
    t = Math.min(air, elapsed);
  const performance = release.flatten !== undefined;
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
      board = motion ? slideAt(motion, elapsed - air) : undefined,
      travel = board ? board.along : 1 - (1 - u) ** 2;
    x = touch.x + (target.x - touch.x) * travel;
    y = touch.y + (target.y - touch.y) * travel;
    if (board) {
      // Along the straight chord: y speed follows the x speed.
      const d = target.x - touch.x;
      vx = board.vx;
      vy = d > 1e-9 ? (board.vx * (target.y - touch.y)) / d : 0;
    } else {
      vx = ((target.x - touch.x) * 2 * (1 - u)) / slide;
      vy = ((target.y - touch.y) * 2 * (1 - u)) / slide;
    }
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
  // Ride-over lift: a presented bag sliding over a drawn bag (resting, or a
  // pushed one where it is now) rises up to 6 px (× depth) over it while it
  // moves: the envelope ramps at most 0.6 px/frame (× depth) in after first
  // impact and out before the bag stops, so it is 0 at first impact, once
  // the bag has stopped and at contactAt. The shadow stays on the board.
  if (motion && elapsed >= air && elapsed < air + motion.moving) {
    const since = elapsed - air,
      envelope = Math.min(
        1,
        since / RIDE_RAMP_SECONDS,
        (motion.moving - since) / RIDE_RAMP_SECONDS,
      );
    if (envelope > 0)
      y -=
        RIDE_LIFT_PX *
        boardDepthScale(a.actor) *
        envelope *
        rideCover(a, shot, release, { x, y }, time);
  }
  const after = Math.max(0, elapsed - a.duration),
    fall = clamp01(after / HOLE_FALL),
    anchor = placement('cornhole', a.actor).anchor;
  // The historical path drops at the target; a ballistic hole bag's sink is
  // set below, where it glides onto the drawn hole.
  let opening = false,
    sink = ballistic ? 0 : fall;
  if (elapsed >= a.duration) {
    x = target.x;
    y = target.y;
    vx = 0;
    vy = 0;
    if (a.contact === 'hole' && ballistic) {
      // Glide from the target onto its rest over the drawn opening (never
      // back), leaving the target at the slide's exit velocity (C1 at
      // contactAt): a cubic Hermite whose x is a uniform deceleration over
      // the run-out (or slower), so x never decreases. A direct shot carries
      // its landing x speed, capped to stop within the run-out.
      const { rest, run } = holeRest(a),
        chord = target.x - touch.x,
        exit = motion
          ? {
              x: motion.v1,
              y: chord > 1e-9 ? (motion.v1 * (target.y - touch.y)) / chord : 0,
            }
          : {
              x: Math.min(
                Math.max(0, ballistic.at(air).vx),
                (2 * run) / HOLE_GLIDE.min,
              ),
              y: 0,
            },
        glide =
          exit.x > 1e-9
            ? Math.min(HOLE_GLIDE.max, (2 * run) / exit.x)
            : HOLE_GLIDE.max,
        at = (t: number) => {
          const g = clamp01(t / glide),
            h00 = 2 * g ** 3 - 3 * g * g + 1,
            h10 = g ** 3 - 2 * g * g + g,
            h01 = 3 * g * g - 2 * g ** 3;
          return {
            x: h00 * target.x + h10 * glide * exit.x + h01 * rest.x,
            y: h00 * target.y + h10 * glide * exit.y + h01 * rest.y,
          };
        },
        g = clamp01(after / glide),
        moving = after < glide;
      ({ x, y } = at(after));
      vx = moving
        ? (6 * (g * g - g) * (target.x - rest.x)) / glide +
          (3 * g * g - 4 * g + 1) * exit.x
        : 0;
      vy = moving
        ? (6 * (g * g - g) * (target.y - rest.y)) / glide +
          (3 * g * g - 4 * g + 1) * exit.y
        : 0;
      ground = y;
      opening = overOpening({ x, y }, a.actor);
      // It sinks (accelerating) from the moment its centre is over the drawn
      // opening (bisected along the glide) to the end of the fall.
      let over = 0;
      if (!overOpening(target, a.actor)) {
        let lo = 0;
        over = glide;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + over) / 2;
          if (overOpening(at(mid), a.actor)) over = mid;
          else lo = mid;
        }
      }
      sink = opening
        ? clamp01((after - over) / Math.max(1e-6, HOLE_FALL - over)) ** 2
        : 0;
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
    // Mask the hole's front lip only while the bag's centre is over the drawn
    // opening, so no bag is clipped on the board around it.
    ...(a.contact === 'hole' && elapsed >= a.duration && (!ballistic || opening)
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
