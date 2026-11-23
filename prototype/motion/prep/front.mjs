// Front-view cut: turns a front "parts sheet" (armless trunk with shorts, a
// head, two hanging arms, two legs; chroma-keyed, optionally with a white
// sticker contour) into the same layered, skinned cut-out the side re-cut
// produces. Same code for every character; the only inputs are the sheet, the
// part rectangles / joint fractions (the shipped `lib/arena/puppet-assets.json`
// `skin` entry has exactly these) and the side view's vertical proportions.
//
// `mode: 'back'` builds the BACK STAND-IN from the same parts: the trunk above
// the waist and the head are filled with one flat garment / hair colour inside
// their own outline. Nothing is painted or generated beyond those flat fills.
import {
  alphaMask,
  blankImage,
  bounds,
  distanceTo,
  flood,
  luminance,
  sample,
  smoothstep,
} from './raster.mjs';
import { keySource } from './recut.mjs';

/** Every tunable of the front cut, in sheet pixels unless noted. */
export const FRONT = {
  canvas: [1280, 1560], // working figure canvas (trunk at native sheet scale)
  // Sticker contour removal.
  stickerMaxWidth: 30, // search limit for the measured contour width
  stickerLum: 165, // contour is lighter than this ...
  stickerChroma: 70, // ... and this grey
  stickerSlack: 3, // flood this far past the measured width
  stickerCleanLum: 120, // antialiased remnant next to the removed contour
  stickerCleanPasses: 2,
  // Trunk landmarks.
  shoulderNeckWidth: 0.6, // row where the trunk reaches this share of shoulder width = shoulder top
  shoulderFullWidth: 0.92, // ... and this share = shoulder line
  shoulderInset: 0.3, // joint inset from the trunk edge, of sleeve width
  shoulderDrop: 0.32, // joint below the shoulder line, of sleeve width
  // Bands (px) over which neighbouring bones blend.
  spineBand: 22,
  elbowBand: 0.16, // of upper-arm length
  wristBand: 0.1,
  kneeBand: 0.16, // of thigh length
  ankleBand: 0.1,
  shortsFollow: 0.92, // how far the hem follows its thigh
  shortsSideBlend: 14,
  neckOverlap: 10, // head joint this far below the top of the trunk's neck stub
  headOverlap: 0.94, // fallback head anchor (fraction of the head piece height)
  // Back stand-in.
  backOutline: 4, // px of the original outline kept around a flat fill
  backNeckShare: 0.2, // bottom share of the head filled with neck skin
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k],
  dot = (a, b) => a[0] * b[0] + a[1] * b[1],
  len = (a) => Math.hypot(a[0], a[1]),
  unit = (a) => {
    const l = len(a) || 1;
    return [a[0] / l, a[1] / l];
  },
  lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function crop(image, [x0, y0, w, h]) {
  const out = blankImage(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = x0 + x,
        sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
      const from = (sy * image.width + sx) * 4,
        to = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out.data[to + c] = image.data[from + c];
    }
  return out;
}

/** Keep only the largest connected opaque component (drops sheet dividers). */
function largestComponent(image) {
  const { width, height } = image,
    solid = alphaMask(image, 128),
    seen = new Uint8Array(width * height);
  let best = null,
    bestCount = 0;
  for (let i = 0; i < solid.length; i++) {
    if (!solid[i] || seen[i]) continue;
    const component = flood(solid, width, height, [[i % width, (i / width) | 0]]);
    let n = 0;
    for (let j = 0; j < component.length; j++)
      if (component[j]) {
        seen[j] = 1;
        n++;
      }
    if (n > bestCount) {
      bestCount = n;
      best = component;
    }
  }
  const grown = distanceTo(best, width, height);
  for (let i = 0; i < solid.length; i++) if (grown[i] > 1.5) image.data[i * 4 + 3] = 0;
  return image;
}

/** Remove a light "sticker" contour outside the drawing's dark outline.
 * Returns the measured contour width (0 when there is none). */
function removeSticker(image) {
  const { width, height, data } = image,
    background = new Uint8Array(width * height);
  // A one pixel transparent frame so the distance works at the crop border.
  for (let i = 0; i < background.length; i++) {
    const x = i % width,
      y = (i / width) | 0;
    background[i] = data[i * 4 + 3] < 128 || x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 1 : 0;
  }
  const dist = distanceTo(background, width, height),
    sums = new Float64Array(FRONT.stickerMaxWidth + 2),
    counts = new Float64Array(FRONT.stickerMaxWidth + 2);
  for (let i = 0; i < background.length; i++) {
    const d = Math.round(dist[i]);
    if (background[i] || d < 1 || d > FRONT.stickerMaxWidth) continue;
    sums[d] += luminance(data, i * 4);
    counts[d]++;
  }
  // Light at the very edge, then the dark outline: the contour width is where
  // the dark pixels nearest the silhouette start (10th percentile of depth).
  if (!counts[2] || sums[2] / counts[2] < FRONT.stickerLum) return 0;
  const depths = [];
  for (let i = 0; i < background.length; i++)
    if (!background[i] && dist[i] <= FRONT.stickerMaxWidth && luminance(data, i * 4) < 90) depths.push(dist[i]);
  if (depths.length < 50) return 0;
  depths.sort((p, q) => p - q);
  const measured = Math.ceil(depths[Math.floor(depths.length * 0.1)]);
  const allowed = new Uint8Array(width * height),
    seeds = [];
  for (let i = 0; i < allowed.length; i++) {
    if (background[i]) continue;
    const o = i * 4,
      chroma = Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]);
    if (luminance(data, o) > FRONT.stickerLum && chroma < FRONT.stickerChroma && dist[i] <= measured + FRONT.stickerSlack) {
      allowed[i] = 1;
      if (dist[i] <= 1.5) seeds.push([i % width, (i / width) | 0]);
    }
  }
  const removed = flood(allowed, width, height, seeds);
  for (let i = 0; i < removed.length; i++) if (removed[i]) data[i * 4 + 3] = 0;
  for (let pass = 0; pass < FRONT.stickerCleanPasses; pass++) {
    const gone = [];
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (data[i * 4 + 3] < 128 || luminance(data, i * 4) < FRONT.stickerCleanLum) continue;
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (data[((y + dy) * width + x + dx) * 4 + 3] < 128) {
              edge = true;
              break;
            }
        if (edge && dist[i] <= measured + FRONT.stickerSlack + 2) gone.push(i);
      }
    for (const i of gone) data[i * 4 + 3] = 0;
  }
  // Whatever half-transparent rim is left would show as a light fringe.
  for (let i = 0; i < background.length; i++) if (data[i * 4 + 3] < 128) data[i * 4 + 3] = 0;
  return measured;
}

/** Opaque runs [x0, x1] of each row. */
function rowRuns(image, minRun = 4) {
  const { width, height, data } = image,
    rows = [];
  for (let y = 0; y < height; y++) {
    const runs = [];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const on = x < width && data[(y * width + x) * 4 + 3] >= 128;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minRun) runs.push([start, x - 1]);
        start = -1;
      }
    }
    rows.push(runs);
  }
  return rows;
}
/** First and last row that carry a real run (ignores specks). */
function solidBox(rows) {
  let y0 = 0,
    y1 = rows.length - 1;
  while (y0 < y1 && !rows[y0].length) y0++;
  while (y1 > y0 && !rows[y1].length) y1--;
  return { y0, y1 };
}
const extent = (runs) => (runs.length ? [runs[0][0], runs[runs.length - 1][1]] : null);
const widthOf = (runs) => {
  const e = extent(runs);
  return e ? e[1] - e[0] + 1 : 0;
};

/** Draw `piece` onto a figure canvas at `scale` with its (px, py) at (fx, fy). */
function placePiece(canvasSize, piece, scale, [px, py], [fx, fy]) {
  const [W, H] = canvasSize,
    out = blankImage(W, H),
    taps = scale < 0.95 ? 3 : 1,
    rgba = [0, 0, 0, 0],
    x0 = Math.max(0, Math.floor(fx - px * scale) - 2),
    y0 = Math.max(0, Math.floor(fy - py * scale) - 2),
    x1 = Math.min(W, Math.ceil(fx + (piece.width - px) * scale) + 2),
    y1 = Math.min(H, Math.ceil(fy + (piece.height - py) * scale) + 2);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let ty = 0; ty < taps; ty++)
        for (let tx = 0; tx < taps; tx++) {
          const sx = (x + (tx + 0.5) / taps - 0.5 - fx) / scale + px,
            sy = (y + (ty + 0.5) / taps - 0.5 - fy) / scale + py;
          sample(piece, sx, sy, rgba);
          const alpha = rgba[3] / 255;
          r += rgba[0] * alpha;
          g += rgba[1] * alpha;
          b += rgba[2] * alpha;
          a += alpha;
        }
      if (a <= 0) continue;
      const o = (y * W + x) * 4,
        alpha = a / (taps * taps);
      out.data[o] = r / a;
      out.data[o + 1] = g / a;
      out.data[o + 2] = b / a;
      out.data[o + 3] = alpha >= 0.5 ? 255 : alpha > 0.15 ? alpha * 255 : 0;
    }
  return out;
}

function medianOf(image, test) {
  const channels = [[], [], []],
    { width, height, data } = image;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (data[o + 3] < 250 || !test(x, y, o)) continue;
      for (let c = 0; c < 3; c++) channels[c].push(data[o + c]);
    }
  return channels.map((list) => {
    list.sort((a, b) => a - b);
    return list.length ? list[list.length >> 1] : 128;
  });
}

/** Flat fill of the masked interior, keeping `FRONT.backOutline` px of outline. */
function flatFill(image, inside, colourAt) {
  const { width, height, data } = image,
    outside = new Uint8Array(width * height);
  for (let i = 0; i < outside.length; i++) outside[i] = data[i * 4 + 3] < 128 ? 1 : 0;
  const dist = distanceTo(outside, width, height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (outside[i] || dist[i] <= FRONT.backOutline || !inside(x, y)) continue;
      const colour = colourAt(x, y),
        // Keep a hint of form: a slightly darker rim just inside the outline.
        shade = 0.9 + 0.1 * smoothstep(FRONT.backOutline, FRONT.backOutline + 18, dist[i]);
      for (let c = 0; c < 3; c++) data[i * 4 + c] = colour[c] * shade;
    }
}

/**
 * @param sheet     decoded parts sheet
 * @param skin      { head, torso, armL, armR, legL, legR } with `rect` and, for
 *                  limbs, `root` / `joint` / `end` fractions and `width`; torso
 *                  `size`; head `anchor`. "L" is the part on the LEFT of the
 *                  sheet's assembled figure (the character's right side).
 * @param side      vertical reference from the side view, in side pixels:
 *                  { shoulderToGround, neck, headLen, spine, chestLen }
 * @param overrides optional per-character corrections (all listed in the rig)
 */
export function frontCut(sheet, skin, side, overrides = {}, mode = 'front') {
  const T = { ...FRONT, ...overrides },
    notes = [],
    keyed = keySource(sheet),
    piece = {},
    sticker = {};
  for (const name of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) {
    piece[name] = largestComponent(crop(keyed, skin[name].rect));
    sticker[name] = removeSticker(piece[name]);
    largestComponent(piece[name]);
  }
  overrides.onPieces?.(piece);
  notes.push(`sticker contour removed, measured width px: ${Object.entries(sticker).map(([k, v]) => `${k} ${v}`).join(', ')}`);

  // ---- Piece scales, relative to the trunk (from the shipped display sizes).
  // Arms: the shipped display widths (one scale for both arms). Legs: measured
  // below, so the leg's shorts hem is as wide as the trunk's leg opening.
  const torsoScale = skin.torso.size[0] / skin.torso.rect[2],
    armScale =
      ((skin.armL.width / skin.armL.rect[2] + skin.armR.width / skin.armR.rect[2]) / 2 / torsoScale) *
      (T.scale?.arm ?? 1);

  // ---- Trunk analysis (native scale; trunk placed with its centre at cx).
  const [W, H] = T.canvas,
    torso = piece.torso,
    tRows = rowRuns(torso, 12),
    tBox = solidBox(tRows),
    tHeight = tBox.y1 - tBox.y0 + 1;
  let shoulderWidth = 0;
  for (let y = tBox.y0; y < tBox.y0 + tHeight * 0.45; y++) shoulderWidth = Math.max(shoulderWidth, widthOf(tRows[y]));
  let shoulderTop = tBox.y0,
    shoulderLine = tBox.y0;
  for (let y = tBox.y0; y < tBox.y1; y++)
    if (widthOf(tRows[y]) >= T.shoulderNeckWidth * shoulderWidth) {
      shoulderTop = y;
      break;
    }
  for (let y = shoulderTop; y < tBox.y1; y++)
    if (widthOf(tRows[y]) >= T.shoulderFullWidth * shoulderWidth) {
      shoulderLine = y;
      break;
    }
  // Hem: the two leg openings a few rows above the bottom, and the crotch.
  const hemRow = tBox.y1 - 8,
    hemRuns = tRows[hemRow].length >= 2
      ? [tRows[hemRow][0], tRows[hemRow][tRows[hemRow].length - 1]]
      : (() => {
          const [a, b] = extent(tRows[hemRow]),
            mid = (a + b) >> 1;
          return [[a, mid], [mid + 1, b]];
        })();
  let crotch = hemRow;
  while (crotch > tBox.y0 && tRows[crotch].length >= 2) crotch--;
  const centreX = (hemRuns[0][1] + hemRuns[1][0]) / 2,
    neckRuns = extent(tRows.slice(tBox.y0, tBox.y0 + 40).find((runs) => widthOf(runs) >= 20) ?? [[0, torso.width]]),
    neckX = (neckRuns[0] + neckRuns[1]) / 2;
  // Figure placement of the trunk: its centre column at the canvas centre.
  const tx = Math.round(W / 2 - centreX),
    ty = 330,
    F = (p) => [p[0] + tx, p[1] + ty]; // trunk piece -> figure

  // ---- Legs: hem on hem.
  const leg = {},
    legInfo = {};
  for (const [name, run] of [['legL', hemRuns[0]], ['legR', hemRuns[1]]]) {
    const image = piece[name],
      rows = rowRuns(image, 12),
      box = solidBox(rows),
      h = box.y1 - box.y0 + 1;
    let hem = box.y0 + Math.round(h * 0.15),
      drop = -1;
    if (T.legHem?.[name] !== undefined) hem = box.y0 + Math.round(h * T.legHem[name]);
    else
      for (let y = box.y0 + 8; y < box.y0 + h * 0.45; y++) {
        const d = widthOf(rows[y - 4]) - widthOf(rows[y + 4]);
        if (d > drop) {
          drop = d;
          hem = y;
        }
      }
    legInfo[name] = { image, rows, box, h, hem, run, opening: (run[1] - run[0] + 1) / widthOf(rows[hem - 5]) };
  }
  const legScale = ((legInfo.legL.opening + legInfo.legR.opening) / 2) * (T.scale?.leg ?? 1);
  for (const name of ['legL', 'legR']) {
    const { image, rows, box, h, hem, run } = legInfo[name],
      scale = legScale,
      hemExtent = extent(rows[hem - 5]),
      hemCentre = (hemExtent[0] + hemExtent[1]) / 2,
      at = [(run[0] + run[1]) / 2 + tx, hemRow + ty],
      toFigure = (p) => [at[0] + (p[0] - hemCentre) * scale, at[1] + (p[1] - hem) * scale],
      fraction = ([fx, fy]) => toFigure([fx * image.width, fy * image.height]),
      // Toe: centre of the lowest rows.
      low = rows.slice(box.y1 - Math.round(h * 0.03), box.y1 + 1).flat(),
      toeX = low.reduce((n, r) => n + (r[0] + r[1]) / 2, 0) / low.length,
      topExtent = extent(rows[box.y0 + 4]);
    leg[name] = {
      image: placePiece([W, H], image, scale, [hemCentre, hem], at),
      hip: toFigure([(topExtent[0] + topExtent[1]) / 2, box.y0]),
      knee: fraction(skin[name].joint),
      ankle: fraction(skin[name].end),
      toe: toFigure([toeX, box.y1]),
      bottom: toFigure([0, box.y1])[1],
      scale,
    };
    notes.push(`${name}: scale ${scale.toFixed(3)} (hem match; the shipped display width implies ${(skin[name].width / skin[name].rect[2] / torsoScale).toFixed(3)}), hem at ${((hem - box.y0) / h).toFixed(3)} of the piece`);
  }
  const ground = Math.max(leg.legL.bottom, leg.legR.bottom);
  for (const l of [leg.legL, leg.legR]) l.heel = [l.ankle[0], l.bottom - 0.25 * (l.bottom - l.ankle[1])];

  // ---- Arms: shoulder joint on the trunk's shoulder corner.
  const arm = {};
  for (const [name, sideSign] of [['armL', -1], ['armR', 1]]) {
    const image = piece[name],
      rows = rowRuns(image, 12),
      box = solidBox(rows),
      h = box.y1 - box.y0 + 1,
      scale = armScale;
    let sleeve = 0;
    for (let y = box.y0; y < box.y0 + h * 0.25; y++) sleeve = Math.max(sleeve, widthOf(rows[y]));
    sleeve *= scale;
    const edge = extent(tRows[Math.min(tBox.y1, Math.round(shoulderLine + T.shoulderDrop * sleeve))]),
      joint = F([
        (sideSign < 0 ? edge[0] + T.shoulderInset * sleeve : edge[1] - T.shoulderInset * sleeve) +
          (T.shoulderShift?.[0] ?? 0) * sideSign,
        shoulderLine + T.shoulderDrop * sleeve + (T.shoulderShift?.[1] ?? 0),
      ]),
      root = [skin[name].root[0] * image.width, skin[name].root[1] * image.height],
      toFigure = (p) => [joint[0] + (p[0] - root[0]) * scale, joint[1] + (p[1] - root[1]) * scale],
      fraction = ([fx, fy]) => toFigure([fx * image.width, fy * image.height]),
      low = rows.slice(box.y1 - Math.round(h * 0.03), box.y1 + 1).flat(),
      tipX = low.reduce((n, r) => n + (r[0] + r[1]) / 2, 0) / low.length;
    arm[name] = {
      image: placePiece([W, H], image, scale, root, joint),
      shoulder: joint,
      elbow: fraction(skin[name].joint),
      wrist: fraction(skin[name].end),
      tip: toFigure([tipX, box.y1]),
      scale,
      sleeve,
    };
    notes.push(`${name}: scale ${scale.toFixed(3)}, sleeve width ${sleeve.toFixed(0)}`);
  }

  // ---- Spine joints from the side view's proportions, so both views agree.
  const chest = [(arm.armL.shoulder[0] + arm.armR.shoulder[0]) / 2, (arm.armL.shoulder[1] + arm.armR.shoulder[1]) / 2],
    k = (ground - chest[1]) / side.shoulderToGround, // figure px per side px
    // Hip height from the side view (the leg pieces start above the joint).
    hipY = ground - k * side.pelvisToGround,
    pelvis = [(leg.legL.hip[0] + leg.legR.hip[0]) / 2, hipY],
    // The head sits on the drawn neck stub (the art decides the neck length).
    headJoint = [neckX + tx, tBox.y0 + ty + T.neckOverlap + (T.headShift?.[1] ?? 0)],
    neckJoint = lerp(chest, headJoint, side.neckBase),
    spineJoint = lerp(pelvis, chest, side.spine / (side.spine + side.chestLen));
  leg.legL.hip[1] = leg.legR.hip[1] = hipY;
  // ---- Head: sized from the side view's head height.
  const headBox = bounds(alphaMask(piece.head, 128), piece.head.width),
    headHeight = headBox.y1 - headBox.y0 + 1,
    anchor = skin.head.anchor ?? [0.5, T.headOverlap],
    anchorPx = [
      headBox.x0 + (headBox.x1 - headBox.x0) * (T.headAnchor?.[0] ?? anchor[0]),
      headBox.y0 + headHeight * (T.headAnchor?.[1] ?? anchor[1]),
    ],
    headScale = ((k * side.headLen) / (anchorPx[1] - headBox.y0)) * (T.scale?.head ?? 1),
    headImage = placePiece([W, H], piece.head, headScale, anchorPx, headJoint),
    headTop = [headJoint[0], headJoint[1] - (anchorPx[1] - headBox.y0) * headScale];
  notes.push(`head: scale ${headScale.toFixed(3)}; figure px per side px ${k.toFixed(3)}`);
  const trunkImage = placePiece([W, H], torso, 1, [0, 0], [tx, ty]);

  // ---- Back stand-in: flat fills inside the existing outlines.
  if (mode === 'back') {
    const waist = pelvis[1] - 0.18 * (pelvis[1] - chest[1]),
      shirtTop = shoulderTop + ty,
      // Outer garment colour: the light, unsaturated majority beside the print.
      garment = medianOf(trunkImage, (x, y, o) => y > shirtTop + 20 && y < waist - 30 && Math.abs(x - (centreX + tx)) > shoulderWidth * 0.3 && luminance(trunkImage.data, o) > 110),
      // The lower garment starts where a column first turns to its colour.
      shorts = medianOf(trunkImage, (x, y) => y > hemRow + ty - 40 && y < hemRow + ty - 10),
      near = (o, c) => Math.abs(trunkImage.data[o] - c[0]) + Math.abs(trunkImage.data[o + 1] - c[1]) + Math.abs(trunkImage.data[o + 2] - c[2]) < 70,
      waistAt = new Float64Array(W).fill(waist);
    for (let x = 0; x < W; x++) {
      let run = 0;
      for (let y = Math.round(chest[1]); y < hemRow + ty; y++) {
        const o = (y * W + x) * 4;
        run = trunkImage.data[o + 3] > 250 && near(o, shorts) ? run + 1 : 0;
        if (run >= 6) {
          waistAt[x] = y - 6;
          break;
        }
      }
    }
    const sorted = Array.from(waistAt).filter((v) => v !== waist).sort((a, b) => a - b),
      waistLine = sorted.length ? sorted[sorted.length >> 1] : waist;
    flatFill(trunkImage, (x, y) => y >= shirtTop && y < waistLine - 3, () => garment);
    // A plain hem line where the fill meets the lower garment.
    for (let x = 0; x < W; x++)
      for (let y = Math.round(waistLine) - 3; y < Math.round(waistLine); y++) {
        const o = (y * W + x) * 4;
        if (trunkImage.data[o + 3] > 250) for (let c = 0; c < 3; c++) trunkImage.data[o + c] = 34;
      }
    const hb = bounds(alphaMask(headImage, 128), W),
      hh = hb.y1 - hb.y0 + 1,
      hair = medianOf(headImage, (x, y, o) => y < hb.y0 + hh * 0.3 && luminance(headImage.data, o) > 40),
      skinTone = medianOf(trunkImage, (x, y, o) => y < shirtTop - 2 && luminance(trunkImage.data, o) > 90);
    flatFill(headImage, () => true, (x, y) => (y > hb.y1 - hh * T.backNeckShare ? skinTone : hair));
    notes.push(`back stand-in: garment rgb ${garment}, hair rgb ${hair}, waist line y ${waistLine.toFixed(0)}`);
  }

  // ---- Bones. Anatomical names: the sheet's left part is the character's right.
  const A = { R: arm.armL, L: arm.armR },
    L = { R: leg.legL, L: leg.legR },
    root = [pelvis[0], ground],
    bones = [],
    bone = (name, parent, point, end) => bones.push({ name, parent, point, end });
  bone('root', null, root);
  bone('pelvis', 'root', pelvis, spineJoint);
  bone('spine', 'pelvis', spineJoint, chest);
  bone('chest', 'spine', chest, neckJoint);
  bone('neck', 'chest', neckJoint, headJoint);
  bone('head', 'neck', headJoint, headTop);
  for (const s of ['R', 'L']) {
    bone(`upper_arm_${s}`, 'chest', A[s].shoulder, A[s].elbow);
    bone(`forearm_${s}`, `upper_arm_${s}`, A[s].elbow, A[s].wrist);
    bone(`hand_${s}`, `forearm_${s}`, A[s].wrist, A[s].tip);
  }
  for (const s of ['R', 'L']) {
    bone(`thigh_${s}`, 'pelvis', L[s].hip, L[s].knee);
    bone(`shin_${s}`, `thigh_${s}`, L[s].knee, L[s].ankle);
    bone(`foot_${s}`, `shin_${s}`, L[s].ankle, L[s].toe);
  }
  const sockets = ['R', 'L'].flatMap((s) => [
    { name: `palm_${s}`, bone: `hand_${s}`, point: lerp(A[s].wrist, A[s].tip, 0.45) },
    { name: `ankle_${s}`, bone: `foot_${s}`, point: L[s].ankle },
    { name: `heel_${s}`, bone: `foot_${s}`, point: L[s].heel },
    { name: `toe_${s}`, bone: `foot_${s}`, point: L[s].toe },
  ]);

  // ---- Weights.
  const chain3 = (names, a, b, c, d, bandB, bandC) => {
    const n1 = unit(add(unit(sub(b, a)), unit(sub(c, b)))),
      n2 = unit(add(unit(sub(c, b)), unit(sub(d, c))));
    return (x, y) => {
      const t1 = smoothstep(-bandB, bandB, dot(sub([x, y], b), n1)),
        t2 = smoothstep(-bandC, bandC, dot(sub([x, y], c), n2)),
        out = {};
      if (1 - t1 > 0) out[names[0]] = 1 - t1;
      if (t1 * (1 - t2) > 0) out[names[1]] = t1 * (1 - t2);
      if (t1 * t2 > 0) out[names[2]] = t1 * t2;
      return out;
    };
  };
  const armWeights = (s) => {
      const upper = len(sub(A[s].elbow, A[s].shoulder));
      return chain3([`upper_arm_${s}`, `forearm_${s}`, `hand_${s}`], A[s].shoulder, A[s].elbow, A[s].wrist, A[s].tip, T.elbowBand * upper, T.wristBand * upper);
    },
    legWeights = (s) => {
      const thigh = len(sub(L[s].knee, L[s].hip));
      return chain3([`thigh_${s}`, `shin_${s}`, `foot_${s}`], L[s].hip, L[s].knee, L[s].ankle, L[s].toe, T.kneeBand * thigh, T.ankleBand * thigh);
    },
    hem = hemRow + ty,
    figureCentre = centreX + tx,
    trunkWeights = (x, y) => {
      // y decreases up the spine.
      const a = smoothstep(-T.spineBand, T.spineBand, spineJoint[1] - y),
        b = smoothstep(-T.spineBand, T.spineBand, chest[1] - y),
        c = smoothstep(-T.spineBand * 0.5, T.spineBand * 0.5, neckJoint[1] - y),
        out = { pelvis: 1 - a, spine: a * (1 - b), chest: a * b * (1 - c), neck: a * b * c };
      if (y > hipY) {
        const follow = T.shortsFollow * smoothstep(hipY, hipY + 0.6 * (hem - hipY), y),
          toL = smoothstep(-T.shortsSideBlend, T.shortsSideBlend, x - figureCentre);
        out.pelvis *= 1 - follow;
        out.thigh_L = follow * toL;
        out.thigh_R = follow * (1 - toL);
      }
      for (const key of Object.keys(out)) if (out[key] < 1e-4) delete out[key];
      const total = Object.values(out).reduce((n, v) => n + v, 0);
      for (const key of Object.keys(out)) out[key] /= total;
      // rig.json carries four influences per vertex.
      const top = Object.entries(out).sort((p, q) => q[1] - p[1]).slice(0, 4),
        sum = top.reduce((n, e) => n + e[1], 0);
      return Object.fromEntries(top.map(([key, v]) => [key, v / sum]));
    },
    identity = (x, y) => [x, y];
  const parts = [
    { name: 'leg_R', image: L.R.image, place: identity, weights: legWeights('R') },
    { name: 'leg_L', image: L.L.image, place: identity, weights: legWeights('L') },
    { name: 'trunk', image: trunkImage, place: identity, weights: trunkWeights },
    { name: 'head', image: headImage, place: identity, weights: () => ({ head: 1 }) },
    { name: 'arm_R', image: A.R.image, place: identity, weights: armWeights('R') },
    { name: 'arm_L', image: A.L.image, place: identity, weights: armWeights('L') },
  ];
  const headTopY = bounds(alphaMask(headImage, 128), W).y0;
  return {
    bones,
    sockets,
    parts,
    notes,
    facing: 0,
    width: W,
    heightPx: ground - headTopY,
    tunables: T,
    // Bind positions of the Character Lab joints, figure pixels.
    joints: {
      pelvis, spine: spineJoint, chest, neck: neckJoint, head: headJoint, headTop: [headJoint[0], headTopY],
      ...Object.fromEntries(['R', 'L'].flatMap((s) => [
        [`shoulder${s}`, A[s].shoulder], [`elbow${s}`, A[s].elbow], [`wrist${s}`, A[s].wrist],
        [`hand${s}`, lerp(A[s].wrist, A[s].tip, 0.45)],
        [`hip${s}`, L[s].hip], [`knee${s}`, L[s].knee], [`ankle${s}`, L[s].ankle],
        [`heel${s}`, L[s].heel], [`toe${s}`, L[s].toe],
      ])),
    },
  };
}
