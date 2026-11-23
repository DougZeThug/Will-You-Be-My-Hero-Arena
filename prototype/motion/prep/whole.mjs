// "Whole drawing" cut for one standing full-figure drawing (transparent RGBA,
// sticker contour kept): the bind pose IS the drawing. The trunk, head, collar
// and shorts stay ONE continuous weighted mesh (no cuts at the neck, collar or
// waist). Only what must slide over or under it is a separate layer:
//   arm_far, leg_far, leg_near  (behind the body)   body   arm_near (in front)
// Every layer pixel visible in the bind pose is the source pixel. What is
// DERIVED sits hidden under a neighbour until something moves:
//   - body under the near arm: the cloth beside the arm mirrored a short way
//     under it, closed with an ink line and the sticker contour;
//   - thigh tops under the shorts hem and the far arm under the sleeve: the
//     limb mirrored upward across its cut, so its outline and contour continue.
// Inputs are hand-read from the drawing (see characters/<id>.json): the joints,
// a neck line, and one outline per separate layer.
import { alphaMask, blankImage, flood, luminance, polygonMask, smoothstep } from './raster.mjs';

export const WHOLE = {
  solid: 8, // alpha at or above this is the figure (soft edge included)
  // px of derived trunk under the near arm. No sticker contour on it: while the arm
  // still overlaps the trunk a contour there would show INSIDE the figure.
  underArm: { cloth: 30, ink: 5, contour: 0 },
  legUnder: 85, // px of thigh mirrored up under the shorts
  armFarUnder: 70, // px of far arm mirrored up under the sleeve
  spineBand: 34, // px over which neighbouring spine bones blend
  neckBand: 16,
  shoulderInner: 60, // px from a shoulder joint where the body fully follows the clavicle ...
  shoulderOuter: 200, // ... fading to nothing here
  shoulderShare: 0.85,
  seamBand: 46, // px from the sleeve seam over which the arm layer goes from trunk to arm
  sleeveBlend: [-10, 70], // along the upper arm (px from the shoulder): clavicle -> upper arm
  elbowBand: 0.16, // of the upper-arm length
  wristBand: 0.1,
  kneeBand: 0.16, // of the thigh length
  ankleBand: 0.1,
  shortsFollow: 0.9, // how far the hem follows its thigh
  shortsSideBlend: 16,
  ink: [26, 22, 24],
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k],
  dot = (a, b) => a[0] * b[0] + a[1] * b[1],
  len = (a) => Math.hypot(a[0], a[1]),
  unit = (a) => {
    const l = len(a) || 1;
    return [a[0] / l, a[1] / l];
  };

/** Closest point on a set of segments: { d, point }. */
function nearestOn(segments, x, y) {
  let best = Infinity,
    point = null;
  for (const [a, b] of segments) {
    const ab = sub(b, a),
      l2 = dot(ab, ab) || 1,
      t = Math.min(1, Math.max(0, dot(sub([x, y], a), ab) / l2)),
      px = a[0] + ab[0] * t,
      py = a[1] + ab[1] * t,
      d = Math.hypot(x - px, y - py);
    if (d < best) {
      best = d;
      point = [px, py];
    }
  }
  return { d: best, point };
}
const segmentsOf = (polygon, [from, to]) => {
  const out = [];
  for (let i = from; i < to; i++) out.push([polygon[i], polygon[i + 1]]);
  return out;
};
const boxOf = (segments, pad, W, H) => {
  const xs = segments.flat().map((p) => p[0]),
    ys = segments.flat().map((p) => p[1]);
  return [Math.max(0, Math.floor(Math.min(...xs) - pad)), Math.max(0, Math.floor(Math.min(...ys) - pad)), Math.min(W - 1, Math.ceil(Math.max(...xs) + pad)), Math.min(H - 1, Math.ceil(Math.max(...ys) + pad))];
};

/**
 * @param sheet decoded RGBA drawing (only read)
 * @param spec  { joints, neckLine: [[nape], [throat]], nearSide: 'R' | 'L',
 *                pieces: { armNear: { polygon, inner: [i, j] }, armFar: { polygon, cut: [i, j] },
 *                          legNear: { polygon, hem: [i, j] }, legFar: { polygon, hem: [i, j] } } }
 *              Polygons are outlines in sheet pixels; the index ranges name the
 *              run of points that borders the body (the rest may lie outside the figure).
 */
export function wholeCut(sheet, spec) {
  const T = { ...WHOLE, ...(spec.overrides ?? {}) },
    W = sheet.width,
    H = sheet.height,
    { data } = sheet,
    // The figure: everything connected to the pelvis. Detached debris is dropped.
    solid = flood(alphaMask(sheet, T.solid), W, H, [spec.joints.pelvis]),
    J = spec.joints,
    near = spec.nearSide,
    far = near === 'R' ? 'L' : 'R',
    notes = [],
    idx = (x, y) => y * W + x,
    mask = Object.fromEntries(Object.entries(spec.pieces).map(([name, piece]) => [name, polygonMask(piece.polygon, W, H)])),
    piece = (name) => {
      const out = blankImage(W, H);
      for (let i = 0; i < W * H; i++) if (solid[i] && mask[name][i]) for (let c = 0; c < 4; c++) out.data[i * 4 + c] = data[i * 4 + c];
      return out;
    },
    images = { armNear: piece('armNear'), armFar: piece('armFar'), legNear: piece('legNear'), legFar: piece('legFar') },
    body = blankImage(W, H);
  for (let i = 0; i < W * H; i++)
    if (solid[i] && !mask.armNear[i] && !mask.armFar[i] && !mask.legNear[i] && !mask.legFar[i]) for (let c = 0; c < 4; c++) body.data[i * 4 + c] = data[i * 4 + c];
  const bodySolid = alphaMask(body, T.solid);

  // Sticker contour colour: light pixels right at the silhouette.
  const contour = (() => {
    const channels = [[], [], []];
    for (let y = 2; y < H - 2; y += 3)
      for (let x = 2; x < W - 2; x += 3) {
        const i = idx(x, y);
        if (!solid[i] || luminance(data, i * 4) < 215) continue;
        if (solid[i - 3] && solid[i + 3] && solid[i - 3 * W] && solid[i + 3 * W]) continue;
        for (let c = 0; c < 3; c++) channels[c].push(data[i * 4 + c]);
      }
    return channels.map((list) => list.sort((a, b) => a - b)[list.length >> 1] ?? 240);
  })();

  /** Mirror `source` across `segments` into `target`, up to `depth` px, where `wanted(i)` holds. */
  const mirror = (target, source, sourceSolid, segments, depth, wanted, skip = 0) => {
    const [x0, y0, x1, y1] = boxOf(segments, depth + 2, W, H);
    let count = 0;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = idx(x, y);
        if (!wanted(i) || target.data[i * 4 + 3] >= T.solid) continue;
        const { d, point } = nearestOn(segments, x, y);
        if (d > depth) continue;
        // `skip` jumps the neighbour's own outline so it is not mirrored in.
        const k = d > 0 ? (d + skip) / d : 1,
          rx = Math.round(point[0] + (point[0] - x) * k),
          ry = Math.round(point[1] + (point[1] - y) * k);
        if (rx < 0 || ry < 0 || rx >= W || ry >= H || !sourceSolid[idx(rx, ry)]) continue;
        for (let c = 0; c < 4; c++) target.data[i * 4 + c] = source.data[idx(rx, ry) * 4 + c];
        count++;
      }
    return count;
  };

  // ---- Derived: body under the near arm (cloth, then ink, then the sticker contour).
  // `under`: the run of the outline where the trunk is truly hidden (sleeve and
  // upper arm): cloth, ink line and contour. `fill`: where only a hole has to be
  // closed (the hand over the shorts): cloth only.
  const inner = segmentsOf(spec.pieces.armNear.polygon, spec.pieces.armNear.under ?? spec.pieces.armNear.inner),
    U = T.underArm,
    cloth =
      mirror(body, body, bodySolid, inner, U.cloth, (i) => mask.armNear[i] === 1) +
      (() => {
        // Under the hand only a hole is closed: nothing past the straight line
        // between the ends of that run (the garment's likely edge under the hand).
        if (!spec.pieces.armNear.fill) return 0;
        const run = segmentsOf(spec.pieces.armNear.polygon, spec.pieces.armNear.fill),
          a = run[0][0],
          b = run[run.length - 1][1],
          side = (x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]),
          bodySide = Math.sign(side(spec.joints.pelvis[0], spec.joints.pelvis[1]));
        return mirror(body, body, bodySolid, run, 80, (i) => mask.armNear[i] === 1 && side(i % W, (i / W) | 0) * bodySide > 0, 10);
      })();
  {
    const total = U.cloth + U.ink + U.contour,
      [x0, y0, x1, y1] = boxOf(inner, total + 2, W, H);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = idx(x, y);
        if (!mask.armNear[i]) continue;
        const { d, point } = nearestOn(inner, x, y);
        if (d < U.cloth || d > total) continue;
        // Only where there is body on the other side of the boundary.
        const n = unit(sub(point, [x, y])),
          bx = Math.round(point[0] + n[0] * 8),
          by = Math.round(point[1] + n[1] * 8);
        if (bx < 0 || by < 0 || bx >= W || by >= H || !bodySolid[idx(bx, by)]) continue;
        const colour = d < U.cloth + U.ink ? T.ink : contour;
        for (let c = 0; c < 3; c++) body.data[i * 4 + c] = colour[c];
        body.data[i * 4 + 3] = 255;
      }
  }
  // ---- Derived: limbs continued under their cover.
  // Only under the OPAQUE inside of the cover, so nothing derived shows through its soft edge.
  const cover = new Uint8Array(W * H);
  for (let y = 5; y < H - 5; y++)
    for (let x = 5; x < W - 5; x++) {
      const i = idx(x, y),
        opaque = (j) => body.data[j * 4 + 3] >= 250;
      if (opaque(i) && opaque(i - 5) && opaque(i + 5) && opaque(i - 5 * W) && opaque(i + 5 * W)) cover[i] = 1;
    }
  const legNearSolid = alphaMask(images.legNear, T.solid),
    legFarSolid = alphaMask(images.legFar, T.solid),
    armFarSolid = alphaMask(images.armFar, T.solid),
    thighNear = mirror(images.legNear, images.legNear, legNearSolid, segmentsOf(spec.pieces.legNear.polygon, spec.pieces.legNear.hem), T.legUnder, (i) => !mask.legNear[i] && cover[i] === 1),
    thighFar = mirror(images.legFar, images.legFar, legFarSolid, segmentsOf(spec.pieces.legFar.polygon, spec.pieces.legFar.hem), T.legUnder, (i) => !mask.legFar[i] && cover[i] === 1),
    armStub = mirror(images.armFar, images.armFar, armFarSolid, segmentsOf(spec.pieces.armFar.polygon, spec.pieces.armFar.cut), T.armFarUnder, (i) => !mask.armFar[i] && cover[i] === 1);
  notes.push(`derived px: body under near arm ${cloth} cloth (+ ink and contour band), thigh tops ${thighNear} / ${thighFar}, far arm under sleeve ${armStub}`);

  // ---- Bones (bind pose = the drawing).
  const P = (name, s) => J[`${name}${s}`],
    ground = [J.pelvis[0], Math.max(J.heelR[1], J.heelL[1], J.toeR[1], J.toeL[1])],
    bones = [],
    bone = (name, parent, point, end) => bones.push({ name, parent, point, end });
  bone('root', null, ground);
  bone('pelvis', 'root', J.pelvis, J.spine);
  bone('spine', 'pelvis', J.spine, J.chest);
  bone('chest', 'spine', J.chest, J.neck);
  bone('neck', 'chest', J.neck, J.head);
  bone('head', 'neck', J.head, J.headTop);
  for (const [tag, s] of [['near', near], ['far', far]]) {
    bone(`clavicle_${tag}`, 'chest', J.chest, P('shoulder', s));
    bone(`upper_arm_${tag}`, `clavicle_${tag}`, P('shoulder', s), P('elbow', s));
    bone(`forearm_${tag}`, `upper_arm_${tag}`, P('elbow', s), P('wrist', s));
    bone(`hand_${tag}`, `forearm_${tag}`, P('wrist', s), P('hand', s));
  }
  for (const [tag, s] of [['near', near], ['far', far]]) {
    bone(`thigh_${tag}`, 'pelvis', P('hip', s), P('knee', s));
    bone(`shin_${tag}`, `thigh_${tag}`, P('knee', s), P('ankle', s));
    bone(`foot_${tag}`, `shin_${tag}`, P('ankle', s), P('toe', s));
  }
  const sockets = [['near', near], ['far', far]].flatMap(([tag, s]) => [
    { name: `palm_${tag}`, bone: `hand_${tag}`, point: [(P('wrist', s)[0] + P('hand', s)[0]) / 2, (P('wrist', s)[1] + P('hand', s)[1]) / 2] },
    { name: `ankle_${tag}`, bone: `foot_${tag}`, point: P('ankle', s) },
    { name: `heel_${tag}`, bone: `foot_${tag}`, point: P('heel', s) },
    { name: `toe_${tag}`, bone: `foot_${tag}`, point: P('toe', s) },
  ]);

  // ---- Weights.
  const tidy = (out) => {
    const top = Object.entries(out).filter(([, v]) => v > 1e-4).sort((p, q) => q[1] - p[1]).slice(0, 4),
      sum = top.reduce((n, e) => n + e[1], 0) || 1;
    return Object.fromEntries(top.map(([key, v]) => [key, v / sum]));
  };
  const chain3 = (names, a, b, c, d, bandB, bandC) => {
    const n1 = unit(add(unit(sub(b, a)), unit(sub(c, b)))),
      n2 = unit(add(unit(sub(c, b)), unit(sub(d, c))));
    return (x, y) => {
      const t1 = smoothstep(-bandB, bandB, dot(sub([x, y], b), n1)),
        t2 = smoothstep(-bandC, bandC, dot(sub([x, y], c), n2));
      return { [names[0]]: 1 - t1, [names[1]]: t1 * (1 - t2), [names[2]]: t1 * t2 };
    };
  };
  // Spine: position along pelvis -> spine -> chest -> neck, then the tilted neck line for the head.
  const spineStops = [J.pelvis, J.spine, J.chest, J.neck],
    spineNames = ['pelvis', 'spine', 'chest', 'neck'],
    napeToThroat = unit(sub(spec.neckLine[1], spec.neckLine[0])),
    headUp = (() => {
      let n = [napeToThroat[1], -napeToThroat[0]];
      if (dot(n, sub(J.headTop, J.head)) < 0) n = [-n[0], -n[1]];
      return n;
    })(),
    hipY = (J.hipR[1] + J.hipL[1]) / 2,
    hemY = Math.max(...spec.pieces.legNear.polygon.slice(...[spec.pieces.legNear.hem[0], spec.pieces.legNear.hem[1] + 1]).map((p) => p[1])),
    nearSign = Math.sign(P('hip', near)[0] - P('hip', far)[0]) || -1,
    bodyWeights = (x, y) => {
      const out = {};
      let carry = 1;
      for (let k = 0; k < spineStops.length; k++) {
        let next = 0;
        if (k + 1 < spineStops.length) {
          const joint = spineStops[k + 1],
            dir = unit(add(unit(sub(joint, spineStops[k])), unit(sub(spineStops[Math.min(k + 2, 3)] === joint ? J.head : spineStops[k + 2], joint))));
          next = smoothstep(-T.spineBand, T.spineBand, dot(sub([x, y], joint), dir));
        }
        out[spineNames[k]] = carry * (1 - next);
        carry *= next;
      }
      // Head: above the neck line.
      const head = smoothstep(-T.neckBand, T.neckBand, dot(sub([x, y], spec.neckLine[0]), headUp));
      for (const key of Object.keys(out)) out[key] *= 1 - head;
      out.head = head;
      // Shoulders: cloth near a shoulder joint follows that clavicle.
      for (const [tag, s] of [['near', near], ['far', far]]) {
        const d = len(sub([x, y], P('shoulder', s))),
          share = T.shoulderShare * (1 - smoothstep(T.shoulderInner, T.shoulderOuter, d)) * (1 - head);
        if (share <= 0) continue;
        for (const key of ['spine', 'chest', 'neck']) {
          const moved = (out[key] ?? 0) * share;
          out[key] -= moved;
          out[`clavicle_${tag}`] = (out[`clavicle_${tag}`] ?? 0) + moved;
        }
      }
      // Shorts: follow the thigh on their side, more toward the hem.
      if (y > hipY) {
        const follow = T.shortsFollow * smoothstep(hipY, hipY + 0.75 * (hemY - hipY), y) * (out.pelvis ?? 0),
          toNear = smoothstep(-T.shortsSideBlend, T.shortsSideBlend, (x - J.pelvis[0]) * nearSign);
        out.pelvis -= follow;
        out.thigh_near = follow * toNear;
        out.thigh_far = follow * (1 - toNear);
      }
      return tidy(out);
    };
  const limb = (tag, s, kind) => {
      if (kind === 'arm') {
        const upper = len(sub(P('elbow', s), P('shoulder', s)));
        return chain3([`upper_arm_${tag}`, `forearm_${tag}`, `hand_${tag}`], P('shoulder', s), P('elbow', s), P('wrist', s), P('hand', s), T.elbowBand * upper, T.wristBand * upper);
      }
      const thigh = len(sub(P('knee', s), P('hip', s)));
      return chain3([`thigh_${tag}`, `shin_${tag}`, `foot_${tag}`], P('hip', s), P('knee', s), P('ankle', s), P('toe', s), T.kneeBand * thigh, T.ankleBand * thigh);
    },
    armNearChain = limb('near', near, 'arm'),
    seam = segmentsOf(spec.pieces.armNear.polygon, spec.pieces.armNear.seam ?? [spec.pieces.armNear.inner[0], spec.pieces.armNear.inner[0] + 1]),
    upperDir = unit(sub(P('elbow', near), P('shoulder', near))),
    armNearWeights = (x, y) => {
      // At the seam and above the shoulder the sleeve is still the trunk's cloth
      // (same weights as the body there), then it becomes the arm.
      const out = armNearChain(x, y),
        s = dot(sub([x, y], P('shoulder', near)), upperDir),
        arm = Math.min(smoothstep(T.sleeveBlend[0], T.sleeveBlend[1], s), smoothstep(0, T.seamBand, nearestOn(seam, x, y).d)),
        trunk = bodyWeights(x, y);
      for (const key of Object.keys(out)) out[key] *= arm;
      for (const [key, v] of Object.entries(trunk)) out[key] = (out[key] ?? 0) + v * (1 - arm);
      return tidy(out);
    },
    identity = (x, y) => [x, y],
    parts = [
      { name: 'arm_far', image: images.armFar, place: identity, weights: (x, y) => tidy(limb('far', far, 'arm')(x, y)) },
      { name: 'leg_far', image: images.legFar, place: identity, weights: (x, y) => tidy(limb('far', far, 'leg')(x, y)) },
      { name: 'leg_near', image: images.legNear, place: identity, weights: (x, y) => tidy(limb('near', near, 'leg')(x, y)) },
      { name: 'body', image: body, place: identity, weights: bodyWeights },
      { name: 'arm_near', image: images.armNear, place: identity, weights: armNearWeights },
    ];
  let top = 0;
  while (top < H && !solid.subarray(top * W, (top + 1) * W).includes(1)) top++;
  let debris = 0;
  for (let i = 0; i < W * H; i++) if (!solid[i] && data[i * 4 + 3] >= T.solid) debris++;
  notes.push(`detached debris dropped: ${debris} px; silhouette top y ${top}`);
  return { bones, sockets, parts, notes, facing: 1, width: W, height: H, heightPx: ground[1] - J.headTop[1], tunables: T, joints: J, nearSide: near };
}
