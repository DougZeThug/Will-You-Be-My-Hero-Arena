/**
 * GAMEPLAY EXPERIMENT: a deterministic, board-aware shot planner.
 *
 * Used by the experiment's hard AI and by the headless simulations to measure
 * how much a throw's best choice depends on the board. It is a two-ply
 * expectimax over a small option set: my shot and reticle, integrated over my
 * timing error and scatter (fixed quadrature nodes, no random draws), then the
 * next thrower's best single reply. No randomness, so the same board always
 * gives the same plan.
 */
import type { Vector } from '../../../input/InputActions';
import type { PrecisionBag } from '../PrecisionPhysics';
import {
  SHOTS,
  releaseWindow,
  resolveThrow,
  restPoint,
  type BoardRules,
  type Shot,
} from './CrowdedBoardRules';

export interface ThrowerModel {
  id: string;
  accuracy: number;
  /** Card skill per shot (Hole runner uses the slide skill). */
  skill: Record<Shot, number>;
  clutch: boolean;
  /** Std. dev. of release error in power units (1 s of charge = 0.667). */
  sigma: number;
  /** Mean release error (negative = early). */
  bias: number;
}
export interface Option {
  shot: Shot;
  aim: Vector;
  /** 'hole' aims at the hole; 'guard' leaves the bag short as a blocker. */
  kind: 'hole' | 'long' | 'guard';
}
export const AIMS: { kind: Option['kind']; aim: Vector }[] = [
  { kind: 'hole', aim: { x: 0, y: 0 } },
  { kind: 'long', aim: { x: 0.15, y: 0 } },
  { kind: 'guard', aim: { x: -0.55, y: 0 } },
];
export const OPTIONS: Option[] = SHOTS.flatMap((shot) =>
  AIMS.map(({ kind, aim }) => ({ shot, aim, kind })),
);
/**
 * Nine equal-probability nodes of a standard normal (the quantiles at
 * (i + 0.5) / 9). Outcomes are step functions of the release error (3, 1 or 0
 * points), which Gauss-Hermite nodes integrate badly: with five GH nodes the
 * planner misjudged the window edge and lost to the favourite-shot default
 * under the shipped rules.
 */
const Q9 = [
  -1.5932, -0.9674, -0.5895, -0.2822, 0, 0.2822, 0.5895, 0.9674, 1.5932,
].map((z) => [z, 1 / 9] as const);
const GH3 = [
  [-1.7321, 1 / 6],
  [0, 2 / 3],
  [1.7321, 1 / 6],
] as const;

const clone = (bags: PrecisionBag[]) => bags.map((b) => ({ ...b }));
const total = (bags: PrecisionBag[], id: string) =>
  bags.filter((b) => b.owner === id).reduce((n, b) => n + b.points, 0);

export interface PlanContext {
  board: BoardRules;
  bags: PrecisionBag[];
  me: ThrowerModel;
  /** Opponents still to throw this round, next first (empty on the last bag). */
  next: ThrowerModel[];
  /** Everyone whose bags count against me this round. */
  rivals: string[];
  clutchNow: boolean;
}
export interface Evaluation {
  option: Option;
  value: number;
}

/** Expected (my points − best rival's points) after this throw and one reply. */
/** Scatter is uniform on each axis: two-point Gauss-Legendre per axis at the top ply, the centre below. */
const SCATTER4 = [
  [0.2113, 0.2113],
  [0.2113, 0.7887],
  [0.7887, 0.2113],
  [0.7887, 0.7887],
] as const;
const SCATTER1 = [[0.5, 0.5]] as const;
export function evaluate(ctx: PlanContext, option: Option, depth = 2): number {
  const nodes = depth === 2 ? Q9 : GH3;
  const scatter = depth === 2 ? SCATTER4 : SCATTER1;
  let value = 0;
  for (const [z, w0] of nodes)
    for (const [rx, ry] of scatter) {
      const w = w0 / scatter.length;
      const bags = clone(ctx.bags),
        window = releaseWindow(
          ctx.me.skill[option.shot],
          false,
          ctx.clutchNow && ctx.me.clutch,
        ),
        rest = restPoint(
          {
            error: ctx.me.bias + z * ctx.me.sigma,
            window,
            accuracy: ctx.me.accuracy,
            precision: false,
            shot: option.shot,
            aim: option.aim,
            board: ctx.board,
          },
          rx,
          ry,
        );
      resolveThrow(
        { board: ctx.board },
        '?plan',
        ctx.me.id,
        option.shot,
        rest,
        bags,
      );
      let outcome: number;
      const reply = ctx.next[0];
      if (depth === 2 && reply) {
        // The next thrower picks the reply that is best for them (a guard
        // only when someone throws after them).
        let best = -Infinity;
        for (const o of OPTIONS)
          if (o.kind !== 'guard' || ctx.next.length > 1) {
            const v = evaluate(
              {
                board: ctx.board,
                bags,
                me: reply,
                next: [],
                rivals: [ctx.me.id],
                clutchNow: ctx.next.length === 1,
              },
              o,
              1,
            );
            if (v > best) best = v;
          }
        // best is reply's (their gain − mine); flip into my frame.
        outcome = -best;
      } else
        outcome =
          total(bags, ctx.me.id) -
          Math.max(0, ...ctx.rivals.map((r) => total(bags, r)));
      value += w * outcome;
    }
  return value;
}

export function plan(ctx: PlanContext, options = OPTIONS): Evaluation[] {
  return options
    .map((option) => ({ option, value: evaluate(ctx, option) }))
    .sort((a, b) => b.value - a.value);
}
