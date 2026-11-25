// CORRECTIVE PIECE for the reach: collar side -> shoulder -> sleeve -> upper arm ->
// forearm -> OPEN PALM as one connected piece, for the pose at the reach extreme.
// ASSEMBLED FROM EXISTING DRAWINGS, NOT NEWLY DRAWN:
//   hand            the open-palm hand on the profile sheet ("the original hand art")
//   upper arm,      the bare-arm drawing on the same sheet, laid along the posed
//   forearm         shoulder -> elbow -> wrist with a real elbow
//   sleeve, cap     the three-quarter drawing's own overshirt sleeve, turned to point
//                   along the upper arm
// It is laid out in the picture plane of the shot camera at one frame of
// shot/shot.ts (the cheated frame: see volume/cheat.ts), so its 2D joints ARE the
// projected 3D joints of that frame; build.mjs then inflates and weights it like any
// other volume part. Built by
//   node --import ./prototype/character-lab/core/ts-loader.mjs prototype/character-lab/volume/prep/build.mjs doug corrections/reach
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodePng, encodePng } from '../../motion/prep/png.mjs';
import { blankImage, polygonMask, sample, smoothstep as ss } from '../../motion/prep/raster.mjs';
import { stripSticker } from '../../motion/prep/sticker.mjs';
import { makeCamera, project } from '../core/camera.ts';
import { buildShot } from '../shot/shot.ts';
import { cheatFrame } from '../volume/cheat.ts';
import { BONES, TWIST_STEPS } from '../volume/prep/views.mjs';
import { nearestOnChain } from '../volume/prep/inflate.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k],
  dot = (a, b) => a[0] * b[0] + a[1] * b[1],
  crs = (a, b) => a[0] * b[1] - a[1] * b[0],
  len = (a) => Math.hypot(a[0], a[1]),
  unit = (a) => {
    const l = len(a) || 1;
    return [a[0] / l, a[1] / l];
  },
  perp = (a) => [-a[1], a[0]];

export function reachView(character, repository) {
  const C = character.corrections.reach,
    s = C.cheat.side,
    lab = resolve(repository, 'prototype/character-lab'),
    proportions = JSON.parse(readFileSync(resolve(lab, `rigs/${character.id}/volume/proportions.json`), 'utf8')),
    volumeRig = JSON.parse(readFileSync(resolve(lab, `rigs/${character.id}/volume/rig.json`), 'utf8')),
    ppm = volumeRig.pxPerMetre,
    camera = makeCamera(0),
    frame = cheatFrame(buildShot(proportions)[C.frame], camera, C.cheat, 1),
    [W, H] = C.canvas,
    anchor = project(frame.joints[`shoulder${s}`], camera),
    ox = C.shoulderAt[0] - anchor.x * ppm,
    oy = C.shoulderAt[1] + anchor.y * ppm,
    px = (p) => {
      const q = project(p, camera);
      return [ox + q.x * ppm, oy - q.y * ppm];
    },
    ex = project({ x: 1, y: 0, z: 0 }, camera),
    ey = project({ x: 0, y: 1, z: 0 }, camera),
    ez = project({ x: 0, y: 0, z: 1 }, camera),
    unproject = (vx, vy, vd) => ({ x: ex.x * vx + ex.y * vy + ex.depth * vd, y: ey.x * vx + ey.y * vy + ey.depth * vd, z: ez.x * vx + ez.y * vy + ez.depth * vd }),
    joints = { ...frame.joints },
    wrist3 = joints[`wrist${s}`],
    palm3 = joints[`hand${s}`],
    palmDir = (() => {
      const d = { x: palm3.x - wrist3.x, y: palm3.y - wrist3.y, z: palm3.z - wrist3.z },
        l = Math.hypot(d.x, d.y, d.z);
      return { x: d.x / l, y: d.y / l, z: d.z / l };
    })();
  joints[`fingertip${s}`] = { x: wrist3.x + palmDir.x * C.hand.length, y: wrist3.y + palmDir.y * C.hand.length, z: wrist3.z + palmDir.z * C.hand.length };
  const J2 = Object.fromEntries(Object.entries(joints).map(([name, p]) => [name, px(p)])),
    depthPx = (name) => project(joints[name], camera).depth * ppm,
    S = J2[`shoulder${s}`],
    E = J2[`elbow${s}`],
    Wr = J2[`wrist${s}`],
    Tip = J2[`fingertip${s}`];

  // ---- Sources (read only).
  const sheetPath = resolve(repository, C.sheet),
    sheet = decodePng(readFileSync(sheetPath)),
    keyed = { width: sheet.width, height: sheet.height, data: Uint8ClampedArray.from(sheet.data) };
  for (let i = 0; i < sheet.width * sheet.height; i++) {
    const d = Math.abs(sheet.data[i * 4] - C.chroma[0]) + Math.abs(sheet.data[i * 4 + 1] - C.chroma[1]) + Math.abs(sheet.data[i * 4 + 2] - C.chroma[2]);
    keyed.data[i * 4 + 3] = Math.round(255 * ss(C.chromaDistance[0], C.chromaDistance[1], d));
  }
  const within = (image, rect) => {
    const out = blankImage(image.width, image.height),
      [x0, y0, w, h] = rect;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) for (let c = 0; c < 4; c++) out.data[(y * image.width + x) * 4 + c] = image.data[(y * image.width + x) * 4 + c];
    return out;
  };
  const armArt = within(keyed, C.arm.rect),
    handArt = within(keyed, C.hand.rect),
    spec = character.threeQuarterFront,
    V = character.volume.threeQuarterFront,
    drawingPath = resolve(repository, spec.source),
    drawing = stripSticker(decodePng(readFileSync(drawingPath))).image,
    sleevePolygon = polygonMask(spec.pieces.armNear.polygon, drawing.width, drawing.height),
    J3 = { ...spec.joints, ...V.jointOverrides },
    sleeveArt = blankImage(drawing.width, drawing.height);
  {
    const a = J3[`shoulder${s}`],
      u = unit(sub(J3[`elbow${s}`], a));
    for (let y = 0; y < drawing.height; y++)
      for (let x = 0; x < drawing.width; x++) {
        const i = y * drawing.width + x;
        if (!sleevePolygon[i] || dot(sub([x, y], a), u) > C.sleeve.hem) continue;
        for (let c = 0; c < 4; c++) sleeveArt.data[i * 4 + c] = drawing.data[i * 4 + c];
      }
  }

  // ---- Assemble in the picture plane of the frame.
  const piece = blankImage(W, H),
    rgba = [0, 0, 0, 0],
    paint = (source, inverse, opacity = () => 1) => {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const at = inverse(x, y);
          if (!at) continue;
          sample(source, at[0], at[1], rgba);
          const a = (rgba[3] / 255) * opacity(x, y);
          if (a <= 0.004) continue;
          const o = (y * W + x) * 4,
            b = piece.data[o + 3] / 255,
            outA = a + b * (1 - a);
          for (let c = 0; c < 3; c++) piece.data[o + c] = (rgba[c] * a + piece.data[o + c] * b * (1 - a)) / outA;
          piece.data[o + 3] = outA * 255;
        }
    };
  // 1. Bare arm: the sheet's shoulder -> elbow -> wrist laid on the posed chain.
  {
    const [a0, a1, a2] = C.arm.joints,
      su = [unit(sub(a1, a0)), unit(sub(a2, a1))],
      sl = [len(sub(a1, a0)), len(sub(a2, a1))],
      tu = [unit(sub(E, S)), unit(sub(Wr, E))],
      tl = [len(sub(E, S)), len(sub(Wr, E))],
      // Keep the elbow point on the outside of the bend.
      mirror = Math.sign(crs(su[0], su[1])) === Math.sign(crs(tu[0], tu[1])) ? 1 : -1,
      bisector = unit(add(tu[0], tu[1])),
      map = (k, x, y) => {
        const from = k ? E : S,
          along = dot(sub([x, y], from), tu[k]),
          across = crs(tu[k], sub([x, y], from)),
          base = k ? a1 : a0;
        return add(add(base, su[k], (along * sl[k]) / tl[k]), perp(su[k]), (across / C.arm.across) * mirror);
      };
    paint(armArt, (x, y) => {
      const side = dot(sub([x, y], E), bisector),
        t = ss(-C.arm.elbowBlend, C.arm.elbowBlend, side),
        p = map(0, x, y),
        q = map(1, x, y);
      if (dot(sub([x, y], Wr), tu[1]) > C.arm.pastWrist || dot(sub([x, y], S), tu[0]) < C.arm.from) return null; // the shoulder ball stays under the sleeve
      return [p[0] * (1 - t) + q[0] * t, p[1] * (1 - t) + q[1] * t];
    });
  }
  // 2. Sleeve and shoulder cap: the three-quarter drawing's sleeve turned to point along the upper arm.
  {
    const a = J3[`shoulder${s}`],
      su = unit(sub(J3[`elbow${s}`], a)),
      tu = unit(sub(E, S)),
      mirror = C.sleeve.mirror ? -1 : 1;
    paint(sleeveArt, (x, y) => {
      const along = dot(sub([x, y], S), tu),
        across = crs(tu, sub([x, y], S));
      return add(add(a, su, along / C.sleeve.along), perp(su), (across / C.sleeve.across) * mirror);
    });
  }
  // 3. The open-palm hand, on top, fading in over the wrist so skin runs through.
  {
    const hu = unit(sub(C.hand.tip, C.hand.wrist)),
      tu = unit(sub(Tip, Wr)),
      scale = len(sub(Tip, Wr)) / len(sub(C.hand.tip, C.hand.wrist)),
      mirror = C.hand.mirror ? -1 : 1;
    paint(
      handArt,
      (x, y) => {
        const along = dot(sub([x, y], Wr), tu),
          across = crs(tu, sub([x, y], Wr));
        return add(add(C.hand.wrist, hu, along / scale), perp(hu), (across / scale) * mirror);
      },
      (x, y) => ss(-C.hand.overlap, -C.hand.overlap + C.hand.blend, dot(sub([x, y], Wr), tu)),
    );
  }
  for (let i = 0; i < W * H; i++) piece.data[i * 4 + 3] = piece.data[i * 4 + 3] >= 128 ? 255 : 0;

  // ---- Review sheet: the sources beside the assembled piece.
  {
    const review = resolve(repository, 'work/qa/character-lab/reach');
    mkdirSync(review, { recursive: true });
    const tiles = [
        ['hand: profile sheet (original hand art)', keyed, C.hand.rect, 2],
        ['arm: profile sheet', keyed, C.arm.rect, 1],
        ['sleeve: three-quarter drawing', sleeveArt, [20, 330, 300, 320], 1],
        ['ASSEMBLED piece (not newly drawn)', piece, [0, 0, W, H], 1],
      ],
      pad = 24,
      width = tiles.reduce((n, t) => n + t[2][2] * t[3] + pad, pad),
      height = Math.max(...tiles.map((t) => t[2][3] * t[3])) + pad * 2,
      out = blankImage(width, height);
    for (let i = 0; i < width * height; i++) out.data.set([207, 198, 180, 255], i * 4);
    let x0 = pad;
    for (const [, image, [rx, ry, rw, rh], zoom] of tiles) {
      for (let y = 0; y < rh * zoom; y++)
        for (let x = 0; x < rw * zoom; x++) {
          const sx = rx + Math.floor(x / zoom),
            sy = ry + Math.floor(y / zoom);
          if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
          const o = (sy * image.width + sx) * 4,
            a = image.data[o + 3] / 255,
            d = ((pad + y) * width + x0 + x) * 4;
          for (let c = 0; c < 3; c++) out.data[d + c] = image.data[o + c] * a + out.data[d + c] * (1 - a);
        }
      x0 += rw * zoom + pad;
    }
    writeFileSync(resolve(review, 'corrective-sources-raw.png'), encodePng(out));
    writeFileSync(resolve(review, 'corrective-sources.json'), JSON.stringify({ tiles: tiles.map((t) => ({ label: t[0], width: t[2][2] * t[3] })), pad }, null, 1));
  }

  // ---- As a volume part.
  const T = C.weights,
    u1 = unit(sub(E, S)),
    u2 = unit(sub(Wr, E)),
    u3 = unit(sub(Tip, Wr)),
    l1 = len(sub(E, S)),
    l2 = len(sub(Wr, E)),
    n1 = unit(add(u1, u2)),
    n2 = unit(add(u2, u3)),
    chain = [S, E, Wr, Tip],
    depths = [`shoulder${s}`, `elbow${s}`, `wrist${s}`, `fingertip${s}`].map(depthPx),
    twist = (out, prefix, t, share) => {
      const k = Math.min(1, Math.max(0, t)) * TWIST_STEPS,
        i = Math.min(TWIST_STEPS - 1, Math.floor(k)),
        f = k - i;
      out[`${prefix}${i}`] = (out[`${prefix}${i}`] ?? 0) + share * (1 - f);
      out[`${prefix}${i + 1}`] = (out[`${prefix}${i + 1}`] ?? 0) + share * f;
    };
  return {
    sheet: piece,
    sourcePath: sheetPath,
    sourceRelative: `${C.sheet} + ${spec.source}`,
    outDir: `rigs/${character.id}/corrections/reach`,
    settings: C,
    joints: J2,
    viewAngleDeg: 0,
    fit: {
      ppm,
      yaw: frame.yaw.pelvis,
      camera,
      joints,
      depthPx,
      toWorld: (x, y, d) => unproject((x - ox) / ppm, (oy - y) / ppm, d / ppm),
    },
    sticker: { width: volumeRig.stickerWidth * ppm, colour: volumeRig.stickerColour },
    bones: BONES,
    notes: [`ASSEMBLED FROM EXISTING DRAWINGS, NOT NEWLY DRAWN. Laid out at shot frame ${C.frame} (cheated, see volume/cheat.ts) for camera yaw 0.`],
    parts({ W: w, H: h }) {
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) mask[i] = piece.data[i * 4 + 3] ? 1 : 0;
      return [
        {
          name: `arm${s}`,
          id: 2,
          mask,
          owned: mask,
          image: { width: w, height: h, data: Uint8ClampedArray.from(piece.data) },
          grid: C.grid,
          weights: (x, y) => {
            const p = [x, y],
              along = dot(sub(p, S), u1),
              e = ss(-T.elbowBand * l1, T.elbowBand * l1, dot(sub(p, E), n1)),
              wr = ss(-T.wristBand * l1, T.wristBand * l1, dot(sub(p, Wr), n2)),
              own = ss(T.root[0], T.root[1], along),
              out = {};
            twist(out, `upper${s}`, along / l1, own * (1 - e));
            twist(out, `fore${s}`, dot(sub(p, E), u2) / l2, own * e * (1 - wr));
            out[`hand${s}`] = own * e * wr;
            out[`girdle${s}`] = (1 - own) * T.rootGirdle;
            out.chest = (1 - own) * (1 - T.rootGirdle);
            return out;
          },
          centre: (x, y) => {
            const { t } = nearestOnChain(chain, x, y),
              k = Math.min(chain.length - 2, Math.floor(t));
            return depths[k] + (depths[k + 1] - depths[k]) * (t - k);
          },
          // The hand is a flat thing seen from its broad side.
          flatten: (x, y) => 1 + (C.hand.depth - 1) * ss(-20, 30, dot(sub([x, y], Wr), u3)),
        },
      ];
    },
  };
}
