import type { V3 } from '../../../model';
import type { ShotStyle } from '../../animation/AnimationTypes';
import type { BagOutcome } from './CornholePhysics';
export interface BoardBag {
  id: string;
  position: V3;
  score: number;
}
export interface BagInteraction {
  id: string;
  from: V3;
  to: V3;
  before: number;
  after: number;
  kind: 'push' | 'drag' | 'collect' | 'kick';
}
export interface BoardResolution {
  shot: ShotStyle;
  outcome: BagOutcome;
  delta: number;
  thrownScore: number;
  bags: BoardBag[];
  interactions: BagInteraction[];
  touch?: V3;
}
export function boardValue(p: V3, lane: number) {
  if (Math.hypot(p.x - 9.2, p.z - lane) <= 0.19) return 3;
  if (p.x >= 8 && p.x <= 9.9 && Math.abs(p.z - lane) <= 0.52) return 1;
  return 0;
}
const onSurface = (p: V3, lane: number) => ({
  ...p,
  y: boardValue(p, lane) ? 0.16 + ((p.x - 8) / 1.9) * 0.34 : 0,
});
function segmentDistance(p: V3, a: V3, b: V3) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    u = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.z - a.z) * dz) /
          Math.max(0.0001, dx * dx + dz * dz),
      ),
    );
  return Math.hypot(p.x - a.x - u * dx, p.z - a.z - u * dz);
}
/** Deterministic board contact solver. Four bag arcade rules keep each lane
 * independent, but pushes/collections can change the value of earlier bags. */
export function resolveBoard(
  before: BoardBag[],
  id: string,
  target: V3,
  lane: number,
  shot: ShotStyle,
): BoardResolution {
  const bags = structuredClone(before),
    thrownScore = boardValue(target, lane),
    interactions: BagInteraction[] = [];
  let outcome: BagOutcome =
    thrownScore === 3
      ? shot === 'airmail'
        ? 'airmailHole'
        : 'cleanHole'
      : thrownScore === 1
        ? shot === 'blocker'
          ? 'blocker'
          : shot === 'roll'
            ? 'rollAround'
            : shot === 'cut'
              ? 'sideSlide'
              : 'frontSlide'
        : target.x < 8
          ? 'short'
          : target.x > 9.9
            ? 'long'
            : target.z < lane
              ? 'missLeft'
              : 'missRight';
  const start = onSurface({ x: 8.15, y: 0, z: target.z }, lane),
    colliders = bags
      .filter(
        (b) =>
          b.score === 1 &&
          segmentDistance(b.position, start, target) < 0.24 &&
          b.position.x <= target.x + 0.14,
      )
      .slice(-2);
  if (thrownScore > 0)
    for (const bag of colliders) {
      if (shot === 'roll') {
        outcome = 'rollAround';
        continue;
      }
      const collect =
        thrownScore === 3 &&
        ['airmail', 'collect', 'drag'].includes(shot) &&
        Math.hypot(bag.position.x - 9.2, bag.position.z - lane) < 0.66;
      const push = [
        'flat',
        'fast',
        'slide',
        'push',
        'cut',
        'standard',
        'clutch',
      ].includes(shot);
      if (!collect && !push) continue;
      const from = { ...bag.position },
        prior = bag.score,
        kind = collect ? 'collect' : shot === 'cut' ? 'kick' : 'push';
      const proposed = collect
        ? { x: 9.2, y: 0.4, z: lane }
        : {
            ...from,
            x: from.x + (shot === 'fast' || shot === 'push' ? 0.36 : 0.21),
            z: from.z + (shot === 'cut' ? 0.11 : 0),
          };
      bag.position = onSurface(proposed, lane);
      bag.score = boardValue(bag.position, lane);
      interactions.push({
        id: bag.id,
        from,
        to: { ...bag.position },
        before: prior,
        after: bag.score,
        kind,
      });
      outcome = collect ? 'collect' : kind === 'kick' ? 'kick' : 'push';
    }
  if (!interactions.length && thrownScore === 1) {
    if (Math.hypot(target.x - 9.2, target.z - lane) < 0.28) outcome = 'hang';
    else if (shot === 'flop') outcome = 'bounce';
    else if (colliders.length && shot !== 'roll') outcome = 'collision';
  }
  let touch: V3 | undefined;
  if (
    !thrownScore &&
    target.x >= 8 &&
    target.x <= 10.5 &&
    Math.abs(target.z - lane) < 0.85 &&
    ['roll', 'slide', 'flat', 'fast', 'cut'].includes(shot)
  ) {
    touch = onSurface(
      {
        x: Math.max(8.12, Math.min(9.72, target.x - 0.24)),
        y: 0,
        z: Math.max(
          lane - 0.4,
          Math.min(lane + 0.4, target.z * 0.55 + lane * 0.45),
        ),
      },
      lane,
    );
    outcome =
      shot === 'roll'
        ? 'rollOff'
        : Math.hypot(touch.x - 9.2, touch.z - lane) < 0.33
          ? 'lipOut'
          : 'slideOff';
  }
  bags.push({ id, position: { ...target }, score: thrownScore });
  return {
    shot,
    outcome,
    thrownScore,
    delta:
      bags.reduce((n, b) => n + b.score, 0) -
      before.reduce((n, b) => n + b.score, 0),
    bags,
    interactions,
    ...(touch ? { touch } : {}),
  };
}
