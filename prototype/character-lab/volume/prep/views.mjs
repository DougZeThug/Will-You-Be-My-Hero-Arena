// One entry per volume: which drawing, which hand-typed landmarks, how the
// drawing is split into continuous surfaces and how each surface is weighted.
// Everything is in source pixels of the drawing; build.mjs does the rest.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodePng } from '../../../motion/prep/png.mjs';
import { alphaMask, close, dilate, erode, flood, luminance, polygonMask, smoothstep as ss } from '../../../motion/prep/raster.mjs';
import { stripSticker } from '../../../motion/prep/sticker.mjs';
import { nearestOnChain } from './inflate.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  dot = (a, b) => a[0] * b[0] + a[1] * b[1],
  len = (a) => Math.hypot(a[0], a[1]),
  unit = (a) => {
    const l = len(a) || 1;
    return [a[0] / l, a[1] / l];
  },
  sum = (a, b) => [a[0] + b[0], a[1] + b[1]],
  clamp01 = (v) => Math.min(1, Math.max(0, v));

export const TWIST_STEPS = 4; // bones per twist chain = TWIST_STEPS + 1

/** Bones every volume is skinned to (see volume/rig.ts for how each one is driven). */
export const BONES = (() => {
  const out = ['pelvis', 'spine', 'chest', 'neck', 'head'];
  for (const s of ['R', 'L']) {
    out.push(`girdle${s}`);
    for (let k = 0; k <= TWIST_STEPS; k++) out.push(`upper${s}${k}`);
    for (let k = 0; k <= TWIST_STEPS; k++) out.push(`fore${s}${k}`);
    out.push(`hand${s}`);
    for (let k = 0; k <= TWIST_STEPS; k++) out.push(`thigh${s}${k}`);
    out.push(`shin${s}`, `foot${s}`);
  }
  return out;
})();

/** Weights spread along a twist chain: t = 0 at the parent joint, 1 at the child. */
function chainWeights(out, prefix, t, share) {
  if (share <= 0) return;
  const k = clamp01(t) * TWIST_STEPS,
    i = Math.min(TWIST_STEPS - 1, Math.floor(k)),
    f = k - i;
  out[`${prefix}${i}`] = (out[`${prefix}${i}`] ?? 0) + share * (1 - f);
  out[`${prefix}${i + 1}`] = (out[`${prefix}${i + 1}`] ?? 0) + share * f;
}

/** Arm or leg: three bones, the first one a twist chain, blended across bisector planes at the joints. */
function limbWeights({ a, b, c, d, first, second, third, secondChain, bandB, bandC }) {
  const u1 = unit(sub(b, a)),
    u2 = unit(sub(c, b)),
    u3 = unit(sub(d, c)),
    l1 = len(sub(b, a)),
    l2 = len(sub(c, b)),
    n1 = unit(sum(u1, u2)),
    n2 = unit(sum(u2, u3));
  return (x, y) => {
    const p = [x, y],
      e = ss(-bandB, bandB, dot(sub(p, b), n1)),
      w = ss(-bandC, bandC, dot(sub(p, c), n2)),
      out = {};
    chainWeights(out, first, dot(sub(p, a), u1) / l1, 1 - e);
    if (secondChain) chainWeights(out, second, dot(sub(p, b), u2) / l2, e * (1 - w));
    else out[second] = e * (1 - w);
    out[third] = e * w;
    return { out, along: dot(sub(p, a), u1) };
  };
}

const mixInto = (target, source, share) => {
  for (const [key, v] of Object.entries(source)) target[key] = (target[key] ?? 0) + v * share;
  return target;
};
const scaleAll = (out, k) => {
  for (const key of Object.keys(out)) out[key] *= k;
};

/** Depth along a 2D chain whose points carry a depth. */
const chainDepth = (chain, depths) => (x, y) => {
  const { t } = nearestOnChain(chain, x, y),
    k = Math.min(chain.length - 2, Math.floor(t)),
    f = t - k;
  return depths[k] + (depths[k + 1] - depths[k]) * f;
};

// ---------------------------------------------------------------------------------------
// Front three-quarter drawing (the figure faces screen-right and toward the viewer).
function threeQuarter(character, repository) {
  const spec = character.threeQuarterFront,
    V = character.volume.threeQuarterFront,
    sourcePath = resolve(repository, spec.source),
    sheet = decodePng(readFileSync(sourcePath)),
    stripped = stripSticker(sheet),
    J = { ...spec.joints, ...V.jointOverrides },
    near = spec.nearSide,
    far = near === 'R' ? 'L' : 'R';
  return {
    sheet,
    sourcePath,
    sourceRelative: spec.source,
    settings: V,
    joints: J,
    sticker: { width: stripped.width, colour: stripped.colour },
    bones: BONES,
    writesProportions: true,
    notes: [`sticker border removed: ${stripped.removed} px, measured width ${stripped.width} px, colour ${stripped.colour.join(',')}`],
    parts({ W, H, fit, notes }) {
      const idx = (x, y) => y * W + x,
        fig = flood(alphaMask(stripped.image, 128), W, H, [J.pelvis]),
        poly = Object.fromEntries(Object.entries(spec.pieces).map(([name, piece]) => [name, polygonMask(piece.polygon, W, H)])),
        make = (test) => {
          const m = new Uint8Array(W * H);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (test(idx(x, y), x, y)) m[idx(x, y)] = 1;
          return m;
        },
        // The typed outlines are loose: an arm is what can be reached from inside it
        // without crossing ink, so slivers of the trunk beyond its contour stay trunk.
        refine = (rough, seeds, others) => {
          if (!seeds) return rough;
          const open = make((i) => rough[i] && luminance(stripped.image.data, i * 4) >= V.inkLuminance),
            reached = dilate(close(flood(open, W, H, seeds), W, H, 6), W, H, 4),
            // Only what lies against the rest of the figure can be handed back to it.
            nearBody = dilate(make((i) => fig[i] && !rough[i] && !others[i]), W, H, 12);
          return make((i) => rough[i] && (reached[i] || !nearBody[i]));
        },
        armNearVis = refine(make((i) => fig[i] && poly.armNear[i]), V.armSeeds.near, poly.armFar),
        armFarVis = refine(make((i) => fig[i] && poly.armFar[i] && !poly.armNear[i]), V.armSeeds.far, poly.armNear),
        legNearVis = make((i) => fig[i] && poly.legNear[i] && !poly.armNear[i] && !poly.armFar[i]),
        legFarVis = make((i) => fig[i] && poly.legFar[i] && !poly.legNear[i] && !poly.armNear[i] && !poly.armFar[i]),
        body = make((i) => fig[i] && !armNearVis[i] && !armFarVis[i] && !legNearVis[i] && !legFarVis[i]),
        hiddenPolygon = polygonMask(V.trunkHidden, W, H),
        trunkExt = make((i) => body[i] || (armNearVis[i] && hiddenPolygon[i])),
        splitX = (y) => V.legSplit[0][0] + ((V.legSplit[1][0] - V.legSplit[0][0]) * (y - V.legSplit[0][1])) / (V.legSplit[1][1] - V.legSplit[0][1]),
        nearIsLeft = J[`hip${near}`][0] < J[`hip${far}`][0],
        onNearSide = (x, y) => (x < splitX(y)) === nearIsLeft,
        image = () => ({ width: W, height: H, data: Uint8ClampedArray.from(stripped.image.data) }),
        D = (name) => fit.depthPx(name),
        P = (name, s) => J[`${name}${s}`];

      // ---- Trunk + neck + head: one surface.
      const napeToThroat = unit(sub(spec.neckLine[1], spec.neckLine[0])),
        headUp = (() => {
          let n = [napeToThroat[1], -napeToThroat[0]];
          if (dot(n, sub(J.headTop, J.head)) < 0) n = [-n[0], -n[1]];
          return n;
        })(),
        neckMid = [(spec.neckLine[0][0] + spec.neckLine[1][0]) / 2, (spec.neckLine[0][1] + spec.neckLine[1][1]) / 2],
        dir1 = unit(sum(unit(sub(J.spine, J.pelvis)), unit(sub(J.chest, J.spine)))),
        dir2 = unit(sum(unit(sub(J.chest, J.spine)), unit(sub(J.head, J.chest)))),
        T = V.weights,
        farUpper = unit(sub(P('elbow', far), P('shoulder', far))),
        farUpperLength = len(sub(P('elbow', far), P('shoulder', far))),
        farOuter = (() => {
          // Perpendicular to the far upper arm, pointing away from the spine.
          let n = [farUpper[1], -farUpper[0]];
          if (dot(n, sub(P('shoulder', far), J.chest)) < 0) n = [-n[0], -n[1]];
          return n;
        })(),
        trunkWeights = (x, y) => {
          const p = [x, y],
            t1 = ss(-T.spineBand, T.spineBand, dot(sub(p, J.spine), dir1)),
            t2 = ss(-T.spineBand, T.spineBand, dot(sub(p, J.chest), dir2)),
            out = { pelvis: 1 - t1, spine: t1 * (1 - t2), chest: t1 * t2 },
            q = dot(sub(p, spec.neckLine[0]), headUp),
            side = Math.abs(dot(sub(p, neckMid), napeToThroat)),
            // Below the neck line only the neck column itself belongs to the neck.
            column = 1 - ss(T.neckHalfWidth, T.neckHalfWidth + 50, side) * (1 - ss(-10, 10, q)),
            head = ss(-T.neckBand, T.neckBand, q) * column,
            above = Math.max(head, ss(T.neckFrom, T.neckTo, q) * column);
          scaleAll(out, 1 - above);
          out.neck = above - head;
          out.head = head;
          for (const s of [near, far]) {
            const share = T.girdleShare * (1 - ss(T.girdleInner, T.girdleOuter, len(sub(p, P('shoulder', s))))) * (1 - above);
            if (share <= 0) continue;
            for (const key of ['spine', 'chest']) {
              const moved = out[key] * share;
              out[key] -= moved;
              out[`girdle${s}`] = (out[`girdle${s}`] ?? 0) + moved;
            }
          }
          // The far sleeve is drawn as part of the trunk's silhouette: its cloth follows the far upper arm.
          const along = dot(sub(p, P('shoulder', far)), farUpper),
            outer = dot(sub(p, P('shoulder', far)), farOuter),
            sleeve = ss(-T.sleeveInner, 5, outer) * ss(-10, 70, along) * (1 - ss(T.farSleeveHem - 30, T.farSleeveHem + 10, along)) * (1 - above);
          if (sleeve > 0) {
            scaleAll(out, 1 - sleeve);
            chainWeights(out, `upper${far}`, along / farUpperLength, sleeve);
          }
          return out;
        },
        spineStops = ['headTop', 'head', 'chest', 'spine', 'pelvis'].map((name) => ({ y: J[name][1], x: J[name][0], d: D(name) })),
        alongSpine = (y) => {
          if (y <= spineStops[0].y) return spineStops[0];
          for (let k = 0; k + 1 < spineStops.length; k++) {
            const a = spineStops[k],
              b = spineStops[k + 1];
            if (y <= b.y) {
              const f = (y - a.y) / (b.y - a.y);
              return { x: a.x + (b.x - a.x) * f, d: a.d + (b.d - a.d) * f };
            }
          }
          return spineStops[spineStops.length - 1];
        },
        trunkBlend = (y) => ss(V.trunk.blendY[0], V.trunk.blendY[1], y),
        trunk = {
          name: 'trunk',
          id: 1,
          mask: make((i, x, y) => trunkExt[i] && y <= V.trunkCutY),
          owned: make((i, x, y) => body[i] && y <= V.trunkCutY),
          image: image(),
          grid: V.grid.trunk,
          weights: trunkWeights,
          centre: (x, y) => {
            const s = alongSpine(y),
              b = trunkBlend(y);
            return s.d + (V.trunk.headShear * (1 - b) + V.trunk.shear * b) * (x - s.x);
          },
          flatten: (x, y) => {
            const b = trunkBlend(y);
            return V.trunk.headFlatten * (1 - b) + V.trunk.flatten * b;
          },
        };

      // ---- Arms: sleeve + upper arm + forearm + hand, one tube each.
      const arm = (s, mask, owned, partId, grid) => {
        const sh = P('shoulder', s),
          el = P('elbow', s),
          wr = P('wrist', s),
          tip = P('hand', s), // the landmark is the fingertips
          upper = len(sub(el, sh)),
          limb = limbWeights({ a: sh, b: el, c: wr, d: tip, first: `upper${s}`, second: `fore${s}`, third: `hand${s}`, secondChain: true, bandB: T.elbowBand * upper, bandC: T.wristBand * upper });
        return {
          name: `arm${s}`,
          id: partId,
          mask,
          owned,
          image: image(),
          grid,
          weights: (x, y) => {
            const { out, along } = limb(x, y),
              // The sleeve is cloth sewn at the armhole: trunk at the root, arm at the hem.
              own = ss(T.sleeveBlend[0], T.sleeveBlend[1], along);
            scaleAll(out, own);
            return own < 1 ? mixInto(out, trunkWeights(x, y), 1 - own) : out;
          },
          centre: chainDepth([sh, el, wr, tip], [D(`shoulder${s}`), D(`elbow${s}`), D(`wrist${s}`), D(`fingertip${s}`)]),
          flatten: () => 1,
        };
      };
      const capsule = (() => {
        const chain = [P('shoulder', far), P('elbow', far)];
        return make((i, x, y) => trunkExt[i] && !armFarVis[i] && nearestOnChain(chain, x, y).d <= V.farArmRadius);
      })();
      const armNear = arm(near, armNearVis, armNearVis, 2, V.grid.armNear),
        armFar = arm(far, make((i) => armFarVis[i] || capsule[i]), armFarVis, 3, V.grid.armFar);
      // DERIVED: the far upper arm is under its sleeve in the drawing. Its skin is the
      // drawn forearm just below the sleeve hem, reflected up along the bone.
      armFar.fill = (image, hidden) => {
        const sh = P('shoulder', far),
          u = unit(sub(P('elbow', far), sh)),
          F = V.farArmFill,
          inner = erode(armFarVis, W, H, 8);
        let count = 0;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const i = idx(x, y);
            if (!hidden[i]) continue;
            const along = dot(sub([x, y], sh), u),
              across = dot(sub([x, y], sh), farOuter),
              t = Math.max(0, F.cut - along) % (2 * F.amplitude),
              back = t < F.amplitude ? t : 2 * F.amplitude - t,
              sAlong = F.cut + F.skip + back,
              sAcross = F.centre + Math.max(-1, Math.min(1, across / V.farArmRadius)) * F.halfWidth,
              sx = Math.round(sh[0] + u[0] * sAlong + farOuter[0] * sAcross),
              sy = Math.round(sh[1] + u[1] * sAlong + farOuter[1] * sAcross);
            if (sx < 0 || sy < 0 || sx >= W || sy >= H || !inner[idx(sx, sy)]) continue;
            for (let c = 0; c < 3; c++) image.data[i * 4 + c] = stripped.image.data[idx(sx, sy) * 4 + c];
            count++;
          }
        notes.push(`arm${far}: ${count} px of the hidden upper arm taken from the drawn forearm below the sleeve hem (derived)`);
      };

      // ---- Legs: shorts leg + thigh + shin + foot, one tube each.
      const leg = (s, vis, partId, grid) => {
        const hip = P('hip', s),
          knee = P('knee', s),
          ankle = P('ankle', s),
          heel = P('heel', s),
          toe = P('toe', s),
          thigh = len(sub(knee, hip)),
          limb = limbWeights({ a: hip, b: knee, c: ankle, d: toe, first: `thigh${s}`, second: `shin${s}`, third: `foot${s}`, secondChain: false, bandB: T.kneeBand * thigh, bandC: T.ankleBand * thigh }),
          mine = (x, y) => onNearSide(x, y) === (s === near),
          shinDepth = chainDepth([hip, knee, ankle], [D(`hip${s}`), D(`knee${s}`), D(`ankle${s}`)]),
          footDepth = chainDepth([heel, toe], [D(`heel${s}`), D(`toe${s}`)]);
        return {
          name: `leg${s}`,
          id: partId,
          mask: make((i, x, y) => vis[i] || (trunkExt[i] && y >= V.legTopY && mine(x, y))),
          owned: make((i, x, y) => vis[i] || (body[i] && y >= V.legTopY && mine(x, y))),
          image: image(),
          grid,
          weights: (x, y) => {
            const { out, along } = limb(x, y),
              own = ss(T.legBlend[0], T.legBlend[1], along);
            scaleAll(out, own);
            out.pelvis = (out.pelvis ?? 0) + 1 - own;
            return out;
          },
          centre: (x, y) => {
            const a = nearestOnChain([hip, knee, ankle], x, y).d,
              b = nearestOnChain([heel, toe], x, y).d;
            return (shinDepth(x, y) * b + footDepth(x, y) * a) / (a + b || 1);
          },
          flatten: () => 1,
        };
      };
      const legNear = leg(near, legNearVis, 4, V.grid.legNear),
        legFar = leg(far, legFarVis, 5, V.grid.legFar);
      let loose = 0;
      for (let i = 0; i < W * H; i++) if (fig[i] && !trunk.mask[i] && !armNear.mask[i] && !armFar.mask[i] && !legNear.mask[i] && !legFar.mask[i]) loose++;
      notes.push(`figure pixels in no part: ${loose}`);
      return [trunk, armNear, armFar, legNear, legFar];
    },
  };
}

export const VIEWS = { volume: threeQuarter };
