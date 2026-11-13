/** Cornhole board geometry in world units, shared by every layer that needs it. */
export const BOARD = {
  frontX: 8,
  backX: 9.9,
  holeX: 9.2,
  holeRadius: 0.19,
  laneHalfWidth: 0.52,
  length: 1.9,
  frontHeight: 0.16,
  rise: 0.34,
} as const;

/** Distance between the two players' lanes along z. */
export const LANE_SPACING = 3.5;

/** Lane centre z for an actor. */
export const laneZ = (actor: number) => actor * LANE_SPACING;

/** Height of the board surface at world x. */
export const boardSurfaceY = (x: number) =>
  BOARD.frontHeight + ((x - BOARD.frontX) / BOARD.length) * BOARD.rise;

/** Drawn hole opening half-extents in screen px at depth scale 1: the dark
 * interior of board-finish-v2 (240 x 104 source px) at the board's scale. */
export const HOLE_HALF = { x: 20, y: 8.3 };

/** Is screen point p inside the drawn hole opening ellipse centred on c? */
export function overHoleOpening(
  p: { x: number; y: number },
  c: { x: number; y: number },
  s: number,
) {
  return (
    ((p.x - c.x) / (HOLE_HALF.x * s)) ** 2 +
      ((p.y - c.y) / (HOLE_HALF.y * s)) ** 2 <
    1
  );
}
