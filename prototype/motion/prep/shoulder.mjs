// The near shoulder of a whole-figure drawing (see whole.mjs), built so the
// shoulder reads as one person and not as a hinge on a fixed torso:
//
//   body            the continuous trunk; its cloth near the shoulder follows the
//                   shoulder girdle (clavicle bone), so the shirt's shoulder line
//                   and the nearby collar move when the shoulder point moves.
//                   DERIVED here: the side of the torso the hanging arm hides
//                   (cloth tiled from a clean patch of the same shirt, shaded,
//                   closed with an ink line along a hand-entered edge).
//   arm_near        bare arm below the sleeve hem (source pixels) plus a DERIVED
//                   proximal stub that runs up under the sleeve to a rounded cap
//                   on the glenohumeral pivot. Rigid on the upper arm, so no
//                   rotation can expose a cut end.
//   sleeve_near     the sleeve cloth as ONE weighted surface across the joint:
//                   armhole/cap = shoulder girdle (same weights as the trunk
//                   under it, so the seam cannot open), hem = upper arm, and
//                   between them two helper bones that turn 1/3 and 2/3 of the
//                   way, so the cloth bends round the joint.
//
// Every number comes from `spec.shoulder` (hand-read off the drawing) or SHOULDER.
import { alphaMask, blankImage, erode, luminance, smoothstep } from './raster.mjs';

export const SHOULDER = {
  // Sleeve: along the upper arm from the pivot (px). Girdle before `bend[0]`, arm after `bend[1]`.
  bend: [-24, 78],
  stub: { cap: 46, ink: 5, mirror: [50, 100], inset: 4 }, // derived arm under the sleeve
  torso: { ink: 5, shade: 0.8 }, // derived torso side under the arm
  skin: { redOverBlue: 45, luminance: 70 }, // what counts as skin when sampling the arm
  ink: [26, 22, 24],
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  dot = (a, b) => a[0] * b[0] + a[1] * b[1],
  unit = (a) => {
    const l = Math.hypot(a[0], a[1]) || 1;
    return [a[0] / l, a[1] / l];
  };
/** y of a polyline (x non-decreasing) at x; flat beyond its ends. */
const lineY = (line, x) => {
  if (x <= line[0][0]) return line[0][1];
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i],
      [bx, by] = line[i + 1];
    if (x <= bx) return bx === ax ? Math.max(ay, by) : ay + ((by - ay) * (x - ax)) / (bx - ax);
  }
  return line[line.length - 1][1];
};
/** x of a polyline (y non-decreasing) at y; flat beyond its ends. */
const lineX = (line, y) => lineY(line.map(([x, v]) => [v, x]), y);
const distanceToLine = (line, x, y) => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      ab = sub(line[i + 1], a),
      t = Math.min(1, Math.max(0, dot(sub([x, y], a), ab) / (dot(ab, ab) || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - ab[0] * t, y - a[1] - ab[1] * t));
  }
  return best;
};

/**
 * @param art     the drawing with the sticker ring removed (only read)
 * @param arm     the near-arm layer as cut by the outline (sleeve + arm); replaced by the bare arm
 * @param body    the trunk layer; the derived torso side is painted into it
 * @param armMask the near-arm outline mask
 * @param spec    { hem: [[x,y]...] just under the hem's ink, outer -> inner (x rising),
 *                  torsoBack: [[x,y]...] the hidden back edge of the torso, top -> bottom (y rising),
 *                  clothPatch: [x0,y0,x1,y1] clean cloth to tile under the arm }
 * @returns { sleeve, weights(x, y, girdleWeights) -> sleeve weights, helpers, notes }
 */
export function cutNearShoulder({ art, arm, body, armMask, pivot, elbow, spec, overrides, tag = 'near' }) {
  const T = { ...SHOULDER, ...(overrides ?? {}) },
    { width: W, height: H } = art,
    idx = (x, y) => y * W + x,
    u = unit(sub(elbow, pivot)), // down the arm
    n = [-u[1], u[0]].map((v) => v * Math.sign(-u[1] || 1)), // across it, +x side
    sleeve = blankImage(W, H),
    notes = [];
  // ---- Split the outline's layer at the hem: cloth above, arm below.
  let sleevePx = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y),
        o = i * 4;
      if (!armMask[i] || arm.data[o + 3] === 0 || y >= lineY(spec.hem, x)) continue;
      for (let c = 0; c < 4; c++) {
        sleeve.data[o + c] = arm.data[o + c];
        arm.data[o + c] = 0;
      }
      sleevePx++;
    }
  // ---- Derived: the arm continued up under the sleeve to a round cap on the pivot.
  const sleeveSolid = alphaMask(sleeve, 250),
    under = erode(sleeveSolid, W, H, T.stub.inset),
    isSkin = (o) => arm.data[o + 3] >= 250 && arm.data[o] - arm.data[o + 2] >= T.skin.redOverBlue && luminance(arm.data, o) >= T.skin.luminance,
    // Arm edges where it leaves the hem: across-arm extent of skin in a thin band under the hem.
    band = { min: Infinity, max: -Infinity },
    mean = [0, 0, 0];
  let skinCount = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = idx(x, y) * 4,
        below = y - lineY(spec.hem, x);
      if (below < 2 || below > 40 || !armMask[idx(x, y)] || !isSkin(o)) continue;
      if (below < 14) {
        const a = dot([x, y], n);
        band.min = Math.min(band.min, a);
        band.max = Math.max(band.max, a);
      }
      for (let c = 0; c < 3; c++) mean[c] += arm.data[o + c];
      skinCount++;
    }
  for (let c = 0; c < 3; c++) mean[c] = Math.round(mean[c] / Math.max(1, skinCount));
  const aPivot = dot(pivot, n),
    sPivot = dot(pivot, u),
    // Half-widths either side of the bone: `cap` at the pivot, the measured arm (plus its outline) at the hem.
    hemS = dot([(spec.hem[0][0] + spec.hem[spec.hem.length - 1][0]) / 2, lineY(spec.hem, (spec.hem[0][0] + spec.hem[spec.hem.length - 1][0]) / 2)], u) - sPivot,
    inside = (x, y) => {
      const s = dot([x, y], u) - sPivot,
        a = dot([x, y], n) - aPivot;
      if (s <= 0) return T.stub.cap - Math.hypot(s, a); // round cap
      const k = Math.min(1, s / hemS),
        low = -T.stub.cap + (band.min - T.stub.ink - aPivot + T.stub.cap) * k,
        high = T.stub.cap + (band.max + T.stub.ink - aPivot - T.stub.cap) * k;
      return Math.min(a - low, high - a);
    };
  let stubPx = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y),
        o = i * 4;
      if (!under[i] || arm.data[o + 3] !== 0) continue;
      const depth = inside(x, y);
      if (depth <= 0) continue;
      const above = lineY(spec.hem, x) - y; // px above the hem (vertical; the hem is near horizontal)
      if (above <= 0) continue;
      let colour = mean;
      if (depth < T.stub.ink) colour = T.ink;
      else {
        // Mirror the arm along the bone across the hem, fading to the flat skin colour.
        const d = above / Math.max(0.2, u[1]),
          mx = Math.round(x + u[0] * 2 * d),
          my = Math.round(y + u[1] * 2 * d),
          keep = 1 - smoothstep(T.stub.mirror[0], T.stub.mirror[1], d);
        if (keep > 0 && mx >= 0 && my >= 0 && mx < W && my < H && isSkin(idx(mx, my) * 4)) {
          const m = idx(mx, my) * 4;
          colour = [0, 1, 2].map((c) => Math.round(arm.data[m + c] * keep + mean[c] * (1 - keep)));
        }
      }
      arm.data[o] = colour[0];
      arm.data[o + 1] = colour[1];
      arm.data[o + 2] = colour[2];
      arm.data[o + 3] = 255;
      stubPx++;
    }
  // ---- Derived: the torso side the arm hides (tiled cloth, shaded, inked back edge).
  const [px0, py0, px1, py1] = spec.clothPatch,
    pw = px1 - px0,
    ph = py1 - py0,
    reflect = (v, size) => {
      const m = ((v % (2 * size)) + 2 * size) % (2 * size);
      return m < size ? m : 2 * size - 1 - m;
    },
    top = spec.torsoBack[0][1],
    bottom = spec.torsoBack[spec.torsoBack.length - 1][1];
  let torsoPx = 0;
  for (let y = Math.max(0, top - 60); y <= bottom; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y),
        o = i * 4;
      if (!armMask[i] || body.data[o + 3] >= 250) continue;
      const edge = lineX(spec.torsoBack, Math.max(top, y));
      if (x < edge) continue;
      const d = y < top ? Math.min(x - edge, 99) : distanceToLine(spec.torsoBack, x, y),
        s = ((py0 + reflect(y - py0, ph)) * W + px0 + reflect(x - px0, pw)) * 4,
        colour = d < T.torso.ink && y >= top ? T.ink : [0, 1, 2].map((c) => Math.round(art.data[s + c] * T.torso.shade));
      body.data[o] = colour[0];
      body.data[o + 1] = colour[1];
      body.data[o + 2] = colour[2];
      body.data[o + 3] = 255;
      torsoPx++;
    }
  notes.push(`near shoulder: sleeve ${sleevePx} px split off at the hem; derived arm stub under the sleeve ${stubPx} px (arm ${Math.round(band.max - band.min)} px wide at the hem, mean skin ${mean}); derived torso side under the arm ${torsoPx} px`);

  // ---- Weights: girdle -> helper 1 -> helper 2 -> upper arm, by distance down the arm from the pivot.
  const names = [`sleeve_${tag}_1`, `sleeve_${tag}_2`, `upper_arm_${tag}`],
    weights = (x, y, girdle) => {
      const t = smoothstep(T.bend[0], T.bend[1], dot([x, y], u) - sPivot),
        hat = (centre) => Math.max(0, 1 - Math.abs(t - centre) * 3),
        out = {};
      for (const [key, v] of Object.entries(girdle)) out[key] = v * hat(0);
      out[names[0]] = hat(1 / 3);
      out[names[1]] = hat(2 / 3);
      out[names[2]] = (out[names[2]] ?? 0) + hat(1);
      return out;
    },
    helpers = [
      { name: names[0], girdle: `clavicle_${tag}`, follows: `upper_arm_${tag}`, fraction: 1 / 3 },
      { name: names[1], girdle: `clavicle_${tag}`, follows: `upper_arm_${tag}`, fraction: 2 / 3 },
    ];
  return { sleeve, weights, helpers, notes, tunables: T };
}
