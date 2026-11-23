// Re-cut one side-view character sheet into layered parts. Pure pixel work on
// the keyed source: no character-specific branches; everything is driven by
// the landmarks and the optional hints in the character config.
//
// Output: bones, sockets and a back-to-front list of part layers. A layer is
// a full-sheet RGBA image holding only that part, a `place` function mapping
// sheet pixels to bind positions (identity for parts cut from the body), and a
// `weights` function giving bone weights at a bind position.
import {
  alphaMask,
  blankImage,
  bounds,
  close,
  compositeOver,
  count,
  cutout,
  dilate,
  distanceTo,
  erode,
  flood,
  intersect,
  luminance,
  medianColour,
  nearestSet,
  polygonMask,
  sample,
  segmentDistance,
  smoothstep,
  subtract,
  union,
} from './raster.mjs';

/** Every tunable of the re-cut, in source pixels unless noted. */
export const RECUT = {
  // Chroma key: the shipped hard rule, then a soft unmixed edge this wide.
  keyEdge: 2,
  // "Same material as the reference colour" (chroma distance, luminance ratio).
  materialChroma: 0.06,
  materialLumMin: 0.42,
  materialLumMax: 1.7,
  outlineLuminance: 82,
  outlineReach: 3.5,
  // Far arm search capsule radius, as a fraction of forearm length.
  armCapsule: 0.42,
  armBridge: 40,
  armClose: 4,
  armWall: 6,
  armFeather: 4,
  hemWindow: 12,
  hemClimb: 14,
  hemEdgeLuminance: 50,
  // Leg split: cost of walking over a black pixel relative to a white one.
  seamDarkCost: 80,
  seamOutline: 2.5, // the far half of the line between the legs goes to the near leg
  // Hidden skin: mirrored band length, outward flare per px, edge stroke.
  fillBand: 30,
  fillSmooth: 4,
  fillSkip: 10, // past the shadow under a hem
  thighFlare: -0.04, // negative: the hidden thigh narrows a little towards the hip
  strokeWidth: 3.2,
  // Shorts: far copy starts this far above the hips and is this much looser
  // than the far thigh at the back; thigh follow reaches `shortsFollow`.
  shortsUnderlap: 14,
  shortsEase: 8,
  shortsCutAhead: 4,
  // Near the hips the trunk keeps a wedge of cloth in front of the near thigh
  // (px at the hip, gone by this fraction of the thigh); it stays on the pelvis.
  shortsWedge: 90,
  shortsWedgeTo: 0.75,
  shortsWedgeBlend: 34,
  shortsFollow: 0.92,
  shortsFollowFrom: -0.15,
  shortsFollowTo: 0.4,
  // Near arm under the sleeve (same numbers as the shipped side rig).
  sleeveSlideFade: 50,
  armTopCrop: 35,
  armTaperFrom: 30,
  armTaperTo: 90,
  // Joint blend half-widths.
  spineBand: 46,
  neckBand: 14,
  headBand: 12,
  kneeBand: 0.2, // of thigh length
  ankleBand: 12,
  elbowBand: 30,
  wristBand: 9,
  sleeveCapFrom: -16, // along the upper arm from the shoulder joint
  sleeveCapTo: 34,
  sleeveTravelFrom: 0.08, // of the sleeve's height, from its top
  sleeveTravelTo: 0.42,
  sleeveFrontBlend: 40,
  // Hand stubs fade out behind the wrist crease so no cut end shows.
  handStubKeep: 10,
  handStubFade: 26,
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const length = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l];
};
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/** Bone-aligned frame: s runs along a->b, t across, +t towards `facing`. */
function frame(a, b, facing) {
  const u = unit(sub(b, a));
  let v = [u[1], -u[0]];
  if (v[0] * facing < 0) v = [-v[0], -v[1]];
  return {
    a,
    b,
    u,
    v,
    length: length(sub(b, a)),
    to: (x, y) => [
      (x - a[0]) * u[0] + (y - a[1]) * u[1],
      (x - a[0]) * v[0] + (y - a[1]) * v[1],
    ],
    from: (s, t) => [a[0] + u[0] * s + v[0] * t, a[1] + u[1] * s + v[1] * t],
  };
}

/** Chroma key. Hard rule as shipped, then soft alpha with the key colour
 * unmixed in a thin band so no magenta survives at the silhouette. */
export function keySource(image) {
  const { width, height, data } = image,
    background = new Uint8Array(width * height);
  for (let i = 0, o = 0; i < background.length; i++, o += 4)
    background[i] =
      data[o] > 110 &&
      data[o + 2] > 100 &&
      data[o + 1] < Math.min(data[o], data[o + 2]) * 0.7
        ? 1
        : 0;
  const key = medianColour(image, background, [8, 8], 6),
    range = Math.min(key[0], key[2]) - key[1],
    dist = distanceTo(background, width, height),
    out = { width, height, data: new Uint8ClampedArray(data) };
  for (let i = 0, o = 0; i < background.length; i++, o += 4) {
    if (background[i]) {
      out.data[o + 3] = 0;
      continue;
    }
    if (dist[i] > RECUT.keyEdge) continue;
    const spill = Math.min(
      1,
      Math.max(0, (Math.min(data[o], data[o + 2]) - data[o + 1]) / range),
    );
    if (spill < 0.1) continue;
    const alpha = 1 - spill;
    if (alpha < 0.06) {
      out.data[o + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++)
      out.data[o + c] = (data[o + c] - spill * key[c]) / alpha;
    out.data[o + 3] = alpha * 255;
  }
  return out;
}

function materialTest(reference, chromaScale = 1, lumMin = RECUT.materialLumMin) {
  const sum = reference[0] + reference[1] + reference[2] + 1,
    cr = reference[0] / sum,
    cg = reference[1] / sum,
    lum = 0.299 * reference[0] + 0.587 * reference[1] + 0.114 * reference[2];
  return (d, o) => {
    const s = d[o] + d[o + 1] + d[o + 2] + 1,
      ratio = luminance(d, o) / lum;
    return (
      Math.hypot(d[o] / s - cr, d[o + 1] / s - cg) < RECUT.materialChroma * chromaScale &&
      ratio > lumMin &&
      ratio < RECUT.materialLumMax
    );
  };
}

function readLandmarks(landmarks, hints) {
  const joints = {};
  for (const j of landmarks.joints)
    joints[j.name] = {
      parent: j.parent,
      point: [j.point.x, j.point.y],
      end: j.end ? [j.end.x, j.end.y] : undefined,
    };
  const near = hints.nearSide ?? 'L',
    far = near === 'L' ? 'R' : 'L';
  // The sheet convention keeps the throwing arm on _L and the off arm on _R.
  return { joints, near, far, throwing: 'L', off: 'R' };
}

/** Across-bone extent [tMin, tMax] of a mask on the line s = const. */
function extentAt(mask, width, height, fr, s, reach = 160) {
  let lo = Infinity,
    hi = -Infinity;
  for (let t = -reach; t <= reach; t += 0.5) {
    const [x, y] = fr.from(s, t),
      xi = Math.round(x),
      yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= width || yi >= height) continue;
    if (!mask[yi * width + xi]) continue;
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  }
  return [lo, hi];
}

/** Two-seed watershed inside `allowed`: every pixel goes to the seed set it
 * can reach most cheaply, and walking over dark pixels is expensive, so the
 * border between the two regions settles on the drawn outline between them.
 * Returns 1 for the first seed set, 2 for the second, 0 for unreached. */
function splitAlongOutline(image, allowed, seedsA, seedsB) {
  const { width, data } = image,
    cost = new Float64Array(allowed.length).fill(Infinity),
    label = new Uint8Array(allowed.length),
    heap = [];
  const push = (i, c) => {
    heap.push([c, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1,
          r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  [seedsA, seedsB].forEach((seeds, k) => {
    for (const i of seeds)
      if (allowed[i] && !label[i]) {
        label[i] = k + 1;
        cost[i] = 0;
        push(i, 0);
      }
  });
  while (heap.length) {
    const [c, i] = pop();
    if (c > cost[i]) continue;
    const x = i % width;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (x + dx < 0 || x + dx >= width) continue;
        const j = i + dy * width + dx;
        if (j < 0 || j >= allowed.length || !allowed[j]) continue;
        const darkness = 1 - luminance(data, j * 4) / 255,
          next = c + Math.hypot(dx, dy) * (1 + RECUT.seamDarkCost * darkness * darkness);
        if (next < cost[j]) {
          cost[j] = next;
          label[j] = label[i];
          push(j, next);
        }
      }
  }
  return label;
}

/**
 * Hidden-surface continuation of a limb segment, as derived art.
 * The limb's visible pixels are walked in the bone frame (s along, t across).
 * Where an edge is not the limb's own drawn outline (it disappears under
 * clothing or under the limb in front), the edge is continued straight up the
 * bone with a slight flare, the interior is filled with the limb's own skin
 * mirrored in a short band, and the new edge gets the drawing's outline colour.
 */
function continueLimb(keyed, visible, behind, fr, { from, cap, tag }) {
  const { width, height } = keyed,
    interior = erode(visible, width, height, 5),
    sMax = Math.round(fr.length + 30);
  // An edge is the limb's own drawn outline when only background (or a part
  // behind this limb) lies beyond it.
  const free = (s, t, side) => {
    for (let k = 1; k <= 5; k++) {
      const [x, y] = fr.from(s, t + side * k),
        i = Math.round(y) * width + Math.round(x);
      if (!visible[i] && !behind[i]) return false;
    }
    return true;
  };
  const sign = { lo: -1, hi: 1 },
    edge = { lo: [], hi: [] },
    reference = Math.round(fr.length),
    // Highest point up the bone to which each edge stays the limb's own.
    ownFrom = { lo: reference, hi: reference };
  for (let s = sMax; s >= from; s--) {
    const [lo, hi] = extentAt(visible, width, height, fr, s);
    edge.lo[s - from] = lo;
    edge.hi[s - from] = hi;
  }
  for (const side of ['lo', 'hi']) {
    let misses = 0;
    for (let s = reference; s >= from && misses < 3; s--) {
      const t = edge[side][s - from];
      if (Number.isFinite(t) && free(s, t, sign[side])) {
        ownFrom[side] = s;
        misses = 0;
      } else misses++;
    }
  }
  const target = (side, s) => {
    const base = Math.max(s, ownFrom[side]);
    return (
      edge[side][Math.round(base) - from] +
      sign[side] * RECUT.thighFlare * Math.max(0, ownFrom[side] - s)
    );
  };
  // Fill colour per across-bone column: the mean of the limb's own lit skin
  // in a short band below where the column becomes visible, smoothed across
  // the bone. Flat, shaded like the drawing, and free of repeated detail.
  const tLo = Math.floor(Math.min(target('lo', from), target('lo', sMax))) - 8,
    tHi = Math.ceil(Math.max(target('hi', from), target('hi', sMax))) + 8,
    columns = tHi - tLo + 1,
    raw = new Float64Array(columns * 3),
    known = new Uint8Array(columns),
    px = [0, 0, 0, 0];
  for (let ti = 0; ti < columns; ti++) {
    const t = tLo + ti,
      band = [];
    let skipped = 0;
    for (let s = from; s <= sMax && band.length < RECUT.fillBand; s++) {
      const [x, y] = fr.from(s, t);
      if (!interior[Math.round(y) * width + Math.round(x)]) continue;
      if (skipped++ < RECUT.fillSkip) continue;
      sample(keyed, x, y, px);
      band.push([px[0], px[1], px[2], luminance(px, 0)]);
    }
    if (band.length < 6) continue;
    const median = band.map((c) => c[3]).sort((a, b) => a - b)[band.length >> 1],
      lit = band.filter((c) => c[3] > median * 0.8);
    for (let c = 0; c < 3; c++)
      raw[ti * 3 + c] = lit.reduce((sum, v) => sum + v[c], 0) / lit.length;
    known[ti] = 1;
  }
  const fill = new Float64Array(columns * 3);
  for (let ti = 0; ti < columns; ti++) {
    let n = 0;
    for (let k = -RECUT.fillSmooth; k <= RECUT.fillSmooth; k++)
      if (known[ti + k]) {
        for (let c = 0; c < 3; c++) fill[ti * 3 + c] += raw[(ti + k) * 3 + c];
        n++;
      }
    if (n) for (let c = 0; c < 3; c++) fill[ti * 3 + c] /= n;
    else {
      // No skin on this line at all: take the nearest column that has some.
      let near = -1;
      for (let k = 1; k < columns && near < 0; k++)
        near = known[ti - k] ? ti - k : known[ti + k] ? ti + k : -1;
      if (near >= 0) for (let c = 0; c < 3; c++) fill[ti * 3 + c] = raw[near * 3 + c];
    }
  }
  const dark = [[], [], []];
  for (let i = 0; i < visible.length; i++)
    if (visible[i] && luminance(keyed.data, i * 4) < 50)
      for (let c = 0; c < 3; c++) dark[c].push(keyed.data[i * 4 + c]);
  const stroke = dark.map((list) => {
    list.sort((a, b) => a - b);
    return list.length ? list[list.length >> 1] : 20;
  });
  // Rasterise the continuation back into sheet space.
  const out = blankImage(width, height),
    halfTop = (target('hi', from + cap) - target('lo', from + cap)) / 2,
    box = [fr.from(from, tLo), fr.from(from, tHi), fr.from(sMax, tLo), fr.from(sMax, tHi)],
    x0 = Math.max(0, Math.floor(Math.min(...box.map((p) => p[0])))),
    x1 = Math.min(width - 1, Math.ceil(Math.max(...box.map((p) => p[0])))),
    y0 = Math.max(0, Math.floor(Math.min(...box.map((p) => p[1])))),
    y1 = Math.min(height - 1, Math.ceil(Math.max(...box.map((p) => p[1]))));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const [s, t] = fr.to(x, y);
      if (s < from || s > sMax) continue;
      const lo = target('lo', s),
        hi = target('hi', s);
      let inside = Math.min(t - lo, hi - t);
      // Rounded top: an ellipse cap over the first `cap` px.
      if (s < from + cap) {
        const mid = (lo + hi) / 2,
          k = (from + cap - s) / cap,
          half = halfTop * Math.sqrt(Math.max(0, 1 - k * k));
        inside = Math.min(inside, half - Math.abs(t - mid), (s - from) * 1.0);
      }
      const coverage = Math.min(1, Math.max(0, inside + 0.5));
      if (!coverage) continue;
      const g = Math.min(columns - 1, Math.max(0, Math.round(t - tLo))) * 3,
        ink = Math.min(1, Math.max(0, RECUT.strokeWidth - inside + 0.5)),
        o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++)
        out.data[o + c] = fill[g + c] * (1 - ink) + stroke[c] * ink;
      out.data[o + 3] = coverage * 255;
    }
  return { image: out, ownFrom, target, tag };
}

/** Bone weights as a plain object, pruned to the 4 largest and normalised. */
function normalise(weights) {
  const top = Object.entries(weights)
    .filter(([, w]) => w > 0.004)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const total = top.reduce((sum, [, w]) => sum + w, 0);
  return Object.fromEntries(top.map(([name, w]) => [name, w / total]));
}
const mix = (a, b, k) => {
  const out = {};
  for (const [name, w] of Object.entries(a)) out[name] = w * (1 - k);
  for (const [name, w] of Object.entries(b)) out[name] = (out[name] ?? 0) + w * k;
  return out;
};

export function recut(sheet, landmarks, hints = {}) {
  const { width, height } = sheet,
    keyed = keySource(sheet),
    solid = alphaMask(keyed),
    { joints: J, near, far, throwing, off } = readLandmarks(landmarks, hints),
    reg = landmarks.registration,
    notes = [];
  const facing = Math.sign(J[`toe_${near}`].point[0] - J[`heel_${near}`].point[0]) || 1;
  const component = (point) =>
    flood(solid, width, height, [nearestSet(solid, width, height, point)]);
  const body = component(J.pelvis.point),
    index = (x, y) => Math.round(y) * width + Math.round(x);

  // ---- Far (off) arm: drawn forearm and hand come out of the body. ----
  const elbowMark = J[`forearm_${off}`].point,
    wrist = J[`hand_${off}`].point,
    handEnd = J[`hand_${off}`].end,
    forearmDir = unit(sub(wrist, elbowMark)),
    forearmLength = length(sub(wrist, elbowMark)),
    armTop = add(elbowMark, forearmDir, -0.35 * forearmLength),
    handTip = add(handEnd, sub(handEnd, wrist), 0.6),
    capsule = RECUT.armCapsule * forearmLength,
    armZone = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!body[i]) continue;
      if (
        segmentDistance(x, y, ...armTop, ...wrist) <= capsule ||
        segmentDistance(x, y, ...wrist, ...handTip) <= capsule
      )
        armZone[i] = 1;
    }
  const armSeeds = [0.3, 0.45, 0.6].map((k) => lerp(elbowMark, wrist, k)).concat(
    [0.3, 0.5, 0.7].map((k) => lerp(wrist, handEnd, k)),
  );
  const armSkinTests = (() => {
    const colours = armSeeds.map((p) => medianColour(keyed, armZone, p, 4));
    const median = [0, 1, 2].map(
      (c) => colours.map((rgb) => rgb[c]).sort((a, b) => a - b)[colours.length >> 1],
    );
    return [materialTest(median), materialTest(median, 1.5, 0.2)];
  })(),
    armSkinTest = armSkinTests[0],
    armHueTest = armSkinTests[1];
  let armSkin = armZone.map((v, i) => (v && armSkinTest(keyed.data, i * 4) ? 1 : 0));
  // Closing joins fingers across their crease lines before the seed flood.
  armSkin = intersect(close(armSkin, width, height, RECUT.armClose), armZone);
  armSkin = flood(
    armSkin,
    width,
    height,
    armSeeds.map((p) => nearestSet(armSkin, width, height, p)).filter(Boolean),
  );
  // Watch straps: zone pixels with skin both ways along the arm.
  const armCore = armSkin.slice();
  for (let i = 0; i < armZone.length; i++) {
    if (!armZone[i] || armSkin[i]) continue;
    const x = i % width,
      y = (i / width) | 0;
    let before = false,
      after = false;
    for (let k = 1; k <= RECUT.armBridge && !(before && after); k++) {
      if (!before && armSkin[index(x - forearmDir[0] * k, y - forearmDir[1] * k)])
        before = true;
      if (!after && armSkin[index(x + forearmDir[0] * k, y + forearmDir[1] * k)])
        after = true;
    }
    if (before && after) armCore[i] = 1;
  }
  const isDark = (i) => luminance(keyed.data, i * 4) < RECUT.outlineLuminance;
  // A wall around the arm core separates the rest of the body. Whatever the
  // pelvis cannot reach without crossing it is arm (watch bulge, fingertips,
  // the arm's free outline). Inside the wall, on the trunk side: skin is arm,
  // the dark line is the trunk's edge (the trunk is in front of the far arm;
  // the hand keeps a copy as its own outline), cloth is trunk.
  const coreDistance = distanceTo(armCore, width, height),
    wall = body.map((v, i) =>
      v && !armCore[i] && coreDistance[i] <= RECUT.armWall ? 1 : 0,
    ),
    restOfBody = flood(subtract(subtract(body, armCore), wall), width, height, [
      nearestSet(body, width, height, J.pelvis.point),
    ]),
    restDistance = distanceTo(restOfBody, width, height),
    armDrawn = new Uint8Array(width * height),
    bodyNoArm = restOfBody.slice();
  for (let i = 0; i < body.length; i++) {
    if (!body[i] || restOfBody[i]) continue;
    const trunkSide = wall[i] && restDistance[i] <= RECUT.armWall + 1;
    if (!trunkSide || (!isDark(i) && armHueTest(keyed.data, i * 4))) {
      armDrawn[i] = 1;
      continue;
    }
    bodyNoArm[i] = 1;
    const x = i % width,
      y = (i / width) | 0;
    if (
      isDark(i) &&
      coreDistance[i] <= RECUT.outlineReach &&
      dot(sub([x, y], wrist), forearmDir) > -10
    )
      armDrawn[i] = 1;
  }
  // Outline scraps the pelvis cannot reach (a hand outline facing the shorts
  // across a thin gap) are arm after all.
  {
    const connected = flood(bodyNoArm, width, height, [
      nearestSet(bodyNoArm, width, height, J.pelvis.point),
    ]);
    for (let i = 0; i < body.length; i++)
      if (bodyNoArm[i] && !connected[i]) {
        bodyNoArm[i] = 0;
        armDrawn[i] = 1;
      }
  }

  // ---- Legs: everything below the hem, split along the drawn outline. ----
  const hip = { [near]: J[`thigh_${near}`].point, [far]: J[`thigh_${far}`].point },
    knee = { [near]: J[`shin_${near}`].point, [far]: J[`shin_${far}`].point },
    ankle = { [near]: J[`foot_${near}`].point, [far]: J[`foot_${far}`].point },
    hipY = Math.min(hip[near][1], hip[far][1]);
  const legTests = [near, far].map((side) =>
    materialTest(medianColour(keyed, bodyNoArm, knee[side], 6)),
  );
  let legSkin = bodyNoArm.map((v, i) =>
    v && ((i / width) | 0) > hipY && legTests.some((test) => test(keyed.data, i * 4))
      ? 1
      : 0,
  );
  legSkin = intersect(close(legSkin, width, height, 2), bodyNoArm);
  legSkin = flood(
    legSkin,
    width,
    height,
    [near, far]
      .flatMap((side) => [knee[side], lerp(knee[side], ankle[side], 0.4)])
      .map((p) => nearestSet(legSkin, width, height, p))
      .filter(Boolean),
  );
  // Hem per column: the first skin under an unbroken run of garment. Columns
  // that run down a dark line between the legs give a late answer; the median
  // of the neighbours restores the garment edge.
  const hem = new Float64Array(width).fill(NaN);
  for (let x = 0; x < width; x++) {
    let run = 0;
    if (!bodyNoArm[Math.round(hipY) * width + x]) continue;
    for (let y = Math.round(hipY); y < height && bodyNoArm[y * width + x]; y++) {
      run = legSkin[y * width + x] ? run + 1 : 0;
      if (run >= 5) {
        // Climb through the shadow the garment casts on the thigh to just
        // under the garment's dark edge line.
        let top = y - 4;
        for (let k = 0; k < RECUT.hemClimb && luminance(keyed.data, ((top - 1) * width + x) * 4) > RECUT.hemEdgeLuminance; k++)
          top--;
        hem[x] = top;
        break;
      }
    }
  }
  {
    const raw = hem.slice();
    for (let x = 0; x < width; x++) {
      if (Number.isNaN(raw[x])) continue;
      const window = [];
      for (let k = -RECUT.hemWindow; k <= RECUT.hemWindow; k++)
        if (!Number.isNaN(raw[x + k] ?? NaN)) window.push(raw[x + k]);
      window.sort((a, b) => a - b);
      const median = window[window.length >> 1];
      hem[x] = Math.abs(raw[x] - median) <= RECUT.hemWindow ? raw[x] : median;
    }
  }
  const hemAt = (x) => {
    for (let k = 0; k < width; k++) {
      if (x - k >= 0 && !Number.isNaN(hem[x - k])) return hem[x - k];
      if (x + k < width && !Number.isNaN(hem[x + k])) return hem[x + k];
    }
    return height;
  };
  const hemColumn = Array.from({ length: width }, (_, x) => hemAt(x)),
    legs = bodyNoArm.map((v, i) =>
      v && ((i / width) | 0) > hipY && (legSkin[i] || ((i / width) | 0) >= hemColumn[i % width]) ? 1 : 0,
    ),
    trunkAll = subtract(bodyNoArm, legs);
  // Split the legs wherever they touch (thighs, crossing feet) along the
  // drawn line between them, seeded from each leg's own bones.
  const legSeeds = (side) => {
    const chain = [
        [hip[side], knee[side]],
        [knee[side], ankle[side]],
        [ankle[side], J[`foot_${side}`].end],
        [ankle[side], J[`heel_${side}`].point],
        [J[`foot_${side}`].end, J[`toe_${side}`].point],
      ],
      seeds = [];
    for (const [a, b] of chain) {
      const steps = Math.ceil(length(sub(b, a)));
      for (let k = 0; k <= steps; k++) {
        const p = lerp(a, b, k / steps),
          i = index(p[0], p[1]);
        if (legs[i] && !isDark(i)) seeds.push(i);
      }
    }
    return seeds;
  };
  const legLabel = splitAlongOutline(keyed, legs, legSeeds(near), legSeeds(far)),
    legBorder = new Uint8Array(width * height);
  let seamTop = null;
  for (let i = width; i < legs.length - width; i++) {
    if (legLabel[i] !== 2) continue;
    if (legLabel[i - 1] === 1 || legLabel[i + 1] === 1 || legLabel[i - width] === 1 || legLabel[i + width] === 1) {
      legBorder[i] = 1;
      if (!seamTop) seamTop = [i % width, (i / width) | 0];
    }
  }
  const legPart = {};
  if (seamTop) {
    // The line between the legs is the near leg's edge: it occludes.
    const toBorder = distanceTo(legBorder, width, height);
    legPart[near] = legs.map((v, i) =>
      v && (legLabel[i] === 1 || (toBorder[i] <= RECUT.seamOutline && isDark(i))) ? 1 : 0,
    );
    notes.push(`legs touch: ${count(legBorder)}px border, top at ${seamTop.join(',')}`);
  } else {
    legPart[near] = legs.map((v, i) => (v && legLabel[i] === 1 ? 1 : 0));
    notes.push('legs do not touch below the hem');
  }
  legPart[far] = subtract(legs, legPart[near]);

  // Hidden thigh continuations (derived art).
  const background = solid.map((v) => v ^ 1),
    trunkDistance = distanceTo(trunkAll, width, height),
    thigh = {},
    legImage = {};
  for (const side of [near, far]) {
    // The hem's own dark edge must not travel with the leg.
    const clean = legPart[side].map((v, i) =>
        v && !(trunkDistance[i] <= 5 && isDark(i)) ? 1 : 0,
      ),
      fr = frame(hip[side], knee[side], facing),
      behind = side === near ? union(background, legPart[far]) : background,
      continued = continueLimb(keyed, clean, behind, fr, {
        from: -Math.round(0.12 * fr.length),
        cap: Math.round(0.2 * fr.length),
        tag: side,
      });
    thigh[side] = { fr, ...continued };
    const image = continued.image;
    compositeOver(image, cutout(keyed, clean));
    legImage[side] = image;
    notes.push(
      `thigh_${side} continued above s=${continued.ownFrom.lo}/${continued.ownFrom.hi} of ${Math.round(fr.length)}`,
    );
  }

  // ---- Shorts: the far thigh gets its own copy of the lower garment. ----
  const nearFrame = thigh[near].fr,
    farFrame = thigh[far].fr,
    // The near shorts leg ends just in front of the near thigh's front edge.
    farOnly = trunkAll.map((v, i) => {
      if (!v) return 0;
      const x = i % width,
        y = (i / width) | 0;
      if (y <= hipY) return 0;
      const [s, t] = nearFrame.to(x, y);
      return t >
        thigh[near].target('hi', Math.max(s, 0)) +
          RECUT.shortsCutAhead +
          RECUT.shortsWedge * (1 - smoothstep(0, RECUT.shortsWedgeTo, s / nearFrame.length))
        ? 1
        : 0;
    }),
    shortsFarMask = trunkAll.map((v, i) => {
      if (!v) return 0;
      const x = i % width,
        y = (i / width) | 0;
      if (y <= hipY - RECUT.shortsUnderlap) return 0;
      const [s, t] = farFrame.to(x, y);
      return t >= thigh[far].target('lo', Math.max(s, -10)) - RECUT.shortsEase ? 1 : 0;
    }),
    shortsFar = cutout(keyed, shortsFarMask);
  {
    // Its back edge is hidden behind the near shorts leg in the bind pose, so
    // it can carry an outline without changing the drawing.
    const inside = distanceTo(
      shortsFarMask.map((v) => v ^ 1),
      width,
      height,
    );
    for (let i = 0; i < shortsFarMask.length; i++) {
      if (!shortsFarMask[i] || inside[i] > RECUT.strokeWidth + 1) continue;
      const x = i % width,
        y = (i / width) | 0;
      const rear = index(x - facing * (inside[i] + 1), y);
      if (y <= hipY || !trunkAll[rear] || shortsFarMask[rear]) continue;
      const ink = Math.min(1, Math.max(0, RECUT.strokeWidth - inside[i] + 0.5));
      for (let c = 0; c < 3; c++)
        shortsFar.data[i * 4 + c] = shortsFar.data[i * 4 + c] * (1 - ink) + 18 * ink;
    }
  }
  let trunkMask = subtract(trunkAll, farOnly);

  // ---- Near sleeve: cloth leaves the trunk; the trunk is continued under it.
  const boundary = polygonMask(reg.sleeveBoundary, width, height),
    opening = polygonMask(reg.sleeveOpening, width, height),
    sleeveCut = reg.bodySleeveCutout
      ? polygonMask(reg.bodySleeveCutout, width, height)
      : dilate(boundary, width, height, 12),
    sleeveBackMask = intersect(boundary, body),
    sleeveFrontMask = subtract(sleeveBackMask, opening),
    cutBox = bounds(intersect(sleeveCut, body), width),
    mirrorY = cutBox.y1 + 4,
    rearAt = (y) => {
      for (let x = facing > 0 ? 0 : width - 1; x >= 0 && x < width; x += facing)
        if (trunkMask[y * width + x]) return x;
      return NaN;
    },
    rearTop = rearAt(cutBox.y0 - 2),
    rearBottom = rearAt(mirrorY + 4);
  const trunk = cutout(keyed, subtract(trunkMask, sleeveCut)),
    fabric = erode(subtract(trunkMask, sleeveCut), width, height, 3),
    underSleeve = new Uint8Array(width * height);
  const fabricRear = (y) => {
    for (let x = facing > 0 ? 0 : width - 1; x >= 0 && x < width; x += facing)
      if (fabric[y * width + x]) return x;
    return NaN;
  };
  for (let y = cutBox.y0; y <= cutBox.y1; y++) {
    const k = (y - (cutBox.y0 - 2)) / (mirrorY + 4 - (cutBox.y0 - 2)),
      rear = rearTop + (rearBottom - rearTop) * k,
      sourceY = 2 * mirrorY - y,
      // Mirror the cloth below the sleeve, slid so its back edge lands on the
      // continued back edge: the edge shading stays at the edge.
      slide = Math.round(fabricRear(sourceY) - RECUT.strokeWidth - rear) || 0;
    for (let x = cutBox.x0; x <= cutBox.x1; x++) {
      const i = y * width + x;
      if (!sleeveCut[i] || !body[i]) continue;
      const inside = (x - rear) * facing;
      if (inside < -0.5) continue;
      underSleeve[i] = 1;
      let source = -1;
      // Slide fades out across the cloth so the print further in is not moved.
      for (const dx of [Math.round(slide * (1 - smoothstep(0, RECUT.sleeveSlideFade, inside))), 0]) {
        const candidate = sourceY * width + x + dx;
        if (fabric[candidate]) {
          source = candidate;
          break;
        }
      }
      if (source < 0) {
        for (let d = 1; d < 80 && source < 0; d++)
          for (const sx of [x + d, x - d])
            if (fabric[sourceY * width + sx]) {
              source = sourceY * width + sx;
              break;
            }
      }
      if (source < 0) continue;
      const o = i * 4,
        ink = Math.min(1, Math.max(0, RECUT.strokeWidth - inside)),
        coverage = Math.min(1, Math.max(0, inside + 0.5));
      for (let c = 0; c < 3; c++)
        trunk.data[o + c] = keyed.data[source * 4 + c] * (1 - ink) + 18 * ink;
      trunk.data[o + 3] = 255 * coverage;
    }
  }
  trunkMask = union(subtract(trunkMask, sleeveCut), underSleeve);

  // ---- Far arm, hidden part: the bare-arm drawing re-posed behind the trunk.
  const armSheet = component(reg.armJoints[1]),
    [A0, A1, A2] = reg.armJoints,
    upperSource = frame(A0, A1, facing),
    lowerSource = frame(A1, A2, facing),
    widthAt = (mask, fr, s) => {
      const [lo, hi] = extentAt(mask, width, height, fr, s);
      return hi - lo;
    },
    drawnForearm = frame(elbowMark, wrist, facing),
    acrossScale = hints.farArmScale ??
      Math.min(
        1.1,
        Math.max(
          0.6,
          widthAt(armDrawn, drawnForearm, forearmLength - 4) /
            widthAt(armSheet, lowerSource, lowerSource.length * 0.93),
        ),
      ),
    frontAt = (mask, y) => {
      for (let x = facing > 0 ? width - 1 : 0; x >= 0 && x < width; x -= facing)
        if (mask[Math.round(y) * width + x]) return x;
      return NaN;
    },
    visibleFront = union(armDrawn, trunkMask),
    elbowHalf = (widthAt(armSheet, lowerSource, 0) / 2) * acrossScale,
    shoulderHalf = (widthAt(armSheet, upperSource, upperSource.length * 0.12) / 2) * acrossScale,
    shoulderMark = J[`upper_arm_${off}`].point,
    farElbow = hints.farElbow ?? [
      frontAt(visibleFront, elbowMark[1]) - facing * (elbowHalf + 1),
      elbowMark[1],
    ],
    shoulderLimit = frontAt(trunkMask, shoulderMark[1]) - facing * (shoulderHalf + 4),
    farShoulder = hints.farShoulder ?? [
      facing > 0 ? Math.min(shoulderMark[0], shoulderLimit) : Math.max(shoulderMark[0], shoulderLimit),
      shoulderMark[1],
    ],
    upperTarget = frame(farShoulder, farElbow, facing),
    lowerTarget = frame(farElbow, wrist, facing),
    elbowBisector = unit(add(upperTarget.u, lowerTarget.u)),
    hiddenBehind = erode(
      union(trunkMask, shortsFarMask).map((v, i) =>
        v && (trunk.data[i * 4 + 3] === 255 || shortsFar.data[i * 4 + 3] === 255) ? 1 : 0,
      ),
      width,
      height,
      1.5,
    ),
    farArm = blankImage(width, height),
    reach = shoulderHalf + 30,
    points = [farShoulder, farElbow, wrist],
    bx0 = Math.max(0, Math.floor(Math.min(...points.map((p) => p[0])) - reach)),
    bx1 = Math.min(width - 1, Math.ceil(Math.max(...points.map((p) => p[0])) + reach)),
    by0 = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1])) - reach)),
    by1 = Math.min(height - 1, Math.ceil(Math.max(...points.map((p) => p[1])) + 12)),
    armPixels = cutout(keyed, armSheet),
    px = [0, 0, 0, 0];
  const bakedSum = [0, 0, 0],
    drawnSum = [0, 0, 0];
  let bakedCount = 0,
    drawnCount = 0;
  for (let i = 0; i < armSkin.length; i++)
    if (armSkin[i]) {
      for (let c = 0; c < 3; c++) drawnSum[c] += keyed.data[i * 4 + c];
      drawnCount++;
    }
  for (let y = by0; y <= by1; y++)
    for (let x = bx0; x <= bx1; x++) {
      const [su, tu] = upperTarget.to(x, y),
        [sl, tl] = lowerTarget.to(x, y),
        fromUpper = upperSource.from(
          (su * upperSource.length) / upperTarget.length,
          tu / acrossScale,
        ),
        fromLower = lowerSource.from(
          (sl * lowerSource.length) / lowerTarget.length,
          tl / acrossScale,
        ),
        k = smoothstep(-25, 25, dot(sub([x, y], farElbow), elbowBisector)),
        source = lerp(fromUpper, fromLower, k);
      sample(armPixels, source[0], source[1], px);
      if (px[3] < 1) continue;
      const o = (y * width + x) * 4;
      farArm.data[o] = px[0];
      farArm.data[o + 1] = px[1];
      farArm.data[o + 2] = px[2];
      farArm.data[o + 3] = px[3];
      if (px[3] > 250 && luminance(px, 0) > 120) {
        for (let c = 0; c < 3; c++) bakedSum[c] += px[c];
        bakedCount++;
      }
    }
  // Match the re-posed arm's skin to the drawn forearm, then keep only what
  // the trunk hides in the bind pose so the visible drawing is unchanged.
  const drawnDistance = distanceTo(armDrawn, width, height),
    coveredNearArm = trunkMask.map((v, i) =>
      v && trunk.data[i * 4 + 3] === 255 && drawnDistance[i] <= RECUT.armWall ? 1 : 0,
    );
  const gain = [0, 1, 2].map((c) =>
    Math.min(1.3, Math.max(0.7, drawnSum[c] / drawnCount / (bakedSum[c] / bakedCount || 1))),
  );
  const clipped = new Uint8Array(width * height);
  for (let i = 0, o = 0; i < armDrawn.length; i++, o += 4) {
    if (!farArm.data[o + 3]) continue;
    if (!hiddenBehind[i] && !armDrawn[i] && !coveredNearArm[i]) {
      farArm.data[o + 3] = 0;
      clipped[i] = 1;
      continue;
    }
    for (let c = 0; c < 3; c++) farArm.data[o + c] *= gain[c];
  }
  // Where the trunk's silhouette cut the re-posed arm short, give the new
  // edge the drawing's outline; where the drawn forearm meets it, feather the
  // drawn pixels in so the old cloth edge does not survive as a line.
  const toClipped = distanceTo(clipped, width, height),
    toTrunkSide = distanceTo(subtract(bodyNoArm, armDrawn), width, height),
    drawnArm = cutout(keyed, armDrawn);
  for (let i = 0, o = 0; i < armDrawn.length; i++, o += 4) {
    if (farArm.data[o + 3] && !armDrawn[i] && toClipped[i] <= RECUT.strokeWidth) {
      const ink = Math.min(1, Math.max(0, RECUT.strokeWidth - toClipped[i] + 0.5));
      for (let c = 0; c < 3; c++) farArm.data[o + c] = farArm.data[o + c] * (1 - ink) + 18 * ink;
    }
    const x = i % width,
      y = (i / width) | 0;
    if (
      armDrawn[i] &&
      farArm.data[o + 3] === 255 &&
      toTrunkSide[i] <= RECUT.armFeather &&
      dot(sub([x, y], wrist), forearmDir) <= -10
    )
      drawnArm.data[o + 3] *= Math.max(0, (toTrunkSide[i] - 1) / (RECUT.armFeather - 1));
  }
  compositeOver(farArm, drawnArm);
  notes.push(
    `far arm: across scale ${acrossScale.toFixed(3)}, shoulder ${farShoulder.map(Math.round).join(',')}, elbow ${farElbow.map(Math.round).join(',')}, gain ${gain.map((g) => g.toFixed(2)).join(',')}`,
  );

  // ---- Near (throwing) arm and the three hands, from their own islands. ----
  const shoulder = J[`upper_arm_${throwing}`].point,
    elbow = J[`forearm_${throwing}`].point,
    nearWrist = J[`hand_${throwing}`].point,
    registerArm = (() => {
      const ux = A1[0] - A0[0],
        uy = A1[1] - A0[1],
        vx = A2[0] - A0[0],
        vy = A2[1] - A0[1],
        det = ux * vy - uy * vx;
      return (x, y) => {
        const dx = x - A0[0],
          dy = y - A0[1],
          u = (dx * vy - dy * vx) / det,
          v = (ux * dy - uy * dx) / det,
          px2 = shoulder[0] + u * (elbow[0] - shoulder[0]) + v * (nearWrist[0] - shoulder[0]),
          py2 = shoulder[1] + u * (elbow[1] - shoulder[1]) + v * (nearWrist[1] - shoulder[1]),
          // The hidden biceps must fit inside the sleeve (as shipped).
          axis =
            shoulder[0] +
            ((elbow[0] - shoulder[0]) * (py2 - shoulder[1])) / (elbow[1] - shoulder[1]),
          taper =
            0.5 +
            0.5 *
              smoothstep(
                shoulder[1] + RECUT.armTaperFrom,
                shoulder[1] + RECUT.armTaperTo,
                py2,
              );
        return [axis + (px2 - axis) * taper, py2];
      };
    })(),
    nearArmMask = armSheet.map((v, i) =>
      v && ((i / width) | 0) >= A0[1] + RECUT.armTopCrop ? 1 : 0,
    ),
    handNames = ['grip', 'open', 'relaxed'],
    handMasks = reg.wrists.map((p) => component(p)),
    // Hand size: the hand's wrist stub is as wide as the arm's wrist end.
    armWristWidth = (() => {
      const top = registerArm(...lowerSource.from(lowerSource.length * 0.95, -40)),
        bottom = registerArm(...lowerSource.from(lowerSource.length * 0.95, 40)),
        [lo, hi] = extentAt(armSheet, width, height, lowerSource, lowerSource.length * 0.95);
      return (length(sub(top, bottom)) * (hi - lo)) / 80;
    })(),
    handScale =
      hints.handScale ??
      (() => {
        const stubs = handMasks.map((mask, k) => {
          let lo = Infinity,
            hi = -Infinity;
          const x = Math.round(reg.wrists[k][0]);
          for (let y = 0; y < height; y++)
            if (mask[y * width + x]) {
              lo = Math.min(lo, y);
              hi = Math.max(hi, y);
            }
          return hi - lo + 1;
        });
        stubs.sort((a, b) => a - b);
        return armWristWidth / stubs[1];
      })();
  notes.push(`hand scale ${handScale.toFixed(3)} (arm wrist ${armWristWidth.toFixed(1)}px)`);

  // ---- Bones (bind pose, sheet pixels). ----
  const N = { n: near, f: far };
  const bones = [];
  const bone = (name, parent, point, end) => bones.push({ name, parent, point, end });
  bone('root', null, J.root.point);
  for (const name of ['pelvis', 'spine_lower', 'spine_mid', 'chest', 'neck', 'head'])
    bone(name, J[name].parent, J[name].point, J[name].end);
  bone('clavicle_far', 'chest', J[`clavicle_${off}`].point, farShoulder);
  bone('upper_arm_far', 'clavicle_far', farShoulder, farElbow);
  bone('forearm_far', 'upper_arm_far', farElbow, wrist);
  bone('hand_far', 'forearm_far', wrist, handEnd);
  bone('clavicle_near', 'chest', J[`clavicle_${throwing}`].point, shoulder);
  bone('upper_arm_near', 'clavicle_near', shoulder, elbow);
  bone('forearm_near', 'upper_arm_near', elbow, nearWrist);
  bone('hand_near', 'forearm_near', nearWrist, J[`hand_${throwing}`].end);
  for (const [tag, side] of [['far', N.f], ['near', N.n]]) {
    bone(`thigh_${tag}`, 'pelvis', hip[side], knee[side]);
    bone(`shin_${tag}`, `thigh_${tag}`, knee[side], ankle[side]);
    bone(`foot_${tag}`, `shin_${tag}`, ankle[side], J[`foot_${side}`].end);
  }
  const sockets = [
    { name: 'palm', bone: 'hand_near', point: J.throwing_hand.point },
    { name: 'off_hand', bone: 'hand_far', point: J.off_hand.point },
    { name: 'head', bone: 'head', point: J.skull_center.point },
    ...[['far', N.f], ['near', N.n]].flatMap(([tag, side]) => [
      { name: `ankle_${tag}`, bone: `foot_${tag}`, point: ankle[side] },
      { name: `heel_${tag}`, bone: `foot_${tag}`, point: J[`heel_${side}`].point },
      { name: `toe_${tag}`, bone: `foot_${tag}`, point: J[`toe_${side}`].point },
    ]),
  ];

  // ---- Weights. ----
  const spine = ['pelvis', 'spine_lower', 'spine_mid', 'chest', 'neck', 'head'],
    spineDirs = spine.map((name) => unit(sub(J[name].end, J[name].point))),
    neckLine = hints.neckLine,
    headNormal = neckLine
      ? (() => {
          const along = unit(sub(neckLine[1], neckLine[0]));
          let normal = [along[1], -along[0]];
          if (dot(normal, spineDirs[5]) < 0) normal = [-normal[0], -normal[1]];
          return normal;
        })()
      : spineDirs[5];
  const chain = (x, y) => {
    const out = {};
    let carry = 1;
    for (let k = 0; k < spine.length; k++) {
      let next = 0;
      if (k + 1 < spine.length) {
        const joint = J[spine[k + 1]].point,
          isHead = k + 1 === 5,
          isNeck = k + 1 === 4,
          normal = isHead || (isNeck && neckLine)
            ? headNormal
            : unit(add(spineDirs[k], spineDirs[k + 1])),
          origin = isHead && neckLine ? neckLine[0] : joint,
          band = isHead ? RECUT.headBand : isNeck ? RECUT.neckBand : RECUT.spineBand;
        next = smoothstep(-band, band, dot(sub([x, y], origin), normal));
      }
      out[spine[k]] = carry * (1 - next);
      carry *= next;
    }
    return out;
  };
  // Lower garment follows a thigh: not at the hips, almost fully at the hem.
  // `aheadOf` (trunk only) fades the follow out in front of the near thigh so
  // the cloth over the far thigh's root stays on the pelvis.
  const withThigh = (fr, name, aheadOf) => (x, y) => {
    const base = chain(x, y);
    if (y <= hipY) return normalise(base);
    const [s, t] = fr.to(x, y);
    let k = RECUT.shortsFollow * smoothstep(RECUT.shortsFollowFrom, RECUT.shortsFollowTo, s / fr.length);
    if (aheadOf) k *= 1 - smoothstep(0, RECUT.shortsWedgeBlend, t - aheadOf(Math.max(s, 0)) - RECUT.shortsCutAhead);
    return normalise(mix(base, { [name]: 1 }, k));
  };
  const trunkWeights = withThigh(nearFrame, 'thigh_near', (s) => thigh[near].target('hi', s));
  const legWeights = (tag, side) => {
    const thighDir = unit(sub(knee[side], hip[side])),
      shinDir = unit(sub(ankle[side], knee[side])),
      kneeNormal = unit(add(thighDir, shinDir)),
      band = RECUT.kneeBand * length(sub(knee[side], hip[side]));
    return (x, y) => {
      const shin = smoothstep(-band, band, dot(sub([x, y], knee[side]), kneeNormal)),
        foot = smoothstep(
          -RECUT.ankleBand,
          RECUT.ankleBand,
          dot(sub([x, y], ankle[side]), shinDir),
        );
      return normalise({
        [`thigh_${tag}`]: 1 - shin,
        [`shin_${tag}`]: shin * (1 - foot),
        [`foot_${tag}`]: shin * foot,
      });
    };
  };
  const limbWeights = (names, a, b, c, bandB, bandC) => {
    const first = unit(sub(b, a)),
      second = unit(sub(c, b)),
      normal = unit(add(first, second));
    return (x, y) => {
      const lower = smoothstep(-bandB, bandB, dot(sub([x, y], b), normal)),
        hand = names[2] ? smoothstep(-bandC, bandC, dot(sub([x, y], c), second)) : 0;
      return normalise({
        [names[0]]: 1 - lower,
        [names[1]]: lower * (1 - hand),
        ...(names[2] ? { [names[2]]: lower * hand } : {}),
      });
    };
  };
  const sleeveBox = bounds(sleeveBackMask, width),
    sleeveHeight = sleeveBox.y1 - sleeveBox.y0,
    upperNear = frame(shoulder, elbow, facing),
    sleeveFront = facing > 0 ? sleeveBox.x1 : sleeveBox.x0,
    // Sleeve cloth: stitched to the chest along its top and front edges, it
    // travels with the shoulder (clavicle) from just under the cap and turns
    // with the upper arm in a narrow band around the joint, where a turn moves
    // points least. The cuff is rigid with the arm.
    sleeveWeights = (x, y) => {
      const stitched = 1 - smoothstep(-RECUT.sleeveFrontBlend, 0, (x - sleeveFront) * facing),
        travel =
          stitched *
          smoothstep(
            sleeveBox.y0 + RECUT.sleeveTravelFrom * sleeveHeight,
            sleeveBox.y0 + RECUT.sleeveTravelTo * sleeveHeight,
            y,
          ),
        swing = Math.min(
          travel,
          stitched * smoothstep(RECUT.sleeveCapFrom, RECUT.sleeveCapTo, upperNear.to(x, y)[0]),
        );
      return normalise({
        ...mix(chain(x, y), {}, travel),
        clavicle_near: travel - swing,
        upper_arm_near: swing,
      });
    };
  const rigid = (name) => () => ({ [name]: 1 });
  // The hand islands point along +x from the wrist; behind the crease is stub.
  const fadeStub = (image, wristX) => {
    for (let i = 0, o = 3; i < width * height; i++, o += 4) {
      if (!image.data[o]) continue;
      const behind = wristX - (i % width) - RECUT.handStubKeep;
      if (behind > 0) image.data[o] *= 1 - smoothstep(0, RECUT.handStubFade, behind);
    }
    return image;
  };
  const identity = (x, y) => [x, y];

  const parts = [
    {
      name: 'arm_far',
      image: farArm,
      place: identity,
      weights: limbWeights(
        ['upper_arm_far', 'forearm_far', 'hand_far'],
        farShoulder,
        farElbow,
        wrist,
        RECUT.elbowBand,
        RECUT.wristBand,
      ),
    },
    { name: 'leg_far', image: legImage[far], place: identity, weights: legWeights('far', far) },
    {
      name: 'shorts_far',
      image: shortsFar,
      place: identity,
      weights: withThigh(farFrame, 'thigh_far'),
    },
    { name: 'leg_near', image: legImage[near], place: identity, weights: legWeights('near', near) },
    { name: 'trunk', image: trunk, place: identity, weights: trunkWeights },
    {
      name: 'sleeve_near_back',
      image: cutout(keyed, sleeveBackMask),
      place: identity,
      weights: sleeveWeights,
    },
    {
      name: 'arm_near',
      image: cutout(keyed, nearArmMask),
      place: registerArm,
      weights: limbWeights(
        ['upper_arm_near', 'forearm_near'],
        shoulder,
        elbow,
        nearWrist,
        RECUT.elbowBand,
        0,
      ),
    },
    {
      name: 'sleeve_near',
      image: cutout(keyed, sleeveFrontMask),
      place: identity,
      weights: sleeveWeights,
    },
    ...handNames.map((name, k) => ({
      name: `hand_${name}`,
      image: fadeStub(cutout(keyed, handMasks[k]), reg.wrists[k][0]),
      place: (x, y) => [
        nearWrist[0] + (x - reg.wrists[k][0]) * handScale,
        nearWrist[1] + (y - reg.wrists[k][1]) * handScale,
      ],
      weights: rigid('hand_near'),
      visible: k === 0,
      group: 'hand',
    })),
  ];
  return {
    keyed,
    body,
    bones,
    sockets,
    parts,
    notes,
    facing,
    sleeveCutBox: [cutBox.x0, cutBox.y0, cutBox.x1, cutBox.y1],
  };
}

