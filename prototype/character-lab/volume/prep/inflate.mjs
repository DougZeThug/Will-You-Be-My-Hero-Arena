// Raster helpers for "drawing on volume": nearest-feature maps, the union-of-balls
// inflation of a silhouette, derived fills. Masks are Uint8Array(W * H) of 0/1.
import { distanceTo } from '../../../motion/prep/raster.mjs';

/** Distance (px) from every set pixel to the nearest unset one (0 outside). */
export function insideDistance(mask, W, H) {
  const inverse = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) inverse[i] = mask[i] ^ 1;
  // A figure touching the image edge would have no outside there: pad by treating the frame as outside.
  const d = distanceTo(inverse, W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i]) d[i] = Math.min(d[i], x + 1, y + 1, W - x, H - y);
    }
  return d;
}

/**
 * Index of the nearest set pixel for every pixel (two-pass vector propagation,
 * 8 neighbours; a few percent off the exact Euclidean answer far from the set,
 * which is fine for fills). -1 where the set is empty.
 */
export function nearestMap(mask, W, H) {
  const N = W * H,
    near = new Int32Array(N).fill(-1),
    dist = new Float64Array(N).fill(Infinity);
  for (let i = 0; i < N; i++)
    if (mask[i]) {
      near[i] = i;
      dist[i] = 0;
    }
  const relax = (i, x, y, j) => {
    const n = near[j];
    if (n < 0) return;
    const dx = (n % W) - x,
      dy = ((n / W) | 0) - y,
      d = dx * dx + dy * dy;
    if (d < dist[i]) {
      dist[i] = d;
      near[i] = n;
    }
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (x > 0) relax(i, x, y, i - 1);
        if (y > 0) {
          relax(i, x, y, i - W);
          if (x > 0) relax(i, x, y, i - W - 1);
          if (x < W - 1) relax(i, x, y, i - W + 1);
        }
      }
    for (let y = H - 1; y >= 0; y--)
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        if (x < W - 1) relax(i, x, y, i + 1);
        if (y < H - 1) {
          relax(i, x, y, i + W);
          if (x < W - 1) relax(i, x, y, i + W + 1);
          if (x > 0) relax(i, x, y, i + W - 1);
        }
      }
  }
  return near;
}

/**
 * Union-of-balls inflation: every pixel of the mask is the centre of the largest
 * disc that fits inside the silhouette; the solid is the union of the spheres on
 * those discs. Returns the half-thickness (px) at every pixel: round
 * cross-sections for anything tube-like, rounded caps at open ends, no bones
 * needed. Computed on a 1/`cell` grid and bilinearly upsampled.
 */
export function ballUnion(mask, W, H, cell = 3) {
  const dt = insideDistance(mask, W, H),
    w = Math.ceil(W / cell),
    h = Math.ceil(H / cell),
    r = new Float32Array(w * h),
    best = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(W - 1, x * cell + (cell >> 1)),
        sy = Math.min(H - 1, y * cell + (cell >> 1));
      r[y * w + x] = dt[sy * W + sx] / cell;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        radius = r[i];
      if (radius <= 0) continue;
      // Only ridge cells matter: a disc that is not locally maximal lies inside a neighbour's.
      let ridge = true;
      for (let dy = -1; dy <= 1 && ridge; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if (r[yy * w + xx] > radius + 0.72) ridge = false;
        }
      if (!ridge) continue;
      const reach = Math.ceil(radius),
        r2 = radius * radius;
      for (let dy = -reach; dy <= reach; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -reach; dx <= reach; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const v = r2 - dx * dx - dy * dy;
          if (v > best[yy * w + xx]) best[yy * w + xx] = v;
        }
      }
    }
  for (let i = 0; i < best.length; i++) best[i] = Math.sqrt(best[i]) * cell;
  // Light smoothing of the creases between neighbouring balls.
  const smooth = new Float32Array(best.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0,
        n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          sum += best[yy * w + xx];
          n++;
        }
      smooth[y * w + x] = sum / n;
    }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      const fx = Math.max(0, Math.min(w - 1.001, (x - (cell >> 1)) / cell)),
        fy = Math.max(0, Math.min(h - 1.001, (y - (cell >> 1)) / cell)),
        x0 = Math.floor(fx),
        y0 = Math.floor(fy),
        tx = fx - x0,
        ty = fy - y0,
        a = smooth[y0 * w + x0],
        b = smooth[y0 * w + Math.min(w - 1, x0 + 1)],
        c = smooth[Math.min(h - 1, y0 + 1) * w + x0],
        d = smooth[Math.min(h - 1, y0 + 1) * w + Math.min(w - 1, x0 + 1)],
        value = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
      // Never thicker than a sphere on the true edge distance allows right at the rim.
      out[i] = Math.min(value, Math.sqrt(dt[i] * (2 * Math.max(value, dt[i]) - dt[i])) + 0.5);
    }
  return { thickness: out, distance: dt };
}

/**
 * DERIVED fill: colours for `hidden` pixels (part of a volume's silhouette that
 * the drawing does not show) from the part's own drawn pixels, by reflecting
 * about the nearest drawn pixel with a triangle wave (so a pattern continues
 * instead of streaking). `drawn` should already exclude the outline band.
 */
export function reflectFill(image, drawn, hidden, W, H, amplitude = 26) {
  const near = nearestMap(drawn, W, H),
    { data } = image;
  let count = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!hidden[i]) continue;
      const n = near[i];
      if (n < 0) continue;
      const nx = n % W,
        ny = (n / W) | 0,
        d = Math.hypot(nx - x, ny - y),
        t = d % (2 * amplitude),
        back = t < amplitude ? t : 2 * amplitude - t;
      let sx = nx,
        sy = ny;
      if (d > 0) {
        sx = Math.round(nx + ((nx - x) / d) * back);
        sy = Math.round(ny + ((ny - y) / d) * back);
      }
      let j = sy * W + sx;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H || !drawn[j]) j = n;
      data[i * 4] = data[j * 4];
      data[i * 4 + 1] = data[j * 4 + 1];
      data[i * 4 + 2] = data[j * 4 + 2];
      data[i * 4 + 3] = 255;
      count++;
    }
  return count;
}

/** Closest point on a polyline: { d, t (0..segments), point }. */
export function nearestOnChain(chain, x, y) {
  let best = Infinity,
    out = { d: Infinity, t: 0, point: chain[0] };
  for (let k = 0; k + 1 < chain.length; k++) {
    const a = chain[k],
      b = chain[k + 1],
      abx = b[0] - a[0],
      aby = b[1] - a[1],
      l2 = abx * abx + aby * aby || 1,
      u = Math.min(1, Math.max(0, ((x - a[0]) * abx + (y - a[1]) * aby) / l2)),
      px = a[0] + abx * u,
      py = a[1] + aby * u,
      d = Math.hypot(x - px, y - py);
    if (d < best) {
      best = d;
      out = { d, t: k + u, point: [px, py] };
    }
  }
  return out;
}
