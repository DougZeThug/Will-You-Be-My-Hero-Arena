import { type Sport, type V3 } from './model';
import { boardSurfaceY, laneZ } from './board-geometry';
import { EQUIPMENT_ART as ART, type XY, type Quad } from './equipment-art';
import { SPORT_STAGE, EQUIPMENT_GROUND, laneGroundY } from './sport-stage';

// Pure layout geometry intentionally has no simulation/timeline dependency.
// Match timing imports surfacePoint while simulation imports match timing.
export const BAG_FLIGHT_FLATTEN = SPORT_STAGE.cornhole.projectile.flatten;
/** A bag lying on the board (and the pose a bag eases into on landing). */
export const BAG_REST_FLATTEN = 0.52;
export const boardDepthScale = (actor: number) => (actor === 1 ? 0.7 : 1);
export const equipmentDepthScale = (sport: Sport, actor: number) =>
  sport === 'cornhole' ? boardDepthScale(actor) : actor === 1 ? 0.78 : 1;
export function quadPoint(q: Quad, u: number, v: number): XY {
  return {
    x:
      (1 - v) * ((1 - u) * q[0].x + u * q[1].x) +
      v * ((1 - u) * q[3].x + u * q[2].x),
    y:
      (1 - v) * ((1 - u) * q[0].y + u * q[1].y) +
      v * ((1 - u) * q[3].y + u * q[2].y),
  };
}
function inverseQuad(q: Quad, p: XY) {
  let u = 0.65,
    v = 0.5;
  for (let i = 0; i < 12; i++) {
    const a = quadPoint(q, u, v),
      du = quadPoint(q, u + 1e-4, v),
      dv = quadPoint(q, u, v + 1e-4),
      ax = (du.x - a.x) / 1e-4,
      ay = (du.y - a.y) / 1e-4,
      bx = (dv.x - a.x) / 1e-4,
      by = (dv.y - a.y) / 1e-4,
      det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-6) break;
    u += ((p.x - a.x) * by - (p.y - a.y) * bx) / det;
    v += (ax * (p.y - a.y) - ay * (p.x - a.x)) / det;
  }
  return { u, v };
}
const holeUV = inverseQuad(ART.board.plane, ART.board.hole);
function register(n: number, source: number, dest: number) {
  return n < source
    ? (n / source) * dest
    : dest + ((n - source) / (1 - source)) * (1 - dest);
}
export function placement(
  sport: Sport,
  actor: number,
): {
  name: keyof typeof EQUIPMENT_GROUND;
  scale: number;
  x: number;
  y: number;
  anchor: XY;
} {
  const stage = SPORT_STAGE[sport],
    name = stage.equipment;
  const art = ART[name];
  const scale =
    (stage.size.px / art[stage.size.axis]) * equipmentDepthScale(sport, actor);
  const anchor =
    'plane' in stage.anchor
      ? quadPoint(stage.anchor.plane, stage.anchor.u, stage.anchor.v)
      : stage.anchor;
  const ground = laneGroundY(actor),
    sourceGround = EQUIPMENT_GROUND[name];
  const destination = {
    x: stage.anchorX.origin + actor * stage.anchorX.perActor,
    y: ground - (sourceGround - anchor.y) * scale,
  };
  return {
    name,
    scale,
    x: destination.x - anchor.x * scale,
    y: destination.y - anchor.y * scale,
    anchor: destination,
  };
}
export function artPoint(sport: Sport, actor: number, p: XY) {
  const a = placement(sport, actor);
  return { x: a.x + p.x * a.scale, y: a.y + p.y * a.scale };
}
export function surfacePoint(sport: Sport, actor: number, p: V3): XY {
  const lane = laneZ(actor),
    a = placement(sport, actor),
    dz = p.z - lane,
    s = SPORT_STAGE[sport].surface;
  if (s.kind === 'board') {
    const u = register((p.x - s.x0) / s.xSpan, s.xHole / s.xSpan, holeUV.u),
      v = register((dz + s.zOffset) / s.zSpan, s.zHole, holeUV.v),
      q = artPoint(sport, actor, quadPoint(ART.board.plane, u, v));
    return { x: q.x, y: q.y - (p.y - boardSurfaceY(p.x)) * s.lift };
  }
  if (s.kind === 'rings') {
    const dy = p.y - s.centerY,
      d = Math.hypot(dz, dy);
    if (d < 1e-8) return a.anchor;
    const radius = (axis: 'x' | 'y') =>
      d <= s.inner
        ? (d / s.inner) * ART.target.inner[axis]
        : d <= s.middle
          ? ART.target.inner[axis] +
            ((d - s.inner) / s.innerSpan) *
              (ART.target.middle[axis] - ART.target.inner[axis])
          : ART.target.middle[axis] +
            ((d - s.middle) / s.outerSpan) *
              (ART.target.outer[axis] - ART.target.middle[axis]);
    return {
      x: a.anchor.x + (dz / d) * radius('x') * a.scale,
      y: a.anchor.y - (dy / d) * radius('y') * a.scale,
    };
  }
  if (s.kind === 'table') {
    const q = artPoint(
      sport,
      actor,
      quadPoint(
        ART.table.plane,
        (p.x - s.x0) / s.xSpan,
        (dz + s.zOffset) / s.zSpan,
      ),
    );
    return { x: q.x, y: q.y - (p.y - s.y0) * s.lift };
  }
  return {
    x: a.anchor.x + (p.x - s.x0) * s.xScale + dz * s.zToX,
    y: a.anchor.y - dz * s.zToY - (p.y - s.y0) * s.yScale,
  };
}
