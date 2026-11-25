// One entry per volume: which drawing, which hand-typed landmarks, how the
// drawing is split into continuous surfaces and how each surface is weighted.
// Everything is in source pixels of the drawing; build.mjs does the rest.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodePng } from '../../../motion/prep/png.mjs';
import { alphaMask, close, dilate, erode, flood, luminance, polygonMask, smoothstep as ss } from '../../../motion/prep/raster.mjs';
import { stripSticker } from '../../../motion/prep/sticker.mjs';
import { reachView } from '../../corrections/reach.mjs';
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
// One standing full-figure drawing -> five continuous surfaces:
//   trunk (pelvis..head, with the shorts seat)   arm R   arm L   leg R   leg L
// An arm is either 'full' (the drawing shows it whole, sleeve included, in front of
// the trunk) or 'underSleeve' (the drawing shows it from the sleeve hem down; the
// sleeve is trunk cloth weighted to the arm, and the upper arm is a derived tube
// hidden inside it). Each leg takes its half of the shorts.
function figure(C, repository) {
  const sourcePath = resolve(repository, C.source),
    sheet = decodePng(readFileSync(sourcePath)),
    stripped = stripSticker(sheet),
    J = C.joints,
    T = C.weights;
  return {
    sheet,
    sourcePath,
    sourceRelative: C.source,
    settings: C.settings,
    joints: J,
    plan: C.plan,
    viewAngleDeg: C.viewAngleDeg,
    sticker: { width: stripped.width, colour: stripped.colour },
    bones: BONES,
    writesProportions: !!C.writesProportions,
    notes: [`sticker border removed: ${stripped.removed} px, measured width ${stripped.width} px, colour ${stripped.colour.join(',')}`],
    parts({ W, H, fit, notes }) {
      const idx = (x, y) => y * W + x,
        fig = flood(alphaMask(stripped.image, 128), W, H, [J.pelvis]),
        make = (test) => {
          const m = new Uint8Array(W * H);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (test(idx(x, y), x, y)) m[idx(x, y)] = 1;
          return m;
        },
        pieces = [
          ...['R', 'L'].map((s) => ({ key: `arm${s}`, ...C.arms[s] })),
          ...['R', 'L'].map((s) => ({ key: `leg${s}`, ...C.legs[s] })),
        ].map((piece) => ({ ...piece, rough: polygonMask(piece.polygon, W, H) })),
        // The typed outlines are loose: a limb is what can be reached from inside it
        // without crossing ink, so slivers of the trunk beyond its contour stay trunk.
        vis = {};
      // Earlier pieces win where typed outlines overlap (arms before legs; `front` first).
      const taken = new Uint8Array(W * H);
      for (const piece of [...pieces].sort((a, b) => (b.front ? 1 : 0) - (a.front ? 1 : 0))) {
        const rough = make((i) => fig[i] && piece.rough[i] && !taken[i]);
        let mask = rough;
        if (piece.seeds) {
          const open = make((i) => rough[i] && luminance(stripped.image.data, i * 4) >= C.inkLuminance),
            reached = dilate(close(flood(open, W, H, piece.seeds), W, H, 6), W, H, 4),
            // Only what lies against the rest of the figure can be handed back to it.
            nearBody = dilate(make((i) => fig[i] && !pieces.some((other) => other.rough[i])), W, H, 12);
          mask = make((i) => rough[i] && (reached[i] || !nearBody[i]));
        }
        vis[piece.key] = mask;
        for (let i = 0; i < W * H; i++) taken[i] |= mask[i];
      }
      const body = make((i) => fig[i] && !taken[i]),
        hiddenPolygon = C.trunkHidden ? polygonMask(C.trunkHidden, W, H) : null,
        fullArms = ['R', 'L'].filter((s) => C.arms[s].mode === 'full'),
        trunkExt = (() => {
          const raw = make((i) => body[i] || (hiddenPolygon && hiddenPolygon[i] && fullArms.some((s) => vis[`arm${s}`][i])));
          // No one-pixel spurs where a typed edge runs beside the drawn one.
          if (!hiddenPolygon) return raw;
          const opened = dilate(erode(raw, W, H, 4), W, H, 4);
          return make((i) => raw[i] && (body[i] || opened[i]));
        })(),
        splitX = (y) => C.legSplit[0][0] + ((C.legSplit[1][0] - C.legSplit[0][0]) * (y - C.legSplit[0][1])) / (C.legSplit[1][1] - C.legSplit[0][1]),
        rightIsLeft = J.hipR[0] < J.hipL[0], // the anatomical right hip is on the screen's left
        sideAt = (x, y) => ((x < splitX(y)) === rightIsLeft ? 'R' : 'L'),
        image = () => ({ width: W, height: H, data: Uint8ClampedArray.from(stripped.image.data) }),
        D = (name) => fit.depthPx(name),
        P = (name, s) => J[`${name}${s}`];

      // ---- Trunk + neck + head: one surface.
      const napeToThroat = unit(sub(C.neckLine[1], C.neckLine[0])),
        headUp = (() => {
          let n = [napeToThroat[1], -napeToThroat[0]];
          if (dot(n, sub(J.headTop, J.head)) < 0) n = [-n[0], -n[1]];
          return n;
        })(),
        neckMid = [(C.neckLine[0][0] + C.neckLine[1][0]) / 2, (C.neckLine[0][1] + C.neckLine[1][1]) / 2],
        dir1 = unit(sum(unit(sub(J.spine, J.pelvis)), unit(sub(J.chest, J.spine)))),
        dir2 = unit(sum(unit(sub(J.chest, J.spine)), unit(sub(J.head, J.chest)))),
        sleeves = ['R', 'L']
          .filter((s) => C.arms[s].mode === 'underSleeve')
          .map((s) => {
            const upper = unit(sub(P('elbow', s), P('shoulder', s)));
            let outer = [upper[1], -upper[0]];
            if (dot(outer, sub(P('shoulder', s), J.chest)) < 0) outer = [-outer[0], -outer[1]];
            return { s, upper, outer, length: len(sub(P('elbow', s), P('shoulder', s))), hem: C.arms[s].hem, hemFade: C.arms[s].hemFade };
          }),
        trunkWeights = (x, y) => {
          const p = [x, y],
            // Shirt and tee hang from the shoulders: with `pelvisBelow` only what is under
            // the shirt hem (the shorts) belongs to the pelvis; the cloth above follows the spine.
            t1 = T.pelvisBelow ? 1 - ss(T.pelvisBelow[0], T.pelvisBelow[1], y) : ss(-T.spineBand, T.spineBand, dot(sub(p, J.spine), dir1)),
            t2 = T.chestDown ? 1 - ss(T.chestDown[0], T.chestDown[1], y) : ss(-T.spineBand, T.spineBand, dot(sub(p, J.chest), dir2)),
            out = { pelvis: 1 - t1, spine: t1 * (1 - t2), chest: t1 * t2 },
            q = dot(sub(p, C.neckLine[0]), headUp),
            side = Math.abs(dot(sub(p, neckMid), napeToThroat)),
            // Below the neck line only the neck column itself belongs to the neck.
            column = 1 - ss(T.neckHalfWidth, T.neckHalfWidth + 50, side) * (1 - ss(-10, 10, q)),
            head = ss(-T.neckBand, T.neckBand, q) * column,
            above = Math.max(head, ss(T.neckFrom, T.neckTo, q) * column);
          scaleAll(out, 1 - above);
          out.neck = above - head;
          out.head = head;
          for (const s of ['R', 'L']) {
            const share = T.girdleShare * (1 - ss(T.girdleInner, T.girdleOuter, len(sub(p, P('shoulder', s))))) * (1 - above);
            if (share <= 0) continue;
            for (const key of ['spine', 'chest']) {
              const moved = out[key] * share;
              out[key] -= moved;
              out[`girdle${s}`] = (out[`girdle${s}`] ?? 0) + moved;
            }
          }
          // A sleeve drawn as part of the trunk's silhouette: its cloth follows that upper arm.
          for (const sl of sleeves) {
            const along = dot(sub(p, P('shoulder', sl.s)), sl.upper),
              outer = dot(sub(p, P('shoulder', sl.s)), sl.outer),
              share = ss(-T.sleeveInner, 5, outer) * ss(-10, 70, along) * (sl.hemFade ? 1 - ss(sl.hem - 30, sl.hem + 10, along) : 1 - ss(sl.hem + 40, sl.hem + 80, along)) * (1 - above);
            if (share <= 0) continue;
            scaleAll(out, 1 - share);
            chainWeights(out, `upper${sl.s}`, along / sl.length, share);
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
        trunkBlend = (y) => ss(C.trunk.blendY[0], C.trunk.blendY[1], y),
        trunk = {
          name: 'trunk',
          id: 1,
          mask: make((i, x, y) => trunkExt[i] && y <= C.trunkCutY),
          owned: make((i, x, y) => body[i] && y <= C.trunkCutY),
          image: image(),
          grid: C.grid.trunk,
          weights: trunkWeights,
          centre: (x, y) => {
            const s = alongSpine(y),
              b = trunkBlend(y);
            return s.d + (C.trunk.headShear * (1 - b) + C.trunk.shear * b) * (x - s.x);
          },
          flatten: (x, y) => {
            const b = trunkBlend(y);
            // Below the ribs the silhouette is mostly hanging cloth, not body: less depth there.
            const waist = C.trunk.waist ? 1 + (C.trunk.waist.flatten - 1) * ss(C.trunk.waist.y[0], C.trunk.waist.y[1], y) : 1;
            return C.trunk.headFlatten * (1 - b) + C.trunk.flatten * b * waist;
          },
          // A back is flatter than a chest: the sheet the drawing does not show is not
          // given the full mirrored depth of the one it does.
          backFlatten: (x, y) => 1 + ((C.trunk.back ?? 1) - 1) * trunkBlend(y),
        };

      // ---- Arms: (sleeve +) upper arm + forearm + hand, one tube each.
      const arm = (s, partId) => {
        const A = C.arms[s],
          sh = P('shoulder', s),
          el = P('elbow', s),
          wr = P('wrist', s),
          tip = P('hand', s), // the landmark is the fingertips
          upper = len(sub(el, sh)),
          limb = limbWeights({ a: sh, b: el, c: wr, d: tip, first: `upper${s}`, second: `fore${s}`, third: `hand${s}`, secondChain: true, bandB: T.elbowBand * upper, bandC: T.wristBand * upper }),
          owned = vis[`arm${s}`],
          // Under a sleeve only the stub just above the hem exists: a whole upper-arm tube
          // would be fatter than the cloth drawn over it and poke through when it moves.
          stubFrom = A.mode === 'underSleeve' ? [sh[0] + ((el[0] - sh[0]) * Math.max(0, A.hem - A.stub)) / upper, sh[1] + ((el[1] - sh[1]) * Math.max(0, A.hem - A.stub)) / upper] : null,
          // Where the trunk also hides part of the forearm, the tube continues down it.
          stubTo = [el[0] + (wr[0] - el[0]) * (A.forearmHidden ?? 0), el[1] + (wr[1] - el[1]) * (A.forearmHidden ?? 0)],
          capsule = stubFrom ? make((i, x, y) => trunkExt[i] && !owned[i] && nearestOnChain([stubFrom, el, stubTo], x, y).d <= A.radius) : null,
          part = {
            name: `arm${s}`,
            id: partId,
            mask: capsule ? make((i) => owned[i] || capsule[i]) : owned,
            owned,
            image: image(),
            grid: C.grid.arm,
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
        if (capsule && A.fill) {
          // DERIVED: the upper arm is under its sleeve in the drawing. Its skin is the
          // drawn forearm just below the sleeve hem, reflected up along the bone.
          const u = unit(sub(el, sh)),
            outer = sleeves.find((sl) => sl.s === s).outer,
            F = A.fill,
            inner = erode(owned, W, H, 8);
          part.fill = (target, hidden) => {
            let count = 0;
            for (let y = 0; y < H; y++)
              for (let x = 0; x < W; x++) {
                const i = idx(x, y);
                if (!hidden[i]) continue;
                const along = dot(sub([x, y], sh), u),
                  across = dot(sub([x, y], sh), outer),
                  t = Math.max(0, F.cut - along) % (2 * F.amplitude),
                  back = t < F.amplitude ? t : 2 * F.amplitude - t,
                  sAlong = F.cut + F.skip + back,
                  sAcross = F.centre + Math.max(-1, Math.min(1, across / A.radius)) * F.halfWidth,
                  sx = Math.round(sh[0] + u[0] * sAlong + outer[0] * sAcross),
                  sy = Math.round(sh[1] + u[1] * sAlong + outer[1] * sAcross);
                if (sx < 0 || sy < 0 || sx >= W || sy >= H || !inner[idx(sx, sy)]) continue;
                for (let c = 0; c < 3; c++) target.data[i * 4 + c] = stripped.image.data[idx(sx, sy) * 4 + c];
                count++;
              }
            notes.push(`arm${s}: ${count} px of the hidden upper arm taken from the drawn forearm below the sleeve hem (derived)`);
          };
        }
        return part;
      };

      // ---- Legs: shorts leg + thigh + shin + foot, one tube each.
      const leg = (s, partId) => {
        const hip = P('hip', s),
          knee = P('knee', s),
          ankle = P('ankle', s),
          heel = P('heel', s),
          toe = P('toe', s) ?? [heel[0], heel[1] + 1],
          thigh = len(sub(knee, hip)),
          limb = limbWeights({ a: hip, b: knee, c: ankle, d: C.legs[s].footToward ?? toe, first: `thigh${s}`, second: `shin${s}`, third: `foot${s}`, secondChain: false, bandB: T.kneeBand * thigh, bandC: T.ankleBand * thigh }),
          mine = (x, y) => sideAt(x, y) === s,
          shinDepth = chainDepth([hip, knee, ankle], [D(`hip${s}`), D(`knee${s}`), D(`ankle${s}`)]),
          footChain = P('toe', s) ? [heel, toe] : null,
          footDepth = footChain ? chainDepth(footChain, [D(`heel${s}`), D(`toe${s}`)]) : null,
          drawn = vis[`leg${s}`];
        return {
          name: `leg${s}`,
          id: partId,
          mask: make((i, x, y) => drawn[i] || (trunkExt[i] && y >= C.legTopY && mine(x, y))),
          owned: make((i, x, y) => drawn[i] || (body[i] && y >= C.legTopY && mine(x, y))),
          image: image(),
          grid: C.grid.leg,
          weights: (x, y) => {
            const { out, along } = limb(x, y),
              own = ss(T.legBlend[0], T.legBlend[1], along);
            scaleAll(out, own);
            out.pelvis = (out.pelvis ?? 0) + 1 - own;
            return out;
          },
          centre: (x, y) => {
            if (!footChain) {
              // The foot points along the view axis: its depth is the middle of the sole.
              const below = ss(ankle[1] - 20, ankle[1] + 60, y);
              return shinDepth(x, y) * (1 - below) + ((D(`heel${s}`) + D(`toe${s}`)) / 2) * below;
            }
            const a = nearestOnChain([hip, knee, ankle], x, y).d,
              b = nearestOnChain(footChain, x, y).d;
            return (shinDepth(x, y) * b + footDepth(x, y) * a) / (a + b || 1);
          },
          // A foot seen end-on is as deep as it is long, not as it is wide.
          flatten: (x, y) => (footChain || !C.legs[s].footDepth ? 1 : 1 + (C.legs[s].footDepth - 1) * ss(ankle[1], ankle[1] + 70, y)),
        };
      };
      const out = [trunk, arm('R', 2), arm('L', 3), leg('R', 4), leg('L', 5)];
      let loose = 0;
      for (let i = 0; i < W * H; i++) if (fig[i] && !out.some((part) => part.mask[i])) loose++;
      notes.push(`figure pixels in no part: ${loose}`);
      return out;
    },
  };
}

const armPlan = (s, P) => {
  const o = s === 'R' ? 1 : -1;
  return [
    ['at', `shoulder${s}`, 'f', 'chest', 0],
    ['at', `elbow${s}`, 'r', `shoulder${s}`, o * P.elbowOut],
    ['at', `wrist${s}`, 'r', `shoulder${s}`, o * P.wristOut],
    ['at', `hand${s}`, 'r', `shoulder${s}`, o * P.handOut],
  ];
};

/** Front three-quarter drawing (faces screen-right and toward the viewer): depth from lateral priors. */
function threeQuarter(character, repository) {
  const spec = character.threeQuarterFront,
    V = character.volume.threeQuarterFront,
    near = spec.nearSide,
    far = near === 'R' ? 'L' : 'R',
    P = V.priors,
    plan = [...['spine', 'chest', 'head', 'headTop'].map((name) => ['at', name, 'r', null, 0])];
  for (const s of ['R', 'L']) {
    const o = s === 'R' ? 1 : -1;
    plan.push(
      ...armPlan(s, P),
      ['at', `hip${s}`, 'f', 'pelvis', 0],
      ['at', `knee${s}`, 'r', `hip${s}`, o * P.kneeOut],
      ['at', `ankle${s}`, 'r', `hip${s}`, o * P.ankleOut],
      ['at', `heel${s}`, 'r', `ankle${s}`, 0],
      ['at', `toe${s}`, 'r', `hip${s}`, o * P.toeOut],
    );
  }
  return figure(
    {
      source: spec.source,
      settings: V,
      viewAngleDeg: V.viewAngleDeg,
      joints: { ...spec.joints, ...V.jointOverrides },
      plan,
      neckLine: spec.neckLine,
      arms: {
        [near]: { mode: 'full', polygon: spec.pieces.armNear.polygon, seeds: V.armSeeds.near, front: true },
        [far]: { mode: 'underSleeve', polygon: spec.pieces.armFar.polygon, seeds: V.armSeeds.far, radius: V.farArmRadius, hem: V.weights.farSleeveHem, stub: V.farArmStub, fill: V.farArmFill, hemFade: true, forearmHidden: V.farForearmHidden },
      },
      legs: { [near]: { polygon: spec.pieces.legNear.polygon }, [far]: { polygon: spec.pieces.legFar.polygon } },
      trunkHidden: V.trunkHidden,
      trunkCutY: V.trunkCutY,
      legTopY: V.legTopY,
      legSplit: V.legSplit,
      trunk: V.trunk,
      weights: V.weights,
      grid: { trunk: V.grid.trunk, arm: V.grid.armNear, leg: V.grid.legNear },
      inkLuminance: V.inkLuminance,
      writesProportions: true,
    },
    repository,
  );
}

/** Back drawing (faces away): lateral is the screen x, so depth comes from typed forward offsets. */
function back(character, repository) {
  const V = character.volume.back,
    P = V.priors,
    plan = [
      ['at', 'spine', 'f', null, P.spine],
      ['at', 'chest', 'f', null, P.chest],
      ['at', 'head', 'f', null, P.head],
      ['at', 'headTop', 'f', null, P.headTop],
    ];
  for (const s of ['R', 'L'])
    plan.push(
      ['at', `shoulder${s}`, 'f', 'chest', 0],
      ['at', `elbow${s}`, 'f', `shoulder${s}`, P.elbow],
      ['at', `wrist${s}`, 'f', `shoulder${s}`, P.wrist],
      ['at', `hand${s}`, 'f', `shoulder${s}`, P.hand],
      ['at', `hip${s}`, 'f', 'pelvis', 0],
      ['at', `knee${s}`, 'f', `hip${s}`, P.knee],
      ['at', `ankle${s}`, 'f', `hip${s}`, P.ankle],
      ['at', `heel${s}`, 'f', `ankle${s}`, P.heel],
      ['offset', `toe${s}`, `heel${s}`, P.footLen, 0, 0],
    );
  return figure(
    {
      source: V.source,
      settings: V,
      viewAngleDeg: V.viewAngleDeg,
      joints: V.joints,
      plan,
      neckLine: V.neckLine,
      arms: Object.fromEntries(['R', 'L'].map((s) => [s, { mode: 'underSleeve', ...V.arms[s], radius: V.armRadius, hem: V.sleeveHem, stub: V.armStub, fill: V.armFill }])),
      legs: Object.fromEntries(['R', 'L'].map((s) => [s, { ...V.legs[s], footDepth: V.footDepth }])),
      trunkCutY: V.trunkCutY,
      legTopY: V.legTopY,
      legSplit: V.legSplit,
      trunk: V.trunk,
      weights: V.weights,
      grid: V.grid,
      inkLuminance: V.inkLuminance,
    },
    repository,
  );
}

/**
 * The HEAD of the profile drawing on its own (a chroma-keyed sheet with no sticker
 * border): head + neck as one small surface, so the head can show its profile
 * while the body is still drawn from another angle.
 */
function sideHead(character, repository) {
  const V = character.volume.sideHead,
    sourcePath = resolve(repository, V.source),
    sheet = decodePng(readFileSync(sourcePath)),
    J = V.joints,
    volumeProportions = JSON.parse(readFileSync(resolve(repository, `prototype/character-lab/rigs/${character.id}/volume/proportions.json`), 'utf8'));
  return {
    sheet,
    sourcePath,
    sourceRelative: V.source,
    settings: V,
    joints: J,
    plan: ['spine', 'chest', 'head', 'headTop'].map((name) => ['at', name, 'r', null, 0]),
    fixed: { ppm: V.pxPerMetre, pelvisHeight: volumeProportions.pelvisHeight },
    viewAngleDeg: V.viewAngleDeg,
    sticker: { width: Math.round(V.stickerPx), colour: V.stickerColour },
    bones: BONES,
    notes: ['no sticker border on this sheet; background removed by chroma key'],
    parts({ W, H, fit }) {
      const idx = (x, y) => y * W + x,
        keep = polygonMask(V.keep, W, H),
        [kr, kg, kb] = V.chroma,
        { data } = sheet,
        solid = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) solid[i] = keep[i] && Math.abs(data[i * 4] - kr) + Math.abs(data[i * 4 + 1] - kg) + Math.abs(data[i * 4 + 2] - kb) > V.chromaDistance ? 1 : 0;
      const mask = flood(solid, W, H, [V.seed]),
        napeToThroat = unit(sub(V.neckLine[1], V.neckLine[0]));
      let headUp = [napeToThroat[1], -napeToThroat[0]];
      if (dot(headUp, sub(J.headTop, J.head)) < 0) headUp = [-headUp[0], -headUp[1]];
      const D = (name) => fit.depthPx(name);
      return [
        {
          name: 'trunk',
          id: 1,
          mask,
          owned: mask,
          image: { width: W, height: H, data: Uint8ClampedArray.from(data) },
          grid: V.grid,
          weights: (x, y) => {
            const q = dot(sub([x, y], V.neckLine[0]), headUp),
              head = ss(-V.neckBand, V.neckBand, q),
              chest = 1 - ss(V.chestFrom, V.chestTo, q);
            return { head, neck: (1 - head) * (1 - chest), chest: (1 - head) * chest };
          },
          centre: (x, y) => {
            const t = Math.min(1, Math.max(0, (J.head[1] - y) / (J.head[1] - J.headTop[1])));
            return D('head') + (D('headTop') - D('head')) * t;
          },
          flatten: () => V.flatten,
        },
      ];
    },
  };
}

export const VIEWS = { volume: threeQuarter, volumeBack: back, volumeSideHead: sideHead, 'corrections/reach': reachView };
