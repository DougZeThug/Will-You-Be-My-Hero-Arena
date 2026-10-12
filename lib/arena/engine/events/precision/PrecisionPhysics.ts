import {
  placement,
  artPoint,
  boardDepthScale,
  BAG_FLIGHT_FLATTEN,
} from '../../../equipment-layout';
import { EQUIPMENT_ART } from '../../../equipment-art';
import type { Vector } from '../../input/InputActions';
export interface PrecisionBag {
  id: string;
  owner: string;
  x: number;
  y: number;
  points: number;
  angle: number;
}
export interface PrecisionFlight {
  id: string;
  owner: string;
  origin: Vector;
  target: Vector;
  age: number;
  duration: number;
  arc: number;
  spin: number;
}
export const precisionTarget = () => placement('cornhole', 0).anchor;
export function flightPosition(f: PrecisionFlight) {
  const t = Math.max(0, Math.min(1, f.age / f.duration));
  return {
    x: f.origin.x + (f.target.x - f.origin.x) * t,
    y:
      f.origin.y +
      (f.target.y - f.origin.y) * t -
      Math.sin(Math.PI * t) * f.arc,
    angle: Math.abs(f.spin)>3 ? t*f.spin : Math.sin(t*f.spin*6)*.075,
    flatten: BAG_FLIGHT_FLATTEN + (Math.abs(f.spin)>3 ? .24*Math.abs(Math.sin(t*f.spin)) : .025*Math.sin(t*8)),
  };
}
function onBoard(p: Vector) {
  const polygon = EQUIPMENT_ART.board.plane.map((v) =>
    artPoint('cornhole', 0, v),
  );
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
  return inside;
}
/**
 * The drawn hole opening's half-extents in stage px at depth scale 1. This is
 * the same ellipse as HOLE_HALF in cornhole/ReleasedBagPhysics.ts, kept as a
 * copy so Play does not import the Watch physics; a test asserts they match.
 */
export const HOLE_HALF = { x: 20, y: 8.3 };
/** Is the point over the drawn hole opening (an ellipse around the target)? */
function overHole(p: Vector) {
  const t = precisionTarget(),
    s = boardDepthScale(0);
  return (
    ((p.x - t.x) / (HOLE_HALF.x * s)) ** 2 +
      ((p.y - t.y) / (HOLE_HALF.y * s)) ** 2 <
    1
  );
}
export function bagPoints(p: Vector) {
  return overHole(p)
    ? 3
    : onBoard(p)
      ? 1
      : 0;
}
export function resolvePrecisionLanding(
  f: PrecisionFlight,
  bags: PrecisionBag[],
  shot: string,
) {
  const landed: PrecisionBag = {
    id: f.id,
    owner: f.owner,
    ...f.target,
    angle: shot === 'roll' ? -0.2 : 0.08,
    points: bagPoints(f.target),
  };
  let rolledAround = false;
  if (landed.points === 1)
    for (const old of bags) {
      if (
        old.points !== 1 ||
        Math.hypot(old.x - landed.x, old.y - landed.y) > 26
      )
        continue;
      const target = precisionTarget(),
        d = Math.max(1, Math.hypot(target.x - old.x, target.y - old.y)),
        push = shot === 'airmail' ? 18 : shot === 'slide' ? 24 : 12;
      old.x += ((target.x - old.x) / d) * push;
      old.y += ((target.y - old.y) / d) * push;
      old.points = bagPoints(old);
      if (shot === 'roll') rolledAround = true;
    }
  // A roll curls around the bags it meets once, however many there are.
  if (rolledAround) {
    landed.y += 16;
    landed.points = bagPoints(landed);
  }
  bags.push(landed);
  return landed;
}
