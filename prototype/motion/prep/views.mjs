// Character Lab view rigs. One command per character and view:
//   node prototype/motion/prep/build.mjs <id> --view side|sideRear|front|back|all [--debug]
// Reads prototype/character-lab/characters/<id>.json and writes
// prototype/character-lab/rigs/<id>/<view>/{rig.json,atlas.png}; after any
// view it refreshes rigs/<id>/proportions.json and views.json. Deterministic;
// sources are only read and their hashes recorded.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleRig, buildCharacter, writeRig } from './build.mjs';
import { FRONT, frontCut } from './front.mjs';
import { decodePng, encodePng } from './png.mjs';
import { alphaMask, blankImage, compositeOver, cutout } from './raster.mjs';

export const VIEW_GENERATOR = 'prototype/motion/prep/views@1';
/** Head / trunk split of the side re-cut, px along the head bone from the head joint. */
const SPLIT = { headKeepsBelow: 16, trunkKeepsAbove: 6 };

const here = dirname(fileURLToPath(import.meta.url)),
  repository = resolve(here, '../../..'),
  lab = resolve(repository, 'prototype/character-lab');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const round = (value, digits = 4) => Number(value.toFixed(digits));
const readJson = (path) => JSON.parse(readFileSync(resolve(repository, path), 'utf8'));

function sideJoints(landmarks) {
  const J = Object.fromEntries(landmarks.joints.map((j) => [j.name, j]));
  const p = (name, key = 'point') => [J[name][key].x, J[name][key].y];
  return { J, p };
}

/** Reference heights of the Character Lab spine joints on the side sheet (y, px). */
function sideReference(landmarks, bodyTop) {
  const { p } = sideJoints(landmarks);
  return {
    ground: p('root')[1],
    pelvis: p('pelvis')[1],
    spine: p('spine_mid')[1],
    chest: (p('upper_arm_L')[1] + p('upper_arm_R')[1]) / 2,
    neck: p('neck')[1],
    head: p('head')[1],
    headTop: bodyTop,
  };
}

/** Split the side trunk part at the head joint so the head can pick its own view. */
function splitHead(cut, { landmarks }) {
  const { p } = sideJoints(landmarks),
    joint = p('head'),
    end = p('head', 'end'),
    l = Math.hypot(end[0] - joint[0], end[1] - joint[1]),
    n = [(end[0] - joint[0]) / l, (end[1] - joint[1]) / l],
    k = cut.parts.findIndex((part) => part.name === 'trunk'),
    trunk = cut.parts[k],
    { width, height } = trunk.image,
    headMask = new Uint8Array(width * height),
    trunkMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const s = (x - joint[0]) * n[0] + (y - joint[1]) * n[1];
      headMask[y * width + x] = s > -SPLIT.headKeepsBelow ? 1 : 0;
      trunkMask[y * width + x] = s < SPLIT.trunkKeepsAbove ? 1 : 0;
    }
  const parts = cut.parts.slice();
  parts.splice(
    k,
    1,
    { ...trunk, image: cutout(trunk.image, trunkMask) },
    { ...trunk, name: 'head', image: cutout(trunk.image, headMask) },
  );
  return { ...cut, parts };
}

function buildSide(id, character, view, debug) {
  const spec = character[view],
    base = readJson(spec.config),
    config = { ...base, ...(spec.source ? { source: spec.source } : {}), hints: { ...base.hints, ...spec.hints } },
    out = resolve(lab, 'rigs', id, view);
  const result = buildCharacter(id, {
    config,
    out,
    transform: splitHead,
    extraMeta: (cut) => {
      const landmarks = typeof config.landmarks === 'string' ? readJson(config.landmarks) : config.landmarks,
        { p } = sideJoints(landmarks),
        // Body top is not known here; the spine parameters only need pelvis..head.
        reference = sideReference(landmarks, 0),
        stops = [reference.pelvis, reference.spine, reference.chest, reference.neck, reference.head],
        // Height on the sheet -> parameter along pelvis(0) spine(1) chest(2) neck(3) head(4).
        param = (y) => {
          for (let i = 0; i < 4; i++)
            if (y >= stops[i + 1] || i === 3) return round(i + (stops[i] - y) / (stops[i] - stops[i + 1]), 4);
          return 4;
        };
      // Wrist width of the hand drawings as placed on the figure (they point +x,
      // so it is the opaque run of the column at the wrist), median of the three.
      const widths = cut.parts
        .filter((part) => part.group === 'hand')
        .map((part, n) => {
          const [wx] = landmarks.registration.wrists[n],
            { width, height, data } = part.image;
          let count = 0;
          for (let y = 0; y < height; y++) if (data[(y * width + Math.round(wx) + 6) * 4 + 3] > 128) count++;
          const a = part.place(0, 0),
            b = part.place(0, 100);
          return (count * Math.hypot(b[0] - a[0], b[1] - a[1])) / 100;
        })
        .sort((p, q) => p - q);
      return {
        lab: {
          view,
          generator: VIEW_GENERATOR,
          split: SPLIT,
          wristWidth: round(widths[widths.length >> 1] ?? 0, 1),
          spine: Object.fromEntries(
            ['pelvis', 'spine_lower', 'spine_mid', 'chest', 'neck'].map((name) => [name, [param(p(name)[1]), param(p(name, 'end')[1])]]),
          ),
        },
      };
    },
  });
  if (debug) debugBind(id, view, result.rig, out);
  return result;
}

function sideProportionInputs(id, character) {
  const base = readJson(character.side.config),
    landmarks = typeof base.landmarks === 'string' ? readJson(base.landmarks) : base.landmarks,
    rig = JSON.parse(readFileSync(resolve(lab, 'rigs', id, 'side/rig.json'), 'utf8')),
    reference = sideReference(landmarks, rig.meta.sheetOrigin[1] - rig.meta.heightPx);
  return { landmarks, rig, reference };
}

function buildFront(id, character, view, debug) {
  // The front cut takes its vertical proportions from the side rig.
  if (!existsSync(resolve(lab, 'rigs', id, 'side/rig.json'))) buildSide(id, character, 'side', false);
  const spec = character.front,
    sheetFile = readFileSync(resolve(repository, spec.sheet)),
    landmarkFile = readFileSync(resolve(repository, spec.landmarks)),
    skin = JSON.parse(landmarkFile.toString('utf8'))[spec.landmarksKey ?? id].skin,
    { reference } = sideProportionInputs(id, character),
    side = {
      shoulderToGround: reference.ground - reference.chest,
      pelvisToGround: reference.ground - reference.pelvis,
      neck: reference.chest - reference.head,
      neckBase: (reference.chest - reference.neck) / (reference.chest - reference.head),
      headLen: reference.head - reference.headTop,
      spine: reference.pelvis - reference.spine,
      chestLen: reference.spine - reference.chest,
    },
    cut = frontCut(decodePng(sheetFile), skin, side, spec.overrides ?? {}, view),
    built = assembleRig(cut, {
      width: cut.width,
      heightPx: round(cut.heightPx, 2),
      meta: (placement) => ({
        id,
        generator: VIEW_GENERATOR,
        derived: true,
        note:
          view === 'back'
            ? 'STAND-IN. The front parts with the trunk above the waist and the head flat-filled inside their own outlines. Not a drawn back view.'
            : 'Derived cut of the front parts sheet: sticker contour removed, parts scaled to one figure, joints from the sheet geometry and the side view proportions.',
        inputs: [{ path: spec.sheet, sha256: sha256(sheetFile) }],
        landmarks: { path: spec.landmarks, key: spec.landmarksKey ?? id, sha256: sha256(landmarkFile) },
        hints: spec.overrides ?? {},
        facing: 0,
        ...placement,
        front: cut.tunables,
        notes: cut.notes,
        lab: {
          view,
          generator: VIEW_GENERATOR,
          spine: { pelvis: [0, 1], spine: [1, 2], chest: [2, 3], neck: [3, 4] },
          wristWidth: round(cut.wristWidth, 1),
          joints: Object.fromEntries(
            Object.entries(cut.joints).map(([name, point]) => [
              name,
              [round(point[0] - placement.sheetOrigin[0], 2), round(point[1] - placement.sheetOrigin[1], 2)],
            ]),
          ),
        },
      }),
    }),
    out = resolve(lab, 'rigs', id, view);
  writeRig(out, built);
  if (debug) debugBind(id, view, built.rig, out, cut);
  return { rig: built.rig, notes: cut.notes, out };
}

/** Bind-pose composite of the cut parts, for eyeballing the assembly. */
function debugBind(id, view, rig, out, cut) {
  if (!cut) return;
  const folder = resolve(repository, 'work/qa/character-lab/views/debug');
  mkdirSync(folder, { recursive: true });
  const bind = blankImage(cut.width, FRONT.canvas[1]);
  for (const part of cut.parts) compositeOver(bind, part.image);
  // Joint markers.
  for (const point of Object.values(cut.joints))
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = Math.round(point[0]) + dx,
          y = Math.round(point[1]) + dy;
        if (x < 0 || y < 0 || x >= bind.width || y >= bind.height) continue;
        bind.data.set(Math.abs(dx) === 3 || Math.abs(dy) === 3 ? [0, 0, 0, 255] : [0, 255, 255, 255], (y * bind.width + x) * 4);
      }
  writeFileSync(resolve(folder, `bind-${id}-${view}.png`), encodePng(bind));
}

/** Proportions (metres) from the drawings' landmarks: lengths from the side
 * view, shoulder and hip widths from the front view. */
function writeProportions(id, character) {
  const sidePath = resolve(lab, 'rigs', id, 'side/rig.json'),
    frontPath = resolve(lab, 'rigs', id, 'front/rig.json');
  if (!existsSync(sidePath) || !existsSync(frontPath)) return null;
  const { landmarks, rig, reference } = sideProportionInputs(id, character),
    { p } = sideJoints(landmarks),
    height = character.height ?? 1.73,
    m = height / rig.meta.heightPx,
    near = (rig.meta.hints.nearSide ?? 'L') === 'R' ? 'R' : 'L',
    length = (name) => Math.hypot(p(name, 'end')[0] - p(name)[0], p(name, 'end')[1] - p(name)[1]),
    both = (name) => (length(`${name}_L`) + length(`${name}_R`)) / 2,
    front = JSON.parse(readFileSync(frontPath, 'utf8')),
    fm = height / front.meta.heightPx,
    fj = front.meta.lab.joints,
    palm = p('throwing_hand'),
    wrist = p(`hand_${near}`),
    footLen = ['L', 'R'].reduce((n, s) => n + Math.abs(p(`toe_${s}`)[0] - p(`heel_${s}`)[0]), 0) / 2,
    ankleHeight = ['L', 'R'].reduce((n, s) => n + (Math.max(p(`heel_${s}`)[1], p(`toe_${s}`)[1]) - p(`foot_${s}`)[1]), 0) / 2,
    proportions = {
      height,
      pelvisHeight: round((reference.ground - reference.pelvis) * m),
      spine: round((reference.pelvis - reference.spine) * m),
      chestLen: round((reference.spine - reference.chest) * m),
      neck: round((reference.chest - reference.head) * m),
      headLen: round((reference.head - reference.headTop) * m),
      shoulderWidth: round(Math.abs(fj.shoulderL[0] - fj.shoulderR[0]) * fm),
      hipWidth: round(Math.abs(fj.hipL[0] - fj.hipR[0]) * fm),
      upperArm: round(length(`upper_arm_${near}`) * m),
      forearm: round(length(`forearm_${near}`) * m),
      // wrist -> fingertips; the palm centre (the drawn grip socket) is at half of it.
      hand: round(2 * Math.hypot(palm[0] - wrist[0], palm[1] - wrist[1]) * m),
      thigh: round(both('thigh') * m),
      shin: round(both('shin') * m),
      footLen: round(footLen * m),
      ankleHeight: round(ankleHeight * m),
      // Not in the Proportions contract; kept so nothing has to be guessed.
      _extra: {
        neckBaseFraction: round((reference.chest - reference.neck) / (reference.chest - reference.head)),
        definitions:
          'pelvisHeight + spine + chestLen + neck + headLen = height. spine = pelvis->spine joint, chestLen = spine->chest (shoulder line), neck = chest->head joint (skull base; on the drawing the neck base sits neckBaseFraction of the way up), headLen = head joint->crown. upperArm/forearm from the drawn throwing arm, hand = 2 x (wrist->drawn palm socket) so the palm centre is at half, thigh/shin = mean of both drawn legs, footLen = heel->toe, ankleHeight = ankle above the sole.',
        sources: { side: rig.meta.landmarks.path ?? 'inline', front: front.meta.landmarks.path },
        sidePxPerMetre: round(1 / m, 2),
        frontPxPerMetre: round(1 / fm, 2),
      },
    };
  writeFileSync(resolve(lab, 'rigs', id, 'proportions.json'), JSON.stringify(proportions, null, 2) + '\n');
  return proportions;
}

function writeViews(id, character) {
  const has = (view) => existsSync(resolve(lab, 'rigs', id, view, 'rig.json')),
    views = {
      id,
      generator: VIEW_GENERATOR,
      note: 'Canonical angles are the block yaw relative to the camera: side 0 (faces screen right), front +90, back -90. The other half-circle is the mirror. See views/poser.ts for the selection rule.',
      views: {
        side: {
          rig: 'side/rig.json',
          standIn: false,
          source: character.side ? readJson(character.side.config).source : null,
          note: 'Drawn right profile, re-cut by the side pipeline.',
        },
        sideRear: has('sideRear')
          ? {
              rig: 'sideRear/rig.json',
              standIn: false,
              source: character.sideRear.source,
              note: 'The same profile with the garment redrawn as seen from behind. Used for the left-facing (mirrored) profile so chest prints are never shown mirrored.',
            }
          : null,
        front: {
          rig: 'front/rig.json',
          standIn: false,
          source: character.front.sheet,
          note: 'Drawn front parts sheet. The trunk, arms and legs are true front drawings; the HEAD on that sheet is a three-quarter-front head, so a dead-on front face is a stand-in.',
          headStandIn: {
            standIn: true,
            reason: 'The only front-ish head is drawn three-quarter, looking to its left.',
            replaceWith: 'A dead-on front head (hair/cap, both ears, neck stub) on the parts sheet.',
          },
        },
        back: {
          rig: 'back/rig.json',
          standIn: true,
          reason: 'No back drawing exists. The tools reuse the front parts mirrored, with the shirt above the waist and the head flat-filled inside their own outlines.',
          replaceWith: 'A back parts sheet in the same layout as the front one: trunk from behind (shirt back, shorts seat), back of the head, two arms and two legs seen from behind.',
        },
        threeQuarterFront: {
          rig: 'front/rig.json',
          standIn: true,
          reason: 'No three-quarter body drawing exists. The front parts are narrowed by the projection (shoulder and hip width follow the 3D skeleton); the head is the true three-quarter head.',
          replaceWith: 'A three-quarter-front parts sheet (45 degrees): trunk, near and far arm, near and far leg.',
        },
        threeQuarterBack: {
          rig: 'back/rig.json',
          standIn: true,
          reason: 'No three-quarter-back drawing exists. The back stand-in narrowed by the projection.',
          replaceWith: 'A three-quarter-back parts sheet (135 degrees), same layout.',
        },
      },
    };
  writeFileSync(resolve(lab, 'rigs', id, 'views.json'), JSON.stringify(views, null, 2) + '\n');
}

export function buildView(id, view, { debug = false } = {}) {
  const character = readJson(`prototype/character-lab/characters/${id}.json`),
    list = view === 'all' ? ['side', ...(character.sideRear ? ['sideRear'] : []), 'front', 'back'] : [view];
  for (const name of list) {
    const started = Date.now();
    let result;
    if (name === 'side' || name === 'sideRear') result = buildSide(id, character, name, debug);
    else if (name === 'front' || name === 'back') result = buildFront(id, character, name, debug);
    else throw new Error(`unknown view ${name}`);
    console.log(`${id} ${name}: ${result.rig.parts.length} parts, ${result.rig.parts.reduce((n, p) => n + p.xy.length / 2, 0)} vertices, atlas ${result.rig.atlas.width}x${result.rig.atlas.height}, height ${result.rig.meta.heightPx}px -> ${result.out} (${Date.now() - started} ms)`);
    for (const note of result.notes) console.log(`  ${note}`);
  }
  const proportions = writeProportions(id, character);
  if (proportions) console.log(`${id} proportions: ${JSON.stringify({ ...proportions, _extra: undefined })}`);
  writeViews(id, character);
}
