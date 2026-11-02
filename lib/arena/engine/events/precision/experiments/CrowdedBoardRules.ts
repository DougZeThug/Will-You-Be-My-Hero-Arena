/**
 * GAMEPLAY EXPERIMENT (prototype, not installed in the player app).
 *
 * "Crowded board" cornhole rules: bags that are already on the board are
 * physical. A shot that slides travels along the board to the reticle and
 * stops against (and shoves) any bag in its way, so a bag left short of the
 * hole becomes a *blocker*, and each of the four shots gets a distinct job:
 *
 *   Hole runner  lands short and slides in; a blocker stops it and is shoved.
 *   Slide        lands shorter and slides harder: the push / knock-in shot.
 *   Roll         tumbles over the first bag it meets, losing 45% of its travel
 *                (aim it a little long to make up for it).
 *   Airmail      drops straight onto the reticle over any blocker, but with
 *                3x the scatter, so even a Perfect release can rim out.
 *
 * A sliding bag that still has too much pace as it reaches the hole skates
 * across it, so aiming long is not free.
 *
 * With an empty lane and a Perfect release aimed at the hole, every sliding
 * shot still scores three, preserving the shipped contract.
 *
 * Optional "backyard innings" scoring: each round, only the difference between
 * the best and second-best round totals scores; the round winner throws first
 * next round (the trailing player gets the last bag, the hammer); first to the
 * target at the end of a round wins.
 *
 * Everything here is pure and Phaser-free so simulations can run headless.
 */
import { artPoint, boardDepthScale } from '../../../../equipment-layout';
import { EQUIPMENT_ART } from '../../../../equipment-art';
import type { Vector } from '../../../input/InputActions';
import {
  HOLE_HALF,
  precisionTarget,
  resolvePrecisionLanding,
  type PrecisionBag,
} from '../PrecisionPhysics';

export type Shot = 'flat' | 'slide' | 'roll' | 'airmail';
export const SHOTS: readonly Shot[] = ['flat', 'slide', 'roll', 'airmail'];
export type BoardRules = 'classic' | 'crowded';
export type ScoringRules = 'total' | 'innings';
export interface ExperimentRules {
  board: BoardRules;
  scoring: ScoringRules;
  /** Innings: first to this many points at the end of a round wins. */
  target: number;
  /** Innings: hard cap on rounds so a practice match always ends. */
  maxRounds: number;
}
export const DEFAULT_RULES: ExperimentRules = {
  board: 'crowded',
  scoring: 'total',
  target: 11,
  maxRounds: 5,
};
export function rulesFromOptions(
  options: Record<string, string | number | boolean> = {},
): ExperimentRules {
  return {
    board: options.cornholeBoard === 'classic' ? 'classic' : 'crowded',
    scoring: options.cornholeScoring === 'innings' ? 'innings' : 'total',
    target: Number(options.cornholeTarget ?? DEFAULT_RULES.target),
    maxRounds: Number(options.cornholeMaxRounds ?? DEFAULT_RULES.maxRounds),
  };
}

/** How far before the rest point each shot touches down, along the board (stage px). */
export const LEAD: Record<Shot, number> = {
  flat: 42,
  slide: 64,
  roll: 40,
  airmail: 0,
};
/** Share of the remaining slide a struck bag receives. */
export const TRANSFER: Record<Shot, number> = {
  flat: 0.55,
  slide: 1,
  roll: 0,
  airmail: 0,
};
/** Scatter multiplier: the airmail's price for flying over blockers. */
export const SCATTER: Record<Shot, number> = {
  flat: 1,
  slide: 1,
  roll: 1,
  airmail: 3,
};
/** Two resting bags touch when their centres are inside this ellipse (stage px). */
export const CONTACT = { x: 44, y: 13 };
export const TUNE = {
  /** Roll: share of the remaining travel kept after hopping a bag. */
  rollKeep: 0.55,
  /** A sliding bag with more travel than this left as it reaches the hole skates over it. */
  hot: 40,
};
/** The roll's nudge to the bag it hops. */
const ROLL_NUDGE = 6,
  /** Airmail landing on a bag skids off it this far. */
  AIRMAIL_SKID = 14,
  STEP = 2;

/** Unit vector up the board, from the front edge's midpoint to the back edge's. */
export const boardAxis = (() => {
  let cached: Vector | undefined;
  return () => {
    if (cached) return cached;
    const p = EQUIPMENT_ART.board.plane.map((v) => artPoint('cornhole', 0, v));
    // plane order: front-left, back-left, back-right, front-right (see PrecisionPhysics)
    const front = { x: (p[0].x + p[3].x) / 2, y: (p[0].y + p[3].y) / 2 },
      back = { x: (p[1].x + p[2].x) / 2, y: (p[1].y + p[2].y) / 2 },
      d = Math.hypot(back.x - front.x, back.y - front.y);
    cached = { x: (back.x - front.x) / d, y: (back.y - front.y) / d };
    return cached;
  };
})();

export interface Motion {
  id: string;
  owner: string;
  from: Vector;
  to: Vector;
  points: number;
}
export interface Resolution {
  landed: PrecisionBag;
  /** Every bag that moved this throw, in order, for presentation and analysis. */
  motions: Motion[];
  /** Readable tags: 'blocked', 'push-in', 'own-push-in', 'gift', 'knock-off', 'hop', 'skid', 'rim'. */
  tags: string[];
}

/**
 * bagPoints from PrecisionPhysics, with the board polygon built once. The
 * resolver tests a point every 2 px of travel and the planner resolves
 * thousands of throws per decision; rebuilding the polygon each time made
 * the simulations several times slower. A test asserts it matches bagPoints.
 */
export const fastBagPoints = (() => {
  let polygon: Vector[] | undefined;
  let t: Vector, hx: number, hy: number;
  return (p: Vector) => {
    if (!polygon) {
      polygon = EQUIPMENT_ART.board.plane.map((v) =>
        artPoint('cornhole', 0, v),
      );
      t = precisionTarget();
      hx = HOLE_HALF.x * boardDepthScale(0);
      hy = HOLE_HALF.y * boardDepthScale(0);
    }
    if (((p.x - t.x) / hx) ** 2 + ((p.y - t.y) / hy) ** 2 < 1) return 3;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      )
        inside = !inside;
    }
    return inside ? 1 : 0;
  };
})();

const touching = (a: Vector, b: Vector) =>
  ((a.x - b.x) / CONTACT.x) ** 2 + ((a.y - b.y) / CONTACT.y) ** 2 < 1;

/**
 * Slide `bag` from its position toward `to`, stopping on the hole, off the
 * board, or against another board bag (which receives the shove). Mutates the
 * bags in place and records motions. `depth` limits chain reactions.
 */
function slide(
  bag: PrecisionBag,
  to: Vector,
  shot: Shot,
  board: PrecisionBag[],
  out: Resolution,
  depth: number,
  ignore: Set<string>,
) {
  const from = { x: bag.x, y: bag.y },
    total = Math.hypot(to.x - from.x, to.y - from.y),
    ux = total ? (to.x - from.x) / total : 0,
    uy = total ? (to.y - from.y) / total : 0;
  let travelled = 0,
    hot = false;
  for (;;) {
    const p = { x: from.x + ux * travelled, y: from.y + uy * travelled };
    let points = fastBagPoints(p);
    // Too much pace left at the lip: it skates across the opening.
    if (points === 3 && (hot || total - travelled > TUNE.hot)) {
      if (!hot) out.tags.push('hot');
      hot = true;
      points = travelled >= total ? 3 : 1;
    } else hot = false;
    if (points !== 1) {
      bag.x = p.x;
      bag.y = p.y;
      bag.points = points;
      break;
    }
    // A thrown bag that touches down overlapping a bag has landed on it.
    // After that, only bags ahead of the moving bag can stop it (never the
    // one behind that just shoved it).
    const hit = board.find(
      (b) =>
        b !== bag &&
        b.points === 1 &&
        !ignore.has(b.id) &&
        ((depth === 0 && travelled === 0) ||
          (b.x - p.x) * ux + (b.y - p.y) * uy > 0) &&
        touching(p, b),
    );
    if (hit) {
      const remaining = total - travelled;
      if (shot === 'roll' && depth === 0) {
        // Tumble over it: keep half the remaining travel, nudge it slightly.
        out.tags.push('hop');
        ignore.add(hit.id);
        shove(hit, ROLL_NUDGE, board, out, depth + 1, ignore, shot);
        bag.x = p.x;
        bag.y = p.y;
        const rest = remaining * TUNE.rollKeep;
        slide(
          bag,
          { x: p.x + ux * rest, y: p.y + uy * rest },
          shot,
          board,
          out,
          depth + 1,
          ignore,
        );
        return;
      }
      bag.x = p.x;
      bag.y = p.y;
      bag.points = 1;
      out.tags.push('blocked');
      const transfer = depth === 0 ? TRANSFER[shot] : 0.6;
      if (depth < 3 && remaining * transfer > 0.5)
        shove(hit, remaining * transfer, board, out, depth + 1, ignore, shot);
      break;
    }
    if (travelled >= total) {
      bag.x = to.x;
      bag.y = to.y;
      bag.points = fastBagPoints(to);
      break;
    }
    travelled = Math.min(total, travelled + STEP);
  }
}

function shove(
  bag: PrecisionBag,
  distance: number,
  board: PrecisionBag[],
  out: Resolution,
  depth: number,
  ignore: Set<string>,
  shot: Shot,
) {
  const u = boardAxis(),
    from = { x: bag.x, y: bag.y };
  slide(
    bag,
    { x: bag.x + u.x * distance, y: bag.y + u.y * distance },
    shot,
    board,
    out,
    depth,
    ignore,
  );
  out.motions.push({
    id: bag.id,
    owner: bag.owner,
    from,
    to: { x: bag.x, y: bag.y },
    points: bag.points,
  });
}

/**
 * Resolve one bag thrown at `rest` (the reticle plus timing drift and scatter:
 * where it would stop on an empty board). Mutates `bags` (pushes the new bag,
 * moves struck bags) exactly as PrecisionEvent's classic resolver does.
 */
export function resolveThrow(
  rules: Pick<ExperimentRules, 'board'>,
  id: string,
  owner: string,
  shot: Shot,
  rest: Vector,
  bags: PrecisionBag[],
): Resolution {
  if (rules.board === 'classic') {
    const before = new Map(
      bags.map((b) => [b.id, { x: b.x, y: b.y, p: b.points }]),
    );
    const landed = resolvePrecisionLanding(
      {
        id,
        owner,
        origin: rest,
        target: rest,
        age: 0,
        duration: 1,
        arc: 0,
        spin: 0,
      },
      bags,
      shot,
    );
    const motions: Motion[] = [];
    const tags: string[] = [];
    for (const b of bags) {
      const was = before.get(b.id);
      if (!was || (was.x === b.x && was.y === b.y)) continue;
      motions.push({
        id: b.id,
        owner: b.owner,
        from: { x: was.x, y: was.y },
        to: { x: b.x, y: b.y },
        points: b.points,
      });
      if (was.p !== 3 && b.points === 3)
        tags.push(b.owner === owner ? 'own-push-in' : 'gift');
    }
    return { landed, motions, tags };
  }
  const u = boardAxis(),
    lead = LEAD[shot],
    out: Resolution = {
      landed: undefined as unknown as PrecisionBag,
      motions: [],
      tags: [],
    },
    touchdown = { x: rest.x - u.x * lead, y: rest.y - u.y * lead },
    bag: PrecisionBag = {
      id,
      owner,
      ...touchdown,
      angle: shot === 'roll' ? -0.2 : 0.08,
      points: fastBagPoints(touchdown),
    };
  out.landed = bag;
  const before = new Map(bags.map((b) => [b.id, b.points]));
  if (bag.points === 0) {
    // Short of the board (or wide): it stays in the grass.
  } else if (bag.points === 3 && shot === 'airmail') {
    // Straight down through the opening.
  } else if (shot === 'airmail') {
    const under = bags.find((b) => b.points === 1 && touching(bag, b));
    if (under) {
      out.tags.push('skid');
      const ignore = new Set([under.id]);
      slide(
        bag,
        { x: bag.x + u.x * AIRMAIL_SKID, y: bag.y + u.y * AIRMAIL_SKID },
        shot,
        bags,
        out,
        1,
        ignore,
      );
    }
  } else {
    slide(bag, rest, shot, bags, out, 0, new Set());
  }
  out.motions.unshift({
    id,
    owner,
    from: touchdown,
    to: { x: bag.x, y: bag.y },
    points: bag.points,
  });
  for (const b of bags) {
    const was = before.get(b.id);
    if (was === undefined || was === b.points) continue;
    if (b.points === 3)
      out.tags.push(b.owner === owner ? 'own-push-in' : 'gift');
    if (b.points === 0) out.tags.push('knock-off');
  }
  if (bag.points === 1 && shot === 'airmail' && overHoleRim(rest))
    out.tags.push('rim');
  bags.push(bag);
  return out;
}

const overHoleRim = (p: Vector) => {
  const t = precisionTarget();
  return Math.hypot((p.x - t.x) / 30, (p.y - t.y) / 13) < 1;
};

/** The thrower-independent part of PrecisionEvent.releaseBag: where the bag would stop. */
export interface ReleaseSpec {
  /** Release power minus ideal power (power units). */
  error: number;
  /** Half-width of the release window (power units). */
  window: number;
  /** Card accuracy for cornhole (0..1). */
  accuracy: number;
  precision: boolean;
  shot: Shot;
  /** Reticle offset, -1..1 on each axis (115 px along, 48 px across). */
  aim: Vector;
  board: BoardRules;
}
const MISS_X = 490,
  MISS_Y = 60;
export function spreadFor(
  spec: Pick<ReleaseSpec, 'accuracy' | 'precision' | 'shot' | 'board'>,
) {
  return (
    (1 - spec.accuracy) *
    22 *
    (spec.precision ? 0.4 : 1) *
    (spec.board === 'crowded' ? SCATTER[spec.shot] : 1)
  );
}
/**
 * The intended rest point before scatter, then scatter from two uniform draws
 * (same order as PrecisionEvent: x then y). Identical maths to the shipped
 * releaseBag for the classic board.
 */
export function restPoint(spec: ReleaseSpec, rx: number, ry: number): Vector {
  const target = precisionTarget(),
    spread = spreadFor(spec),
    w = spec.window,
    miss = Math.abs(spec.error),
    hx = (HOLE_HALF.x - 1) * boardDepthScale(0),
    hy = (HOLE_HALF.y - 1) * boardDepthScale(0),
    edge = Math.max(
      0,
      (1 - (spread / 2) * Math.hypot(1 / hx, 1 / hy)) /
        Math.hypot(1 / hx, MISS_Y / MISS_X / hy),
    ),
    blend = Math.min(1, Math.max(0, (miss - w) / w)),
    drift =
      miss > 2 * w
        ? { x: miss * MISS_X, y: miss * MISS_Y }
        : miss <= w
          ? { x: (miss / w) * edge, y: ((miss / w) * edge * MISS_Y) / MISS_X }
          : {
              x: edge + blend * (2 * w * MISS_X - edge),
              y:
                (edge * MISS_Y) / MISS_X +
                blend * (2 * w * MISS_Y - (edge * MISS_Y) / MISS_X),
            };
  return {
    x:
      target.x +
      spec.aim.x * 115 +
      Math.sign(spec.error) * drift.x +
      (rx - 0.5) * spread,
    y: target.y + spec.aim.y * 48 + drift.y + (ry - 0.5) * spread,
  };
}

/** The window formula from PrecisionEvent (shot skill, precision, clutch). */
export function releaseWindow(
  skill: number,
  precision: boolean,
  clutch: boolean,
) {
  return 0.02 + skill / 30 + (precision ? 0.015 : 0) + (clutch ? 0.01 : 0);
}

/** Innings: points awarded this round from each player's round total. */
export function inningAward(roundTotals: Record<string, number>) {
  const ranked = Object.entries(roundTotals).sort((a, b) => b[1] - a[1]);
  const award: Record<string, number> = Object.fromEntries(
    ranked.map(([id]) => [id, 0]),
  );
  if (ranked.length === 1) award[ranked[0][0]] = ranked[0][1];
  else if (ranked[0][1] > ranked[1][1])
    award[ranked[0][0]] = ranked[0][1] - ranked[1][1];
  return award;
}

/** Round totals from the bags currently resolved. */
export function bagTotals(ids: string[], bags: PrecisionBag[]) {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      bags.filter((b) => b.owner === id).reduce((n, b) => n + b.points, 0),
    ]),
  );
}

/** Is there a board bag sitting on the sliding line into the hole? (for captions/analysis) */
export function laneBlocker(
  bags: PrecisionBag[],
  aim: Vector = { x: 0, y: 0 },
) {
  const t = precisionTarget(),
    u = boardAxis(),
    rest = { x: t.x + aim.x * 115, y: t.y + aim.y * 48 };
  for (let s = 0; s <= LEAD.slide; s += STEP) {
    const p = { x: rest.x - u.x * s, y: rest.y - u.y * s };
    const b = bags.find((b) => b.points === 1 && touching(p, b));
    if (b) return b;
  }
  return undefined;
}
