// Full-body cut: turns ONE standing whole-figure drawing (transparent RGBA,
// optionally with a sticker contour) into the same layered, skinned rig the
// front parts sheet gives. Used for the owner's `back` and `threeQuarterFront`
// turnaround drawings. Same code for every character and view; inputs are the
// drawing, the shared Proportions (to estimate joints from the silhouette) and
// optional hand corrections of single joints.
//
// What is DERIVED here (never painted): the hidden trunk under a hanging arm
// (flat colour taken from the cloth right beside the arm, with an outline),
// outlines on new cut edges, and, in a three-quarter drawing, the far arm:
// it is mostly hidden by the trunk, so the poser draws the near arm's drawing
// for it (the drawn far forearm and hand are cut away and not used).
import { alphaMask, blankImage, distanceTo, luminance } from './raster.mjs';
import { FRONT, extent, largestComponent, removeSticker, rigParts, rowRuns } from './front.mjs';

/** Tunables of the full-body cut. Metres are converted with the drawing's own scale. */
export const BODY = {
  dark: 78, // luminance under which a pixel counts as outline
  armReach: 0.12, // m: pixels this far from an arm bone can belong to the arm
  armInnerMax: 0.075, // m: search limit for the arm's inner outline
  armHalfWidth: 0.045, // m: assumed arm half width when it cannot be read off the silhouette
  armInnerSlack: 1.15, // inner radius allowed above the forearm's (sleeves, dotted cloth)
  under: 16, // px of the arm kept on the trunk as overlap
  fillDepth: 0.55, // of the arm's width: how far under the arm the hidden trunk is filled
  fillSample: [6, 28], // px beside the arm from which the fill colour is taken
  outline: 2.5, // px outline on derived edges
  ink: [28, 24, 26],
  headKeepsBelow: 16,
  trunkKeepsAbove: 8,
  legTop: 12, // px above the hip joint kept on a leg part
  hemPast: 6, // px of trunk kept below the detected hem
  skinTolerance: 90, // summed RGB distance to the knee's skin colour
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  dot = (a, b) => a[0] * b[0] + a[1] * b[1],
  len = (a) => Math.hypot(a[0], a[1]),
  unit = (a) => {
    const l = len(a) || 1;
    return [a[0] / l, a[1] / l];
  },
  lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
  median = (list) => {
    const sorted = list.slice().sort((p, q) => p - q);
    return sorted.length ? sorted[sorted.length >> 1] : 0;
  };

/** Closest point of a polyline: { d, s (arc length), side (signed offset, + = left of travel), k (segment) }. */
function onPolyline(points, x, y) {
  let best = { d: Infinity, s: 0, side: 0, k: 0 },
    walked = 0;
  for (let k = 0; k + 1 < points.length; k++) {
    const a = points[k],
      b = points[k + 1],
      ab = sub(b, a),
      l = len(ab) || 1,
      t = Math.min(1, Math.max(0, dot(sub([x, y], a), ab) / (l * l))),
      px = a[0] + ab[0] * t,
      py = a[1] + ab[1] * t,
      d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { d, s: walked + t * l, side: ((x - a[0]) * -ab[1] + (y - a[1]) * ab[0]) / l, k };
    walked += l;
  }
  return best;
}

/**
 * Joints from the silhouette and the shared proportions. Heights come from the
 * proportions (the drawing is scaled to the character's height); left-right
 * positions from the silhouette's rows. `view` is 'back' or 'threeQuarterFront'
 * (facing screen-right). Returns Character Lab joint names -> [x, y].
 */
export function estimateLandmarks(image, p, view) {
  const rows = rowRuns(image, 6),
    solid = rows.map((runs) => runs.length > 0);
  let top = solid.indexOf(true),
    ground = solid.lastIndexOf(true);
  const ppm = (ground - top) / p.height,
    y = (metres) => Math.round(ground - metres * ppm),
    wide = (yy) => rows[Math.max(0, Math.min(rows.length - 1, yy))].slice().sort((a, b) => b[1] - b[0] - (a[1] - a[0])),
    mid = (run) => (run[0] + run[1]) / 2,
    turned = view === 'threeQuarterFront' ? Math.SQRT1_2 : 1,
    // Which screen side the character's LEFT is on: left for a back view, right otherwise.
    leftSign = view === 'back' ? -1 : 1,
    J = {};
  const yAnkle = y(p.ankleHeight),
    yKnee = y(p.ankleHeight + p.shin),
    yPelvis = y(p.pelvisHeight),
    ySpine = y(p.pelvisHeight + p.spine),
    yChest = y(p.pelvisHeight + p.spine + p.chestLen),
    yHead = y(p.pelvisHeight + p.spine + p.chestLen + p.neck),
    yElbow = Math.round(yChest + p.upperArm * ppm),
    yWrist = Math.round(yElbow + p.forearm * ppm),
    yTip = Math.round(yWrist + p.hand * ppm);
  // Legs: the two widest runs at knee and ankle height, left to right.
  const pair = (yy) => wide(yy).slice(0, 2).sort((a, b) => a[0] - b[0]),
    knees = pair(yKnee),
    ankles = pair(yAnkle),
    legSide = (i) => ((i === 0) === (leftSign < 0) ? 'L' : 'R'),
    centre = (mid(knees[0]) + mid(knees[knees.length - 1])) / 2;
  for (let i = 0; i < 2; i++) {
    const s = legSide(i),
      knee = knees[Math.min(i, knees.length - 1)],
      ankle = ankles[Math.min(i, ankles.length - 1)];
    J[`knee${s}`] = [mid(knee), yKnee];
    J[`ankle${s}`] = [mid(ankle), yAnkle];
    J[`hip${s}`] = [centre + (i === 0 ? -1 : 1) * (p.hipWidth / 2) * ppm * turned, yPelvis];
    // Foot: the leg's own bottom, read off the rows under the ankle.
    let bottom = yAnkle,
      low = ankle;
    for (let yy = yAnkle; yy <= ground; yy++) {
      const run = rows[yy].find((r) => r[1] >= ankle[0] - 30 && r[0] <= ankle[1] + 30);
      if (!run) break;
      bottom = yy;
      low = run;
    }
    if (view === 'back') {
      J[`heel${s}`] = [mid(ankle), bottom - 0.12 * (bottom - yAnkle)];
      J[`toe${s}`] = [mid(ankle), yAnkle + 0.35 * (bottom - yAnkle)]; // hidden, away from the camera
    } else {
      const sole = rows[bottom - 6].find((r) => r[1] >= ankle[0] - 60 && r[0] <= ankle[1] + 200) ?? low;
      J[`heel${s}`] = [Math.min(mid(ankle), sole[0] + 0.2 * (sole[1] - sole[0])), bottom - 8];
      J[`toe${s}`] = [sole[1] - 6, bottom - 6];
    }
  }
  J.pelvis = [centre, yPelvis];
  // Chest: centre of the widest run at shoulder height (biased by a near sleeve in 3/4: corrected by hand if needed).
  const chestRun = wide(yChest)[0],
    headRun = wide(yHead - Math.round(0.03 * ppm))[0],
    chestX = view === 'back' ? mid(chestRun) : mid(chestRun) + 0.02 * ppm;
  J.chest = [chestX, yChest];
  J.spine = [(centre + chestX) / 2, ySpine];
  J.head = [mid(headRun), yHead];
  J.neck = lerp(J.chest, J.head, 0.35);
  J.headTop = [J.head[0], top];
  // Arms hang: elbow and wrist heights from the proportions, x from the outer silhouette.
  const half = BODY.armHalfWidth * ppm;
  for (const sign of [-1, 1]) {
    const s = sign * leftSign > 0 ? 'L' : 'R',
      edge = (yy) => {
        const e = extent(rows[yy]);
        return sign < 0 ? e[0] : e[1];
      },
      outer = (yy) => {
        // The outermost run, when it is a separate arm; else the silhouette edge inset by half an arm.
        const runs = rows[yy],
          run = sign < 0 ? runs[0] : runs[runs.length - 1];
        return runs.length >= 3 && run[1] - run[0] < 4 * half ? mid(run) : edge(yy) - sign * half;
      };
    J[`shoulder${s}`] = [chestX + sign * (p.shoulderWidth / 2) * ppm * turned, yChest];
    J[`elbow${s}`] = [outer(yElbow), yElbow];
    J[`wrist${s}`] = [outer(yWrist), yWrist];
    const tipRun = (() => {
      for (let yy = yTip + Math.round(0.06 * ppm); yy > yWrist; yy--) {
        const runs = rows[yy],
          run = sign < 0 ? runs[0] : runs[runs.length - 1];
        if (run && Math.abs(mid(run) - J[`wrist${s}`][0]) < 3 * half) return [mid(run), yy];
      }
      return [J[`wrist${s}`][0], yTip];
    })();
    J[`hand${s}`] = tipRun; // fingertip; the palm socket is derived from it
  }
  return { joints: J, ppm, ground, top, leftSign };
}

/**
 * @param sheet        decoded RGBA drawing (only read)
 * @param proportions  the character's shared Proportions
 * @param spec         { view: 'back' | 'threeQuarterFront', landmarks?: { joint: [x, y] } (hand corrections), overrides? }
 */
export function bodyCut(sheet, proportions, spec) {
  const T = { ...FRONT, ...BODY, ...(spec.overrides ?? {}) },
    view = spec.view,
    notes = [],
    W = sheet.width,
    H = sheet.height,
    image = { width: W, height: H, data: new Uint8ClampedArray(sheet.data) };
  // Semi-transparent debris around the figure, then the sticker contour.
  for (let o = 3; o < image.data.length; o += 4) if (image.data[o] < 200) image.data[o] = 0;
  largestComponent(image);
  const sticker = removeSticker(image);
  largestComponent(image);
  notes.push(`sticker contour removed, measured width ${sticker} px`);
  const estimate = estimateLandmarks(image, proportions, view),
    { ppm, leftSign } = estimate,
    J = { ...estimate.joints },
    corrected = Object.keys(spec.landmarks ?? {});
  for (const name of corrected) J[name] = spec.landmarks[name];
  notes.push(`joints estimated from the silhouette and proportions (${Object.keys(estimate.joints).length}); corrected by hand: ${corrected.length ? corrected.join(', ') : 'none'}`);
  const { data } = image,
    solid = alphaMask(image, 128),
    idx = (x, y) => y * W + x,
    isDark = (i) => luminance(data, i * 4) < T.dark,
    centreX = J.chest[0],
    nearSide = view === 'threeQuarterFront' ? (leftSign > 0 ? 'R' : 'L') : null,
    armOf = (s) => [J[`shoulder${s}`], J[`elbow${s}`], J[`wrist${s}`], J[`hand${s}`]];

  // ---- Arms: everything outside the arm's inner outline, which is followed along the bone.
  const reach = T.armReach * ppm;
  function armMaskFor(s) {
    const line = armOf(s),
      total = len(sub(line[1], line[0])) + len(sub(line[2], line[1])) + len(sub(line[3], line[2])),
      upper = len(sub(line[1], line[0])),
      n = Math.ceil(total / 4) + 1,
      inner = new Float64Array(n),
      // + = toward the trunk centre.
      inwardSign = (k) => {
        const a = line[k],
          b = line[k + 1],
          ab = unit(sub(b, a)),
          normal = [-ab[1], ab[0]]; // "left of travel" for onPolyline's sign
        return (centreX - (a[0] + b[0]) / 2) * normal[0] >= 0 ? 1 : -1;
      };
    for (let q = 0; q < n; q++) {
      let s0 = q * 4,
        k = 0;
      while (k < 2 && s0 > len(sub(line[k + 1], line[k]))) {
        s0 -= len(sub(line[k + 1], line[k]));
        k++;
      }
      const a = line[k],
        ab = unit(sub(line[k + 1], a)),
        at = [a[0] + ab[0] * s0, a[1] + ab[1] * s0],
        sign = inwardSign(k),
        normal = [-ab[1] * sign, ab[0] * sign];
      let r = T.armInnerMax * ppm,
        run = 0;
      for (let t = 4; t < T.armInnerMax * ppm; t++) {
        const x = Math.round(at[0] + normal[0] * t),
          y = Math.round(at[1] + normal[1] * t);
        if (x < 0 || y < 0 || x >= W || y >= H || !solid[idx(x, y)]) {
          r = t;
          break;
        }
        run = isDark(idx(x, y)) ? run + 1 : 0;
        if (run >= 3) {
          r = t + 2;
          break;
        }
      }
      inner[q] = r;
    }
    // The forearm (skin against cloth or air) is the reliable part; bound the rest by it.
    const fore = median(Array.from(inner.slice(Math.floor(upper / 4) + 2, Math.floor((total - len(sub(line[3], line[2]))) / 4)))),
      smooth = new Float64Array(n);
    for (let q = 0; q < n; q++) {
      const window = Array.from(inner.slice(Math.max(0, q - 5), q + 6));
      smooth[q] = Math.min(T.armInnerSlack * fore, Math.max(0.6 * fore, median(window)));
    }
    const mask = new Uint8Array(W * H),
      offset = new Float32Array(W * H), // inward offset minus the inner radius (<= 0 inside the arm)
      along = new Float32Array(W * H),
      signs = [inwardSign(0), inwardSign(1), inwardSign(2)],
      x0 = Math.max(0, Math.floor(Math.min(...line.map((p) => p[0])) - reach)),
      x1 = Math.min(W - 1, Math.ceil(Math.max(...line.map((p) => p[0])) + reach)),
      y0 = Math.max(0, Math.floor(line[0][1] - reach)),
      y1 = Math.min(H - 1, Math.ceil(Math.max(...line.map((p) => p[1])) + reach * 0.6));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = idx(x, y);
        if (!solid[i]) continue;
        const c = onPolyline(line, x, y);
        if (c.d > reach) continue;
        const inwardOffset = c.side * signs[c.k],
          r = smooth[Math.min(n - 1, Math.round(c.s / 4))];
        // Above the shoulder the cap is round: do not take the collar with it.
        if (c.s <= 0 && c.d > r * 1.25) continue;
        offset[i] = inwardOffset - r;
        along[i] = c.s;
        if (inwardOffset <= r) mask[i] = 1;
      }
    return { mask, offset, along, smooth, fore, line, total };
  }
  const arms = { L: armMaskFor('L'), R: armMaskFor('R') };

  // ---- Legs: below the hips, each pixel to the nearer leg bone.
  const legLine = (s) => [J[`hip${s}`], J[`knee${s}`], J[`ankle${s}`], J[`toe${s}`]],
    legMask = { L: new Uint8Array(W * H), R: new Uint8Array(W * H) },
    hipY = (J.hipL[1] + J.hipR[1]) / 2;
  for (let y = Math.round(hipY - T.legTop); y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (!solid[i] || arms.L.mask[i] || arms.R.mask[i]) continue;
      const l = onPolyline(legLine('L'), x, y).d,
        r = onPolyline(legLine('R'), x, y).d;
      legMask[l <= r ? 'L' : 'R'][i] = 1;
    }
  // Hem: going down each thigh, the last place that is not the knee's skin colour.
  const hem = {};
  for (const s of ['L', 'R']) {
    const knee = J[`knee${s}`],
      hip = J[`hip${s}`],
      sample = (p) => {
        const o = idx(Math.round(p[0]), Math.round(p[1])) * 4;
        return [data[o], data[o + 1], data[o + 2]];
      },
      skin = sample(lerp(hip, knee, 0.97));
    hem[s] = knee[1];
    for (let t = 0.95; t > 0; t -= 0.01) {
      const c = sample(lerp(hip, knee, t));
      if (Math.abs(c[0] - skin[0]) + Math.abs(c[1] - skin[1]) + Math.abs(c[2] - skin[2]) > T.skinTolerance && luminance(c, 0) > T.dark * 0.5) {
        // Dark = the hem's own outline; keep going one more step.
        hem[s] = lerp(hip, knee, t)[1] + 8;
        break;
      }
    }
  }
  notes.push(`hem y: L ${hem.L.toFixed(0)}, R ${hem.R.toFixed(0)}; scale ${ppm.toFixed(1)} px/m`);

  // ---- Part images.
  const cut = (test) => {
    const out = blankImage(W, H);
    for (let i = 0; i < W * H; i++)
      if (solid[i] && test(i, i % W, (i / W) | 0)) for (let c = 0; c < 4; c++) out.data[i * 4 + c] = data[i * 4 + c];
    return out;
  };
  /** Dark line on the part's edge wherever `where` holds (new cut edges). */
  const outlineEdge = (part, where) => {
    const outside = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) outside[i] = part.data[i * 4 + 3] < 128 ? 1 : 0;
    const dist = distanceTo(outside, W, H);
    for (let i = 0; i < W * H; i++)
      if (!outside[i] && dist[i] <= T.outline && where(i, i % W, (i / W) | 0)) for (let c = 0; c < 3; c++) part.data[i * 4 + c] = T.ink[c];
  };
  const headLine = J.head[1],
    headImage = cut((i, x, y) => y < headLine + T.headKeepsBelow && !arms.L.mask[i] && !arms.R.mask[i]),
    // An arm that is drawn as a part; in a three-quarter drawing only the near one.
    drawn = (s) => !nearSide || s === nearSide,
    trunkImage = cut((i, x, y) => {
      if (y < headLine - T.trunkKeepsAbove) return false;
      for (const s of ['L', 'R']) {
        if (arms[s].mask[i] && (!drawn(s) || arms[s].offset[i] < -T.under)) return false;
        if (legMask[s][i] && y > hem[s] + T.hemPast) return false;
      }
      return true;
    });
  // Hidden trunk under a hanging arm: flat colour from the cloth just beside the arm.
  let invented = 0;
  for (const s of ['L', 'R']) {
    if (!drawn(s)) continue;
    const arm = arms[s],
      n = arm.smooth.length,
      sums = Array.from({ length: n }, () => [[], [], []]);
    for (let i = 0; i < W * H; i++) {
      if (!solid[i] || arm.mask[i] || arms[s === 'L' ? 'R' : 'L'].mask[i] || !arm.along[i] || isDark(i)) continue;
      if (arm.offset[i] < T.fillSample[0] || arm.offset[i] > T.fillSample[1]) continue;
      const q = Math.min(n - 1, Math.round(arm.along[i] / 4));
      for (let c = 0; c < 3; c++) sums[q][c].push(data[i * 4 + c]);
    }
    const colour = sums.map((channels) => (channels[0].length >= 6 ? channels.map(median) : null));
    // Where nothing lies beside the arm (air), there is no trunk to continue.
    for (let i = 0; i < W * H; i++) {
      if (!arm.mask[i] || arm.offset[i] >= -T.under) continue;
      const q = Math.min(n - 1, Math.round(arm.along[i] / 4)),
        y = (i / W) | 0;
      if (!colour[q] || y < headLine + T.headKeepsBelow || arm.offset[i] < -2 * T.fillDepth * arm.smooth[q]) continue;
      if (legMask.L[i] || legMask.R[i]) continue;
      for (let c = 0; c < 3; c++) trunkImage.data[i * 4 + c] = colour[q][c];
      trunkImage.data[i * 4 + 3] = 255;
      invented++;
    }
    outlineEdge(trunkImage, (i) => arm.mask[i] === 1);
  }
  notes.push(`hidden trunk under the arms: ${invented} px filled with flat cloth colour`);
  const armImage = {},
    A = {},
    L = {};
  for (const s of ['L', 'R']) {
    // In a three-quarter drawing the far arm is hidden: the near arm's drawing stands in.
    const source = drawn(s) ? s : nearSide,
      from = arms[source];
    armImage[s] = cut((i) => from.mask[i] === 1);
    A[s] = { image: armImage[s], shoulder: J[`shoulder${source}`], elbow: J[`elbow${source}`], wrist: J[`wrist${source}`], tip: J[`hand${source}`] };
    const legImage = cut((i, x, y) => legMask[s][i] === 1);
    outlineEdge(legImage, (i, x, y) => y < hem[s] - 4 && Math.abs(y - (hipY - T.legTop)) > 6);
    L[s] = { image: legImage, hip: J[`hip${s}`], knee: J[`knee${s}`], ankle: J[`ankle${s}`], heel: J[`heel${s}`], toe: J[`toe${s}`] };
  }
  const result = rigParts({
    leftSign,
    W, H, A, L,
    pelvis: J.pelvis, spineJoint: J.spine, chest: J.chest, neckJoint: J.neck, headJoint: J.head,
    headTop: J.headTop,
    ground: estimate.ground,
    hem: Math.max(hem.L, hem.R),
    hipY,
    figureCentre: J.pelvis[0],
    trunkImage, headImage, T, notes,
  });
  // The far arm of a three-quarter drawing reuses the near arm's bones and art.
  if (nearSide) {
    const far = nearSide === 'L' ? 'R' : 'L';
    result.parts = result.parts.filter((part) => part.name !== `arm_${far}` && part.name !== `hand_${far}`);
  }
  // Real shoulder/elbow/wrist positions of both sides, for the poser's sockets.
  for (const s of ['L', 'R']) {
    result.joints[`shoulder${s}`] = J[`shoulder${s}`];
    result.joints[`elbow${s}`] = J[`elbow${s}`];
    result.joints[`wrist${s}`] = J[`wrist${s}`];
  }
  return { ...result, leftSign, nearSide, estimated: estimate.joints, corrected, ppm };
}
