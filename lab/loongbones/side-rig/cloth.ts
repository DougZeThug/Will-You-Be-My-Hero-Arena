import { smooth } from '../authoring/weighted-mesh';
import type { Vec } from '../authoring/skeleton';

/** Reuse the existing side-panel fabric for the body hidden under the sleeve.
 * Register its rear edge to the original body's silhouette, so exposing it
 * cannot create a stepped outline or add width to the character. */
export function shirtBackRegistration(
  pixels: Uint8ClampedArray,
  width: number,
) {
  const edges = new Map<number, number>();
  const rearEdge = (y: number) => {
    const row = Math.round(y);
    if (edges.has(row)) return edges.get(row)!;
    for (let x = 340; x < 520; x++)
      if (pixels[(row * width + x) * 4 + 3] > 0) {
        edges.set(row, x);
        return x;
      }
    throw Error(`Missing source torso contour at row ${row}`);
  };
  return (p: Vec): Vec => {
    const y = p.y - 85 * (1 - smooth(402, 505, p.y));
    const shift = rearEdge(y) - rearEdge(p.y);
    return { x: p.x + shift * (1 - smooth(480, 545, p.x)), y };
  };
}
