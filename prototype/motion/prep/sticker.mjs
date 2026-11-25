// The white "sticker" border baked into a whole-figure drawing. A baked border
// cannot survive posing: it stretches with the mesh and gets trapped INSIDE the
// figure wherever two layers meet (armpit, between arm and torso). So on the
// DERIVED layers it is removed here, and the renderer draws a constant-width
// border around the posed figure's union silhouette instead (see
// character-lab/views/outline.ts). The source PNG is only read.
//
// The ring is everything light and colourless that can be reached from outside
// the figure without crossing the dark ink outline, plus enclosed pockets of
// the same white named by hand (`seeds`). Ink pixels that were anti-aliased
// against the ring are un-mixed (ink colour, partial alpha).
import { luminance } from './raster.mjs';

export const STICKER = {
  solid: 8, // alpha at or above this is the figure
  light: 185, // luminance at or above this ...
  chroma: 40, // ... with at most this max-min channel spread is border white
  thin: 200, // alpha below this (the soft outer edge) always belongs to the ring
  fringe: 2, // px next to the removed ring that are un-mixed
  ink: [26, 22, 24],
  inkLuminance: 30, // un-mix: luminance of pure ink ...
  whiteLuminance: 245, // ... and of the border
};

/** @returns {{ image, ring: Uint8Array, width: number, colour: number[], removed: number }} */
export function stripSticker(sheet, { seeds = [], overrides = {} } = {}) {
  const T = { ...STICKER, ...overrides },
    { width: W, height: H, data } = sheet,
    N = W * H,
    solid = new Uint8Array(N),
    light = new Uint8Array(N),
    depth = new Int32Array(N).fill(-1),
    queue = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const o = i * 4,
      a = data[o + 3];
    solid[i] = a >= T.solid ? 1 : 0;
    const chroma = Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]);
    light[i] = solid[i] && ((luminance(data, o) >= T.light && chroma <= T.chroma) || a < T.thin) ? 1 : 0;
  }
  let head = 0,
    tail = 0;
  for (let i = 0; i < N; i++)
    if (!solid[i]) {
      depth[i] = 0;
      queue[tail++] = i;
    }
  // Hand-named enclosed pockets start at depth 1.
  for (const [x, y] of seeds) {
    const i = Math.round(y) * W + Math.round(x);
    if (light[i] && depth[i] < 0) {
      depth[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++],
      x = i % W,
      d = depth[i];
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= N || depth[j] >= 0 || !light[j]) continue;
      depth[j] = d + 1;
      queue[tail++] = j;
    }
  }
  const ring = new Uint8Array(N),
    histogram = new Int32Array(64),
    channels = [[], [], []];
  let removed = 0;
  for (let i = 0; i < N; i++) {
    if (depth[i] <= 0) continue;
    ring[i] = 1;
    removed++;
    if (depth[i] < 64) histogram[depth[i]]++;
    if (depth[i] > 3 && depth[i] < 10 && data[i * 4 + 3] > 250 && i % 7 === 0) for (let c = 0; c < 3; c++) channels[c].push(data[i * 4 + c]);
  }
  // Border width: the depth where the ring's population falls to half of its plateau.
  const plateau = (histogram[3] + histogram[4] + histogram[5] + histogram[6]) / 4;
  let width = 6;
  while (width < 63 && histogram[width + 1] > plateau / 2) width++;
  const colour = channels.map((list) => list.sort((a, b) => a - b)[list.length >> 1] ?? 245),
    image = { width: W, height: H, data: Uint8ClampedArray.from(data) },
    out = image.data;
  for (let i = 0; i < N; i++) if (ring[i]) out[i * 4 + 3] = 0;
  // Un-mix the ink's anti-aliased edge against the removed ring.
  const F = T.fringe;
  for (let y = F; y < H - F; y++)
    for (let x = F; x < W - F; x++) {
      const i = y * W + x;
      if (ring[i] || !solid[i]) continue;
      let near = false;
      for (let dy = -F; dy <= F && !near; dy++) for (let dx = -F; dx <= F; dx++) if (ring[i + dy * W + dx]) near = true;
      if (!near) continue;
      const o = i * 4,
        chroma = Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]);
      if (chroma > T.chroma) continue;
      const t = Math.min(1, Math.max(0, (luminance(data, o) - T.inkLuminance) / (T.whiteLuminance - T.inkLuminance)));
      if (t < 0.12) continue;
      out[o] = T.ink[0];
      out[o + 1] = T.ink[1];
      out[o + 2] = T.ink[2];
      out[o + 3] = Math.round(data[o + 3] * (1 - t));
    }
  return { image, ring, width, colour, removed };
}
