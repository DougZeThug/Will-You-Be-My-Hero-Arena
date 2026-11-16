/** True for a magenta chroma-key pixel (the puppet atlas key colour [255,0,255]). Pure. */
export function isKeyPixel(r: number, g: number, b: number): boolean {
  return r > 110 && b > 100 && g < Math.min(r, b) * 0.7;
}
