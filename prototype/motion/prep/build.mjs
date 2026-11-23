// One command per character:  node prototype/motion/prep/build.mjs <id> [--debug]
// Reads prototype/motion/characters/<id>.json, re-cuts the source sheet and
// writes prototype/motion/rigs/<id>/{atlas.png,rig.json}. Deterministic; the
// source assets are only read.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './png.mjs';
import { alphaMask, blankImage, bleed, bounds, compositeOver, dilate } from './raster.mjs';
import { RECUT, recut } from './recut.mjs';

export const GENERATOR = 'prototype/motion/prep@1';
/** Atlas and mesh layout, in pixels. */
const LAYOUT = {
  cell: 12, // mesh grid pitch
  pad: 4, // transparent margin kept around every island
  gutter: 4, // extra space between islands
  bleed: 4, // colour dilation into the transparent margin
  atlasWidth: 1536,
};

const here = dirname(fileURLToPath(import.meta.url)),
  repository = resolve(here, '../../..'),
  motion = resolve(here, '..');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const round = (value, digits) => Number(value.toFixed(digits));

function loadSheet(config) {
  const file = readFileSync(resolve(repository, config.source)),
    sheet = decodePng(file),
    inputs = [{ path: config.source, sha256: sha256(file) }];
  // Optional replacement regions (the isolated limbs were redrawn on a second
  // sheet with the same layout).
  for (const overlay of config.overlays ?? []) {
    const overlayFile = readFileSync(resolve(repository, overlay.image)),
      image = decodePng(overlayFile),
      [x0, y0, w, h] = overlay.rect;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const o = (y * sheet.width + x) * 4;
        for (let c = 0; c < 4; c++) sheet.data[o + c] = image.data[o + c];
      }
    inputs.push({ path: overlay.image, sha256: sha256(overlayFile), rect: overlay.rect });
  }
  return { sheet, inputs };
}

/** Regular grid mesh over the part's opaque pixels, in sheet coordinates. */
function meshPart(part, boneIndex, origin) {
  const { width, height } = part.image,
    mask = alphaMask(part.image),
    box = bounds(mask, width),
    x0 = Math.max(0, box.x0 - LAYOUT.pad),
    y0 = Math.max(0, box.y0 - LAYOUT.pad),
    x1 = Math.min(width, box.x1 + 1 + LAYOUT.pad),
    y1 = Math.min(height, box.y1 + 1 + LAYOUT.pad),
    columns = Math.max(1, Math.ceil((x1 - x0) / LAYOUT.cell)),
    rows = Math.max(1, Math.ceil((y1 - y0) / LAYOUT.cell)),
    xs = Array.from({ length: columns + 1 }, (_, i) => x0 + ((x1 - x0) * i) / columns),
    ys = Array.from({ length: rows + 1 }, (_, i) => y0 + ((y1 - y0) * i) / rows),
    wide = dilate(mask, width, height, 2),
    vertexOf = new Int32Array((columns + 1) * (rows + 1)).fill(-1),
    vertices = [],
    triangles = [];
  const vertex = (cx, cy) => {
    const key = cy * (columns + 1) + cx;
    if (vertexOf[key] < 0) {
      vertexOf[key] = vertices.length;
      vertices.push([xs[cx], ys[cy]]);
    }
    return vertexOf[key];
  };
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < columns; cx++) {
      let used = false;
      for (let y = Math.floor(ys[cy]); y < Math.ceil(ys[cy + 1]) && !used; y++)
        for (let x = Math.floor(xs[cx]); x < Math.ceil(xs[cx + 1]); x++)
          if (wide[y * width + x]) {
            used = true;
            break;
          }
      if (!used) continue;
      const a = vertex(cx, cy),
        b = vertex(cx + 1, cy),
        c = vertex(cx + 1, cy + 1),
        d = vertex(cx, cy + 1);
      triangles.push(a, b, c, a, c, d);
    }
  const xy = [],
    indices = [],
    weights = [];
  for (const [x, y] of vertices) {
    const [bx, by] = part.place(x, y),
      entries = Object.entries(part.weights(bx, by));
    xy.push(round(bx - origin[0], 2), round(by - origin[1], 2));
    for (let k = 0; k < 4; k++) {
      indices.push(entries[k] ? boneIndex[entries[k][0]] : 0);
      weights.push(entries[k] ? round(entries[k][1], 4) : 0);
    }
  }
  return { island: { x0, y0, width: x1 - x0, height: y1 - y0 }, vertices, xy, indices, weights, triangles };
}

/** Shelf packing, tallest first; stable for a given part list. */
function pack(meshes) {
  const order = meshes.map((_, i) => i).sort(
    (a, b) => meshes[b].island.height - meshes[a].island.height || a - b,
  );
  let x = LAYOUT.gutter,
    y = LAYOUT.gutter,
    shelf = 0;
  for (const i of order) {
    const island = meshes[i].island;
    if (x + island.width + LAYOUT.gutter > LAYOUT.atlasWidth) {
      x = LAYOUT.gutter;
      y += shelf + LAYOUT.gutter;
      shelf = 0;
    }
    island.atlasX = x;
    island.atlasY = y;
    x += island.width + LAYOUT.gutter;
    shelf = Math.max(shelf, island.height);
  }
  return { width: LAYOUT.atlasWidth, height: y + shelf + LAYOUT.gutter };
}

export function buildCharacter(id, { debug = false } = {}) {
  const configPath = resolve(motion, 'characters', `${id}.json`),
    config = JSON.parse(readFileSync(configPath, 'utf8')),
    { sheet, inputs } = loadSheet(config);
  let landmarks = config.landmarks,
    landmarksInfo = { inline: true };
  if (typeof landmarks === 'string') {
    const file = readFileSync(resolve(repository, landmarks));
    landmarksInfo = { path: landmarks, sha256: sha256(file) };
    landmarks = JSON.parse(file.toString('utf8'));
  }
  const cut = recut(sheet, landmarks, config.hints ?? {}),
    origin = cut.bones[0].point,
    boneIndex = Object.fromEntries(cut.bones.map((bone, i) => [bone.name, i])),
    meshes = cut.parts.map((part) => meshPart(part, boneIndex, origin)),
    size = pack(meshes),
    atlas = blankImage(size.width, size.height);
  cut.parts.forEach((part, k) => {
    const { x0, y0, width, height, atlasX, atlasY } = meshes[k].island;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const from = ((y0 + y) * sheet.width + x0 + x) * 4,
          to = ((atlasY + y) * size.width + atlasX + x) * 4;
        for (let c = 0; c < 4; c++) atlas.data[to + c] = part.image.data[from + c];
      }
  });
  bleed(atlas, LAYOUT.bleed);
  const bodyBox = bounds(cut.body, sheet.width),
    rig = {
      format: 'arena-cutout-rig',
      version: 1,
      meta: {
        id,
        generator: GENERATOR,
        derived: true,
        note: 'Derived re-cut of the source sheet. Hidden surfaces (thigh tops, far upper arm, far shorts leg, trunk under the sleeve) are generated; see prototype/motion/README.md.',
        inputs,
        landmarks: landmarksInfo,
        hints: config.hints ?? {},
        facing: cut.facing,
        heightPx: origin[1] - bodyBox.y0,
        sheetOrigin: origin,
        // Sheet-pixel boxes used by the bind-pose comparison.
        bodyBox: [bodyBox.x0, bodyBox.y0, bodyBox.x1, bodyBox.y1],
        sleeveCutBox: cut.sleeveCutBox,
        recut: RECUT,
        layout: LAYOUT,
        notes: cut.notes,
      },
      atlas: { image: 'atlas.png', width: size.width, height: size.height },
      bones: cut.bones.map((bone) => ({
        name: bone.name,
        parent: bone.parent,
        x: round(bone.point[0] - origin[0], 2),
        y: round(bone.point[1] - origin[1], 2),
        rotation: bone.end
          ? round(Math.atan2(bone.end[1] - bone.point[1], bone.end[0] - bone.point[0]), 5)
          : 0,
        length: bone.end
          ? round(Math.hypot(bone.end[0] - bone.point[0], bone.end[1] - bone.point[1]), 2)
          : 0,
      })),
      sockets: cut.sockets.map((socket) => ({
        name: socket.name,
        bone: socket.bone,
        x: round(socket.point[0] - origin[0], 2),
        y: round(socket.point[1] - origin[1], 2),
      })),
      parts: cut.parts.map((part, k) => {
        const mesh = meshes[k],
          { x0, y0, atlasX, atlasY } = mesh.island;
        return {
          name: part.name,
          visible: part.visible ?? true,
          ...(part.group ? { group: part.group } : {}),
          xy: mesh.xy,
          uv: mesh.vertices.flatMap(([x, y]) => [
            round((atlasX + x - x0) / size.width, 6),
            round((atlasY + y - y0) / size.height, 6),
          ]),
          bones: mesh.indices,
          weights: mesh.weights,
          triangles: mesh.triangles,
        };
      }),
    };
  const out = resolve(motion, 'rigs', id);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'atlas.png'), encodePng(atlas));
  writeFileSync(resolve(out, 'rig.json'), JSON.stringify(rig));
  if (debug) {
    const folder = resolve(repository, 'work/qa/reimagine/pass-b/debug', id);
    mkdirSync(folder, { recursive: true });
    const bind = blankImage(sheet.width, sheet.height);
    for (const part of cut.parts) {
      writeFileSync(resolve(folder, `part-${part.name}.png`), encodePng(part.image));
      if (part.place(10, 10)[0] === 10 && (part.visible ?? true)) compositeOver(bind, part.image);
    }
    writeFileSync(resolve(folder, 'bind-body-parts.png'), encodePng(bind));
    writeFileSync(resolve(folder, 'keyed.png'), encodePng(cut.keyed));
  }
  return { rig, notes: cut.notes, out };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ids = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (!ids.length) {
    console.error('usage: node prototype/motion/prep/build.mjs <character id> [--debug]');
    process.exit(1);
  }
  for (const id of ids) {
    const started = Date.now(),
      { rig, notes, out } = buildCharacter(id, { debug: process.argv.includes('--debug') });
    console.log(`${id}: ${rig.parts.length} parts, ${rig.parts.reduce((n, p) => n + p.xy.length / 2, 0)} vertices, atlas ${rig.atlas.width}x${rig.atlas.height} -> ${out} (${Date.now() - started} ms)`);
    for (const note of notes) console.log(`  ${note}`);
  }
}
