// Small raster toolkit for the re-cut: masks are Uint8Array(width * height)
// with 0/1 values, images are { width, height, data: Uint8ClampedArray RGBA }.
// Nothing here knows about characters.

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const luminance = (d, o) =>
  0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];

export function count(mask) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}
export const union = (a, b) => a.map((v, i) => v | b[i]);
export const intersect = (a, b) => a.map((v, i) => v & b[i]);
export const subtract = (a, b) => a.map((v, i) => v & (b[i] ^ 1));

export function bounds(mask, width) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1;
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) {
      const x = i % width,
        y = (i / width) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return { x0, y0, x1, y1 };
}

/** Exact Euclidean distance (px) from every pixel to the nearest set pixel. */
export function distanceTo(mask, width, height) {
  const INF = 1e12,
    size = Math.max(width, height),
    f = new Float64Array(size),
    d = new Float64Array(size),
    v = new Int32Array(size),
    z = new Float64Array(size + 1),
    out = new Float64Array(width * height);
  const pass = (n) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      do {
        const p = v[k];
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
      } while (s <= z[k] && --k >= 0);
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const p = v[k];
      d[q] = (q - p) * (q - p) + f[p];
    }
  };
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = mask[y * width + x] ? 0 : INF;
    pass(height);
    for (let y = 0; y < height; y++) out[y * width + x] = d[y];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = out[y * width + x];
    pass(width);
    for (let x = 0; x < width; x++) out[y * width + x] = Math.sqrt(d[x]);
  }
  return out;
}

export function dilate(mask, width, height, radius) {
  const dist = distanceTo(mask, width, height);
  return mask.map((_, i) => (dist[i] <= radius ? 1 : 0));
}
export function erode(mask, width, height, radius) {
  const dist = distanceTo(
    mask.map((v) => v ^ 1),
    width,
    height,
  );
  return mask.map((_, i) => (dist[i] > radius ? 1 : 0));
}
export const close = (mask, width, height, radius) =>
  erode(dilate(mask, width, height, radius), width, height, radius);

/** 4-connected flood through `allowed` from seed pixels [[x, y], ...]. */
export function flood(allowed, width, height, seeds) {
  const out = new Uint8Array(width * height),
    stack = [];
  for (const [sx, sy] of seeds) {
    const x = Math.round(sx),
      y = Math.round(sy);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const i = y * width + x;
    if (allowed[i] && !out[i]) {
      out[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length) {
    const i = stack.pop(),
      x = i % width;
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < width - 1 ? i + 1 : -1,
      i - width,
      i + width,
    ])
      if (j >= 0 && j < out.length && allowed[j] && !out[j]) {
        out[j] = 1;
        stack.push(j);
      }
  }
  return out;
}

/** Nearest allowed pixel to a point, searched in growing squares. */
export function nearestSet(mask, width, height, [px, py], limit = 40) {
  const cx = Math.round(px),
    cy = Math.round(py);
  let best = null,
    bestD = Infinity;
  for (let r = 0; r <= limit && best === null; r++)
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (!mask[y * width + x]) continue;
        const d = (x - px) ** 2 + (y - py) ** 2;
        if (d < bestD) {
          bestD = d;
          best = [x, y];
        }
      }
  return best;
}

export function polygonMask(points, width, height) {
  const out = new Uint8Array(width * height);
  const ys = points.map((p) => p[1]),
    y0 = Math.max(0, Math.floor(Math.min(...ys))),
    y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i],
        [bx, by] = points[(i + 1) % points.length];
      if (ay <= y !== by <= y) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (
        let x = Math.max(0, Math.ceil(xs[k]));
        x <= Math.min(width - 1, Math.floor(xs[k + 1]));
        x++
      )
        out[y * width + x] = 1;
  }
  return out;
}

/** Distance from p to segment a-b, and the clamped parameter along it. */
export function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    t = Math.min(
      1,
      Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
    );
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Median RGB of the masked pixels inside a disc. */
export function medianColour(image, mask, [cx, cy], radius) {
  const channels = [[], [], []];
  for (let y = Math.round(cy - radius); y <= cy + radius; y++)
    for (let x = Math.round(cx - radius); x <= cx + radius; x++) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
      const i = y * image.width + x;
      if (mask && !mask[i]) continue;
      for (let c = 0; c < 3; c++) channels[c].push(image.data[i * 4 + c]);
    }
  return channels.map((list) => {
    list.sort((a, b) => a - b);
    return list.length ? list[list.length >> 1] : 0;
  });
}

/** Bilinear RGBA sample (premultiplied) of an image; returns [r,g,b,a] 0..255. */
export function sample(image, x, y, out = [0, 0, 0, 0]) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    fx = x - x0,
    fy = y - y0;
  let r = 0,
    g = 0,
    b = 0,
    a = 0;
  for (let k = 0; k < 4; k++) {
    const xx = x0 + (k & 1),
      yy = y0 + (k >> 1);
    if (xx < 0 || yy < 0 || xx >= image.width || yy >= image.height) continue;
    const w = (k & 1 ? fx : 1 - fx) * (k >> 1 ? fy : 1 - fy),
      o = (yy * image.width + xx) * 4,
      alpha = (image.data[o + 3] / 255) * w;
    r += image.data[o] * alpha;
    g += image.data[o + 1] * alpha;
    b += image.data[o + 2] * alpha;
    a += alpha;
  }
  out[0] = a ? r / a : 0;
  out[1] = a ? g / a : 0;
  out[2] = a ? b / a : 0;
  out[3] = a * 255;
  return out;
}

export function blankImage(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** Copy the masked pixels of `source` into a new transparent image. */
export function cutout(source, mask) {
  const out = blankImage(source.width, source.height);
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) for (let c = 0; c < 4; c++) out.data[i * 4 + c] = source.data[i * 4 + c];
  return out;
}

export const alphaMask = (image, threshold = 1) => {
  const out = new Uint8Array(image.width * image.height);
  for (let i = 0; i < out.length; i++)
    out[i] = image.data[i * 4 + 3] >= threshold ? 1 : 0;
  return out;
};

/** Source-over composite of `top` onto `base` in place (straight alpha). */
export function compositeOver(base, top) {
  const b = base.data,
    t = top.data;
  for (let o = 0; o < b.length; o += 4) {
    const ta = t[o + 3] / 255;
    if (!ta) continue;
    const ba = b[o + 3] / 255,
      a = ta + ba * (1 - ta);
    for (let c = 0; c < 3; c++)
      b[o + c] = (t[o + c] * ta + b[o + c] * ba * (1 - ta)) / a;
    b[o + 3] = a * 255;
  }
}

/** Extend RGB outward into fully transparent texels (alpha stays 0) so
 * bilinear filtering never pulls in a foreign colour at an island edge. */
export function bleed(image, passes) {
  const { width, height, data } = image;
  let known = alphaMask(image);
  for (let pass = 0; pass < passes; pass++) {
    const next = known.slice();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (known[i]) continue;
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
            const j = yy * width + xx;
            if (!known[j]) continue;
            r += data[j * 4];
            g += data[j * 4 + 1];
            b += data[j * 4 + 2];
            n++;
          }
        if (!n) continue;
        data[i * 4] = r / n;
        data[i * 4 + 1] = g / n;
        data[i * 4 + 2] = b / n;
        next[i] = 1;
      }
    known = next;
  }
}
