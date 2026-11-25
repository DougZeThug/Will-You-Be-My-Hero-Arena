// "Drawing on volume" prep: wraps ONE drawing onto a low inflated 3D body.
//   node --import ./prototype/character-lab/core/ts-loader.mjs prototype/character-lab/volume/prep/build.mjs [doug] [volume]
// Reads (never writes) the source drawing and characters/<id>.json. Writes
//   rigs/<id>/<volume>/atlas.png        DERIVED texture: the drawing with the baked sticker
//                                       border and silhouette ink removed, plus derived fills
//   rigs/<id>/<volume>/mesh.bin         front + back sheets of every part, bind pose (world)
//   rigs/<id>/<volume>/rig.json         bind joints, bones, part table, provenance
//   rigs/<id>/<volume>/proportions.json Proportions measured from this drawing (three-quarter only)
// and review images under work/qa/character-lab/shot/prep/. Deterministic.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from '../../../motion/prep/png.mjs';
import { blankImage, bounds, flood, luminance } from '../../../motion/prep/raster.mjs';
import { stripSticker } from '../../../motion/prep/sticker.mjs';
import { fitBind } from './fit.mjs';
import { ballUnion, insideDistance, nearestMap, nearestOnChain, reflectFill } from './inflate.mjs';
import { VIEWS } from './views.mjs';

const here = dirname(fileURLToPath(import.meta.url)),
  repository = resolve(here, '../../../..'),
  id = process.argv[2] ?? 'doug',
  volumeName = process.argv[3] ?? 'volume',
  character = JSON.parse(readFileSync(resolve(repository, `prototype/character-lab/characters/${id}.json`), 'utf8')),
  view = VIEWS[volumeName](character, repository),
  out = resolve(repository, `prototype/character-lab/rigs/${id}/${volumeName}`),
  review = resolve(repository, 'work/qa/character-lab/shot/prep', volumeName),
  ATLAS = 2048,
  INK_LUMINANCE = 70,
  INK_BAND = 9,
  RIM = 6; // px at the edge of a drawn part that are always replaced (they hold ink and the neighbour's colours)
mkdirSync(out, { recursive: true });
mkdirSync(review, { recursive: true });

const sheet = view.sheet,
  W = sheet.width,
  H = sheet.height,
  V = view.settings,
  J2 = view.joints,
  fit = fitBind(J2, { viewAngleDeg: view.viewAngleDeg, plan: view.plan, height: character.height, fixed: view.fixed }),
  notes = [...(view.notes ?? [])],
  idx = (x, y) => y * W + x;

// ---- 1. Parts: silhouette, drawn pixels, derived fills.
const parts = view.parts({ W, H, fit, notes });
for (const part of parts) {
  // Pinholes in a silhouette would pinch the two sheets together: close them.
  {
    const outside = new Uint8Array(W * H),
      seeds = [];
    for (let i = 0; i < W * H; i++) outside[i] = part.mask[i] ^ 1;
    for (let x = 0; x < W; x++) seeds.push([x, 0], [x, H - 1]);
    for (let y = 0; y < H; y++) seeds.push([0, y], [W - 1, y]);
    const reached = flood(outside, W, H, seeds);
    let closed = 0;
    for (let i = 0; i < W * H; i++)
      if (!part.mask[i] && !reached[i]) {
        part.mask[i] = 1;
        closed++;
      }
    if (closed) notes.push(`${part.name}: ${closed} px of pinholes in the silhouette closed`);
  }
  // Baked ink at the edge of what the drawing shows of this part -> the colour just inside it.
  const dOwned = insideDistance(part.owned, W, H),
    deep = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) deep[i] = part.owned[i] && dOwned[i] >= INK_BAND + 1 ? 1 : 0;
  const near = nearestMap(deep, W, H),
    { data } = part.image;
  let cleaned = 0;
  for (let i = 0; i < W * H; i++) {
    if (!part.owned[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    data[i * 4 + 3] = 255;
    if (near[i] < 0 || dOwned[i] >= INK_BAND || (dOwned[i] >= RIM && luminance(data, i * 4) >= INK_LUMINANCE)) continue;
    for (let c = 0; c < 3; c++) data[i * 4 + c] = data[near[i] * 4 + c];
    cleaned++;
  }
  // Derived: the part of this volume's silhouette that the drawing hides.
  const hidden = new Uint8Array(W * H),
    drawn = new Uint8Array(W * H);
  let hiddenCount = 0;
  for (let i = 0; i < W * H; i++) {
    hidden[i] = part.mask[i] && !part.owned[i] ? 1 : 0;
    hiddenCount += hidden[i];
    drawn[i] = part.owned[i] && dOwned[i] >= 4 ? 1 : 0;
  }
  const filled = hiddenCount ? reflectFill(part.image, drawn, hidden, W, H, part.fillAmplitude ?? 26) : 0;
  if (part.fill) part.fill(part.image, hidden);
  notes.push(`${part.name}: ${cleaned} px of baked outline ink recoloured from just inside it; ${filled} px DERIVED (hidden in the drawing, reflected from this part's own drawn pixels)`);
  part.derivedPx = filled;
}

// ---- 2. Inflate: half-thickness and centre depth per pixel (source px; depth + = toward the viewer).
for (const part of parts) {
  const { thickness } = ballUnion(part.mask, W, H, 3);
  part.front = new Float32Array(W * H);
  part.back = new Float32Array(W * H);
  part.centreDepth = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (!part.mask[i]) continue;
      const c = part.centre(x, y),
        h = thickness[i] * part.flatten(x, y);
      part.centreDepth[i] = c;
      part.front[i] = c + h;
      part.back[i] = c - h;
    }
}
// The drawing is the truth for what is in front at the bind pose: where a part the
// drawing hides would come out in front of the part it shows, it is pressed back.
{
  const EPS = 2;
  let pressed = 0,
    worst = 0;
  for (let i = 0; i < W * H; i++) {
    let ownerFront = -Infinity;
    for (const part of parts) if (part.owned[i]) ownerFront = Math.max(ownerFront, part.front[i]);
    if (ownerFront === -Infinity) continue;
    for (const part of parts) {
      if (!part.mask[i] || part.owned[i]) continue;
      const over = part.front[i] - (ownerFront - EPS);
      if (over <= 0) continue;
      pressed++;
      worst = Math.max(worst, over);
      part.front[i] = ownerFront - EPS;
      part.back[i] = Math.min(part.back[i], part.front[i]);
      part.centreDepth[i] = Math.min(part.centreDepth[i], part.front[i]);
    }
  }
  notes.push(`bind depth order: ${pressed} px of hidden surface pressed behind the drawn part (worst ${(worst / fit.ppm).toFixed(3)} m)`);
}

// ---- 3. Atlas.
const atlas = blankImage(ATLAS, ATLAS);
{
  const PAD = 40;
  let cursorX = 0,
    cursorY = 0,
    rowHeight = 0;
  for (const part of [...parts].sort((a, b) => bounds(b.mask, W).y1 - bounds(b.mask, W).y0 - (bounds(a.mask, W).y1 - bounds(a.mask, W).y0))) {
    const b = bounds(part.mask, W),
      x0 = Math.max(0, b.x0 - PAD),
      y0 = Math.max(0, b.y0 - PAD),
      x1 = Math.min(W - 1, b.x1 + PAD),
      y1 = Math.min(H - 1, b.y1 + PAD),
      w = x1 - x0 + 1,
      h = y1 - y0 + 1;
    if (cursorX + w > ATLAS) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    if (cursorY + h > ATLAS) throw new Error('atlas full');
    // Crop; every texel outside the silhouette takes the nearest silhouette colour, so
    // no mip level (a wall seen edge-on samples very coarse ones) can pull in emptiness.
    const crop = blankImage(w, h),
      inCrop = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) inCrop[y * w + x] = part.mask[idx(x0 + x, y0 + y)];
    const nearest = nearestMap(inCrop, w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = nearest[y * w + x],
          i = idx(x0 + (n % w), y0 + ((n / w) | 0));
        for (let c = 0; c < 3; c++) crop.data[(y * w + x) * 4 + c] = part.image.data[i * 4 + c];
        crop.data[(y * w + x) * 4 + 3] = 255;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = ((cursorY + y) * ATLAS + cursorX + x) * 4,
          s = (y * w + x) * 4;
        atlas.data[o] = crop.data[s];
        atlas.data[o + 1] = crop.data[s + 1];
        atlas.data[o + 2] = crop.data[s + 2];
        atlas.data[o + 3] = 255;
      }
    part.atlas = { x: cursorX - x0, y: cursorY - y0 };
    cursorX += w;
    rowHeight = Math.max(rowHeight, h);
  }
  // Opaque everywhere: the mesh, not alpha, is the silhouette.
  for (let i = 0; i < ATLAS * ATLAS; i++)
    if (!atlas.data[i * 4 + 3]) {
      atlas.data[i * 4] = atlas.data[i * 4 + 1] = atlas.data[i * 4 + 2] = 128;
      atlas.data[i * 4 + 3] = 255;
    }
}

// ---- 4. Mesh: a grid over each silhouette, rim vertices snapped onto the silhouette.
const boneNames = view.bones,
  boneIndex = Object.fromEntries(boneNames.map((name, i) => [name, i])),
  chunks = [],
  partTable = [];
let byteOffset = 0;
const push = (typed) => {
  const buffer = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength),
    pad = (4 - (buffer.length % 4)) % 4,
    at = byteOffset;
  chunks.push(buffer);
  if (pad) chunks.push(Buffer.alloc(pad));
  byteOffset += buffer.length + pad;
  return at;
};
for (const part of parts) {
  const g = part.grid,
    cols = Math.floor((W - 1) / g) + 1,
    rows = Math.floor((H - 1) / g) + 1,
    inside = new Uint8Array(cols * rows),
    nearMask = nearestMap(part.mask, W, H),
    slot = new Int32Array(cols * rows).fill(-1),
    node = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) inside[r * cols + c] = part.mask[idx(c * g, r * g)];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      if (inside[k]) {
        // A grid point sitting on the silhouette itself is rim: both sheets meet there.
        const x = c * g,
          y = r * g,
          edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 || !part.mask[idx(x - 1, y)] || !part.mask[idx(x + 1, y)] || !part.mask[idx(x, y - 1)] || !part.mask[idx(x, y + 1)];
        slot[k] = node.length;
        node.push({ x, y, rim: edge });
        continue;
      }
      let touches = false;
      for (let dr = -1; dr <= 1 && !touches; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr,
            cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < rows && cc < cols && inside[rr * cols + cc]) touches = true;
        }
      if (!touches) continue;
      const n = nearMask[idx(c * g, r * g)];
      slot[k] = node.length;
      node.push({ x: n % W, y: (n / W) | 0, rim: true });
    }
  if (process.env.VOLUME_DEBUG) {
    // Nodes whose half-thickness is far from all of their grid neighbours'.
    const half = (n) => (n.rim ? 0 : (part.front[idx(n.x, n.y)] - part.back[idx(n.x, n.y)]) / 2);
    let shown = 0;
    for (let r = 1; r + 1 < rows; r++)
      for (let c = 1; c + 1 < cols; c++) {
        const k = slot[r * cols + c];
        if (k < 0) continue;
        const around = [slot[r * cols + c - 1], slot[r * cols + c + 1], slot[(r - 1) * cols + c], slot[(r + 1) * cols + c]].filter((q) => q >= 0).map((q) => half(node[q])),
          h = half(node[k]);
        if (around.length && (h > Math.max(...around) + 12 || h < Math.min(...around) - 12) && shown++ < 12) console.log(part.name, 'outlier', node[k], h.toFixed(1), around.map((v) => v.toFixed(1)).join(' '), 'mid', part.centreDepth[idx(node[k].x, node[k].y)].toFixed(1), 'front', part.front[idx(node[k].x, node[k].y)].toFixed(1));
      }
    console.log(part.name, 'outliers', shown);
  }
  const count = node.length * 2,
    positions = new Float32Array(count * 3),
    uvs = new Float32Array(count * 2),
    weights = new Float32Array(count * 4),
    bones = new Uint8Array(count * 4),
    indices = [];
  if (count > 65535) throw new Error(`${part.name}: ${count} vertices, raise its grid`);
  node.forEach((n, k) => {
    const i = idx(n.x, n.y),
      mid = part.centreDepth[i],
      front = n.rim ? Math.min(mid, part.front[i]) : part.front[i],
      back = n.rim ? front : part.back[i],
      w = Object.entries(part.weights(n.x, n.y)).filter(([, v]) => v > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4),
      sum = w.reduce((s, e) => s + e[1], 0) || 1;
    for (const [sheetIndex, depth] of [[0, front], [1, back]]) {
      const v = k * 2 + sheetIndex,
        p = fit.toWorld(n.x, n.y, depth);
      positions.set([p.x, p.y, p.z], v * 3);
      uvs.set([(n.x + part.atlas.x + 0.5) / ATLAS, (n.y + part.atlas.y + 0.5) / ATLAS], v * 2);
      w.forEach(([name, value], q) => {
        if (!(name in boneIndex)) throw new Error(`${part.name}: unknown bone ${name}`);
        bones[v * 4 + q] = boneIndex[name];
        weights[v * 4 + q] = value / sum;
      });
    }
  });
  for (let r = 0; r + 1 < rows; r++)
    for (let c = 0; c + 1 < cols; c++) {
      const a = slot[r * cols + c],
        b = slot[r * cols + c + 1],
        d = slot[(r + 1) * cols + c],
        e = slot[(r + 1) * cols + c + 1];
      if (a < 0 || b < 0 || d < 0 || e < 0) continue;
      if (!inside[r * cols + c] && !inside[r * cols + c + 1] && !inside[(r + 1) * cols + c] && !inside[(r + 1) * cols + c + 1]) continue;
      // A triangle that is a sliver in the drawing can still be a real wall in depth:
      // only drop it when two of its corners are the same point.
      const same = (p, q) => node[p].x === node[q].x && node[p].y === node[q].y;
      for (const [p, q, s] of [[a, b, e], [a, e, d]]) {
        if (same(p, q) || same(q, s) || same(p, s)) continue;
        indices.push(p * 2, q * 2, s * 2, p * 2 + 1, s * 2 + 1, q * 2 + 1);
      }
    }
  const index16 = Uint16Array.from(indices);
  partTable.push({
    name: part.name,
    id: part.id,
    vertexCount: count,
    indexCount: index16.length,
    positions: push(positions),
    uvs: push(uvs),
    weights: push(weights),
    bones: push(bones),
    indices: push(index16),
    grid: g,
    derivedPx: part.derivedPx,
  });
}

// ---- 5. Write.
const round = (v, n = 5) => +v.toFixed(n),
  proportions = Object.fromEntries(Object.entries(fit.proportions ?? {}).map(([k, v]) => [k, round(v, 4)])),
  sourceHash = createHash('sha256').update(readFileSync(view.sourcePath)).digest('hex'),
  rig = {
    generator: 'prototype/character-lab/volume/prep/build.mjs@1',
    id,
    volume: volumeName,
    derived: true,
    source: { path: view.sourceRelative, sha256: sourceHash, note: 'Read only. atlas.png is DERIVED from it: baked sticker border removed, baked silhouette ink recoloured, hidden regions filled by reflection, back sheets reuse the front texture mirrored.' },
    view: { angleDeg: view.viewAngleDeg, yawDeg: round((fit.yaw * 180) / Math.PI, 3), cameraYaw: 0, cameraPitchDeg: round((fit.camera.pitch * 180) / Math.PI, 3) },
    sheet: { width: W, height: H, pelvisPx: J2.pelvis, source: view.sourceRelative },
    pxPerMetre: round(fit.ppm, 3),
    inkWidth: round(V.inkPx / fit.ppm),
    stickerWidth: round(view.sticker.width / fit.ppm),
    stickerColour: view.sticker.colour,
    inkColour: [26, 22, 24],
    atlas: { file: 'atlas.png', size: ATLAS },
    mesh: { file: 'mesh.bin', bytes: byteOffset },
    bindJoints: Object.fromEntries(Object.entries(fit.joints).map(([name, p]) => [name, [round(p.x), round(p.y), round(p.z)]])),
    bones: boneNames,
    parts: partTable,
    fit: fit.sides
      ? {
          sides: JSON.parse(JSON.stringify(fit.sides, (k, v) => (typeof v === 'number' ? round(v, 4) : v))),
          drawnSoleGap: { R: round(fit.soleGap.R, 4), L: round(fit.soleGap.L, 4) },
          pelvisDrawnHeight: round(fit.pelvisDrawn, 4),
        }
      : { partial: true },
    settings: V,
    notes,
  };
writeFileSync(resolve(out, 'atlas.png'), encodePng(atlas));
writeFileSync(resolve(out, 'mesh.bin'), Buffer.concat(chunks));
writeFileSync(resolve(out, 'rig.json'), JSON.stringify(rig, null, 1) + '\n');
if (view.writesProportions)
  writeFileSync(
    resolve(out, 'proportions.json'),
    JSON.stringify(
      {
        ...proportions,
        _extra: {
          source: view.sourceRelative,
          definitions:
            'Measured from the three-quarter drawing by volume/prep/fit.mjs: 2D landmarks (characters/<id>.json threeQuarterFront.joints with volume.threeQuarterFront.jointOverrides) + one depth prior per joint, at view angle 45 deg under core/camera project(). pelvisHeight = thigh + shin + ankleHeight (straight legs); pelvisHeight + spine + chestLen + neck + headLen = height. hand = wrist -> fingertips. Limb lengths are the mean of the two drawn sides.',
          perSide: rig.fit.sides,
        },
      },
      null,
      2,
    ) + '\n',
  );

// ---- 6. Review images.
{
  // Parts side by side (derived fills included), and the front-depth map.
  const sheetOut = blankImage(W * parts.length, H);
  parts.forEach((part, k) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = idx(x, y),
          o = (y * sheetOut.width + k * W + x) * 4;
        if (!part.mask[i]) {
          sheetOut.data.set([70, 80, 100, 255], o);
          continue;
        }
        const owned = part.owned[i];
        for (let c = 0; c < 3; c++) sheetOut.data[o + c] = part.image.data[i * 4 + c] * (owned ? 1 : 0.8) + (owned ? 0 : 50 * (c === 0 ? 1 : 0));
        sheetOut.data[o + 3] = 255;
      }
  });
  writeFileSync(resolve(review, 'parts.png'), encodePng(sheetOut));
  const depth = blankImage(W, H);
  let lo = Infinity,
    hi = -Infinity;
  const front = new Float32Array(W * H).fill(NaN);
  for (let i = 0; i < W * H; i++)
    for (const part of parts)
      if (part.mask[i] && !(front[i] >= part.front[i])) {
        front[i] = part.front[i];
        lo = Math.min(lo, front[i]);
        hi = Math.max(hi, front[i]);
      }
  for (let i = 0; i < W * H; i++) {
    const v = Number.isNaN(front[i]) ? 0 : 40 + (215 * (front[i] - lo)) / (hi - lo);
    depth.data.set(Number.isNaN(front[i]) ? [20, 30, 60, 255] : [v, v, v, 255], i * 4);
  }
  writeFileSync(resolve(review, 'front-depth.png'), encodePng(depth));
}
console.log(`${id}/${volumeName}: ppm ${fit.ppm.toFixed(1)}, parts ${partTable.map((p) => `${p.name} ${p.vertexCount}v/${p.indexCount / 3}t`).join(', ')}`);
console.log(JSON.stringify(proportions));
for (const note of notes) console.log(' -', note);
